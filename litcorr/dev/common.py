"""Shared helpers for the developer tools: locations and safe loading of the raw corpus."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from ..paths import DataPaths
from ..settings import Settings, load_settings


def settings(config: str | None = None) -> Settings:
    return load_settings(config)


def dev_dir(s: Settings) -> Path:
    p = s.data_dir / "dev"
    p.mkdir(parents=True, exist_ok=True)
    return p


def paths(s: Settings) -> DataPaths:
    return DataPaths(s.data_dir)


def load_texts(s: Settings, keys: list[str] | None = None,
               columns: tuple[str, ...] = ("story_key", "text")) -> pd.DataFrame:
    """Story keys with their text (stories without text are dropped). Text stays in memory; never print it."""
    raw = pd.read_parquet(paths(s).raw_stories, columns=list(columns))
    raw = raw[raw["text"].notna()]
    if keys is not None:
        raw = raw[raw["story_key"].isin(set(keys))]
    return raw.reset_index(drop=True)


def load_features(s: Settings, path: Path | None = None) -> pd.DataFrame:
    return pd.read_parquet(path or paths(s).features)


def paragraphs_of(text: str) -> list[str]:
    """The paragraphs exactly as analyze.py hands them to the measures."""
    return text.split("\n\n") if isinstance(text, str) and text else []
