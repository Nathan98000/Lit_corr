"""`site-data`: build the website's precomputed aggregates from the Stage 2 handoff zip.

Input: data/handoff/litcorr_stage2_handoff_YYYYMMDD.zip (the authoritative corpus; nothing else is read).
Output (default site/public/aggregates/):

  meta.json                  genres, popularity measures, story characteristics (labels, descriptions,
                             groups of stories, and whether their noun is plural), the "stories included" options,
                             collection facts, and the Trends page's periods, rule and genres too few to compare
  v/<characteristic>/<included>.json
                             for every genre (and "all"): per group of stories, the number of stories, their
                             median age, and per popularity measure the median, quartiles and mean; plus the
                             genre's overall figures and a pattern summary used to word the chart title
  patterns.json              the pattern summaries of the v/ files ("All stories"), one character per
                             characteristic, for the Patterns page
  genres/<included>.json     the Genres page: for every characteristic (but publication month and weekday) and
                             every genre, the number of stories and their quartiles or shares, with the rank-biserial
                             correlation (or, for named groups, the total variation distance) against all genres and
                             whether the genre clearly differs (GENRE_*); plus each genre's number of stories and
                             median age
  trends/<included>/<genre>.json
                             the Trends page (trends.py), for All stories and the Length options: for every
                             characteristic but the left-out ones, per five-year period of publication year the number
                             of stories and their quartiles or shares, and the stories from 2020 or later compared with
                             those from 2000-2009 (TREND_*)

Only summaries leave this step: groups with fewer than MIN_N stories are left out, and no minimum, maximum
or per-story value is written. "All genres" weights each story by its category's sampling weight, so big
categories count in proportion to their size on Literotica; within one genre all stories weigh the same.
"""

from __future__ import annotations

import io
import json
import math
import os
import shutil
import time
import zipfile
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from ..log import get_logger
from ..settings import PROJECT_ROOT
from . import wording as W
from .stats import (effective_n, rank_biserial_se, sig, spearman_ci, weighted_auc, weighted_mean,
                    weighted_quantiles, weighted_spearman)



log = get_logger("site-data")

MIN_N = 10        # groups with fewer stories are not shown at all
SMALL_N = 30      # groups with fewer stories are shown as uncertain and never support a pattern statement
PATTERN_MIN_EFFECT = 0.10   # |rank correlation| needed before a title says "tend to"
PATTERN_Z = 2.576           # ...it must be clear of zero at the 99% level (the site offers many charts)
PATTERN_MIN_GAP = 0.10      # ...and the end groups' medians must differ by at least this share,
RATING_MIN_GAP = 0.1        # ...or, for the average rating (a 1-5 scale), by at least this many stars
ZERO_BIN_SHARE = 0.15       # a characteristic that is exactly 0 this often gets its own "None" group
GENRE_MIN_R = 0.20          # Genres page: |rank-biserial r| a genre needs before it "clearly differs" from all genres
GENRE_Z = 3.29              # ...it must be clear of zero at the 99.9% level (the page makes thousands of comparisons)
GENRE_MIN_TVD = 0.20        # named groups: the total variation distance from the all-genres mix needed
GENRE_CHI2 = {1: 10.828, 2: 13.816, 3: 16.266, 4: 18.467, 5: 20.515, 6: 22.458}  # ...and chi-square at 99.9%, by df
DEFAULT_OUT = PROJECT_ROOT / "site" / "public" / "aggregates"


# ------------------------------------------------------------------------------------------------ loading
@dataclass
class Handoff:
    path: Path
    stories: pd.DataFrame
    categories: pd.DataFrame
    dictionary: list[dict[str, Any]]
    manifest: dict[str, Any]


def latest_handoff(root: Path = PROJECT_ROOT / "data" / "handoff") -> Path:
    zips = sorted(root.glob("litcorr_stage2_handoff_*.zip"))
    if not zips:
        raise FileNotFoundError(f"No handoff zip in {root}; run `python -m litcorr process` first.")
    return zips[-1]


def load_handoff(path: Path) -> Handoff:
    with zipfile.ZipFile(path) as z:
        stories = pd.read_parquet(io.BytesIO(z.read("stories_features.parquet")))
        categories = pd.read_parquet(io.BytesIO(z.read("category_frame.parquet")))
        dictionary = json.loads(z.read("data_dictionary.json"))["variables"]
        manifest = json.loads(z.read("collection_manifest.json"))
    return Handoff(path, stories, categories, dictionary, manifest)


def _numeric(s: pd.Series) -> np.ndarray:
    if s.dtype == bool or str(s.dtype) == "boolean":
        s = s.astype("float64")
    return pd.to_numeric(s, errors="coerce").to_numpy(dtype="float64", na_value=np.nan)


# ------------------------------------------------------------------------------------------------ binning
_MANTISSAS = (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10)


