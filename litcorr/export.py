"""`export-handoff`: package the processed dataset for Stage 2.

The handoff contains what the website build needs and nothing that identifies
stories or authors:

  stories_features.parquet   processed table WITHOUT story text, titles,
                             descriptions, URLs/slugs or author names/ids
  category_frame.parquet     per-category counts and size estimates
  data_dictionary.json       machine-readable schema
  quality_report.md / .json  data-quality summary
  collection_manifest.json   when/how the data were collected and processed
  METHODOLOGY.md, DATA_DICTIONARY.md, lexicons/   documentation

To make it hard to match a row back to a specific story or author, the handoff
also coarsens a few columns (the processed table on your computer keeps the
exact values):

  * story_key is a keyed hash whose secret never leaves your computer;
  * only tags used by at least COMMON_TAG_MIN stories are kept (rare tags can be names);
  * the exact publication date is dropped (year, month and weekday remain);
  * author story/follower counts become bands (e.g. 6–20 stories);
  * raw totals (views, favorites, comments, reading-list adds) are rounded to
    3 significant figures, and days online to whole weeks. Ratios and per-month
    measures were computed from the exact values beforehand.

Raw data, story text and the page cache never leave your machine.
"""

from __future__ import annotations

import math
import time
import zipfile
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd

from .log import get_logger
from .paths import DataPaths
from .settings import PROJECT_ROOT, Settings

log = get_logger("export")

# Never part of the handoff, even if present in the processed table.
IDENTIFYING = ("story_slug", "url", "title", "description", "author_name", "author_id", "author_url_key",
               "listing_title", "listing_author", "series_title", "series_id", "text", "lit_id", "date_published")
COMMON_TAG_MIN = 20
AUTHOR_STORY_BANDS = (1, 2, 6, 21, 51, 101, 201)
FOLLOWER_BANDS = (0, 10, 100, 1000, 10000)
ROUNDED_TOTALS = ("pop_views", "pop_favorites", "pop_comments", "pop_reading_lists", "pop_rating_count")


def _band(x: float, bands: tuple[int, ...]) -> float:
    if x is None or x != x:
        return np.nan
    lower = [b for b in bands if x >= b]
    return float(lower[-1]) if lower else np.nan


def _round_sig(x: float, sig: int = 3) -> float:
    if x is None or x != x or x == 0:
        return x
    digits = sig - int(math.floor(math.log10(abs(x)))) - 1
    return float(round(x, digits)) if digits > 0 else float(round(x, digits))


def coarsen_for_handoff(df: pd.DataFrame) -> pd.DataFrame:
    df = df.drop(columns=[c for c in IDENTIFYING if c in df.columns]).copy()
    if "tags" in df:
        counts = Counter(t for tags in df["tags"] if isinstance(tags, (list, np.ndarray)) for t in tags)
        common = {t for t, n in counts.items() if n >= COMMON_TAG_MIN}
        df["tags"] = df["tags"].apply(
            lambda tags: [t for t in tags if t in common] if isinstance(tags, (list, np.ndarray)) else [])
    if "author_stories_count" in df:
        df["author_stories_count"] = df["author_stories_count"].map(lambda x: _band(x, AUTHOR_STORY_BANDS))
    if "author_followers_count" in df:
        df["author_followers_count"] = df["author_followers_count"].map(lambda x: _band(x, FOLLOWER_BANDS))
    for c in ROUNDED_TOTALS:
        if c in df:
            df[c] = pd.to_numeric(df[c], errors="coerce").map(_round_sig)
    if "age_days" in df:
        df["age_days"] = (pd.to_numeric(df["age_days"], errors="coerce") / 7).round() * 7
    if "age_years" in df:
        df["age_years"] = pd.to_numeric(df["age_years"], errors="coerce").round(1)
    return df


def export_handoff(settings: Settings) -> Path:
    paths = DataPaths(settings.data_dir).ensure()
    if not paths.features.exists():
        raise FileNotFoundError("Run `python -m litcorr analyze` (and `report`) first.")
    df = coarsen_for_handoff(pd.read_parquet(paths.features))
    stamp = time.strftime("%Y%m%d")
    tmp = paths.handoff / f"stories_features_{stamp}.parquet"
    df.to_parquet(tmp, index=False, compression="zstd")
    out = paths.handoff / f"litcorr_stage2_handoff_{stamp}.zip"
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.write(tmp, "stories_features.parquet")
        for p in (paths.category_frame, paths.dictionary_json, paths.quality_md, paths.quality_json, paths.manifest):
            if p.exists():
                z.write(p, p.name)
        for doc in ("METHODOLOGY.md", "DATA_DICTIONARY.md"):
            p = PROJECT_ROOT / "docs" / doc
            if p.exists():
                z.write(p, f"docs/{doc}")
        for p in sorted((PROJECT_ROOT / "lexicons").glob("*")):
            z.write(p, f"lexicons/{p.name}")
    tmp.unlink(missing_ok=True)
    log.info("Stage 2 handoff written to %s (%d stories, %d columns).", out, len(df), df.shape[1])
    return out
