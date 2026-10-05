"""`analyze`: raw corpus -> processed, analysis-ready dataset (no network, no story text out).

Steps
  1. compute every text measure for every story with text (parallel processes); measures of stories whose text,
     metadata, measure code, word lists and measure settings are unchanged since the last run are taken from
     data/derived/text_measures.parquet instead (``--full`` recomputes everything)
  2. carry over the site metadata and add popularity measures
  3. attach quality flags and decide `analysis_include` (problem records are
     flagged and kept, never dropped)
  4. add per-category sampling weights
  5. write data/processed/stories_features.parquet (+ optional CSV), the category
     frame, the data dictionary and a collection manifest
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import time
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from . import __version__
from .build.quality import attach_quality_flags
from .log import get_logger
from .paths import DataPaths
from .popularity import add_popularity
from .schema import NEEDS_FULL_TEXT, ORDER, REG, write_dictionary_json
from .settings import Analysis, Settings
from .text.features import MEASURE_SETTINGS, Measurer
from .text import TEXT_PIPELINE_VERSION, code_fingerprint
from .text.lexicons import lexicon_hash, load_all

log = get_logger("analyze")

_MEASURER: Measurer | None = None

META_FOR_TEXT = ("title", "description", "tags", "series_id", "series_parts_count", "series_part_index",
                 "html_em_count")


def _init_worker(analysis: dict[str, Any]) -> None:
    global _MEASURER
    _MEASURER = Measurer(load_all(), Analysis(**analysis))


def _measure(task: tuple[str, str | None, dict[str, Any]]) -> dict[str, Any]:
    key, text, meta = task
    assert _MEASURER is not None
    paragraphs = text.split("\n\n") if isinstance(text, str) and text else []
    out = _MEASURER.measure(paragraphs, meta)
    out["story_key"] = key
    return out


def _clean_meta(row: dict[str, Any]) -> dict[str, Any]:
    out = {}
    for k in META_FOR_TEXT:
        v = row.get(k)
        if isinstance(v, np.ndarray):
            v = v.tolist()
        out[k] = v
    parsed = row.get("n_pages_parsed")
    out["_parsed"] = bool(parsed) and parsed == parsed  # was the story page parsed at all?
    return out


def _col(df: pd.DataFrame, name: str, default: Any = np.nan) -> pd.Series:
    return df[name] if name in df.columns else pd.Series(default, index=df.index)


def _bool01(s: pd.Series) -> pd.Series:
    """True/False/missing -> 1.0/0.0/NaN (a consistent numeric form for yes/no variables)."""
    return s.map(lambda x: 1.0 if x is True or x == 1 else 0.0 if x is False or x == 0 else np.nan).astype(float)


def measure_context(analysis: Analysis) -> str:
    """Everything besides a story's own text and metadata that its measures depend on: the text pipeline version,
    the measure code, the word lists and the [analysis] settings the measures read."""
    ctx = {"text_pipeline_version": TEXT_PIPELINE_VERSION, "code": code_fingerprint(), "lexicons": lexicon_hash(),
           "settings": {k: getattr(analysis, k) for k in MEASURE_SETTINGS}}
    return hashlib.sha256(json.dumps(ctx, sort_keys=True).encode("utf-8")).hexdigest()[:16]


def _input_hash(text: Any, meta: dict[str, Any]) -> str:
    h = hashlib.sha256((text if isinstance(text, str) else "").encode("utf-8"))
    h.update(b"\0" + json.dumps(meta, sort_keys=True, default=str).encode("utf-8"))
    return h.hexdigest()[:24]


def compute_text_measures(raw: pd.DataFrame, analysis: Analysis, workers: int = 0, cache: Any = None,
                          full: bool = False) -> tuple[pd.DataFrame, dict[str, int]]:
    """Text measures for every story in ``raw``, one row per story in the same order. With a ``cache`` path, a
    story is measured again only if its text or metadata changed or the measure context did (see
    measure_context); the result always goes through the same Parquet round trip, so an incremental run gives
    exactly what a full run gives."""
    rows = raw.to_dict("records")
    keys = [r["story_key"] for r in rows]
    metas = [_clean_meta(r) for r in rows]
    hashes = [_input_hash(r.get("text"), m) for r, m in zip(rows, metas)]
    context = measure_context(analysis)
    cached = pd.DataFrame()
    if cache is not None and not full and cache.exists():
        c = pd.read_parquet(cache)
        if {"story_key", "_input_hash", "_context"} <= set(c.columns):
            want = dict(zip(keys, hashes))
            cached = c[(c["_context"] == context) & (c["story_key"].map(want) == c["_input_hash"])]
            cached = cached.drop_duplicates("story_key")
    have = set(cached["story_key"]) if len(cached) else set()
    todo = [i for i, k in enumerate(keys) if k not in have]
    tasks = [(keys[i], rows[i].get("text"), metas[i]) for i in todo]
    n_workers = workers or max(1, min(8, (os.cpu_count() or 2) - 1))
    cfg = analysis.__dict__.copy()
    t0 = time.time()
    if n_workers > 1 and len(tasks) > 50:
        with ProcessPoolExecutor(max_workers=n_workers, initializer=_init_worker, initargs=(cfg,)) as ex:
            results = list(ex.map(_measure, tasks, chunksize=16))
    else:
        _init_worker(cfg)
        results = [_measure(t) for t in tasks]
    log.info("Text measures for %d stories in %.1f s (%d worker(s)); %d unchanged stories taken from the cache.",
             len(tasks), time.time() - t0, n_workers, len(keys) - len(tasks))
    new = pd.DataFrame(results)
    if len(new):
        new["_input_hash"] = [hashes[i] for i in todo]
        new["_context"] = context
    parts = [x for x in (cached, new) if len(x)]
    table = pd.concat(parts, ignore_index=True) if len(parts) > 1 else (parts[0] if parts else
                                                                        pd.DataFrame({"story_key": keys}))
    table = table.set_index("story_key").loc[keys].reset_index()
    buf = io.BytesIO()
    table.to_parquet(buf, index=False, compression="zstd")
    if cache is not None:
        cache.parent.mkdir(parents=True, exist_ok=True)
        tmp = cache.with_name(cache.name + ".tmp")
        tmp.write_bytes(buf.getvalue())
        os.replace(tmp, cache)
    buf.seek(0)
    feats = pd.read_parquet(buf).drop(columns=["_input_hash", "_context"], errors="ignore")
    return feats, {"measured": len(tasks), "from_cache": len(keys) - len(tasks)}


def build_processed(raw: pd.DataFrame, categories: pd.DataFrame | None, settings: Settings,
                    workers: int = 0, cache: Any = None, full: bool = False,
                    stats: dict[str, int] | None = None) -> pd.DataFrame:
    a = settings.analysis
    feats, st = compute_text_measures(raw, a, workers, cache=cache, full=full)
    if stats is not None:
        stats.update(st)
    df = pd.DataFrame({
        "story_key": raw["story_key"],
        "queue_category_slug": _col(raw, "queue_category_slug"),
        "category_slug": _col(raw, "category_slug"),
        "category_name": _col(raw, "category_name"),
        "category_source": _col(raw, "category_source"),
        "date_published": pd.to_datetime(_col(raw, "date_published"), errors="coerce"),
        "pop_views": pd.to_numeric(_col(raw, "views"), errors="coerce"),
        "pop_views_approx": _col(raw, "views_approx", False).fillna(False).astype(bool),
        "pop_favorites": pd.to_numeric(_col(raw, "favorites"), errors="coerce"),
        "pop_comments": pd.to_numeric(_col(raw, "comments"), errors="coerce"),
        "pop_rating": pd.to_numeric(_col(raw, "rating"), errors="coerce"),
        "pop_rating_count": pd.to_numeric(_col(raw, "rating_count"), errors="coerce"),
        "pop_reading_lists": pd.to_numeric(_col(raw, "reading_lists"), errors="coerce"),
        "pop_is_hot": _bool01(_col(raw, "is_hot", np.nan)),
        "pop_writers_pick": _bool01(_col(raw, "writers_pick", np.nan)),
        "pop_contest_winner": _bool01(_col(raw, "contest_winner", np.nan)),
        "site_words_count": pd.to_numeric(_col(raw, "site_words_count"), errors="coerce"),
        "story_pages": pd.to_numeric(_col(raw, "n_pages_total"), errors="coerce"),
        "author_stories_count": pd.to_numeric(_col(raw, "author_stories_count"), errors="coerce"),
        "author_followers_count": pd.to_numeric(_col(raw, "author_followers_count"), errors="coerce"),
        "tags": _col(raw, "tags", None).apply(lambda t: list(t) if isinstance(t, (list, np.ndarray)) else []),
        "has_text": _col(raw, "text", None).apply(lambda t: isinstance(t, str) and len(t) > 0),
        "text_truncated": _col(raw, "text_truncated", False).fillna(False).astype(bool),
        "stats_observed_at": pd.to_datetime(_col(raw, "stats_observed_at"), errors="coerce", utc=True),
    })
    # Category names: the site's own name for each category (from its category list), so every story in a
    # category carries the same name; the name read from the story page is only a fallback.
    if categories is not None and not categories.empty and "slug" in categories:
        names = dict(zip(categories["slug"], categories["name"]))
        df["category_name"] = df["category_slug"].map(names).fillna(df["category_name"])
    # Publication fields
    d = df["date_published"]
    df["pub_year"] = d.dt.year
    df["pub_month"] = d.dt.month
    df["pub_weekday"] = d.dt.weekday
    df["pub_is_weekend"] = d.dt.weekday.isin([5, 6]).astype(float).where(d.notna())
    df = add_popularity(df, a.min_views_for_rates)
    df = df.merge(feats, on="story_key", how="left", suffixes=("", "_text"))
    missing = [c for c in ORDER if c not in df.columns]  # every documented column exists, even if empty
    if missing:
        df = df.reindex(columns=list(df.columns) + missing)
    # Yes/no story characteristics as 1.0 / 0.0 / missing (quality flags stay plain True/False).
    for x in REG:
        if x.kind == "binary" and x.ui_group != "Quality" and x.name in df.columns:
            df[x.name] = _bool01(df[x.name])
    truncated = df["text_truncated"].fillna(False).astype(bool)
    full_text_cols = list(NEEDS_FULL_TEXT) + [c for c in df.columns if c.startswith("pace_")]
    df[full_text_cols] = df[full_text_cols].apply(pd.to_numeric, errors="coerce").astype(float)
    df.loc[truncated, full_text_cols] = np.nan
    df = attach_quality_flags(df, raw, settings)
    df = add_sampling_weights(df, categories)
    df = df.drop(columns=[c for c in df.columns if c.startswith("_")])  # internal values used by the QC flags
    extra = [c for c in df.columns if c not in ORDER and c != "stats_observed_at"]
    if extra:
        log.warning("Columns not in the data dictionary (kept at the end): %s", extra)
    return df[ORDER + extra]


def add_sampling_weights(df: pd.DataFrame, categories: pd.DataFrame | None) -> pd.DataFrame:
    df = df.copy()
    pop = {}
    if categories is not None and not categories.empty:
        for _, c in categories.iterrows():
            n = c.get("total_stories_reported")
            if n is not None and n == n and n > 0:
                pop[c["slug"]] = float(n)
    # Weights follow the listing category each story was SAMPLED from (its stratum), which is also the
    # category whose size was estimated; the story page's own category can occasionally differ.
    stratum = df["queue_category_slug"].fillna(df["category_slug"])
    included = df[df["analysis_include"]].groupby(stratum[df["analysis_include"]]).size()
    df["sampling_weight"] = stratum.map(
        lambda s: pop[s] / included[s] if s in pop and s in included and included[s] > 0 else np.nan)
    df.loc[~df["analysis_include"], "sampling_weight"] = np.nan
    return df


OPEN_STATUSES = ("queued", "partial")


def collection_progress(df: pd.DataFrame, story_counts: list[dict[str, Any]],
                        state_cats: list[dict[str, Any]]) -> dict[str, Any]:
    """How far the collection has got, per sampled category: the stories sampled (queued), collected, still
    waiting, and those that cannot be collected (gone, failed, disallowed ...). While stories are still waiting
    or listings unread, every result describes the stories collected so far and the weights are provisional."""
    counts: dict[str, dict[str, int]] = {}
    for r in story_counts:
        counts.setdefault(r["category_slug"] or "(none)", {})[r["status"]] = int(r["n"])
    selected = {c["slug"]: c for c in state_cats if c.get("selected")}
    stratum = df["queue_category_slug"].fillna(df["category_slug"]).fillna("(none)")
    with_text = df["has_text"].groupby(stratum).sum()
    included = df["analysis_include"].groupby(stratum).sum()
    by_cat = {}
    for slug in sorted(set(counts) | set(selected)):
        c = counts.get(slug, {})
        n, done = sum(c.values()), c.get("done", 0)
        waiting = sum(c.get(s, 0) for s in OPEN_STATUSES)
        by_cat[slug] = {"sampled": n, "collected": done, "still_queued": waiting,
                        "not_collectable": n - done - waiting, "with_text": int(with_text.get(slug, 0)),
                        "included": int(included.get(slug, 0)),
                        "listing_finished": (selected[slug].get("listing_status") == "done") if slug in selected
                        else None}
    total = {k: sum(v[k] for v in by_cat.values()) for k in ("sampled", "collected", "still_queued",
                                                               "not_collectable", "with_text", "included")}
    complete = total["still_queued"] == 0 and all(c.get("listing_status") == "done" for c in selected.values())
    return {"complete": bool(complete), **total,
            "share_collected": round(total["collected"] / total["sampled"], 4) if total["sampled"] else None,
            "by_category": by_cat}


def category_frame(df: pd.DataFrame, categories: pd.DataFrame | None, state_frame: dict[str, Any]) -> pd.DataFrame:
    rows = []
    cats = categories if categories is not None else pd.DataFrame(columns=["slug", "name"])
    slugs = sorted(set(cats.get("slug", pd.Series(dtype=str)).dropna()) | set(df["category_slug"].dropna()))
    for s in slugs:
        c = cats[cats["slug"] == s].iloc[0].to_dict() if "slug" in cats and (cats["slug"] == s).any() else {}
        sub = df[df["category_slug"] == s]
        fr = state_frame.get(s, {})
        rows.append({
            "category_slug": s, "category_name": c.get("name") or (sub["category_name"].dropna().iloc[0]
                                                                   if sub["category_name"].notna().any() else s),
            "selected": bool(c.get("selected", True)), "listing_pages_total": c.get("total_pages"),
            "stories_per_listing_page": c.get("stories_per_page"),
            "estimated_stories_in_category": c.get("total_stories_reported"),
            "frame_stories_seen": fr.get("frame"), "sampled": fr.get("chosen"),
            "stories_in_dataset": len(sub), "with_text": int(sub["has_text"].sum()),
            "analysis_included": int(sub["analysis_include"].sum()),
        })
    return pd.DataFrame(rows)


def run_analyze(settings: Settings, workers: int = 0, write_csv: bool = True, full: bool = False) -> dict[str, Any]:
    paths = DataPaths(settings.data_dir).ensure()
    if not paths.raw_stories.exists():
        raise FileNotFoundError(f"{paths.raw_stories} not found; run `python -m litcorr build-raw` first.")
    raw = pd.read_parquet(paths.raw_stories)
    cats = pd.read_parquet(paths.raw_categories) if paths.raw_categories.exists() else None
    stats: dict[str, int] = {}
    df = build_processed(raw, cats, settings, workers or settings.analysis.workers, cache=paths.measure_cache,
                         full=full, stats=stats)
    df.to_parquet(paths.features, index=False, compression="zstd")
    if write_csv:
        csv = df.copy()
        for c in ("tags", "qc_flags", "exclusion_reasons"):
            csv[c] = csv[c].apply(lambda x: "|".join(x) if isinstance(x, (list, np.ndarray)) else "")
        csv.to_csv(paths.features_csv, index=False)
    state_frame = {}
    from .state import State

    story_counts: list[dict[str, Any]] = []
    state_cats: list[dict[str, Any]] = []
    if paths.state_db.exists():
        st = State.snapshot(paths.state_db)
        try:
            state_cats = st.categories()
            for c in state_cats:
                raw_frame = st.get_meta(f"frame:{c['slug']}")
                if raw_frame:
                    state_frame[c["slug"]] = json.loads(raw_frame)
            runs = st.runs()
            layout = st.get_meta("listing_layout")
            story_counts = [dict(r) for r in st.conn.execute(
                "SELECT category_slug, status, COUNT(*) AS n FROM stories GROUP BY category_slug, status")]
        finally:
            st.close()
    else:
        runs, layout = [], None
    progress = collection_progress(df, story_counts, state_cats)
    category_frame(df, cats, state_frame).to_parquet(paths.category_frame, index=False)
    write_dictionary_json(paths.dictionary_json)
    lex = load_all()
    started = [r["started_at"] for r in runs if r.get("started_at")]
    manifest = {
        "pipeline_version": __version__,
        "text_pipeline_version": TEXT_PIPELINE_VERSION,
        "lexicon_hash": lexicon_hash(),
        "processed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "collection_first_session": datetime.fromtimestamp(min(started), timezone.utc).isoformat() if started else None,
        "collection_last_session": datetime.fromtimestamp(max(started), timezone.utc).isoformat() if started else None,
        "stats_observed_range": [str(raw["stats_observed_at"].min()) if "stats_observed_at" in raw else None,
                                 str(raw["stats_observed_at"].max()) if "stats_observed_at" in raw else None],
        "n_stories": int(len(df)), "n_with_text": int(df["has_text"].sum()),
        "n_analysis_included": int(df["analysis_include"].sum()),
        "collection_progress": progress,
        "sampling_weights_provisional": not progress["complete"],
        "listing_layout": json.loads(layout) if layout else None,
        "settings": {"scope": settings.scope.__dict__, "analysis": settings.analysis.__dict__,
                     "politeness": settings.politeness.__dict__},
        "lexicons": {k: {"entries": x.n_entries, "label": x.label} for k, x in lex.items()},
    }
    paths.manifest.write_text(json.dumps(manifest, indent=2, default=str), encoding="utf-8")
    summary = {"stories": len(df), "with_text": int(df["has_text"].sum()),
               "included": int(df["analysis_include"].sum()), "columns": df.shape[1], **stats,
               "collection_complete": progress["complete"]}
    log.info("Processed dataset written to %s: %s", paths.features, summary)
    return summary
