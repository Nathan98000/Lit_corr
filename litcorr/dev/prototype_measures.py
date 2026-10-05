"""`prototype_measures`: Phase 5 candidate measures, computed on the real corpus for the proposal only.

  python -m litcorr.dev.prototype_measures run        (computes every candidate, also on odd/even halves)
  python -m litcorr.dev.prototype_measures report     (summary table + known-group checks -> data/dev/proposal/)

These are NOT pipeline measures: nothing here reaches data/processed. The report gives, per candidate, its
distribution, the existing measure it correlates with most (Spearman, analysed stories), its correlation with
log story length, split-half reliability (odd vs even story paragraphs, stories of 1,000+ words, Spearman-Brown),
the known-group expectations written in WORKLOG Phase 5 before the run, and the compute cost per story.
Word lists for the prototypes are in litcorr/dev/proposal_lexicons/. Output is aggregate only.
"""

from __future__ import annotations

import argparse
import math
import os
import re
import time
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .common import dev_dir, load_features, load_texts, paragraphs_of, settings

PROTO_LEX_DIR = Path(__file__).parent / "proposal_lexicons"
NAN = float("nan")

SCENE_WINDOW, SCENE_STEP, SCENE_MIN_TERMS = 200, 50, 6  # a sex-dense stretch: >= 6 sexual terms in 200 words

_CONTINUED = re.compile(r"\b(?:to be continued|tbc|continued in|continues in|more to come|stay tuned|"
                        r"next (?:chapter|part|episode|installment|instalment)|part \w+ (?:coming|soon)|"
                        r"(?:chapter|part) \w+ (?:is )?coming soon|until next time)\b", re.I)
_MISSING_SPACE = re.compile(r"[a-z]{2,}[.,!?;:][A-Za-z]{2,}")
_URLISH = re.compile(r"https?:|www\.|@|\.(?:com|net|org|edu|gov|co|uk|io|txt|html?|jpg|png|pdf)\b", re.I)
_DOUBLED = re.compile(r"\b(the|a|an|to|of|and|in|on|at|is|was|for|it|with|as|his|her|my|your|their|our)\s+\1\b",
                      re.I)
_CONFUSIONS = [
    re.compile(r"\bits (?:a|an|not|been|so|the|like|ok|okay|just|too|going|gonna|all|true|over|time|getting|"
               r"really|never|always|only|very|almost|good|bad|fine|nice|great)\b", re.I),
    re.compile(r"\byour (?:welcome|going|gonna|so|not|the|a|an|being|doing|making|getting|really|very|too|"
               r"always|never|just|such|beautiful|amazing|crazy|kidding)\b", re.I),
    re.compile(r"\b(?:should|could|would|must|might) of\b", re.I),
    re.compile(r"\balot\b", re.I),
    re.compile(r"\btheir (?:is|are|was|were)\b", re.I),
    re.compile(r"\b(?:better|more|less|rather|other|bigger|smaller|harder|longer|faster|larger|greater|higher|"
               r"lower)\s+then\b", re.I),
]
_LOWER_AFTER_STOP = re.compile(r"(\w+)([.!?])\s+([a-z])")  # not after a closing quote: '"Why?" she asked'
_ELONGATED = re.compile(r"([a-z])\1\1", re.I)
_SPEAKER = re.compile(r"^\s*(?:[A-Z][\w'.-]*\s*){1,3}(?:\([^)]{0,30}\)\s*)?:\s+\S")  # "Anna: ...", "MR SMITH (softly): ..."
_ELONGATED_SKIP = frozenset({"www", "xxx", "zzz", "iii", "vvv"})
FP = {"i", "me", "my", "mine", "myself", "we", "us", "our", "ours", "i'm", "i've", "i'd", "i'll"}
SP = {"you", "your", "yours", "yourself", "you're", "you've", "you'd", "you'll"}
TP = {"he", "him", "his", "she", "her", "hers", "they", "them", "their", "himself", "herself", "themselves"}

_STATE: dict[str, Any] = {}


