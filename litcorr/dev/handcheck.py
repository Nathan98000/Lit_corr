"""`handcheck`: hand-check sheets for the rule-based classifiers, using only the masked view.

  python -m litcorr.dev.handcheck make CLASSIFIER SHEET --sample SAMPLE [--n 50] [--seed 1]
  python -m litcorr.dev.handcheck show SHEET [--items 1-10]
  python -m litcorr.dev.handcheck judge SHEET "1:ok 2:error:missed_split 3:ok ..."
  python -m litcorr.dev.handcheck score [SHEET ...]

Classifiers (one item = what is judged):
  quote_mode      story: is the quotation style (double / single / none) right?
  dialogue_spans  paragraph with quote characters: are the quoted spans (⟪ ⟫) exactly the speech?
  sentences       paragraph with at least one candidate boundary: are all sentence boundaries right?
  scene_breaks    paragraph: detected breaks (precision) and short / symbol-only paragraphs (recall)
  paratext        first or last paragraph: is the pipeline's paratext label right (author note, feedback request,
                  heading, "to be continued", none)?
  pov             story: first / second / third / mixed / unknown
  tense           story: present / past / mixed / unknown
  commands        quoted passage: is the 'command' decision right?

Sheets live in data/dev/handchecks/SHEET.tsv with columns item, classifier, story_key, locator, decision,
judgement (ok | error | skip), error_type, note. `score` reports accuracy with a Wilson 95% interval and the
error types. Items are drawn reproducibly from a review sample, so the same procedure can be repeated on stories
collected later (draw the sample with review_sample --only-new-since / --exclude-sample).
"""

from __future__ import annotations

import argparse
import math
import random
import re
from pathlib import Path

import numpy as np
import pandas as pd

from ..text.doc import TOKEN_RE, TextDoc, quote_mode, quote_spans
from ..text.features import _SCENE_BREAK, FP_SING, SECOND, MASC, FEM, NEUTRAL, PAST_FORMS, PRESENT_FORMS, Measurer
from ..text.lexicons import load_all
from .common import dev_dir, load_features, load_texts, paragraphs_of, settings
from .inspect_text import pipeline_para_tags
from .mask import format_views, render
from .review_sample import load_sample

CLASSIFIERS = ("quote_mode", "dialogue_spans", "sentences", "scene_breaks", "paratext", "pov", "tense", "commands")
COLUMNS = ["item", "classifier", "story_key", "locator", "decision", "judgement", "error_type", "note"]
_CANDIDATE_END = re.compile(r"[.!?…]+[\"'”’)\]]*\s+\S")


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return float("nan"), float("nan")
    p = k / n
    den = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / den
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return max(0.0, centre - half), min(1.0, centre + half)


def sheet_path(name: str) -> Path:
    return dev_dir(settings()) / "handchecks" / f"{name}.tsv"


def _load(name: str) -> pd.DataFrame:
    return pd.read_csv(sheet_path(name), sep="\t", dtype=str, keep_default_na=False)


def _save(df: pd.DataFrame, name: str) -> None:
    p = sheet_path(name)
    p.parent.mkdir(parents=True, exist_ok=True)
    df[COLUMNS].to_csv(p, sep="\t", index=False)


# ------------------------------------------------------------------------------------------- items
def make_items(classifier: str, stories: pd.DataFrame, feats: pd.DataFrame, n: int, seed: int) -> list[dict]:
    rng = random.Random(f"{classifier}:{seed}")
    f = feats.set_index("story_key")
    items: list[dict] = []
    rows = list(stories.itertuples(index=False))
    rng.shuffle(rows)
    if classifier in ("quote_mode", "pov", "tense"):
        col = {"quote_mode": "qc_quote_style", "pov": "pov_class", "tense": "narr_tense_class"}[classifier]
        for r in rows[:n]:
            items.append({"story_key": r.story_key, "locator": "story", "decision": str(f.loc[r.story_key, col])})
        return items
    per_story = max(1, math.ceil(n / max(1, len(rows))))
    for r in rows:
        paras = paragraphs_of(r.text)
        cands: list[tuple[str, str]] = []
        if classifier == "dialogue_spans":
            mode = quote_mode(paras)
            for i, p in enumerate(paras):
                if any(c in p for c in "\"“”‘’'") and (mode != "none" or '"' in p or "“" in p):
                    spans, bal = quote_spans(p, mode)
                    cands.append((f"p{i}", f"{len(spans)} span(s), mode {mode}{'' if bal else ', unbalanced'}"))
        elif classifier == "sentences":
            for i, p in enumerate(paras):
                if _CANDIDATE_END.search(p):
                    cands.append((f"p{i}", "split as shown"))
        elif classifier == "scene_breaks":
            for i, p in enumerate(paras):
                q = p.strip()
                detected = bool(_SCENE_BREAK.match(q))
                ntok = len(TOKEN_RE.findall(q))
                if detected:
                    cands.append((f"p{i}", "scene break"))
                elif ntok == 0 or (ntok <= 3 and not re.search(r"[.!?\"”]$", q)):
                    cands.append((f"p{i}", "not a scene break"))
        elif classifier == "paratext":
            tags = pipeline_para_tags(paras)
            for i in sorted(set(range(min(2, len(paras)))) | set(range(max(0, len(paras) - 2), len(paras)))):
                lab = [t.split(":", 1)[1] for t in tags.get(i, []) if t.startswith("PARATEXT:")]
                cands.append((f"p{i}", lab[0] if lab else "story text"))
        elif classifier == "commands":
            doc = TextDoc(paras)
            m = Measurer()
            flagged = set(_command_segments(m, doc))
            for k, (first, count, has_q) in enumerate(doc.segment_info):
                cands.append((f"seg{k}@p{int(doc.para_idx[first])}", "command" if k in flagged else "not a command"))
        rng.shuffle(cands)
        for loc, dec in cands[:per_story]:
            items.append({"story_key": r.story_key, "locator": loc, "decision": dec})
        if len(items) >= n:
            break
    return items[:n]