def nice(v: float) -> float:
    """The closest 'round' number (1, 1.2, 1.5, 2, 2.5, 3, 4 ... times a power of ten)."""
    if v == 0 or not math.isfinite(v):
        return 0.0
    a = abs(v)
    base = 10 ** math.floor(math.log10(a))
    best = min((m * base for m in _MANTISSAS), key=lambda c: abs(c - a))
    return math.copysign(float(f"{best:.12g}"), v)


def nice_step(s: float) -> float:
    base = 10 ** math.floor(math.log10(s))
    return next(m * base for m in (1, 2, 2.5, 5, 10) if m * base >= s * 0.999)


@dataclass
class Bins:
    """How one characteristic splits stories into groups."""

    type: str                     # "ranges" | "levels"
    labels: list[str]
    ordered: bool                 # groups have a natural order (a pattern can be read along them)
    binary: bool = False
    edges: list[float] = field(default_factory=list)   # ranges: group i is [edges[i-1], edges[i])
    zero: bool = False            # ranges: an extra first group for exactly 0
    values: list[Any] = field(default_factory=list)    # levels: the value of each group
    tail: bool = False            # levels: the last group also takes every larger value

    def codes(self, x: np.ndarray) -> np.ndarray:
        out = np.full(len(x), -1, dtype=np.int16)
        if self.type == "ranges":
            ok = np.isfinite(x)
            if self.zero:
                out[ok & (x == 0)] = 0
                pos = ok & (x != 0)
                out[pos] = np.searchsorted(self.edges, x[pos], side="right") + 1
            else:
                out[ok] = np.searchsorted(self.edges, x[ok], side="right")
            return out
        last = len(self.values) - 1
        for i, v in enumerate(self.values):
            if isinstance(v, str):
                hit = x == v
            elif self.tail and i == last:
                hit = x >= float(v) - 1e-9
            else:
                hit = np.isclose(x, float(v))
            out[np.asarray(hit, dtype=bool) & (out == -1)] = i
        return out

    def to_json(self) -> dict[str, Any]:
        return {"type": self.type, "labels": [W.us_english(lab) for lab in self.labels], "ordered": self.ordered}


def _fmt(v: float, style: str) -> str:
    if style == "percent":
        p = v * 100
        txt = f"{p:.3g}" if abs(p) < 100 else f"{p:.0f}"
        return f"{float(txt):g}".replace("-", "−")
    if style == "year":
        return str(int(round(v)))
    if abs(v) >= 1000:
        return f"{v:,.0f}".replace("-", "−")
    return f"{float(f'{v:.3g}'):g}".replace("-", "−")


def _range_labels(edges: list[float], lo: float, hi: float, style: str, exact_ints: bool) -> list[str]:
    pct = "%" if style == "percent" else ""
    f = (lambda v: _fmt(v, style))
    signed = any(e < 0 for e in edges)
    if exact_ints:
        bounds = [lo] + edges + [hi + 1]
        out = []
        for a, b in zip(bounds, bounds[1:]):
            a, b = int(round(a)), int(round(b)) - 1
            if b == int(round(hi)) and style != "year" and b > a:
                out.append(f"{f(a)}+")
            else:
                out.append(f(a) if b <= a else f"{f(a)}–{f(b)}")
        return out
    sep = " to " if signed else "–"
    labels = [f"Under {f(edges[0])}{pct}"]
    labels += [f"{f(a)}{sep}{f(b)}{pct}" if signed else f"{f(a)}–{f(b)}{pct}" for a, b in zip(edges, edges[1:])]
    if edges[-1] >= hi:
        labels.append(f"{f(hi)}{pct}")
    else:
        labels.append(f"{f(edges[-1])}{pct}+" if not signed else f"{f(edges[-1])}{pct} or more")
    return labels


def _integer_groups(x: np.ndarray, w: np.ndarray, min_share: float = 0.05) -> list[float]:
    """Edges for whole numbers: consecutive values are joined until each group holds min_share of stories;
    a small remainder at the top joins the last group."""
    values = np.unique(x)
    shares = np.array([w[x == v].sum() for v in values]) / w.sum()
    starts, acc = [values[0]], 0.0
    for v, s in zip(values, shares):
        if acc >= min_share:
            starts.append(v)
            acc = 0.0
        acc += s
    if acc < min_share and len(starts) > 1:
        starts.pop()
    return [float(v) for v in starts[1:]]


def value_style(name: str, kind: str, unit: str) -> str:
    """How a characteristic's values are written: "percent" (shares and positions), "year" or "num"."""
    if kind == "share" or unit.startswith(("share", "position")):
        return "percent"
    return "year" if name == "pub_year" else "num"