def _init() -> None:
    from ..text.features import Measurer
    from ..text.lexicons import load_lexicon

    _STATE["M"] = Measurer()
    from ..text.lexicons import LEXICON_DIR

    # the adopted lists moved to lexicons/ (Stage 1B, text pipeline 1.3); the rest stay here
    names = ("consent_checkin", "time_jumps", "reader_address", "humor_levity", "setting_home", "setting_public",
             "setting_outdoors")
    _STATE["P"] = {**{n: load_lexicon(LEXICON_DIR / f"{n}.txt") for n in names},
                   **{p.stem: load_lexicon(p) for p in sorted(PROTO_LEX_DIR.glob("*.txt"))}}


def _per_1k(k: float, n: int) -> float:
    return 1000.0 * k / n if n else NAN


def _scenes(sex: np.ndarray, n: int) -> dict[str, float]:
    names = ("sex_scene_count", "sex_scene_share", "sex_first_scene_position", "sex_scenes_per_10k",
             "sex_scene_concentration")
    if n < 2 * SCENE_WINDOW:
        return dict.fromkeys(names, NAN)
    c = np.concatenate([[0], np.cumsum(sex)])
    starts = np.arange(0, n - SCENE_WINDOW + 1, SCENE_STEP)
    dense = (c[starts + SCENE_WINDOW] - c[starts]) >= SCENE_MIN_TERMS
    covered = np.zeros(n, dtype=bool)
    for s in starts[dense]:
        covered[s:s + SCENE_WINDOW] = True
    runs = int(np.sum(covered[1:] & ~covered[:-1]) + covered[0])
    first = float(np.argmax(covered) / n) if covered.any() else NAN
    total = int(sex.sum())
    conc = float(sex[covered].sum() / total) if total >= 10 else NAN
    return dict(zip(names, (float(runs), float(covered.mean()), first, 10000.0 * runs / n, conc)))