def _command_segments(m: Measurer, doc: TextDoc) -> list[int]:
    """Indices of the quoted passages the pipeline counts as commands (mirrors Measurer._agency)."""
    from ..text.features import _FILLERS, _NAME_SHAPE

    toks, out = doc.tokens, []
    for k, (first, count, has_q) in enumerate(doc.segment_info):
        if has_q:
            continue
        j, end, steps = first, first + count, 0
        while j < end and steps < 3 and (toks[j] in _FILLERS or (
                _NAME_SHAPE.match(doc.orig[j]) and toks[j] not in m.stop and toks[j] not in m.imperatives
                and doc.comma_after[j] and j + 1 < end)):
            j += 1
            steps += 1
        if j < end and toks[j] in m.imperatives:
            if toks[j] in ("don't", "do") and j + 1 < end and toks[j + 1] in ("you", "i", "we", "they"):
                continue
            out.append(k)
    return out


# ------------------------------------------------------------------------------------------- show
def show_item(row: pd.Series, text: str, feats_row: pd.Series, lex) -> str:
    paras = paragraphs_of(text)
    c = row["classifier"]
    head = f"#{row['item']} [{c}] story {row['story_key']} {row['locator']} -> pipeline: {row['decision']}"
    tags = pipeline_para_tags(paras)
    if c in ("pov", "tense"):
        doc = TextDoc(paras)
        narr = ~doc.in_quote
        toks = np.array(doc.tokens, dtype=object)
        nt = toks[narr]
        cnt = {"I-forms": sum(t in FP_SING for t in nt), "you-forms": sum(t in SECOND for t in nt),
               "he/she/they": sum(t in MASC or t in FEM or t in NEUTRAL for t in nt),
               "present": sum(t in PRESENT_FORMS for t in nt), "past": sum(t in PAST_FORMS for t in nt)}
        info = (f"   narration words {int(narr.sum())}; " + ", ".join(f"{k} {v}" for k, v in cnt.items()) +
                f"; pov_first_person_share {feats_row.get('pov_first_person_share'):.2f}"
                f"; present share {feats_row.get('narr_present_tense_share')}")
        # three narration-heavy paragraphs spread through the story
        words = np.array([len(TOKEN_RE.findall(p)) for p in paras])
        order = [i for i in np.argsort(-words) if words[i] >= 25][:12]
        pick = sorted(order[:: max(1, len(order) // 3)][:3])
        body = "\n".join(format_views(render(paras, lexicons=lex, overlay=False, paras=(i, i + 1)), False)
                         for i in pick)
        return f"{head}\n{info}\n{body}"
    if c == "quote_mode":
        text_all = "\n".join(paras)
        info = "   counts: " + ", ".join(f"{q!r} {text_all.count(q)}" for q in ['"', "“", "”", "'", "‘", "’"])
        quoted = [i for i, p in enumerate(paras) if any(ch in p for ch in "\"“”‘’")]
        pick = quoted[:: max(1, len(quoted) // 2)][:2] if quoted else list(range(min(2, len(paras))))
        body = "\n".join(format_views(render(paras, lexicons=lex, paras=(i, i + 1), para_tags=tags), False)
                         for i in pick)
        return f"{head}\n{info}\n{body}"
    m = re.search(r"p(\d+)", row["locator"])
    i = int(m.group(1)) if m else 0
    lo, hi = (i - 1, i + 2) if c in ("scene_breaks", "paratext") else (i, i + 1)
    lex_names = ["imperative_verbs"] if c == "commands" else None
    views = render(paras, lexicons=lex, paras=(max(0, lo), hi), para_tags=tags, lex_names=lex_names)
    return f"{head}\n{format_views(views, per_sentence=(c != 'scene_breaks'))}"


def _parse_items(spec: str | None, n: int) -> list[int]:
    if not spec:
        return list(range(1, n + 1))
    out: list[int] = []
    for part in spec.split(","):
        a, _, b = part.partition("-")
        out.extend(range(int(a), int(b or a) + 1))
    return out


def score(names: list[str]) -> pd.DataFrame:
    rows = []
    for name in names:
        d = _load(name)
        d = d[d["judgement"].isin(["ok", "error"])]
        for c, sub in d.groupby("classifier"):
            k, n = int((sub["judgement"] == "ok").sum()), len(sub)
            lo, hi = wilson(k, n)
            errs = sub.loc[sub["judgement"] == "error", "error_type"].value_counts().to_dict()
            rows.append({"sheet": name, "classifier": c, "n": n, "correct": k, "accuracy": k / n if n else np.nan,
                         "ci_low": lo, "ci_high": hi, "errors": "; ".join(f"{e or '?'} {v}" for e, v in errs.items())})
    return pd.DataFrame(rows)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m litcorr.dev.handcheck", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    mk = sub.add_parser("make")
    mk.add_argument("classifier", choices=CLASSIFIERS)
    mk.add_argument("sheet")
    mk.add_argument("--sample", required=True)
    mk.add_argument("--n", type=int, default=50)
    mk.add_argument("--seed", type=int, default=1)
    mk.add_argument("--strata-col", default=None, help="balance stories across this feature column's values")
    sh = sub.add_parser("show")
    sh.add_argument("sheet")
    sh.add_argument("--items", default=None)
    jd = sub.add_parser("judge")
    jd.add_argument("sheet")
    jd.add_argument("spec", help='"1:ok 2:error:type 3:skip" (a note may follow after a second colon-free "|")')
    sc = sub.add_parser("score")
    sc.add_argument("sheets", nargs="*")
    args = ap.parse_args(argv)
    s = settings()
    if args.cmd == "make":
        smp = load_sample(args.sample)
        feats = load_features(s)
        texts = load_texts(s, list(smp["story_key"]))
        stories = smp.merge(texts, on="story_key")
        if args.strata_col:  # interleave strata so every class is represented
            vals = feats.set_index("story_key")[args.strata_col].astype(str)
            stories["_s"] = stories["story_key"].map(vals)
            stories["_r"] = stories.groupby("_s").cumcount()
            stories = stories.sort_values(["_r", "_s"]).drop(columns=["_s", "_r"])
            items = []
            for r in stories.itertuples(index=False):
                col = {"pov": "pov_class", "tense": "narr_tense_class", "quote_mode": "qc_quote_style"}[args.classifier]
                items.append({"story_key": r.story_key, "locator": "story",
                              "decision": str(feats.set_index("story_key").loc[r.story_key, col])})
                if len(items) >= args.n:
                    break
        else:
            items = make_items(args.classifier, stories, feats, args.n, args.seed)
        df = pd.DataFrame(items)
        df.insert(0, "item", range(1, len(df) + 1))
        df.insert(1, "classifier", args.classifier)
        for col in ("judgement", "error_type", "note"):
            df[col] = ""
        _save(df, args.sheet)
        print(f"{len(df)} items -> {sheet_path(args.sheet)}")
    elif args.cmd == "show":
        d = _load(args.sheet)
        texts = load_texts(s, list(d["story_key"].unique())).set_index("story_key")["text"]
        feats = load_features(s).set_index("story_key")
        lex = load_all()
        for i in _parse_items(args.items, len(d)):
            row = d[d["item"] == str(i)]
            if row.empty:
                continue
            row = row.iloc[0]
            print(show_item(row, texts[row["story_key"]], feats.loc[row["story_key"]], lex))
            print()
    elif args.cmd == "judge":
        d = _load(args.sheet)
        for tok in args.spec.split():
            parts = tok.split(":")
            idx = d.index[d["item"] == parts[0]]
            if len(idx) != 1:
                raise SystemExit(f"no item {parts[0]}")
            d.loc[idx, "judgement"] = parts[1]
            d.loc[idx, "error_type"] = parts[2] if len(parts) > 2 else ""
        _save(d, args.sheet)
        print(d["judgement"].replace("", "(open)").value_counts().to_string())
    else:
        names = args.sheets or sorted(p.stem for p in (dev_dir(s) / "handchecks").glob("*.tsv"))
        t = score(names)
        with pd.option_context("display.width", 200, "display.max_colwidth", 80):
            print(t.to_string(index=False, float_format=lambda x: f"{x:.3f}") if len(t) else "nothing judged yet")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
