"""`build-raw`: turn the page cache into the raw corpus (no network access).

Outputs (in data/raw/):
  stories.parquet       one row per queued story: all parsed metadata, the full
                        text, and collection/parse status (problem records are
                        kept and flagged, never dropped)
  story_pages.parquet   one row per story page that was parsed
  listing_items.parquet the sampling frame: every story seen on a listing page
  categories.parquet    categories and how their listing pages were read
  pages.parquet         every URL requested, with status and fetch time
"""

from __future__ import annotations

import gzip
import hashlib
import hmac
import json
import os
import secrets
import zlib
from concurrent.futures import ProcessPoolExecutor
from typing import Any

import pandas as pd

from ..log import get_logger
from ..net.cache import PageCache
from ..paths import DataPaths
from ..settings import Settings
from ..site.parse_story import parse_story_page
from ..site.urls import normalize_url, story_page_url, story_slug
from ..state import DONE, PARTIAL, State

log = get_logger("build")

COUNT_FIELDS = ("views", "favorites", "comments", "reading_lists", "rating_count")


def load_key_secret(paths: DataPaths) -> bytes:
    """A random secret created once and kept only in your data folder (never exported)."""
    p = paths.root / ".story_key_secret"
    if not p.exists():
        p.write_text(secrets.token_hex(32), encoding="utf-8")
    return bytes.fromhex(p.read_text(encoding="utf-8").strip())


def story_key(slug: str, secret: bytes) -> str:
    """Stable key for a story (HMAC-SHA256 of its slug with the local secret). Without the secret it cannot be
    matched back to a story URL, even by someone who hashes every public slug."""
    return hmac.new(secret, slug.encode("utf-8"), hashlib.sha256).hexdigest()[:16]


def _decode(body: bytes, headers_json: str | None) -> str:
    charset = "utf-8"
    try:
        ct = json.loads(headers_json or "{}").get("Content-Type") or ""
        if "charset=" in ct.lower():
            charset = ct.lower().split("charset=", 1)[1].split(";")[0].strip()
    except ValueError:
        pass
    try:
        return body.decode(charset, errors="replace")
    except LookupError:
        return body.decode("utf-8", errors="replace")


def _parse_story_task(task: dict[str, Any]) -> dict[str, Any]:
    """Runs in a worker process: parse all cached pages of one story and merge them."""
    pages_out: list[dict[str, Any]] = []
    fields: dict[str, Any] = {}
    sources: dict[str, str] = {}
    paragraphs: list[str] = []
    em = strong = 0
    warnings: list[str] = []
    max_page = None
    tags: set[str] = set()
    stats_at = None
    fetched = []
    for p in task["pages"]:
        path = p["path"]
        if not path or not os.path.exists(path):
            warnings.append(f"page{p['page_no']}:missing_from_cache")
            break
        try:
            with gzip.open(path, "rb") as fh:
                html = _decode(fh.read(), p["headers_json"])
        except (OSError, EOFError, zlib.error):  # saved copy cut short (e.g. by a power failure)
            warnings.append(f"page{p['page_no']}:unreadable_in_cache")
            break
        try:
            sp = parse_story_page(html, p["url"])
        except Exception as e:  # an unexpected page format: flag this story instead of stopping the build
            warnings.append(f"page{p['page_no']}:parse_error:{type(e).__name__}")
            break
        fetched.append(p["fetched_at"])
        pages_out.append({"story_slug": task["slug"], "page_no": p["page_no"], "url": p["url"],
                          "fetched_at": p["fetched_at"], "parse_status": sp.status,
                          "n_paragraphs": len(sp.paragraphs), "n_chars": sum(len(x) for x in sp.paragraphs),
                          "text_source": sp.text_source, "warnings": sp.warnings})
        warnings.extend(f"page{p['page_no']}:{w}" for w in sp.warnings)
        paragraphs.extend(sp.paragraphs)
        em += sp.em_count
        strong += sp.strong_count
        if sp.max_page:
            max_page = max(max_page or 0, sp.max_page)
        for k, v in sp.fields.items():
            if k == "tags":
                tags.update(v)
                continue
            if k.endswith("_approx"):
                continue
            if k in COUNT_FIELDS:
                approx = sp.fields.get(f"{k}_approx", False)
                if k not in fields or (fields.get(f"{k}_approx") and not approx):
                    fields[k], fields[f"{k}_approx"] = v, approx
                    sources[k] = f"{sp.sources.get(k)}@p{p['page_no']}"
                    if k == "views":
                        stats_at = p["fetched_at"]
            elif k not in fields:
                fields[k] = v
                sources[k] = f"{sp.sources.get(k)}@p{p['page_no']}"
    if tags:
        fields["tags"] = sorted(tags)
    return {"slug": task["slug"], "fields": fields, "sources": sources, "paragraphs": paragraphs, "em": em,
            "strong": strong, "max_page": max_page, "warnings": warnings, "pages": pages_out,
            "fetched_first": min(fetched) if fetched else None, "fetched_last": max(fetched) if fetched else None,
            "stats_at": stats_at}