def candidates(paragraphs: list[str], title: str | None, desc: str | None, full: bool,
               timing: dict[str, float]) -> dict[str, Any]:
    from ..text.doc import _ABBREV, TextDoc
    from ..text.features import _LY_NOT_ADVERB
    from ..text.lexicons import match

    M, P = _STATE["M"], _STATE["P"]
    out: dict[str, Any] = {}
    doc = TextDoc(paragraphs)
    n = doc.n
    if n == 0:
        return out
    pbt = doc.positions_by_type()

    def hits(lex) -> np.ndarray:
        return match(lex, doc.vocab, doc.type_ids, doc.para_idx, pbt)

    t = time.perf_counter()
    sex = np.maximum(np.maximum(hits(M.lex["sexual_anatomy"]), hits(M.lex["sexual_action"])),
                     hits(M.lex["sexual_general"]))
    timing["_sexual_hits"] += time.perf_counter() - t

    def timed(name: str, fn) -> None:
        t0 = time.perf_counter()
        r = fn()
        timing[name] += time.perf_counter() - t0
        if isinstance(r, dict):
            out.update(r)
        else:
            out[name] = r

    # openings and endings
    timed("open_dialogue", lambda: float(bool(doc.in_quote[0])))
    timed("open_sex_per_1k", lambda: _per_1k(int(sex[:500].sum()), min(500, n)) if n >= 250 else NAN)
    timed("end_dialogue", lambda: float(bool(doc.in_quote[-1])))
    # sex-scene structure
    timed("_scenes", lambda: _scenes(sex, n))
    def speaker_labels() -> float:
        labels = [p.split(":", 1)[0].split("(")[0].strip().lower() for p in paragraphs if _SPEAKER.match(p)]
        counts = {lab: labels.count(lab) for lab in set(labels)}
        return sum(c for c in counts.values() if c >= 3) / len(paragraphs)  # a label must recur (chat, script)

    timed("fmt_speaker_label_share", speaker_labels)
    # writing mechanics
    text = "\n".join(paragraphs)
    timed("mech_lowercase_i_per_1k", lambda: _per_1k(sum(o in ("i", "i'm", "i've", "i'd", "i'll")
                                                           for o in doc.orig), n))

    def lower_start() -> float:
        k = sum(1 for p in paragraphs if p[:1].isalpha() and p[:1].islower())
        for p in paragraphs:
            for m in _LOWER_AFTER_STOP.finditer(p):
                word = m.group(1).lower()
                if word not in _ABBREV and len(word) > 1:
                    k += 1
        return _per_1k(k, n)

    timed("mech_lowercase_start_per_1k", lower_start)
    def missing_space() -> float:
        k = 0
        for m in _MISSING_SPACE.finditer(text):
            a, b = text.rfind(" ", 0, m.start()) + 1, text.find(" ", m.end())
            if not _URLISH.search(text[a:b if b >= 0 else len(text)]):
                k += 1
        return _per_1k(k, n)

    timed("mech_missing_space_per_1k", missing_space)
    timed("mech_doubled_word_per_1k", lambda: _per_1k(len(_DOUBLED.findall(text)), n))
    timed("mech_confusions_per_1k", lambda: _per_1k(sum(len(r.findall(text)) for r in _CONFUSIONS), n))

    # dialogue craft
    def dialogue() -> dict[str, float]:
        sv = hits(M.lex["speech_verbs"]).astype(bool)
        q = doc.in_quote
        qpos = np.flatnonzero(q)
        tags: list[tuple[int, str]] = []
        if qpos.size:
            for j in np.flatnonzero(sv & ~q):
                k = np.searchsorted(qpos, j)
                near = [qpos[x] for x in (k - 1, k) if 0 <= x < qpos.size]
                if any(abs(int(x) - int(j)) <= 4 and doc.para_idx[x] == doc.para_idx[j] for x in near):
                    tags.append((int(j), doc.tokens[j]))
        r: dict[str, float] = {"dlg_tag_variety": float(len({w for _, w in tags[:20]})) if len(tags) >= 20 else NAN}
        if len(tags) >= 5:
            def adv(i: int) -> bool:
                w = doc.tokens[i] if 0 <= i < n else ""
                return w.endswith("ly") and len(w) >= 5 and w.isalpha() and w not in _LY_NOT_ADVERB \
                    and doc.sent_idx[i] == doc.sent_idx[j]
            k = 0
            for j, _ in tags:
                if adv(j + 1) or adv(j + 2) or adv(j - 1):
                    k += 1
            r["dlg_adverb_tag_share"] = k / len(tags)
        else:
            r["dlg_adverb_tag_share"] = NAN
        n_par = len(paragraphs)
        quoted = np.bincount(doc.para_idx, weights=q.astype(float), minlength=n_par)
        words = np.bincount(doc.para_idx, minlength=n_par)
        kinds = [("D" if quoted[i] > 0 else "N") for i in range(n_par) if words[i] > 0]
        d = kinds.count("D")
        bare = sum(1 for i in range(n_par) if words[i] > 0 and quoted[i] == words[i])
        r["dlg_bare_line_share"] = bare / d if d >= 5 else NAN
        switches = sum(1 for a, b in zip(kinds, kinds[1:]) if a != b)
        r["dlg_switches_per_1k"] = _per_1k(switches, n)
        m_ = len(kinds)
        p = d / m_ if m_ else 0
        expected = 2 * p * (1 - p) * (m_ - 1)
        r["dlg_alternation_index"] = switches / expected if d >= 5 and (m_ - d) >= 5 and expected > 0 else NAN
        return r

    timed("_dialogue", dialogue)
    # lexicon prototypes
    narr = ~doc.in_quote
    for name in ("consent_checkin", "time_jumps", "humor_levity", "setting_home", "setting_public",
                 "setting_outdoors", "intensifiers"):
        timed(name, lambda name=name: _per_1k(int(hits(P[name]).sum()), n))
    timed("reader_address", lambda: _per_1k(int((hits(P["reader_address"]).astype(bool) & narr).sum()),
                                            int(narr.sum())) if narr.sum() >= 200 else NAN)
    timed("style_elongated_per_1k", lambda: _per_1k(sum(1 for o in doc.orig if _ELONGATED.search(o)
                                                        and o.lower() not in _ELONGATED_SKIP), n))
    if full:
        timed("end_to_be_continued", lambda: float(any(_CONTINUED.search(p) for p in paragraphs[-3:])))
        for nm, s in (("title", title), ("desc", desc)):
            if isinstance(s, str) and s.strip():
                d2 = TextDoc([s])
                sx = sum(int(match(M.lex[x], d2.vocab, d2.type_ids, d2.para_idx).sum())
                         for x in ("sexual_anatomy", "sexual_action", "sexual_general"))
                out[f"{nm}_sexual"] = float(sx > 0)
                if nm == "title":
                    out["title_question"] = float(s.strip().endswith("?"))
                else:
                    toks = d2.tokens
                    f, s2, t3 = (sum(w in FP for w in toks), sum(w in SP for w in toks), sum(w in TP for w in toks))
                    out["desc_pov"] = ("first" if f and f >= s2 else "second" if s2 else "third" if t3 else "none")
    return out


