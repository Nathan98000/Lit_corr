"""`review_sample`: a reproducible, stratified sample of stories for hand-checks.

  python -m litcorr.dev.review_sample NAME [--n-per-category 2] [--strata pov_class] [--seed 1]
                                           [--population included|text] [--min-words 0]
                                           [--exclude-sample OTHER ...] [--only-new-since OLD_FEATURES.parquet]

Writes data/dev/samples/NAME.csv (story_key, category_slug, stratum, rank) and NAME.json (how it was drawn).

Each story's place in the sample order is a hash of (seed, story_key), so it does not depend on which other
stories exist: when more stories arrive, a sample drawn again with the same seed keeps its earlier members
unless newer stories rank ahead of them within their stratum. For a hold-out check on stories collected later,
use --only-new-since with the processed table of the earlier run (only stories that had no text then are
eligible) and/or --exclude-sample with every earlier sample.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from .common import dev_dir, load_features, settings


def rank_key(seed: int, key: str) -> str:
    return hashlib.sha256(f"{seed}:{key}".encode()).hexdigest()


def draw(df: pd.DataFrame, n_per_stratum: int, seed: int, strata: list[str] | None = None,
         exclude: set[str] | None = None) -> pd.DataFrame:
    d = df[~df["story_key"].isin(exclude or set())].copy()
    cols = ["category_slug"] + list(strata or [])
    d["stratum"] = d[cols].astype(str).agg(" / ".join, axis=1)
    d["_order"] = d["story_key"].map(lambda k: rank_key(seed, k))
    d = d.sort_values(["stratum", "_order"])
    d["rank"] = d.groupby("stratum").cumcount() + 1
    out = d[d["rank"] <= n_per_stratum]
    return out[["story_key", "category_slug", "stratum", "rank"]].reset_index(drop=True)


def load_sample(name_or_path: str) -> pd.DataFrame:
    p = Path(name_or_path)
    if not p.exists():
        p = dev_dir(settings()) / "samples" / f"{name_or_path}.csv"
    return pd.read_csv(p)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m litcorr.dev.review_sample", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("name")
    ap.add_argument("--n-per-category", type=int, default=2, help="stories per stratum")
    ap.add_argument("--strata", default="", help="extra stratification columns, comma-separated")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--population", choices=("included", "text"), default="included")
    ap.add_argument("--min-words", type=int, default=0)
    ap.add_argument("--exclude-sample", action="append", default=[])
    ap.add_argument("--only-new-since", default=None, help="an earlier stories_features.parquet")
    args = ap.parse_args(argv)
    s = settings()
    df = load_features(s)
    pop = df[df["analysis_include"]] if args.population == "included" else df[df["has_text"]]
    if args.min_words:
        pop = pop[pd.to_numeric(pop["story_words"], errors="coerce").fillna(
            pd.to_numeric(pop["site_words_count"], errors="coerce")) >= args.min_words]
    if args.only_new_since:
        old = pd.read_parquet(args.only_new_since, columns=["story_key", "has_text"])
        pop = pop[~pop["story_key"].isin(set(old.loc[old["has_text"], "story_key"]))]
    exclude: set[str] = set()
    for e in args.exclude_sample:
        exclude |= set(load_sample(e)["story_key"])
    strata = [c for c in args.strata.split(",") if c]
    sample = draw(pop, args.n_per_category, args.seed, strata, exclude)
    out = dev_dir(s) / "samples"
    out.mkdir(parents=True, exist_ok=True)
    sample.to_csv(out / f"{args.name}.csv", index=False)
    meta = {"name": args.name, "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "seed": args.seed, "n_per_stratum": args.n_per_category, "strata": ["category_slug"] + strata,
            "population": args.population, "population_size": int(len(pop)), "min_words": args.min_words,
            "excluded_samples": args.exclude_sample, "only_new_since": args.only_new_since,
            "sample_size": int(len(sample))}
    (out / f"{args.name}.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"{len(sample)} stories from a population of {len(pop):,} -> {out / (args.name + '.csv')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