def make_bins(name: str, kind: str, unit: str, values: pd.Series, w: np.ndarray) -> Bins | None:
    """Groups for one characteristic, decided once from all included stories (weighted)."""
    if name in W.LEVELS:
        lv = W.LEVELS[name]
        return Bins("levels", [lab for _, lab in lv], ordered=False, values=[v for v, _ in lv])
    if name in W.ORDINAL_LEVELS:
        lv = W.ORDINAL_LEVELS[name]
        return Bins("levels", [lab for _, lab in lv], ordered=True, values=[v for v, _ in lv],
                    tail=name == "author_stories_count")
    if kind == "binary":
        yes, no = W.BINARY[name][:2]
        return Bins("levels", [yes, no], ordered=False, binary=True, values=[1.0, 0.0])
    x = _numeric(values)
    ok = np.isfinite(x)
    if ok.sum() < 50:
        return None
    xv, wv = x[ok], w[ok]
    integer = bool(np.all(np.isclose(xv, np.round(xv))))
    distinct = np.unique(xv)
    if integer and len(distinct) <= 12:  # a handful of whole numbers: one group per value (or run of values)
        edges = _integer_groups(xv, wv)
        if not edges:
            return None
        return Bins("ranges", _range_labels(edges, float(xv.min()), float(xv.max()), "num", True),
                    ordered=True, edges=edges)
    style = value_style(name, kind, unit)
    lo, hi = float(xv.min()), float(xv.max())
    signed = lo < 0
    zero_share = float(wv[xv == 0].sum() / wv.sum())
    zero = zero_share >= ZERO_BIN_SHARE and not signed
    if zero:
        pos = xv > 0
        k = int(min(4, max(1, round((1 - zero_share) / 0.15))))
        base_x, base_w = xv[pos], wv[pos]
    else:
        k, base_x, base_w = 5, xv, wv
    qv = list(weighted_quantiles(base_x, base_w, [i / k for i in range(1, k)])) if k > 1 else []
    if qv:
        q_lo, q_hi = qv[0], qv[-1]
        if lo >= 0 and q_lo > 0 and (len(qv) == 1 or q_hi / q_lo >= 2):
            edges = [nice(v) for v in qv]
        else:
            step = nice_step(max((q_hi - q_lo) / 8, abs(q_hi) * 1e-3, 1e-9))
            if integer:
                step = max(1.0, round(step))
            edges = [round(v / step) * step for v in qv]
        if integer:
            edges = [float(round(e)) for e in edges]
        edges = [float(f"{e:.10g}") for e in edges]
        floor = float(base_x.min())
        edges = sorted({e for e in edges if floor < e <= hi})
    else:
        edges = []
    # merge groups holding under 4% of stories into a neighbour
    while edges:
        codes = np.searchsorted(edges, base_x, side="right")
        shares = np.bincount(codes, weights=base_w, minlength=len(edges) + 1) / base_w.sum()
        small = int(np.argmin(shares))
        if shares[small] >= 0.04:
            break
        drop = small - 1 if small == len(edges) else (small if small == 0 else
                                                      (small - 1 if shares[small - 1] < shares[small + 1] else small))
        edges.pop(drop)
    exact_ints = integer and (style == "year" or hi < 1000) and all(float(e).is_integer() for e in edges)
    if integer and not zero and len(edges) < 3:  # quantiles collapsed (e.g. half the stories have 1 page)
        grouped = _integer_groups(xv, wv)
        if len(grouped) > len(edges):
            edges, exact_ints = grouped, hi < 1000 or style == "year"
    if zero:
        if not edges:
            return Bins("ranges", ["None", "Some"], ordered=True, zero=True, edges=[])
        labels = ["None"] + _range_labels(edges, float(base_x.min()), hi, style, exact_ints)
        return Bins("ranges", labels, ordered=True, zero=True, edges=edges)
    if not edges:
        return None
    return Bins("ranges", _range_labels(edges, lo, hi, style, exact_ints), ordered=True, edges=edges)


# ---------------------------------------------------------------------------------------------- statistics
_S: dict[str, Any] = {}  # arrays shared with worker processes


def _init(shared: dict[str, Any]) -> None:
    _S.clear()
    _S.update(shared)


def _cell(mask: np.ndarray) -> list[Any] | None:
    n = int(mask.sum())
    if n < MIN_N:
        return None
    w, Y = _S["w"][mask], _S["Y"][mask]
    age = _S["age"][mask]
    ok_age = np.isfinite(age)
    out: list[Any] = [n, round(float(weighted_quantiles(age[ok_age], w[ok_age], [0.5])[0]), 1) if ok_age.any() else None]
    for k in range(Y.shape[1]):
        y = Y[:, k]
        ok = np.isfinite(y)
        nk = int(ok.sum())
        if nk < MIN_N:
            out.append(None)
            continue
        q25, q50, q75 = weighted_quantiles(y[ok], w[ok], [0.25, 0.5, 0.75])
        stats = [sig(q50), sig(q25), sig(q75), sig(weighted_mean(y[ok], w[ok]))]
        if nk != n:
            stats.append(nk)
        out.append(stats)
    return out