def _story(task: tuple[str, str, Any, Any]) -> tuple[str, dict, dict, dict, dict]:
    from ..text.prepare import prepare

    key, text, title, desc = task
    timing: dict[str, float] = defaultdict(float)
    prep = prepare(paragraphs_of(text), title if isinstance(title, str) else None,
                   desc if isinstance(desc, str) else None)
    t0 = time.perf_counter()
    full = candidates(prep.story, title if isinstance(title, str) else None,
                      desc if isinstance(desc, str) else None, True, timing)
    timing["_total"] += time.perf_counter() - t0
    # closing paratext counts too for "to be continued"
    tail = [prep.paragraphs[i] for i in sorted(prep.paratext.labels) if i >= prep.paratext.tail_start]
    if any(_CONTINUED.search(p) for p in tail):
        full["end_to_be_continued"] = 1.0
    story = prep.story
    odd = candidates(story[0::2], None, None, False, defaultdict(float))
    even = candidates(story[1::2], None, None, False, defaultdict(float))
    return key, full, odd, even, dict(timing)


def run(workers: int = 0) -> Path:
    s = settings()
    feats = load_features(s)
    keys = list(feats.loc[feats["analysis_include"].fillna(False).astype(bool), "story_key"])
    texts = load_texts(s, keys, columns=("story_key", "text", "title", "description"))
    tasks = list(texts.itertuples(index=False, name=None))
    n = workers or max(1, min(8, (os.cpu_count() or 2) - 1))
    with ProcessPoolExecutor(max_workers=n, initializer=_init) as ex:
        res = list(ex.map(_story, tasks, chunksize=16))
    od = dev_dir(s) / "proposal"
    od.mkdir(parents=True, exist_ok=True)
    for i, part in ((1, "full"), (2, "odd"), (3, "even")):
        pd.DataFrame([r[i] for r in res], index=[r[0] for r in res]).rename_axis("story_key").reset_index() \
            .to_parquet(od / f"prototypes_{part}.parquet", index=False)
    tim = pd.DataFrame([r[4] for r in res]).fillna(0.0)
    tim.mean().mul(1000).rename("ms_per_story").to_frame().to_csv(od / "timing.tsv", sep="\t")
    return od


