"""Directory layout under the configured data directory.

    data/
      state.sqlite3      progress database (what has been fetched, the request log)
      cache/pages/       every downloaded page, gzip-compressed (never fetched twice)
      raw/               parsed records built from the cache (includes story text)
      processed/         analysis-ready tables (no story text), reports, dictionary
      logs/              human-readable log, request log, error log, probe output
      handoff/           the zip file to give back for Stage 2
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class DataPaths:
    root: Path

    @property
    def state_db(self) -> Path:
        return self.root / "state.sqlite3"

    @property
    def cache(self) -> Path:
        return self.root / "cache"

    @property
    def raw(self) -> Path:
        return self.root / "raw"

    @property
    def processed(self) -> Path:
        return self.root / "processed"

    @property
    def logs(self) -> Path:
        return self.root / "logs"

    @property
    def handoff(self) -> Path:
        return self.root / "handoff"

    @property
    def lock_file(self) -> Path:
        return self.root / ".collector.lock"

    @property
    def derived(self) -> Path:
        """Re-creatable intermediate results without story text (the per-story measure cache, refresh profiles)."""
        return self.root / "derived"

    def ensure(self) -> "DataPaths":
        for p in (self.root, self.cache, self.raw, self.processed, self.logs, self.handoff, self.derived):
            p.mkdir(parents=True, exist_ok=True)
        return self

    # Raw outputs
    @property
    def raw_stories(self) -> Path:
        return self.raw / "stories.parquet"

    @property
    def raw_story_pages(self) -> Path:
        return self.raw / "story_pages.parquet"

    @property
    def raw_listing_items(self) -> Path:
        return self.raw / "listing_items.parquet"

    @property
    def raw_categories(self) -> Path:
        return self.raw / "categories.parquet"

    @property
    def raw_pages(self) -> Path:
        return self.raw / "pages.parquet"

    @property
    def parse_cache(self) -> Path:
        """Parsed story pages from earlier build-raw runs (contains story text, so it stays in raw/)."""
        return self.raw / "parse_cache.parquet"

    @property
    def measure_cache(self) -> Path:
        """Text measures from earlier analyze runs, one row per story (no text)."""
        return self.derived / "text_measures.parquet"

    @property
    def refresh_profiles(self) -> Path:
        return self.derived / "profiles"

    # Processed outputs
    @property
    def features(self) -> Path:
        return self.processed / "stories_features.parquet"

    @property
    def features_csv(self) -> Path:
        return self.processed / "stories_features.csv"

    @property
    def category_frame(self) -> Path:
        return self.processed / "category_frame.parquet"

    @property
    def quality_md(self) -> Path:
        return self.processed / "quality_report.md"

    @property
    def quality_json(self) -> Path:
        return self.processed / "quality_report.json"

    @property
    def dictionary_json(self) -> Path:
        return self.processed / "data_dictionary.json"

    @property
    def manifest(self) -> Path:
        return self.processed / "collection_manifest.json"
