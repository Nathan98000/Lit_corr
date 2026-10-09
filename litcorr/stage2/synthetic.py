"""A small synthetic Stage 2 handoff (invented numbers, no real stories) for tests.

    python -m litcorr.stage2.synthetic site/src/test/fixtures/aggregates

writes the website test fixtures: the aggregates built from this synthetic handoff. The Python tests also use an
extended version (`extended=True`) with more characteristics, three of which differ between genres on purpose.
"""

from __future__ import annotations

import io
import json
import sys
import tempfile
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

GENRES = [("romance", "Romance", 120, 1000.0), ("fetish", "Fetish", 150, 4000.0), ("tiny", "Tiny Genre", 8, 50.0)]

DICTIONARY = {"variables": [
    {"name": "dlg_word_share", "label": "Dialogue share", "group": "Dialogue", "ui_group": "Narration",
     "kind": "share", "unit": "share (0–1)", "description": "Share of words inside quotation marks.",
     "caveat": "", "explorer": True},
    {"name": "dlg_has_dialogue", "label": "Has dialogue", "group": "Dialogue", "ui_group": "Narration",
     "kind": "binary", "unit": "yes/no", "description": "Any dialogue at all.", "caveat": "", "explorer": True},
    {"name": "pov_class", "label": "Narrative perspective", "group": "Narration", "ui_group": "Narration",
     "kind": "categorical", "unit": "", "description": "Point of view.", "caveat": "", "explorer": True},
    {"name": "emo_anger_per_1k", "label": "Anger", "group": "Emotion", "ui_group": "Language",
     "kind": "continuous", "unit": "per 1,000 words", "description": "Anger words.", "caveat": "",
     "explorer": True},
    {"name": "story_key", "label": "Story key", "group": "Identifiers & category", "ui_group": "Identifiers",
     "kind": "id", "unit": "", "description": "", "caveat": "", "explorer": False},
]}

# The extended handoff's extra characteristics (for the Genres page's tests): publication year, story length and age
# (which some "Only include" options leave out), publication month (left out of that page), the author's number of
# stories (ordered bands), and three that differ between genres on purpose.
EXTENDED = [
    {"name": "pub_year", "label": "Publication year", "group": "Publication", "ui_group": "Publication",
     "kind": "count", "unit": "year", "description": "Year of publication.", "caveat": "", "explorer": True},
    {"name": "story_words", "label": "Word count", "group": "Story basics", "ui_group": "Story", "kind": "count",
     "unit": "words", "description": "Number of words.", "caveat": "", "explorer": True},
    {"name": "age_years", "label": "Years online", "group": "Publication", "ui_group": "Publication",
     "kind": "continuous", "unit": "years", "description": "Years online.", "caveat": "", "explorer": True},
    {"name": "pub_month", "label": "Publication month", "group": "Publication", "ui_group": "Publication",
     "kind": "count", "unit": "month (1–12)", "description": "Month of publication.", "caveat": "",
     "explorer": True},
    {"name": "author_stories_count", "label": "Author's story count", "group": "Site metadata", "ui_group": "Story",
     "kind": "count", "unit": "stories", "description": "Stories by the author.", "caveat": "", "explorer": True},
    {"name": "sex_terms_per_1k", "label": "Sexual language", "group": "Sexual content",
     "ui_group": "Sexual content", "kind": "continuous", "unit": "per 1,000 words",
     "description": "Sexual terms per 1,000 words.", "caveat": "", "explorer": True},
    {"name": "narr_tense_class", "label": "Narration tense", "group": "Narration", "ui_group": "Narration",
     "kind": "categorical", "unit": "present / past / mixed / unknown", "description": "Tense.", "caveat": "",
     "explorer": True},
    {"name": "pov_is_first_person", "label": "First-person narration", "group": "Narration",
     "ui_group": "Narration", "kind": "binary", "unit": "1 = first, 0 = third", "description": "First person.",
     "caveat": "", "explorer": True},
]

MANIFEST = {"processed_at": "2026-10-08T17:00:26+00:00", "collection_first_session": "2026-10-01T13:54:49",
            "collection_last_session": "2026-10-08T16:44:12", "stats_observed_range": ["2026-10-01", "2026-10-08"],
            "text_pipeline_version": "1.3"}