# ------------------------------------------------------------------------------------------- report
EXPECT = [
    ("open_dialogue", "erotic-letters", "LOW"), ("open_dialogue", "reviews-and-essays", "LOW"),
    ("open_dialogue", "adult-how-to", "LOW"),
    ("open_sex_per_1k", "masturbation-stories", "HIGH"), ("open_sex_per_1k", "anal-sex-stories", "HIGH"),
    ("open_sex_per_1k", "non-erotic-stories", "LOW"), ("open_sex_per_1k", "reviews-and-essays", "LOW"),
    ("open_sex_per_1k", "adult-romance", "LOW"),
    ("end_dialogue", "erotic-letters", "LOW"), ("end_dialogue", "reviews-and-essays", "LOW"),
    ("end_dialogue", "adult-how-to", "LOW"),
    ("end_to_be_continued", "erotic-novels", "HIGH"), ("end_to_be_continued", "erotic-letters", "LOW"),
    ("end_to_be_continued", "adult-how-to", "LOW"),
    ("sex_scene_count", "group-sex-stories", "HIGH"), ("sex_scene_count", "erotic-novels", "HIGH"),
    ("sex_scene_count", "non-erotic-stories", "LOW"), ("sex_scene_count", "reviews-and-essays", "LOW"),
    ("sex_scene_share", "masturbation-stories", "HIGH"), ("sex_scene_share", "anal-sex-stories", "HIGH"),
    ("sex_scene_share", "non-erotic-stories", "LOW"), ("sex_scene_share", "adult-romance", "LOW"),
    ("sex_scene_share", "reviews-and-essays", "LOW"),
    ("sex_first_scene_position", "adult-romance", "HIGH"), ("sex_first_scene_position", "erotic-novels", "HIGH"),
    ("sex_first_scene_position", "masturbation-stories", "LOW"),
    ("sex_first_scene_position", "anal-sex-stories", "LOW"),
    ("mech_lowercase_i_per_1k", "reviews-and-essays", "BELOW"), ("mech_lowercase_i_per_1k", "erotic-novels", "BELOW"),
    ("mech_lowercase_start_per_1k", "reviews-and-essays", "BELOW"),
    ("mech_missing_space_per_1k", "reviews-and-essays", "BELOW"),
    ("mech_doubled_word_per_1k", "reviews-and-essays", "BELOW"),
    ("mech_confusions_per_1k", "reviews-and-essays", "BELOW"), ("mech_confusions_per_1k", "erotic-novels", "BELOW"),
    ("dlg_bare_line_share", "adult-humor", "HIGH"),
    ("dlg_switches_per_1k", "erotic-letters", "LOW"), ("dlg_switches_per_1k", "reviews-and-essays", "LOW"),
    ("dlg_switches_per_1k", "adult-how-to", "LOW"),
    ("consent_checkin", "bdsm-stories", "HIGH"), ("consent_checkin", "first-time-sex-stories", "HIGH"),
    ("consent_checkin", "non-erotic-stories", "LOW"),
    ("time_jumps", "erotic-novels", "HIGH"), ("time_jumps", "adult-romance", "HIGH"),
    ("time_jumps", "loving-wives", "HIGH"), ("time_jumps", "masturbation-stories", "LOW"),
    ("time_jumps", "adult-how-to", "LOW"),
    ("reader_address", "reviews-and-essays", "HIGH"), ("reader_address", "adult-how-to", "HIGH"),
    ("humor_levity", "adult-humor", "HIGH"), ("humor_levity", "erotic-horror", "LOW"),
    ("humor_levity", "non-consent-stories", "LOW"),
    ("setting_home", "loving-wives", "HIGH"), ("setting_public", "exhibitionist-voyeur", "HIGH"),
    ("setting_outdoors", "exhibitionist-voyeur", "HIGH"),
    ("title_sexual", "anal-sex-stories", "HIGH"), ("title_sexual", "group-sex-stories", "HIGH"),
    ("title_sexual", "masturbation-stories", "HIGH"), ("title_sexual", "adult-romance", "LOW"),
    ("title_sexual", "non-erotic-stories", "LOW"), ("title_sexual", "science-fiction-fantasy", "LOW"),
    ("style_elongated_per_1k", "masturbation-stories", "HIGH"),
    ("style_elongated_per_1k", "group-sex-stories", "HIGH"),
    ("style_elongated_per_1k", "reviews-and-essays", "LOW"), ("style_elongated_per_1k", "non-erotic-stories", "LOW"),
    ("style_elongated_per_1k", "adult-how-to", "LOW"),
]


def _spearman(a: pd.Series, b: pd.Series) -> float:
    ok = a.notna() & b.notna()
    if ok.sum() < 30:
        return NAN
    return float(a[ok].rank().corr(b[ok].rank()))


