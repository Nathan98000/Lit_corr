"""Weighted summary statistics used for the site aggregates.

"All genres" combines categories in proportion to their size on Literotica (each story carries its
category's sampling weight); within one genre every story has the same weight, so the same functions
give the ordinary unweighted statistics there.
"""

from __future__ import annotations

import math

import numpy as np

Z95 = 1.959964


def weighted_quantiles(x: np.ndarray, w: np.ndarray, qs: list[float]) -> np.ndarray:
    """Quantiles by the midpoint rule: each value sits at the middle of its share of the total weight, with
    linear interpolation in between. With equal weights this is numpy's ``method="hazen"``."""
    order = np.argsort(x, kind="mergesort")
    xs, ws = x[order], w[order]
    cw = np.cumsum(ws)
    pos = (cw - ws / 2) / cw[-1]
    return np.interp(qs, pos, xs)


def weighted_mean(x: np.ndarray, w: np.ndarray) -> float:
    return float(np.average(x, weights=w))


def effective_n(w: np.ndarray) -> float:
    s = float(w.sum())
    return s * s / float((w * w).sum()) if s > 0 else 0.0


def _weighted_ranks(x: np.ndarray, w: np.ndarray) -> np.ndarray:
    """Mid-ranks on the cumulative-weight scale; tied values share the middle of their group."""
    order = np.argsort(x, kind="mergesort")
    xs, ws = x[order], w[order]
    _, start = np.unique(xs, return_index=True)
    sums = np.add.reduceat(ws, start)
    mid = np.cumsum(sums) - sums / 2
    ranks_sorted = np.repeat(mid, np.diff(np.append(start, len(xs))))
    ranks = np.empty_like(ranks_sorted)
    ranks[order] = ranks_sorted
    return ranks


def weighted_spearman(x: np.ndarray, y: np.ndarray, w: np.ndarray) -> float:
    """Spearman's rank correlation with weights (weighted Pearson correlation of weighted mid-ranks).
    With equal weights it equals the usual Spearman coefficient with average ranks for ties."""
    rx, ry = _weighted_ranks(x, w), _weighted_ranks(y, w)
    mx, my = np.average(rx, weights=w), np.average(ry, weights=w)
    dx, dy = rx - mx, ry - my
    vx, vy = np.average(dx * dx, weights=w), np.average(dy * dy, weights=w)
    if vx <= 0 or vy <= 0:
        return math.nan
    return float(np.average(dx * dy, weights=w) / math.sqrt(vx * vy))


def spearman_ci(rho: float, n_eff: float, z_crit: float = Z95) -> tuple[float, float]:
    """Approximate interval (Fisher z with the Fieller-Hartley-Pearson variance 1.06 / (n - 3)); 95% by default."""
    if not math.isfinite(rho) or n_eff <= 4:
        return math.nan, math.nan
    r = min(max(rho, -0.999999), 0.999999)
    z, se = math.atanh(r), math.sqrt(1.06 / (n_eff - 3))
    return math.tanh(z - z_crit * se), math.tanh(z + z_crit * se)


def weighted_auc(ya: np.ndarray, wa: np.ndarray, yb: np.ndarray, wb: np.ndarray) -> float:
    """Chance that a story from group a has the higher value than one from group b (ties count half)."""
    order = np.argsort(yb, kind="mergesort")
    ys, ws = yb[order], wb[order]
    cw = np.concatenate([[0.0], np.cumsum(ws)])
    below = cw[np.searchsorted(ys, ya, side="left")]
    upto = cw[np.searchsorted(ys, ya, side="right")]
    return float(np.sum(wa * (below + (upto - below) / 2)) / (wa.sum() * wb.sum()))


def rank_biserial_se(n_a: float, n_b: float) -> float:
    """Standard error of the rank-biserial correlation (2 * AUC - 1) when the groups do not differ."""
    return math.sqrt((n_a + n_b + 1) / (3 * n_a * n_b)) if n_a > 0 and n_b > 0 else math.inf


def sig(x: float | None, digits: int = 3) -> float | int | None:
    """Round to a few significant digits for compact JSON (integers stay integers)."""
    if x is None or not math.isfinite(x):
        return None
    if x == 0:
        return 0
    v = float(f"{x:.{digits}g}")
    return int(v) if v.is_integer() and abs(v) < 1e15 else v