def _gap(a: float, b: float) -> float:
    """Relative difference (b - a) on the scale of the larger of the two."""
    scale = max(abs(a), abs(b))
    return 0.0 if scale == 0 else (b - a) / scale


def _gap_ok(a: float, b: float, k: int, sign: float) -> bool:
    """Do two medians differ enough, in the direction `sign`, for a 'tend to' title?"""
    if _S["rating"][k]:
        return abs(b - a) >= RATING_MIN_GAP and math.copysign(1, b - a) == sign
    gap = _gap(a, b)
    return abs(gap) >= PATTERN_MIN_GAP and math.copysign(1, gap) == sign


def _pattern(mask: np.ndarray, codes: np.ndarray, x: np.ndarray, kind: str, cells: list, k: int) -> list[Any]:
    """[direction, effect] for one genre and popularity measure. direction is +1 / -1 only when the pattern
    is clear enough for a 'tend to' title (see PATTERN_* and SMALL_N); effect is the rank correlation."""
    y, w = _S["Y"][:, k], _S["w"]
    if kind == "ordered":
        ok = mask & np.isfinite(x) & np.isfinite(y) & (codes >= 0)
        if ok.sum() < SMALL_N:
            return [0, None]
        rho = weighted_spearman(x[ok], y[ok], w[ok])
        if not math.isfinite(rho):
            return [0, None]
        lo, hi = spearman_ci(rho, effective_n(w[ok]), PATTERN_Z)
        meds = [c[2 + k][0] for c in cells if c is not None and c[2 + k] is not None
                and (c[2 + k][4] if len(c[2 + k]) > 4 else c[0]) >= SMALL_N]
        sign = math.copysign(1, rho)
        clear = (abs(rho) >= PATTERN_MIN_EFFECT and (lo > 0 or hi < 0) and len(meds) >= 2
                 and _gap_ok(meds[0], meds[-1], k, sign))
        return [int(sign) if clear else 0, round(rho, 2)]
    if kind == "binary":
        a = mask & (codes == 0) & np.isfinite(y)
        b = mask & (codes == 1) & np.isfinite(y)
        if a.sum() < SMALL_N or b.sum() < SMALL_N:
            return [0, None]
        r = 2 * weighted_auc(y[a], w[a], y[b], w[b]) - 1
        se = rank_biserial_se(effective_n(w[a]), effective_n(w[b]))
        ca, cb = cells[0], cells[1]
        if ca is None or cb is None or ca[2 + k] is None or cb[2 + k] is None:
            return [0, round(r, 2)]
        sign = math.copysign(1, r)
        clear = abs(r) >= PATTERN_MIN_EFFECT and abs(r) >= PATTERN_Z * se and \
            _gap_ok(cb[2 + k][0], ca[2 + k][0], k, sign)  # the "yes" group compared with the "no" group
        return [int(sign) if clear else 0, round(r, 2)]
    return [0, None]


def _var_task(name: str, codes: np.ndarray, x: np.ndarray, kind: str, nbins: int) -> dict[str, str]:
    """All payloads for one characteristic: {subset id: JSON text}."""
    G, genre_ids, subsets = _S["g"], _S["genre_ids"], _S["subsets"]
    out = {}
    for sid, smask in subsets.items():
        base = smask & (codes >= 0)
        genres = {}
        for gi, gid in enumerate(genre_ids):
            gm = base if gid == "all" else base & (G == gi)
            cells = [_cell(gm & (codes == b)) for b in range(nbins)]
            genres[gid] = {"n": int(gm.sum()), "b": cells, "o": _cell(gm),
                           "p": [_pattern(gm, codes, x, kind, cells, k) for k in range(_S["Y"].shape[1])]}
        out[sid] = json.dumps({"v": name, "s": sid, "g": genres}, separators=(",", ":"), allow_nan=False)
    return out


# ------------------------------------------------------------------------------------------------ genres page
def genre_kind(bins: Bins) -> str:
    """The Genres page's form for a characteristic: "bin" (yes/no), "grp" (named groups), "band" (ordered levels),
    "zero" (ranges with a "None" group, ZERO_BIN_SHARE) or "num"."""
    if bins.binary:
        return "bin"
    if bins.type == "levels":
        return "band" if bins.ordered else "grp"
    return "zero" if bins.zero else "num"


def subset_conflict(group: str, name: str) -> bool:
    """Does an "Only include" option of this group leave the characteristic one group? (subsetConflict on the site)"""
    return (group == "Length" and name == "story_words") or (group == "Published" and name in ("pub_year", "age_years"))


def _genre_quantiles(x: np.ndarray, w: np.ndarray, qs: list[float], year: bool) -> list[Any]:
    """Quantiles to 3 significant digits; publication years as whole years (sig() would make 2013 into 2010)."""
    return [int(math.floor(float(v) + 0.5)) if year else sig(float(v)) for v in weighted_quantiles(x, w, qs)]