def report() -> pd.DataFrame:
    from .measure_audit import analysed, text_measures

    s = settings()
    od = dev_dir(s) / "proposal"
    full = pd.read_parquet(od / "prototypes_full.parquet").set_index("story_key")
    odd = pd.read_parquet(od / "prototypes_odd.parquet").set_index("story_key")
    even = pd.read_parquet(od / "prototypes_even.parquet").set_index("story_key")
    timing = pd.read_csv(od / "timing.tsv", sep="\t", index_col=0)["ms_per_story"]
    f = analysed(load_features(s)).set_index("story_key")
    full = full.reindex(f.index)
    mech = ["mech_lowercase_i_per_1k", "mech_lowercase_start_per_1k", "mech_missing_space_per_1k",
            "mech_doubled_word_per_1k", "mech_confusions_per_1k"]
    full["mech_errors_per_1k"] = full[mech].sum(axis=1, min_count=1)
    for h in (odd, even):
        h["mech_errors_per_1k"] = h[mech].sum(axis=1, min_count=1)
    existing = text_measures(f.reset_index(), ("continuous", "count", "share", "binary"))
    X = f[existing].apply(pd.to_numeric, errors="coerce").astype(float)
    lw = np.log(pd.to_numeric(f["story_words"], errors="coerce").astype(float))
    long_ = pd.to_numeric(f["story_words"], errors="coerce") >= 1000
    cat = f["category_slug"]
    rows, kg = [], []
    for c in [c for c in full.columns if c != "desc_pov"]:
        v = pd.to_numeric(full[c], errors="coerce").astype(float)
        ok = v.notna()
        cors = X[ok].rank().corrwith(v[ok].rank()).dropna()
        top = cors.abs().sort_values(ascending=False)
        best = top.index[0] if len(top) else ""
        sb = NAN
        if c in odd.columns and c in even.columns:
            a = pd.to_numeric(odd[c].reindex(f.index[long_]), errors="coerce").astype(float)
            b = pd.to_numeric(even[c].reindex(f.index[long_]), errors="coerce").astype(float)
            both = a.notna() & b.notna()
            if both.sum() > 30 and a[both].nunique() > 1 and b[both].nunique() > 1:
                r = float(a[both].corr(b[both]))
                sb = 2 * r / (1 + r) if r > -1 else NAN
        means = v.groupby(cat).mean().dropna()
        order = means.sort_values(ascending=False)
        rows.append({"candidate": c, "stories": int(ok.sum()), "pct_nonzero": 100 * float((v[ok] != 0).mean()),
                     "median": float(v.median()), "mean": float(v.mean()),
                     "max_abs_rho": float(top.iloc[0]) if len(top) else NAN,
                     "rho_sign": float(np.sign(cors[best])) if best else NAN, "closest_existing": best,
                     "rho_log_words": _spearman(v, lw), "split_half_sb": sb,
                     "ms_per_story": float(timing.get(c, timing.get("_scenes" if c.startswith("sex_") else
                                                                    "_dialogue" if c.startswith("dlg_") else c,
                                                                    NAN))),
                     "top3": ", ".join(order.index[:3]), "bottom3": ", ".join(order.index[::-1][:3])})
        for m, cg, kind in [e for e in EXPECT if e[0] == c]:
            rank = list(order.index).index(cg) + 1 if cg in order.index else None
            med = float(order.median())
            val = float(order.get(cg, NAN))
            ok_ = {"HIGH": rank is not None and rank <= 6, "LOW": rank is not None and rank >= len(order) - 5,
                   "ABOVE": val > med, "BELOW": val < med}[kind]
            kg.append({"candidate": c, "category": cg, "expect": kind, "rank_of": f"{rank}/{len(order)}",
                       "category_mean": val, "median_of_means": med, "result": "pass" if ok_ else "FAIL"})
    t = pd.DataFrame(rows)
    t.to_csv(od / "summary.tsv", sep="\t", index=False, float_format="%.4g")
    pd.DataFrame(kg).to_csv(od / "known_groups.tsv", sep="\t", index=False, float_format="%.4g")
    if "desc_pov" in full.columns:
        tab = pd.crosstab(cat, full["desc_pov"], normalize="index").round(3)
        tab.to_csv(od / "desc_pov_by_category.tsv", sep="\t")
    return t


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m litcorr.dev.prototype_measures", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=("run", "report"))
    ap.add_argument("--workers", type=int, default=0)
    args = ap.parse_args(argv)
    if args.cmd == "run":
        print(f"-> {run(args.workers)}")
    else:
        t = report()
        with pd.option_context("display.width", 250, "display.max_colwidth", 60, "display.max_rows", 100):
            print(t.to_string(index=False, float_format=lambda x: f"{x:.3g}"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