def synthetic_stories(seed: int = 7, extended: bool = False) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    for slug, _, n, size in GENRES:
        for i in range(n):
            words = float(np.round(rng.lognormal(8, 0.7)))
            dialogue = float(rng.uniform(0, 0.5))
            views = float(np.round(rng.lognormal(10, 0.6), -1))
            age = float(rng.uniform(0, 20))
            rows.append({
                "story_key": f"k{slug}{i:04d}", "queue_category_slug": slug, "category_slug": slug,
                "analysis_include": True, "has_text": True, "exclusion_reasons": [],
                "sampling_weight": size / n, "age_years": age,
                "pop_views_per_month": float(np.round(views / max(1.0, age * 12), 1)),
                "pub_year": float(rng.integers(2000, 2027)), "story_words": words,
                "pop_views": views, "pop_rating_count": float(rng.integers(0, 300)),
                # favorites per 1,000 views rise with the dialogue share: a pattern the build should report
                "pop_fav_per_1k_views": 0.2 + 2.0 * dialogue + float(rng.uniform(0, 0.2)),
                "pop_rating": float(rng.uniform(3, 5)) if i % 2 else np.nan,  # 50% coverage: not offered
                "dlg_word_share": dialogue, "dlg_has_dialogue": bool(dialogue > 0.15),
                "pov_class": "first" if i % 3 else "third", "emo_anger_per_1k": 0.0 if i % 2 else 1.0 + (i % 7) * 0.37,
            })
    rows.append({**rows[0], "story_key": "kexcluded", "analysis_include": False, "has_text": False,
                 "exclusion_reasons": ["no_text"]})
    df = pd.DataFrame(rows)
    if extended:  # drawn after the stories above, so the default handoff stays the same
        x = np.random.default_rng(seed + 1)
        n = len(df)
        rom = (df["queue_category_slug"] == "romance").to_numpy()
        bands = np.array([1, 2, 6, 21, 51, 101, 201], dtype=float)
        df["pub_month"] = x.integers(1, 13, n).astype(float)
        # Romance: more prolific authors, less sexual language, more present-tense and first-person narration
        df["author_stories_count"] = np.where(rom, x.choice(bands, n, p=[.05, .1, .15, .2, .2, .15, .15]),
                                              x.choice(bands, n, p=[.3, .3, .2, .1, .05, .03, .02]))
        df["sex_terms_per_1k"] = np.round(np.where(rom, x.lognormal(1.5, 0.5, n), x.lognormal(2.5, 0.5, n)), 2)
        tenses = ["present", "past", "mixed"]
        df["narr_tense_class"] = np.where(rom, x.choice(tenses, n, p=[.6, .3, .1]), x.choice(tenses, n, p=[.1, .85, .05]))
        first = np.where(rom, x.uniform(size=n) < 0.85, x.uniform(size=n) < 0.4).astype(float)
        first[x.uniform(size=n) < 0.1] = np.nan  # second person or mixed: neither
        df["pov_is_first_person"] = first
    return df


def write_synthetic_handoff(folder: Path, seed: int = 7, extended: bool = False) -> tuple[Path, pd.DataFrame]:
    df = synthetic_stories(seed, extended)
    cats = pd.DataFrame([{"category_slug": s, "category_name": nm, "selected": True,
                          "estimated_stories_in_category": size} for s, nm, _, size in GENRES])
    path = folder / "litcorr_stage2_handoff_20261008.zip"
    with zipfile.ZipFile(path, "w") as z:
        for name, frame in (("stories_features.parquet", df), ("category_frame.parquet", cats)):
            buf = io.BytesIO()
            frame.to_parquet(buf, index=False)
            z.writestr(name, buf.getvalue())
        z.writestr("data_dictionary.json",
                   json.dumps({"variables": DICTIONARY["variables"] + EXTENDED} if extended else DICTIONARY))
        z.writestr("collection_manifest.json", json.dumps(MANIFEST))
    return path, df


if __name__ == "__main__":
    from .site_data import build_site_data

    out = Path(sys.argv[1] if len(sys.argv) > 1 else "site/src/test/fixtures/aggregates")
    with tempfile.TemporaryDirectory() as tmp:
        handoff, _ = write_synthetic_handoff(Path(tmp))
        print(build_site_data(handoff, out, workers=1))