def _genre_shares(counts: np.ndarray) -> list[float]:
    """Shares to 3 decimals that add up to exactly 1 (the largest remainders are rounded up), so 100% bars close."""
    units = counts / counts.sum() * 1000
    whole = np.floor(units)
    order = np.argsort(-(units - whole), kind="mergesort")
    whole[order[: int(round(1000 - whole.sum()))]] += 1
    return [int(u) // 1000 if u % 1000 == 0 else round(float(u) / 1000, 3) for u in whole]


def _genre_entry(kind: str, fmt: str, x: np.ndarray, codes: np.ndarray, nbins: int, smask: np.ndarray) -> dict[str, Any]:
    """One characteristic on the Genres page for one "Only include" option: per genre (all genres first), the
    number of stories with it and their quartiles (or shares), and the comparison with all genres. All genres weights
    each story by its sampling weight; within a genre every story weighs the same. A genre with fewer than MIN_N
    stories gets null, and one with fewer than SMALL_N is never compared.

    A mostly-zero characteristic ("zero") gives only each genre's number of stories in "q", and in "z" the stories
    above 0: how many, then (all genres only, weighted) their share, then their quartiles when there are at least
    MIN_N. The page uses nothing else, and works out a genre's share from its two counts (the owner's decision, which
    keeps each file under 60 KB gzipped)."""
    G, w, genre_ids = _S["g"], _S["w"], _S["genre_ids"]
    year = fmt == "year"
    ok = smask & (codes >= 0)
    xa, wa = x[ok], w[ok]
    n_eff = effective_n(wa)
    pa = np.bincount(codes[ok], weights=wa, minlength=nbins) / wa.sum() if kind == "grp" and ok.any() else None
    q, z, r, f = [], [], [], []
    for gi, gid in enumerate(genre_ids):
        m = ok if gid == "all" else ok & (G == gi)
        n = int(m.sum())
        if n < MIN_N:
            q.append(None)
            z.append(None)
            r.append(None)
            f.append(0)
            continue
        xg = x[m]
        wg = w[m] if gid == "all" else np.ones(n)
        if kind == "num":
            q.append([n] + _genre_quantiles(xg, wg, [0.1, 0.25, 0.5, 0.75, 0.9] if gid == "all" else [0.25, 0.5, 0.75],
                                            year))
        elif kind == "zero":
            pos = xg > 0
            cell = [int(pos.sum())] + ([round(float(wg[pos].sum() / wg.sum()), 3)] if gid == "all" else [])
            if pos.sum() >= MIN_N:
                cell += _genre_quantiles(xg[pos], wg[pos], [0.25, 0.5, 0.75], year)
            q.append([n])
            z.append(cell)
        elif kind == "bin":
            q.append([n, round(float(wg[xg == 1].sum() / wg.sum()), 3)])
        else:
            q.append([n] + _genre_shares(np.bincount(codes[m], weights=wg, minlength=nbins)))
        if gid == "all" or n < SMALL_N:
            r.append(None)
            f.append(0)
        elif kind == "grp":
            # total variation distance from the all-genres mix, and a chi-square test on the genre's own counts, with
            # the groups under 1% of all genres pooled into one
            pg = np.bincount(codes[m], minlength=nbins) / n
            tvd = 0.5 * float(np.abs(pg - pa).sum())
            small = pa < 0.01
            pg2 = np.append(pg[~small], pg[small].sum()) if small.any() else pg
            pa2 = np.append(pa[~small], pa[small].sum()) if small.any() else pa
            keep = pa2 > 0
            chi = n * float((((pg2 - pa2)[keep]) ** 2 / pa2[keep]).sum())
            df = int(keep.sum()) - 1
            r.append(round(tvd, 2) + 0.0)
            f.append(int(df >= 1 and tvd >= GENRE_MIN_TVD and chi > GENRE_CHI2[df]))
        else:
            # rank-biserial correlation against all genres, on the raw values (for yes/no: the difference in shares),
            # with the standard error the binary patterns use
            rb = 2 * weighted_auc(xg, np.ones(n), xa, wa) - 1
            clear = abs(rb) >= GENRE_MIN_R and abs(rb) / rank_biserial_se(n, n_eff) >= GENRE_Z
            r.append(round(rb, 2) + 0.0)  # never "-0.0"
            f.append(int(math.copysign(1, rb)) if clear else 0)
    entry: dict[str, Any] = {"k": kind}
    if kind in ("num", "zero"):
        entry["fmt"] = fmt
    entry["q"] = q
    if kind == "zero":
        entry["z"] = z
    entry["r"] = r
    entry["f"] = f
    return entry


def _genre_task(name: str, kind: str, fmt: str, x: np.ndarray, codes: np.ndarray, nbins: int,
                skip: set[str]) -> dict[str, dict[str, Any]]:
    """One characteristic for the Genres page, in every "Only include" option it goes with: {subset id: entry}."""
    return {sid: _genre_entry(kind, fmt, x, codes, nbins, smask) for sid, smask in _S["subsets"].items() if sid not in skip}


def genre_file(sid: str, smask: np.ndarray, g: np.ndarray, w: np.ndarray, age: np.ndarray, genre_ids: list[str],
               entries: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """genres/<included>.json: the rule, the genres (meta.json's order), each genre's number of stories and median
    age in this option (no age for fewer than MIN_N stories), and one entry per characteristic."""
    ns, ages = [], []
    for gi, gid in enumerate(genre_ids):
        m = smask if gid == "all" else smask & (g == gi)
        ok = m & np.isfinite(age)
        wv = w[ok] if gid == "all" else np.ones(int(ok.sum()))
        ns.append(int(m.sum()))
        ages.append(round(float(weighted_quantiles(age[ok], wv, [0.5])[0]), 1) if ok.sum() >= MIN_N else None)
    return {"s": sid, "rule": {"min_r": GENRE_MIN_R, "z": GENRE_Z, "min_tvd": GENRE_MIN_TVD, "min_n": SMALL_N},
            "genres": genre_ids, "n": ns, "age": ages, "c": entries}


# ------------------------------------------------------------------------------------------------- building
def _subset_mask(df: pd.DataFrame, col: str | None, low: float | None, high: float | None) -> np.ndarray:
    if col is None:
        return np.ones(len(df), dtype=bool)
    x = _numeric(df[col])
    m = np.isfinite(x)
    if low is not None:
        m &= x >= low
    if high is not None:
        m &= x < high
    return m


# The pattern index (patterns.json) re-packages the pattern results already in v/<characteristic>/all.json: for
# every genre and measure, one character per characteristic (meta.json's order) giving the direction (-1, 0, +1)
# and the strength band of the existing effect, with the site's own cut-offs (weak < 0.2 <= moderate < 0.4 <= strong).
PATTERN_CODES = {(-1, "weak"): "a", (-1, "moderate"): "b", (-1, "strong"): "c",
                 (0, "weak"): "d", (0, "moderate"): "e", (0, "strong"): "f",
                 (1, "weak"): "g", (1, "moderate"): "h", (1, "strong"): "i"}
PATTERN_NONE = "."  # the effect was not computed (too few stories, or a characteristic without order)


def strength_band(effect: float) -> str:
    a = abs(effect)
    return "weak" if a < 0.2 else ("moderate" if a < 0.4 else "strong")


def pattern_code(p: list[Any]) -> str:
    direction, effect = p
    return PATTERN_NONE if effect is None else PATTERN_CODES[(int(direction), strength_band(effect))]


def build_patterns(out_dir: Path, variable_ids: list[str], genre_ids: list[str], n_metrics: int) -> dict[str, Any]:
    """patterns.json: {"key": ..., "g": {genre: [one string per measure, one character per characteristic]}}."""
    files = {v: json.loads((out_dir / "v" / v / "all.json").read_text(encoding="utf-8")) for v in variable_ids}
    return {"key": "".join(PATTERN_CODES.values()) + PATTERN_NONE,
            "g": {g: ["".join(pattern_code(files[v]["g"][g]["p"][k]) for v in variable_ids) for k in range(n_metrics)]
                  for g in genre_ids}}


def _topics(variables: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The eight browsing topics, each with its characteristics in display order (sub-group, then dictionary)."""
    order = {v["id"]: i for i, v in enumerate(variables)}
    out = []
    for i, (tid, label, blurb, pairs) in enumerate(W.TOPICS):
        members = [v for v in variables if v["topic"] == tid]
        sub_order = {W.us_english(W.SUBGROUP_LABEL.get(g, g)): j for j, (_, g) in reversed(list(enumerate(pairs)))}
        lead = {vid: j for j, vid in enumerate(W.TOPIC_LEAD)}
        members.sort(key=lambda v: (lead.get(v["id"], len(lead)), sub_order.get(v["subgroup"], 99), order[v["id"]]))
        if members:
            out.append({"id": tid, "label": label, "blurb": blurb, "syn": W.TOPIC_SYNONYMS.get(tid, ""),
                        "ids": [v["id"] for v in members]})
    return out


def build_site_data(handoff: Path | None = None, out_dir: Path | None = None, workers: int = 0) -> dict[str, Any]:
    from . import trends as T  # (trends imports this module)

    t0 = time.time()
    h = load_handoff(handoff or latest_handoff())
    out_dir = out_dir or DEFAULT_OUT
    all_rows = h.stories
    df = all_rows[all_rows["analysis_include"].fillna(False).astype(bool)].reset_index(drop=True)
    genre_col = df["queue_category_slug"].fillna(df["category_slug"])
    cats = h.categories[h.categories["selected"].fillna(False).astype(bool)]
    cats = cats[cats["category_slug"].isin(set(genre_col))].sort_values("category_name")
    genre_ids = ["all"] + list(cats["category_slug"])
    gindex = {g: i for i, g in enumerate(genre_ids)}
    g = genre_col.map(gindex).fillna(-1).astype(int).to_numpy()
    w = _numeric(df["sampling_weight"])
    if not np.all(np.isfinite(w)):
        raise ValueError("Every included story needs a sampling weight.")

    metrics = []
    for m in W.METRICS:
        if m["id"] in df.columns:
            cov = float(np.isfinite(_numeric(df[m["id"]])).mean())
            if cov >= W.MIN_METRIC_COVERAGE:
                metrics.append({**m, "coverage": round(cov, 3)})
    Y = np.column_stack([_numeric(df[m["id"]]) for m in metrics])
    subset_defs = [s for s in W.SUBSETS if s[3] is None or s[3] in df.columns]
    subsets = {sid: _subset_mask(df, col, lo, hi) for sid, _, _, col, lo, hi in subset_defs}

    labels = {v["name"]: W.label_for(v["name"], v["label"]) for v in h.dictionary}
    variables, tasks, genre_tasks, trend_tasks = [], [], [], []
    for v in h.dictionary:
        name = v["name"]
        if not v.get("explorer") or name in W.EXCLUDED or name not in df.columns or v["ui_group"] not in W.GROUPS:
            continue
        if (v["ui_group"], v["group"]) not in W.TOPIC_OF:
            raise ValueError(f"{name}: no topic for {(v['ui_group'], v['group'])}; add it to TOPICS in wording.py")
        bins = make_bins(name, v["kind"], v.get("unit", ""), df[name], w)
        if bins is None or len(bins.labels) < 2:
            log.info("Skipping %s: it does not split stories into groups.", name)
            continue
        raw = df[name]
        x = _numeric(raw) if raw.dtype != object and str(raw.dtype) not in ("str", "string") else np.full(len(df), np.nan)
        codes = bins.codes(raw.to_numpy() if bins.type == "levels" and isinstance(bins.values[0], str) else _numeric(raw))
        kind = "binary" if bins.binary else ("ordered" if bins.ordered else "categorical")
        label = labels[name]
        entry = {"id": name, "label": label, "topic": W.TOPIC_OF[(v["ui_group"], v["group"])][2],
                 "subgroup": W.us_english(W.SUBGROUP_LABEL.get(v["group"], v["group"])), "kind": v["kind"],
                 "unit": v.get("unit", ""),
                 "description": W.us_english(W.SITE_DESCRIPTION.get(name) or W.site_text(v.get("description", ""), labels)),
                 "caveat": W.site_text(v.get("caveat", ""), labels),
                 "bins": bins.to_json(), "noun": W.us_english(W.noun_for(name, label)),
                 **({"plural": True} if name in W.PLURAL else {}), "n": int((codes >= 0).sum())}
        syn = W.synonyms_for(name)
        if syn:
            entry["syn"] = syn
        if bins.binary:
            entry.update(dict(zip(("yes", "no", "yes_subject", "no_subject"), map(W.us_english, W.BINARY[name]))))
        elif bins.ordered:
            entry["more"] = W.us_english(W.more_for(name, label))
        if name in W.DIRECTION_WORDS:
            entry["more_word"], entry["less_word"] = W.DIRECTION_WORDS[name]
        variables.append(entry)
        tasks.append((name, codes, x, kind, len(bins.labels)))
        if name not in W.GENRE_PAGE_EXCLUDED:
            skip = {sid for sid, _, grp, *_ in subset_defs if subset_conflict(grp, name)}
            genre_tasks.append((name, genre_kind(bins), value_style(name, v["kind"], v.get("unit", "")), x, codes,
                                len(bins.labels), skip))
        if name not in W.TREND_PAGE_EXCLUDED:
            skip = {sid for sid, _, grp, *_ in subset_defs if subset_conflict(grp, name)}
            trend_tasks.append((name, genre_kind(bins), value_style(name, v["kind"], v.get("unit", "")), x, codes,
                                len(bins.labels), skip))

    year = _numeric(df["pub_year"])
    periods = T.trend_periods(year[np.isfinite(year)])
    trend_subsets = [sid for sid in W.TREND_SUBSETS if sid in subsets]
    shared = {"g": g, "w": w, "Y": Y, "age": _numeric(df["age_years"]), "genre_ids": genre_ids, "subsets": subsets,
              "rating": [m["format"] == "rating" for m in metrics], "year": year, "trend_periods": periods,
              "trend_subsets": trend_subsets}
    if out_dir.exists():
        shutil.rmtree(out_dir)
    (out_dir / "v").mkdir(parents=True)
    n_workers = workers or max(1, min(8, os.cpu_count() or 1))
    with ProcessPoolExecutor(max_workers=n_workers, initializer=_init, initargs=(shared,)) as ex:
        futures = [ex.submit(_var_task, *t) for t in tasks]
        genre_futures = [ex.submit(_genre_task, *t) for t in genre_tasks]
        trend_futures = [ex.submit(T.trend_task, *t) for t in trend_tasks]
        for (name, *_), fut in zip(tasks, futures):
            vdir = out_dir / "v" / name
            vdir.mkdir()
            for sid, text in fut.result().items():
                (vdir / f"{sid}.json").write_text(text, encoding="utf-8")
        genre_entries = {t[0]: fut.result() for t, fut in zip(genre_tasks, genre_futures)}
        trend_entries = {t[0]: fut.result() for t, fut in zip(trend_tasks, trend_futures)}

    # the Trends page's stories per period, for every option and genre (its files' `n`, and meta's genres too few to
    # compare)
    pmask = [(year >= lo) & (year <= hi) for lo, hi in periods]
    trend_counts = {sid: {gid: [int(((subsets[sid] if gid == "all" else subsets[sid] & (g == gi)) & pm).sum())
                                for pm in pmask] for gi, gid in enumerate(genre_ids)} for sid in trend_subsets}

    excluded = all_rows[~all_rows["analysis_include"].fillna(False).astype(bool)]
    reasons: dict[str, int] = {}
    for rs in excluded["exclusion_reasons"]:
        for r in (list(rs) if rs is not None else []):
            reasons[r] = reasons.get(r, 0) + 1
    man = h.manifest
    meta = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": {"handoff": h.path.name, "processed_at": man.get("processed_at"),
                   "collected_from": (man.get("collection_first_session") or "")[:10],
                   "collected_to": (man.get("collection_last_session") or "")[:10],
                   "stats_observed": [str(s)[:10] for s in (man.get("stats_observed_range") or [])],
                   "text_pipeline_version": man.get("text_pipeline_version")},
        "counts": {"sampled": int(len(all_rows)), "with_text": int(all_rows["has_text"].fillna(False).sum()),
                   "included": int(len(df)), "excluded_reasons": reasons},
        "min_n": MIN_N, "small_n": SMALL_N,
        "genre_rule": {"min_r": GENRE_MIN_R, "level": 0.999, "min_tvd": GENRE_MIN_TVD, "min_n": SMALL_N},
        "trend": T.trend_meta(periods, trend_subsets, list(W.TREND_PAGE_EXCLUDED), trend_counts),
        "genres": [{"id": "all", "name": "All genres", "n": int(len(df))}] + [
            {"id": r.category_slug, "name": r.category_name, "n": int((genre_col == r.category_slug).sum()),
             "size": None if pd.isna(r.estimated_stories_in_category) else int(r.estimated_stories_in_category)}
            for r in cats.itertuples()],
        "metrics": metrics, "metric_groups": W.METRIC_GROUPS, "default_metric": W.DEFAULT_METRIC,
        "subsets": [{"id": sid, "label": lab, "group": grp, "n": int(subsets[sid].sum())}
                    for sid, lab, grp, *_ in subset_defs],
        "topics": _topics(variables),
        "popular": [p for p in W.POPULAR if p in {v["id"] for v in variables}],
        "variables": variables,
        "featured": [{"question": q, **s} for q, s in W.FEATURED if s["var"] in {v["id"] for v in variables}],
    }
    (out_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    patterns = build_patterns(out_dir, [v["id"] for v in variables], genre_ids, len(metrics))
    (out_dir / "patterns.json").write_text(json.dumps(patterns, separators=(",", ":")), encoding="utf-8")
    (out_dir / "genres").mkdir()
    for sid, smask in subsets.items():
        entries = {name: per[sid] for name, per in genre_entries.items() if sid in per}
        payload = genre_file(sid, smask, g, w, shared["age"], genre_ids, entries)
        (out_dir / "genres" / f"{sid}.json").write_text(json.dumps(payload, separators=(",", ":"), allow_nan=False),
                                                       encoding="utf-8")
    for sid in trend_subsets:
        (out_dir / "trends" / sid).mkdir(parents=True)
        for gid in genre_ids:
            entries = {name: per[sid][gid] for name, per in trend_entries.items() if sid in per}
            payload = T.trend_file(sid, gid, periods, trend_counts[sid][gid], entries)
            (out_dir / "trends" / sid / f"{gid}.json").write_text(
                json.dumps(payload, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    size = sum(p.stat().st_size for p in out_dir.rglob("*.json"))
    files = sum(1 for _ in out_dir.rglob("*.json"))
    summary = {"variables": len(variables), "metrics": len(metrics), "genres": len(genre_ids) - 1,
               "subsets": len(subsets), "files": files, "megabytes": round(size / 1e6, 1),
               "seconds": round(time.time() - t0, 1), "out": str(out_dir)}
    log.info("Site aggregates written: %s", summary)
    return summary
