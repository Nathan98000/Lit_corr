"""`lexicon_audit`: corpus-level audit of every word list (counts only, never story text).

  python -m litcorr.dev.lexicon_audit [--top 40] [--near 25] [--lexicons a,b,c]
  python -m litcorr.dev.lexicon_audit compare OLD.tsv NEW.tsv      (hit counts before/after a lexicon edit)

For each lexicon used by a measure, over all story text (paratext excluded, as the measures see it):
  * total hits and stories with at least one hit;
  * the top entries by hits (the matched word form, or the phrase) with their share of all hits;
  * likely omissions: words that occur unusually often within three words of a hit (ratio of their
    frequency near hits to their overall frequency, at least 50 occurrences near hits), that are not already
    matched by the lexicon and are not function words.
Writes data/dev/audit/lexicon_hits.tsv, lexicon_top.tsv and lexicon_near.tsv.
"""

from __future__ import annotations

import argparse
import os
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd

from .common import dev_dir, load_texts, paragraphs_of, settings

WINDOW = 3


def _one(task: tuple[str, object, object]) -> tuple[dict, dict, dict, Counter]:
    from ..text.doc import TextDoc
    from ..text.features import LEXICON_MEASURES
    from ..text.lexicons import load_all, match
    from ..text.prepare import prepare

    global _LEX
    try:
        _LEX
    except NameError:
        _LEX = load_all()
    text, title, desc = task
    prep = prepare(paragraphs_of(text), title if isinstance(title, str) else None,
                   desc if isinstance(desc, str) else None)
    doc = TextDoc(prep.story)
    forms: dict[str, Counter] = {}
    near: dict[str, Counter] = {}
    hits_n: dict[str, int] = {}
    toks = doc.tokens
    for name in sorted(LEXICON_MEASURES):
        lex = _LEX[name]
        h = match(lex, doc.vocab, doc.type_ids, doc.para_idx, doc.positions_by_type())
        pos = np.flatnonzero(h)
        hits_n[name] = int(pos.size)
        c: Counter = Counter()
        nb: Counter = Counter()
        for p in pos:
            w = toks[p]
            # a phrase match is reported as the phrase
            phr = next((" ".join(ph) for ph in lex.phrases.get(w, ())
                        if p + len(ph) <= doc.n and tuple(toks[p:p + len(ph)]) == ph), None)
            c[phr or w] += 1
            for q in range(max(0, p - WINDOW), min(doc.n, p + WINDOW + 1)):
                if q != p and not h[q]:
                    nb[toks[q]] += 1
        forms[name] = c
        near[name] = nb
    return hits_n, forms, near, Counter(toks)


def audit(workers: int = 0) -> dict[str, pd.DataFrame]:
    from ..text.lexicons import load_all

    s = settings()
    texts = load_texts(s, columns=("story_key", "text", "title", "description"))
    tasks = list(texts[["text", "title", "description"]].itertuples(index=False, name=None))
    n = workers or max(1, min(8, (os.cpu_count() or 2) - 1))
    hits_total: Counter = Counter()
    stories_with: Counter = Counter()
    forms: dict[str, Counter] = defaultdict(Counter)
    near: dict[str, Counter] = defaultdict(Counter)
    corpus: Counter = Counter()
    with ProcessPoolExecutor(max_workers=n) as ex:
        for h, f, nb, cc in ex.map(_one, tasks, chunksize=16):
            for k, v in h.items():
                hits_total[k] += v
                stories_with[k] += int(v > 0)
            for k, v in f.items():
                forms[k].update(v)
            for k, v in nb.items():
                near[k].update(v)
            corpus.update(cc)
    lex = load_all()
    stop = lex["stopwords"].words
    total_tokens = sum(corpus.values())
    hit_rows, top_rows, near_rows = [], [], []
    for name in sorted(forms):
        tot = hits_total[name]
        hit_rows.append({"lexicon": name, "entries": lex[name].n_entries, "hits": tot, "stories": stories_with[name],
                         "pct_stories": 100 * stories_with[name] / max(1, len(tasks)),
                         "per_1k_words": 1000 * tot / max(1, total_tokens)})
        for rank, (w, k) in enumerate(forms[name].most_common(), 1):
            top_rows.append({"lexicon": name, "rank": rank, "entry": w, "hits": k, "share": k / tot if tot else 0})
        nb = near[name]
        nb_total = sum(nb.values()) or 1
        cands = []
        for w, k in nb.items():
            if k < 50 or w in stop or not w.replace("'", "").isalpha() or len(w) < 3 or lex[name].word_matches(w):
                continue
            ratio = (k / nb_total) / (corpus[w] / total_tokens)
            cands.append((ratio, w, k))
        for ratio, w, k in sorted(cands, reverse=True)[:40]:
            near_rows.append({"lexicon": name, "word": w, "near_hits": k, "corpus": corpus[w], "ratio": ratio})
    return {"lexicon_hits": pd.DataFrame(hit_rows), "lexicon_top": pd.DataFrame(top_rows),
            "lexicon_near": pd.DataFrame(near_rows)}


def compare(old: Path, new: Path) -> pd.DataFrame:
    a = pd.read_csv(old, sep="\t").set_index("lexicon")
    b = pd.read_csv(new, sep="\t").set_index("lexicon")
    t = pd.DataFrame({"entries_old": a["entries"], "entries_new": b["entries"], "hits_old": a["hits"],
                      "hits_new": b["hits"]})
    t["hits_change_pct"] = 100 * (t["hits_new"] - t["hits_old"]) / t["hits_old"]
    return t[(t["entries_old"] != t["entries_new"]) | (t["hits_old"] != t["hits_new"])]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m litcorr.dev.lexicon_audit", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", nargs="?", default="audit", choices=("audit", "compare"))
    ap.add_argument("paths", nargs="*")
    ap.add_argument("--top", type=int, default=40)
    ap.add_argument("--near", type=int, default=25)
    ap.add_argument("--lexicons", default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args(argv)
    if args.cmd == "compare":
        print(compare(Path(args.paths[0]), Path(args.paths[1])).to_string(float_format=lambda x: f"{x:.1f}"))
        return 0
    od = Path(args.out) if args.out else dev_dir(settings()) / "audit"
    od.mkdir(parents=True, exist_ok=True)
    t = audit()
    for k, v in t.items():
        v.to_csv(od / f"{k}.tsv", sep="\t", index=False, float_format="%.4g")
    only = set(args.lexicons.split(",")) if args.lexicons else None
    hits = t["lexicon_hits"].set_index("lexicon")
    for name in hits.index:
        if only and name not in only:
            continue
        h = hits.loc[name]
        top = t["lexicon_top"]
        top = top[(top["lexicon"] == name) & (top["rank"] <= args.top)]
        nr = t["lexicon_near"]
        nr = nr[nr["lexicon"] == name].head(args.near)
        print(f"== {name}: {int(h['hits']):,} hits, {h['pct_stories']:.0f}% of stories, {int(h['entries'])} entries")
        print("   top: " + ", ".join(f"{r.entry} {100 * r.share:.1f}" for r in top.itertuples()))
        print("   near: " + ", ".join(f"{r.word} {r.ratio:.1f}" for r in nr.itertuples()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
