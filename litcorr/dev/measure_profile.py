"""`measure_profile`: a diffable statistical profile of every measure in the processed table.

  python -m litcorr.dev.measure_profile save NAME [--features PATH] [--population included|text]
  python -m litcorr.dev.measure_profile diff OLD NEW            (two saved profiles: aggregate changes)
  python -m litcorr.dev.measure_profile diff-features OLD.parquet NEW.parquet
                                                                 (same stories, before vs after a code change)

`save` writes data/dev/profiles/NAME/:
  overall.tsv       one row per numeric measure: N, % missing, % zero, min, p1, median, mean, sd, p99, max
  by_category.tsv   the same per category
  categorical.tsv   value shares of the categorical measures, overall and per category
  outliers.tsv      the 5 lowest and 5 highest story_keys per measure (keys only, never text)
  meta.json         population, source file and versions

Numbers are written with 6 significant digits and rows are sorted, so two profiles can be compared with any
diff tool. The population is the analysed stories (analysis_include) unless --population text is given.
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from ..schema import BY_NAME, REG
from .common import dev_dir, load_features, paths, settings

NUMERIC_KINDS = ("continuous", "count", "share", "binary")
STATS = ("n", "pct_missing", "pct_zero", "min", "p1", "median", "mean", "sd", "p99", "max")


def fmt(x) -> str:
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return ""
    if isinstance(x, (int, np.integer)):
        return str(int(x))
    return f"{float(x):.6g}"


def numeric_measures(df: pd.DataFrame) -> list[str]:
    cols = [x.name for x in REG if x.kind in NUMERIC_KINDS and x.name in df.columns and x.ui_group != "Identifiers"]
    extra = [c for c in df.columns if c not in BY_NAME and pd.api.types.is_numeric_dtype(df[c])]
    return cols + extra


def categorical_measures(df: pd.DataFrame) -> list[str]:
    return [x.name for x in REG if x.kind == "categorical" and x.name in df.columns and x.ui_group != "Identifiers"]


def population(df: pd.DataFrame, which: str = "included") -> pd.DataFrame:
    if which == "text":
        return df[df["has_text"].fillna(False).astype(bool)]
    return df[df["analysis_include"].fillna(False).astype(bool)]


def describe(s: pd.Series) -> dict[str, float]:
    s = pd.to_numeric(s, errors="coerce").astype(float)
    n_all = len(s)
    v = s.dropna()
    n = len(v)
    out = {"n": n, "pct_missing": 100.0 * (n_all - n) / n_all if n_all else np.nan}
    if n:
        q = v.quantile([0.01, 0.5, 0.99])
        out.update(pct_zero=100.0 * float((v == 0).mean()), min=float(v.min()), p1=float(q[0.01]),
                   median=float(q[0.5]), mean=float(v.mean()), sd=float(v.std()) if n > 1 else np.nan,
                   p99=float(q[0.99]), max=float(v.max()))
    else:
        out.update({k: np.nan for k in STATS[2:]})
    return out


def build_profile(df: pd.DataFrame, which: str = "included") -> dict[str, pd.DataFrame]:
    pop = population(df, which)
    cat = pop["category_slug"].fillna("(none)")
    rows, crows, orows, krows = [], [], [], []
    for m in numeric_measures(pop):
        rows.append({"measure": m, **describe(pop[m])})
        for c, sub in pop.groupby(cat, sort=True):
            crows.append({"measure": m, "category": c, **describe(sub[m])})
        v = pd.to_numeric(pop[m], errors="coerce").astype(float)
        ok = v.notna()
        if ok.sum() and v[ok].nunique() > 1:
            order = v[ok].sort_values(kind="mergesort")
            keys = pop.loc[order.index, "story_key"]
            for side, idx in (("low", order.index[:5]), ("high", order.index[::-1][:5])):
                for rank, i in enumerate(idx, 1):
                    orows.append({"measure": m, "side": side, "rank": rank, "story_key": keys[i], "value": v[i]})
    for m in categorical_measures(pop):
        vals = pop[m].fillna("(missing)").astype(str)
        for c, sub in [("(all)", vals)] + list(vals.groupby(cat, sort=True)):
            shares = sub.value_counts(normalize=True)
            for val, sh in shares.items():
                krows.append({"measure": m, "category": c, "value": val, "share": sh, "n": len(sub)})
    return {"overall": pd.DataFrame(rows).sort_values("measure"),
            "by_category": pd.DataFrame(crows).sort_values(["measure", "category"]),
            "outliers": pd.DataFrame(orows, columns=["measure", "side", "rank", "story_key", "value"]),
            "categorical": pd.DataFrame(krows).sort_values(["measure", "category", "value"])}


def write_profile(prof: dict[str, pd.DataFrame], out: Path, meta: dict) -> Path:
    out.mkdir(parents=True, exist_ok=True)
    for name, frame in prof.items():
        frame = frame.copy()
        for c in frame.columns:
            if pd.api.types.is_numeric_dtype(frame[c]) and c not in ("rank",):
                frame[c] = frame[c].map(fmt)
        frame.to_csv(out / f"{name}.tsv", sep="\t", index=False)
    (out / "meta.json").write_text(json.dumps(meta, indent=2, default=str), encoding="utf-8")
    return out


def save(name: str, features: Path | None = None, which: str = "included", out_root: Path | None = None) -> Path:
    s = settings()
    src = Path(features) if features else paths(s).features
    df = load_features(s, src)
    manifest = {}
    mpath = src.parent / "collection_manifest.json"
    if mpath.exists():
        manifest = json.loads(mpath.read_text(encoding="utf-8"))
    meta = {"name": name, "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "source": str(src), "source_mtime": datetime.fromtimestamp(src.stat().st_mtime, timezone.utc).isoformat(),
            "population": which, "n_rows": int(len(df)), "n_population": int(len(population(df, which))),
            "pipeline_version": manifest.get("pipeline_version"),
            "text_pipeline_version": manifest.get("text_pipeline_version"),
            "lexicon_hash": manifest.get("lexicon_hash")}
    out = (out_root or dev_dir(s) / "profiles") / name
    return write_profile(build_profile(df, which), out, meta)


# ------------------------------------------------------------------------------------------- diffs
def _read(p: Path, name: str) -> pd.DataFrame:
    return pd.read_csv(p / f"{name}.tsv", sep="\t", keep_default_na=False, na_values=[""])


def diff_profiles(old: Path, new: Path, rel_tol: float = 1e-6) -> str:
    a, b = _read(old, "overall").set_index("measure"), _read(new, "overall").set_index("measure")
    lines = [f"# Profile diff: {old.name} -> {new.name}", ""]
    ma, mb = json.loads((old / "meta.json").read_text()), json.loads((new / "meta.json").read_text())
    lines.append(f"Population: {ma.get('n_population')} -> {mb.get('n_population')} stories")
    added, removed = sorted(set(b.index) - set(a.index)), sorted(set(a.index) - set(b.index))
    if added:
        lines.append(f"New measures ({len(added)}): " + ", ".join(added))
    if removed:
        lines.append(f"Removed measures ({len(removed)}): " + ", ".join(removed))
    changed = []
    for m in sorted(set(a.index) & set(b.index)):
        ra, rb = a.loc[m], b.loc[m]
        deltas = {}
        for k in ("pct_missing", "median", "mean", "p99", "max", "min", "pct_zero"):
            x, y = ra[k], rb[k]
            if (pd.isna(x) and pd.isna(y)) or (not pd.isna(x) and not pd.isna(y) and
                                                abs(x - y) <= rel_tol * max(1.0, abs(x), abs(y))):
                continue
            deltas[k] = (x, y)
        if deltas:
            changed.append((m, deltas))
    lines += ["", f"Measures with changed overall statistics: {len(changed)}", "",
              "| Measure | % missing | median | mean | p99 |", "|---|---|---|---|---|"]
    for m, d in changed:
        cell = lambda k: (f"{fmt(d[k][0])} → {fmt(d[k][1])}" if k in d else "")  # noqa: E731
        lines.append(f"| `{m}` | {cell('pct_missing')} | {cell('median')} | {cell('mean')} | {cell('p99')} |")
    return "\n".join(lines) + "\n"


def diff_features(old_path: Path, new_path: Path, which: str = "included") -> pd.DataFrame:
    """Per measure, on the stories present (and in the population) in BOTH files: how many values changed and how
    the median / mean / missing rate moved. This is the before/after table used for CHANGELOG entries."""
    a = population(pd.read_parquet(old_path), which).set_index("story_key")
    b = population(pd.read_parquet(new_path), which).set_index("story_key")
    common = a.index.intersection(b.index)
    a, b = a.loc[common], b.loc[common]
    rows = []
    for m in sorted(set(numeric_measures(a.reset_index())) | set(numeric_measures(b.reset_index()))):
        x = pd.to_numeric(a[m], errors="coerce").astype(float) if m in a else pd.Series(np.nan, index=common)
        y = pd.to_numeric(b[m], errors="coerce").astype(float) if m in b else pd.Series(np.nan, index=common)
        same = (x.isna() & y.isna()) | np.isclose(x.fillna(0), y.fillna(0), rtol=1e-9, atol=1e-12) & (x.notna() == y.notna())
        n_changed = int((~same).sum())
        if not n_changed:
            continue
        rows.append({"measure": m, "stories": len(common), "n_changed": n_changed,
                     "pct_changed": 100.0 * n_changed / len(common),
                     "median_old": x.median(), "median_new": y.median(), "mean_old": x.mean(), "mean_new": y.mean(),
                     "missing_old_pct": 100.0 * x.isna().mean(), "missing_new_pct": 100.0 * y.isna().mean(),
                     "corr_old_new": x.corr(y) if (x.notna() & y.notna()).sum() > 2 else np.nan})
    for m in categorical_measures(a.reset_index()):
        if m not in b:
            continue
        x, y = a[m].astype(str), b[m].astype(str)
        n_changed = int((x != y).sum())
        if n_changed:
            rows.append({"measure": m, "stories": len(common), "n_changed": n_changed,
                         "pct_changed": 100.0 * n_changed / len(common)})
    return pd.DataFrame(rows)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m litcorr.dev.measure_profile", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sv = sub.add_parser("save")
    sv.add_argument("name")
    sv.add_argument("--features", default=None)
    sv.add_argument("--population", choices=("included", "text"), default="included")
    df_ = sub.add_parser("diff")
    df_.add_argument("old")
    df_.add_argument("new")
    dfe = sub.add_parser("diff-features")
    dfe.add_argument("old")
    dfe.add_argument("new")
    dfe.add_argument("--out", default=None, help="also write the table as TSV here")
    args = ap.parse_args(argv)
    s = settings()
    root = dev_dir(s) / "profiles"
    if args.cmd == "save":
        print(f"profile written to {save(args.name, args.features, args.population)}")
    elif args.cmd == "diff":
        resolve = lambda x: Path(x) if Path(x).exists() else root / x  # noqa: E731
        print(diff_profiles(resolve(args.old), resolve(args.new)))
    else:
        t = diff_features(Path(args.old), Path(args.new))
        if args.out:
            t.to_csv(args.out, sep="\t", index=False, float_format="%.6g")
        with pd.option_context("display.max_rows", 500, "display.width", 200):
            print(t.to_string(index=False, float_format=lambda x: f"{x:.4g}") if len(t) else "no changes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
