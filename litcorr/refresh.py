"""`refresh`: bring the processed data up to date with the collection so far (offline, no export).

build-raw and analyze only redo the stories that are new or changed (see their caches), then the quality report is
rewritten and a statistical profile of every measure is compared with the one from the previous refresh. Safe to
run while the collector is running: the state database is only ever read (``State.snapshot``).
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import pandas as pd

from .log import get_logger
from .paths import DataPaths
from .settings import Settings

log = get_logger("refresh")


def _profile(paths: DataPaths) -> tuple[Path, Path | None]:
    from .dev.measure_profile import build_profile, write_profile

    df = pd.read_parquet(paths.features)
    manifest = json.loads(paths.manifest.read_text(encoding="utf-8"))
    root = paths.refresh_profiles
    earlier = sorted(p for p in root.glob("*") if p.is_dir()) if root.exists() else []
    stamp = manifest["processed_at"].replace("-", "").replace(":", "").replace("+0000", "Z")
    prof = build_profile(df)
    prof.pop("outliers")  # story keys are not needed to compare two refreshes
    meta = {"name": stamp, "processed_at": manifest["processed_at"], "n_rows": int(len(df)),
            "n_population": int(df["analysis_include"].sum()),
            "text_pipeline_version": manifest.get("text_pipeline_version"),
            "lexicon_hash": manifest.get("lexicon_hash")}
    out = write_profile(prof, root / stamp, meta)
    previous = next((p for p in reversed(earlier) if p.name != stamp and (p / "overall.tsv").exists()), None)
    return out, previous


def _largest_median_shifts(old: Path, new: Path, k: int = 5) -> list[str]:
    a = pd.read_csv(old / "overall.tsv", sep="\t").set_index("measure")["median"]
    b = pd.read_csv(new / "overall.tsv", sep="\t").set_index("measure")["median"]
    both = pd.concat([a, b], axis=1, keys=["old", "new"]).dropna()
    rel = (both["new"] - both["old"]).abs() / both["old"].abs().clip(lower=1e-9)
    top = rel[rel > 0].sort_values(ascending=False).head(k)
    return [f"{m} {both.loc[m, 'old']:.4g} -> {both.loc[m, 'new']:.4g}" for m in top.index]


def run_refresh(settings: Settings, workers: int = 0, full: bool = False) -> str:
    from .analyze import run_analyze
    from .build.quality import quality_report
    from .build.raw_corpus import build_raw
    from .dev.measure_profile import diff_profiles

    paths = DataPaths(settings.data_dir).ensure()
    t0 = time.time()
    raw = build_raw(settings, workers=workers, full=full)
    proc = run_analyze(settings, workers=workers, full=full)
    quality_report(settings)
    progress: dict[str, Any] = json.loads(paths.manifest.read_text(encoding="utf-8"))["collection_progress"]
    new, previous = _profile(paths)
    lines = [f"Refresh finished in {time.time() - t0:.0f} s (offline; nothing exported).",
             f"  build-raw: {raw['stories']:,} stories, {raw['with_text']:,} with text; {raw['parsed']:,} parsed, "
             f"{raw['reused']:,} unchanged and reused",
             f"  analyze:   {proc['included']:,} stories included; {proc['measured']:,} measured, "
             f"{proc['from_cache']:,} unchanged and taken from the cache"]
    if progress["complete"]:
        lines.append(f"  collection: complete ({progress['collected']:,} of {progress['sampled']:,} sampled stories)")
    else:
        lines.append(f"  collection: PARTIAL, {progress['collected']:,} of {progress['sampled']:,} sampled stories "
                     f"collected ({progress['share_collected']:.0%}); sampling weights are provisional")
    lines.append(f"  quality report: {paths.quality_md}")
    if previous is not None:
        diff = diff_profiles(previous, new)
        (paths.refresh_profiles / "latest_diff.md").write_text(diff, encoding="utf-8")
        ma = json.loads((previous / "meta.json").read_text(encoding="utf-8"))
        changed = next((ln for ln in diff.splitlines() if ln.startswith("Measures with changed")), "")
        lines += [f"  compared with the refresh of {ma.get('processed_at')}: analysed stories "
                  f"{ma.get('n_population'):,} -> {proc['included']:,}; {changed.lower()}"]
        shifts = _largest_median_shifts(previous, new)
        if shifts:
            lines.append("    largest relative median changes: " + "; ".join(shifts))
        lines.append(f"    full comparison: {paths.refresh_profiles / 'latest_diff.md'}")
    else:
        lines.append(f"  first refresh profile saved to {new} (the next refresh is compared with it)")
    return "\n".join(lines)