def _first_listing(items: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for it in items:
        out.setdefault(it["story_slug"], it)
    return out


def _ts(x: Any) -> pd.Timestamp | None:
    return pd.to_datetime(x, unit="s", utc=True) if x else None


def build_raw(settings: Settings, workers: int = 0) -> dict[str, Any]:
    paths = DataPaths(settings.data_dir).ensure()
    state = State(paths.state_db)
    cache = PageCache(paths.cache)
    secret = load_key_secret(paths)
    base = settings.scope.base_url.rstrip("/")
    try:
        pages = {p["url"]: p for p in state.all_pages()}
        stories = state.stories()
        listing = state.listing_items()
        cats = state.categories()
        first_stub = _first_listing(listing)

        tasks = []
        for st in stories:
            if st["status"] not in (DONE, PARTIAL) or not st["pages_expected"]:
                continue
            canonical = story_slug(st["canonical_url"] or "") or st["story_slug"]
            task_pages = []
            for n in range(1, (st["pages_expected"] or 1) + 1):
                url = normalize_url(story_page_url(base, canonical, n), base)
                page = pages.get(url)
                if (page is None or page["status"] != "ok") and n == 1:
                    page = pages.get(normalize_url(story_page_url(base, st["story_slug"], 1), base))
                ok = page is not None and page["status"] == "ok" and cache.has(page["cache_key"])
                task_pages.append({"page_no": n, "url": url,
                                   "path": str(cache.path_for(page["cache_key"])) if ok else None,
                                   "fetched_at": page["fetched_at"] if ok else None,
                                   "headers_json": page["headers_json"] if ok else None})
            tasks.append({"slug": st["story_slug"], "pages": task_pages})

        n_workers = workers or max(1, min(8, (os.cpu_count() or 2) - 1))
        parsed: dict[str, dict[str, Any]] = {}
        if tasks:
            log.info("Parsing %d stories from the cache with %d worker(s)...", len(tasks), n_workers)
            if n_workers > 1 and len(tasks) > 20:
                with ProcessPoolExecutor(max_workers=n_workers) as ex:
                    for res in ex.map(_parse_story_task, tasks, chunksize=8):
                        parsed[res["slug"]] = res
            else:
                for t in tasks:
                    res = _parse_story_task(t)
                    parsed[res["slug"]] = res

        rows, page_rows = [], []
        for st in stories:
            slug = st["story_slug"]
            stub = first_stub.get(slug, {})
            extra = {}
            try:
                extra = json.loads(stub.get("extra_json") or "{}")
            except (TypeError, ValueError):
                pass
            row: dict[str, Any] = {
                "story_slug": slug, "story_key": story_key(slug, secret),
                "url": st["canonical_url"] or story_page_url(base, slug, 1),
                "queue_category_slug": st["category_slug"], "collection_status": st["status"],
                "collection_attempts": st["attempts"], "collection_error": st["last_error"],
                "n_pages_expected": st["pages_expected"], "n_pages_fetched": st["pages_fetched"],
                "listing_title": stub.get("title"), "listing_author": stub.get("author"),
                "listing_date_text": stub.get("date_text"), "listing_rating_text": stub.get("rating_text"),
                "listing_views_text": stub.get("views_text"), "listing_strategy": stub.get("strategy"),
                "listing_page_no": stub.get("page_no"), "listing_category_hint": extra.get("category_hint"),
            }
            res = parsed.get(slug)
            if res:
                f = res["fields"]
                for k, v in f.items():
                    row[k] = v
                row["text"] = "\n\n".join(res["paragraphs"]) if res["paragraphs"] else None
                row["n_paragraphs"] = len(res["paragraphs"])
                row["text_chars"] = len(row["text"] or "")
                row["text_sha1"] = hashlib.sha1((row["text"] or "").encode()).hexdigest() if row["text"] else None
                row["html_em_count"], row["html_strong_count"] = res["em"], res["strong"]
                row["n_pages_total"] = res["max_page"]
                row["n_pages_parsed"] = len(res["pages"])
                row["text_truncated"] = bool(res["max_page"] and res["max_page"] > len(res["pages"]))
                row["parse_warnings"] = res["warnings"]
                row["field_sources"] = json.dumps(res["sources"], sort_keys=True)
                row["fetched_at_first"] = _ts(res["fetched_first"])
                row["fetched_at_last"] = _ts(res["fetched_last"])
                row["stats_observed_at"] = _ts(res["stats_at"] or res["fetched_first"])
                page_rows.extend(res["pages"])
            else:
                row["parse_warnings"] = []
            if not row.get("category_slug"):
                row["category_slug"] = row.get("listing_category_hint") or st["category_slug"]
                row["category_source"] = "listing"
            else:
                row["category_source"] = "page"
            rows.append(row)

        df = pd.DataFrame(rows)
        for col in ("tags", "parse_warnings"):
            if col in df:
                df[col] = df[col].apply(lambda v: list(v) if isinstance(v, (list, tuple)) else [])
        df.to_parquet(paths.raw_stories, index=False, compression="zstd")
        pdf = pd.DataFrame(page_rows)
        if not pdf.empty:
            pdf["fetched_at"] = pd.to_datetime(pdf["fetched_at"], unit="s", utc=True)
        pdf.to_parquet(paths.raw_story_pages, index=False)
        pd.DataFrame(listing).to_parquet(paths.raw_listing_items, index=False)
        pd.DataFrame(cats).to_parquet(paths.raw_categories, index=False)
        pages_df = pd.DataFrame(list(pages.values()))
        if not pages_df.empty:
            pages_df["fetched_at"] = pd.to_datetime(pages_df["fetched_at"], unit="s", utc=True)
        pages_df.to_parquet(paths.raw_pages, index=False)
        summary = {"stories": len(df), "with_text": int(df["text"].notna().sum()) if "text" in df else 0,
                   "story_pages": len(pdf), "listing_items": len(listing), "categories": len(cats)}
        log.info("Raw corpus written to %s: %s", paths.raw, summary)
        return summary
    finally:
        state.close()
