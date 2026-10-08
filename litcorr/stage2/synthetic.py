"""A small synthetic Stage 2 handoff (invented numbers, no real stories) for tests.

    python -m litcorr.stage2.synthetic site/src/test/fixtures/aggregates

writes the website test fixtures: the aggregates built from this synthetic handoff.
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

MANIFEST = {"processed_at": "2026-10-08T17:00:26+00:00", "collection_first_session": "2026-10-01T13:54:49",
            "collection_last_session": "2026-10-08T16:44:12", "stats_observed_range": ["2026-10-01", "2026-10-08"],
            "text_pipeline_version": "1.3"}


def synthetic_stories(seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    for slug, _, n, size in GENRES:
        for i in range(n):
            words = float(np.round(rng.lognormal(8, 0.7)))
            dialogue = float(rng.uniform(0, 0.5))
            views = float(np.round(rng.lognormal(10, 0.6), -1))
            rows.append({
                "story_key": f"k{slug}{i:04d}", "queue_category_slug": slug, "category_slug": slug,
                "analysis_include": True, "has_text": True, "exclusion_reasons": [],
                "sampling_weight": size / n, "age_years": float(rng.uniform(0, 20)),
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
    return pd.DataFrame(rows)


def write_synthetic_handoff(folder: Path, seed: int = 7) -> tuple[Path, pd.DataFrame]:
    df = synthetic_stories(seed)
    cats = pd.DataFrame([{"category_slug": s, "category_name": nm, "selected": True,
                          "estimated_stories_in_category": size} for s, nm, _, size in GENRES])
    path = folder / "litcorr_stage2_handoff_20261008.zip"
    with zipfile.ZipFile(path, "w") as z:
        for name, frame in (("stories_features.parquet", df), ("category_frame.parquet", cats)):
            buf = io.BytesIO()
            frame.to_parquet(buf, index=False)
            z.writestr(name, buf.getvalue())
        z.writestr("data_dictionary.json", json.dumps(DICTIONARY))
        z.writestr("collection_manifest.json", json.dumps(MANIFEST))
    return path, df


if __name__ == "__main__":
    from .site_data import build_site_data

    out = Path(sys.argv[1] if len(sys.argv) > 1 else "site/src/test/fixtures/aggregates")
    with tempfile.TemporaryDirectory() as tmp:
        handoff, _ = write_synthetic_handoff(Path(tmp))
        print(build_site_data(handoff, out, workers=1))
