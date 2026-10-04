"""Data-quality flags (per story) and the collection quality report.

Nothing is silently discarded: every queued story stays in the processed table
with a list of `qc_flags`, and `analysis_include` says whether it meets the
minimum requirements for the website's analyses (with `exclusion_reasons`).
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from ..paths import DataPaths
from ..settings import Settings
from ..state import State

EARLIEST_PLAUSIBLE_DATE = pd.Timestamp("1998-01-01")  # Literotica launched in 1998
VERY_LONG_WORDS = 200_000
MIN_ENGLISH_FUNCTION_SHARE = 0.25

FLAG_DESCRIPTIONS = {
    "status_gone": "Story page no longer exists (HTTP 404/410, or the site redirected to its home page).",
    "status_robots_disallowed": "Not fetched because robots.txt (or the built-in safety list) disallows it.",
    "status_unavailable": "Story exists but is not publicly readable (e.g. awaiting moderator approval).",
    "status_failed": "Could not be fetched after the maximum number of attempts.",
    "status_queued": "Selected for the sample but not yet fetched when the data were processed.",
    "status_partial": "Some pages fetched; the rest were still pending when the data were processed.",
    "status_skipped": "Deliberately skipped.",
    "no_text": "No story text was collected.",
    "text_truncated": "The story has more pages than were collected (page cap or missing pages).",
    "text_too_short": "Text shorter than the minimum for text measures.",
    "very_long_text": f"More than {VERY_LONG_WORDS:,} words.",
    "missing_title": "No title found.",
    "missing_category": "No category found.",
    "missing_date": "No publication date found.",
    "missing_views": "No view count found.",
    "missing_favorites": "No favorites count found.",
    "missing_comments": "No comment count found.",
    "missing_rating": "No average rating (often: no votes yet).",
    "views_approximate": "Only an abbreviated view count (e.g. '12.3k') was available.",
    "favorites_exceed_views": "More favorites than views (inconsistent metadata).",
    "comments_exceed_views": "More comments than views (inconsistent metadata).",
    "rating_out_of_range": "Average rating outside 1–5.",
    "date_out_of_range": "Publication date before 1998 or after the statistics were recorded.",
    "category_differs_from_listing": "The story page names a different category than the listing it was found on.",
    "title_differs_from_listing": "The story page title differs from the listing title.",
    "site_word_count_mismatch": "Our word count differs from Literotica's by more than 25% (text may be incomplete).",
    "possibly_not_english": "Few common English function words; the text may not be English.",
    "dialogue_quotes_unbalanced": "Quotation marks are mostly unbalanced; dialogue measures less reliable.",
    "duplicate_text": "Identical text to another story in the dataset.",
    "duplicate_site_id": "Same Literotica submission id as another record.",
    "parse_warnings": "The page parser reported problems (see raw parse_warnings).",
}


def _norm_title(s: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower()) if isinstance(s, str) else ""


def attach_quality_flags(df: pd.DataFrame, raw: pd.DataFrame, settings: Settings) -> pd.DataFrame:
    df = df.copy()
    r = raw.set_index("story_key").reindex(df["story_key"])
    r.index = df.index
    flags: dict[str, pd.Series] = {}

    def col(frame: pd.DataFrame, name: str) -> pd.Series:
        return frame[name] if name in frame.columns else pd.Series(np.nan, index=frame.index)

    status = col(r, "collection_status").fillna("unknown").astype(str)
    has_text = df["has_text"].fillna(False).astype(bool)
    words = pd.to_numeric(df.get("story_words"), errors="coerce")
    flags["no_text"] = ~has_text
    flags["text_truncated"] = df["text_truncated"].fillna(False).astype(bool) | (
        pd.to_numeric(col(r, "n_pages_fetched"), errors="coerce") < pd.to_numeric(col(r, "n_pages_expected"), errors="coerce"))
    flags["text_too_short"] = has_text & (words.fillna(0) < settings.analysis.min_words_for_text_measures)
    flags["very_long_text"] = words > VERY_LONG_WORDS
    flags["missing_title"] = col(r, "title").isna() & has_text
    flags["missing_category"] = df["category_slug"].isna()
    flags["missing_date"] = df["date_published"].isna() & has_text
    for m in ("views", "favorites", "comments", "rating"):
        flags[f"missing_{m}"] = df[f"pop_{m}"].isna() & has_text
    flags["views_approximate"] = df["pop_views_approx"].fillna(False).astype(bool)
    flags["favorites_exceed_views"] = df["pop_favorites"] > df["pop_views"]
    flags["comments_exceed_views"] = df["pop_comments"] > df["pop_views"]
    flags["rating_out_of_range"] = (df["pop_rating"] < 1) | (df["pop_rating"] > 5)
    observed = pd.to_datetime(df.get("stats_observed_at"), errors="coerce", utc=True).dt.tz_localize(None)
    pub = pd.to_datetime(df["date_published"], errors="coerce")
    flags["date_out_of_range"] = (pub < EARLIEST_PLAUSIBLE_DATE) | (pub > observed)
    q = col(r, "queue_category_slug")
    flags["category_differs_from_listing"] = q.notna() & df["category_slug"].notna() & (q != df["category_slug"]) & (
        col(r, "category_source") == "page")
    lt = col(r, "listing_title").map(_norm_title)
    pt = col(r, "title").map(_norm_title)
    flags["title_differs_from_listing"] = (lt != "") & (pt != "") & (lt != pt)
    site = pd.to_numeric(df["site_words_count"], errors="coerce")
    flags["site_word_count_mismatch"] = (site > 0) & ~flags["text_truncated"] & ((words - site).abs() / site > 0.25)
    flags["possibly_not_english"] = pd.to_numeric(df.get("qc_english_function_word_share"), errors="coerce") < MIN_ENGLISH_FUNCTION_SHARE
    flags["dialogue_quotes_unbalanced"] = df.get("qc_dialogue_quotes_unbalanced").fillna(False).astype(bool) \
        if "qc_dialogue_quotes_unbalanced" in df else pd.Series(False, index=df.index)
    sha = col(r, "text_sha1")
    dup_text = sha.notna() & sha.duplicated(keep=False)
    flags["duplicate_text"] = dup_text
    lit = pd.to_numeric(col(r, "lit_id"), errors="coerce")
    flags["duplicate_site_id"] = lit.notna() & lit.duplicated(keep=False)
    pw = col(r, "parse_warnings")
    flags["parse_warnings"] = pw.apply(lambda x: isinstance(x, (list, np.ndarray)) and len(x) > 0)

    names = list(flags)
    mat = pd.DataFrame({k: s.fillna(False).astype(bool) for k, s in flags.items()})
    status_flag = status.where(~status.isin(["done"]), "")
    df["qc_flags"] = [
        ([f"status_{s}"] if s else []) + [n for n, on in zip(names, row) if on]
        for s, row in zip(status_flag, mat.itertuples(index=False))
    ]
    # analysis_include: minimum requirements, and keep only the first copy of duplicated text
    secondary_dup = sha.notna() & sha.duplicated(keep="first")
    reasons = {
        "no_text": ~has_text,
        "text_too_short": flags["text_too_short"],
        "missing_category": flags["missing_category"],
        "missing_date": df["date_published"].isna(),
        "missing_views": df["pop_views"].isna(),
        "duplicate_of_another_story": secondary_dup,
        "possibly_not_english": flags["possibly_not_english"].fillna(False),
        "date_out_of_range": flags["date_out_of_range"].fillna(False),
    }
    rm = pd.DataFrame({k: s.fillna(False).astype(bool) for k, s in reasons.items()})
    # A story without text is excluded for that reason alone (its other gaps follow from it).
    df["exclusion_reasons"] = [["no_text"] if row[0] else [n for n, on in zip(rm.columns, row) if on]
                               for row in rm.itertuples(index=False)]
    df["analysis_include"] = df["exclusion_reasons"].apply(len) == 0
    return df


# ------------------------------------------------------------------- report
def _pct(a: int, b: int) -> str:
    return f"{a:,} ({a / b:.0%})" if b else f"{a:,}"


def quality_report(settings: Settings) -> dict[str, Any]:
    paths = DataPaths(settings.data_dir)
    df = pd.read_parquet(paths.features)
    raw = pd.read_parquet(paths.raw_stories) if paths.raw_stories.exists() else pd.DataFrame()
    listing = pd.read_parquet(paths.raw_listing_items) if paths.raw_listing_items.exists() else pd.DataFrame()
    pages = pd.read_parquet(paths.raw_pages) if paths.raw_pages.exists() else pd.DataFrame()
    st_info: dict[str, Any] = {}
    if paths.state_db.exists():
        st = State(paths.state_db)
        try:
            st_info = {"request_outcomes": st.request_outcome_counts(), "story_status": st.story_status_counts(),
                       "sessions": len(st.runs()),
                       "stop_reasons": pd.Series([r["stop_reason"] for r in st.runs()]).value_counts().to_dict()}
        finally:
            st.close()
    n = len(df)
    text = df[df["has_text"]]
    flags = pd.Series([f for fl in df["qc_flags"] for f in fl]).value_counts().to_dict() if n else {}
    excl = pd.Series([f for fl in df["exclusion_reasons"] for f in fl]).value_counts().to_dict() if n else {}
    authors = raw["author_id"].nunique() if "author_id" in raw and raw["author_id"].notna().any() else (
        raw["author_name"].nunique() if "author_name" in raw else None)
    dates = pd.to_datetime(df["date_published"], errors="coerce")
    per_cat = (df.groupby(df["category_name"].fillna(df["category_slug"]).fillna("(unknown)"))
               .agg(stories=("story_key", "size"), with_text=("has_text", "sum"),
                    with_views=("pop_views", lambda s: int(s.notna().sum())),
                    included=("analysis_include", "sum"))
               .sort_values("stories", ascending=False))
    page_status = pages.groupby(["kind", "status"]).size().to_dict() if not pages.empty else {}
    blocked_pages = int(((pages["status"] == "blocked") if not pages.empty else pd.Series(dtype=bool)).sum())
    sources = {}
    if "field_sources" in raw:
        for key in ("views", "favorites", "comments", "rating", "date_published", "category_slug"):
            vals = raw["field_sources"].dropna().map(lambda j: (json.loads(j).get(key) or "none").split("@")[0])
            sources[key] = vals.value_counts().to_dict()
    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "stories_in_dataset": n,
        "stories_with_text": int(df["has_text"].sum()),
        "stories_included_in_analysis": int(df["analysis_include"].sum()),
        "with_views": int(df["pop_views"].notna().sum()),
        "with_rating": int(df["pop_rating"].notna().sum()),
        "with_rating_count": int(df["pop_rating_count"].notna().sum()),
        "with_favorites": int(df["pop_favorites"].notna().sum()),
        "with_comments": int(df["pop_comments"].notna().sum()),
        "date_range": [str(dates.min().date()) if dates.notna().any() else None,
                       str(dates.max().date()) if dates.notna().any() else None],
        "unique_authors": int(authors) if authors is not None else None,
        "duplicate_text_records": int(flags.get("duplicate_text", 0)),
        "duplicate_site_id_records": int(flags.get("duplicate_site_id", 0)),
        "duplicate_listing_entries": int(listing.duplicated(["story_slug"]).sum()) if not listing.empty else 0,
        "stories_seen_in_listings": int(listing["story_slug"].nunique()) if not listing.empty else 0,
        "failures_by_status": {k: v for k, v in st_info.get("story_status", {}).items() if k != "done"},
        "pages_by_kind_and_status": {f"{k[0]}/{k[1]}": int(v) for k, v in page_status.items()},
        "bot_or_block_pages": blocked_pages,
        "request_outcomes": st_info.get("request_outcomes", {}),
        "sessions": st_info.get("sessions"), "session_stop_reasons": st_info.get("stop_reasons", {}),
        "flag_counts": {k: int(v) for k, v in flags.items()},
        "exclusion_counts": {k: int(v) for k, v in excl.items()},
        "field_sources": sources,
        "word_count": {"median": float(text["story_words"].median()) if len(text) else None,
                       "p1": float(text["story_words"].quantile(0.01)) if len(text) else None,
                       "p99": float(text["story_words"].quantile(0.99)) if len(text) else None},
        "per_category": per_cat.reset_index().rename(columns={per_cat.index.name or "index": "category"}).to_dict("records"),
    }
    paths.quality_json.write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    paths.quality_md.write_text(_markdown(summary), encoding="utf-8")
    return summary


def _markdown(s: dict[str, Any]) -> str:
    n = s["stories_in_dataset"]
    lines = [
        "# Data-quality report", "", f"Generated {s['generated_at']}.", "",
        "## Summary", "",
        "| | |", "|---|---|",
        f"| Stories in dataset (queued for full text) | {n:,} |",
        f"| Stories seen on listing pages (sampling frame) | {s['stories_seen_in_listings']:,} |",
        f"| With text | {_pct(s['stories_with_text'], n)} |",
        f"| Included in analysis | {_pct(s['stories_included_in_analysis'], n)} |",
        f"| With views | {_pct(s['with_views'], n)} |",
        f"| With average rating | {_pct(s['with_rating'], n)} |",
        f"| With number of ratings | {_pct(s['with_rating_count'], n)} |",
        f"| With favorites | {_pct(s['with_favorites'], n)} |",
        f"| With comments | {_pct(s['with_comments'], n)} |",
        f"| Publication dates | {s['date_range'][0]} to {s['date_range'][1]} |",
        f"| Unique authors | {s['unique_authors'] if s['unique_authors'] is not None else 'n/a'} |",
        f"| Records with duplicated text | {s['duplicate_text_records']:,} |",
        f"| Records sharing a site id | {s['duplicate_site_id_records']:,} |",
        f"| Repeat sightings in listings | {s['duplicate_listing_entries']:,} |",
        f"| Bot/challenge/blocked pages | {s['bot_or_block_pages']:,} |",
        "| Word count: median (1st–99th percentile) | " + (
            f"{s['word_count']['median']:,.0f} ({s['word_count']['p1']:,.0f}–{s['word_count']['p99']:,.0f})"
            if s["word_count"]["median"] is not None else "n/a") + " |",
        "",
        "## Failures and collection status", "",
        "Stories not fully collected, by status: " + (", ".join(f"{k} {v:,}" for k, v in s["failures_by_status"].items()) or "none") + ".",
        "", "Network requests by outcome: " + (", ".join(f"{k} {v:,}" for k, v in s["request_outcomes"].items()) or "none") + ".",
        "", "Sessions: " + str(s["sessions"]) + "; stop reasons: " + json.dumps(s["session_stop_reasons"]) + ".", "",
        "## By category", "", "| Category | Stories | With text | With views | Included |", "|---|---|---|---|---|",
    ]
    for row in s["per_category"]:
        lines.append(f"| {row.get('category')} | {row['stories']:,} | {int(row['with_text']):,} | "
                     f"{int(row['with_views']):,} | {int(row['included']):,} |")
    lines += ["", "## Quality flags", "", "| Flag | Stories | Meaning |", "|---|---|---|"]
    for k, v in sorted(s["flag_counts"].items(), key=lambda kv: -kv[1]):
        desc = FLAG_DESCRIPTIONS.get(k, "")
        lines.append(f"| `{k}` | {v:,} | {desc} |")
    lines += ["", "## Why stories are excluded from analysis", "", "| Reason | Stories |", "|---|---|"]
    for k, v in sorted(s["exclusion_counts"].items(), key=lambda kv: -kv[1]):
        lines.append(f"| `{k}` | {v:,} |")
    if s["field_sources"]:
        lines += ["", "## Where key fields came from", "",
                  "`embedded` = exact values from the page's data; `dom` = visible page text (may be abbreviated); "
                  "`jsonld`/`meta` = page metadata.", ""]
        for k, d in s["field_sources"].items():
            lines.append(f"- **{k}**: " + ", ".join(f"{src} {cnt:,}" for src, cnt in d.items()))
    lines.append("")
    return "\n".join(lines)
