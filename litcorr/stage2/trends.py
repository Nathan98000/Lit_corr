"""The Trends page's aggregates: trends/<included>/<genre>.json, one file per "Only include" option and genre.

For every characteristic but the left-out ones (wording.TREND_PAGE_EXCLUDED), per five-year period of publication
year: the number of stories with it and their quartiles (or shares), as the Genres page gives them; the same for the
"then" window (2000-2009); and the comparison of the "now" window (2020 to the newest story, the last period) with
"then", by the Genres page's rule (TREND_*). All genres weights each story by its category's sampling weight; within a
genre every story weighs the same. For All genres the comparison is also made with each genre's share of both windows
held fixed (rm, fm), since the genres' shares of new stories changed.

Only summaries leave this step: periods and windows of at least MIN_N stories, r for windows of at least SMALL_N, and
counts of stories. The tasks read the characteristic, the genre, the weight, the publication year and the options'
masks (story length), nothing else.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np

from . import site_data as sd
from .stats import effective_n, rank_biserial_se, weighted_auc

TREND_PERIOD_YEARS = 5         # 2000-04, 2005-09, ...; from TREND_NOW_FROM on, one period to the newest story
TREND_THEN = (2000, 2009)      # the two windows compared: the site's "Published 2000-2009" ...
TREND_NOW_FROM = 2020          # ... and "Published 2020 or later" (the last period)
TREND_MIN_R = 0.20             # the Genres page's rule (GENRE_*), kept apart so that this page's can change alone
TREND_Z = 3.29
TREND_MIN_TVD = 0.20


def trend_periods(years: np.ndarray) -> list[list[int]]:
    """Five-year periods from the first year in the data up to TREND_NOW_FROM - 1, then one period from TREND_NOW_FROM
    to the newest year: [[2000, 2004], [2005, 2009], [2010, 2014], [2015, 2019], [2020, 2026]] today."""
    lo, hi = int(np.min(years)), int(np.max(years))
    out = [[s, min(s + TREND_PERIOD_YEARS - 1, TREND_NOW_FROM - 1)] for s in range(lo, TREND_NOW_FROM, TREND_PERIOD_YEARS)]
    if hi >= TREND_NOW_FROM:
        out.append([TREND_NOW_FROM, hi])
    return out


def trend_cell(kind: str, fmt: str, x: np.ndarray, codes: np.ndarray, nbins: int, mask: np.ndarray, w: np.ndarray,
               weighted: bool) -> list[Any] | None:
    """One group of stories (a period, or a window), in the Genres page's forms: num [n, p25, median, p75]; bin [n,
    share]; zero [n, stories above 0, (All genres only: their weighted share), then p25, median, p75 among them when at
    least MIN_N]; grp and band [n, a share per group, adding up to 1]. None under MIN_N stories."""
    ok = mask & (codes >= 0)
    n = int(ok.sum())
    if n < sd.MIN_N:
        return None
    ww = w[ok] if weighted else np.ones(n)
    xs = x[ok]
    year = fmt == "year"
    if kind == "num":
        return [n] + sd._genre_quantiles(xs, ww, [0.25, 0.5, 0.75], year)
    if kind == "bin":
        return [n, round(float(ww[xs == 1].sum() / ww.sum()), 3)]
    if kind == "zero":
        pos = xs > 0
        cell = [n, int(pos.sum())] + ([round(float(ww[pos].sum() / ww.sum()), 3)] if weighted else [])
        if pos.sum() >= sd.MIN_N:
            cell += sd._genre_quantiles(xs[pos], ww[pos], [0.25, 0.5, 0.75], year)
        return cell
    return [n] + sd._genre_shares(np.bincount(codes[ok], weights=ww, minlength=nbins))


def trend_compare(kind: str, x: np.ndarray, codes: np.ndarray, nbins: int, then: np.ndarray, now: np.ndarray,
                  w: np.ndarray, weighted: bool, w_then: np.ndarray | None = None,
                  w_now: np.ndarray | None = None) -> tuple[float | None, int]:
    """The "now" window against "then": (r, flag), or for named groups (total variation distance, flag); (None, 0) when
    a window has fewer than SMALL_N stories with the characteristic. r = 2 * AUC - 1 on the raw values (bands on their
    codes), positive when newer stories score higher; flag = sign(r) when |r| >= TREND_MIN_R and |r| / SE >= TREND_Z.
    Named groups: flag 1 when the distance is at least TREND_MIN_TVD and a two-sample chi-square on the effective sizes
    (groups whose pooled share is under 1% pooled into one) clears GENRE_CHI2. w_then / w_now: other weights for the two
    windows' stories, in their order (the genre mix held fixed)."""
    a, b = then & (codes >= 0), now & (codes >= 0)
    na, nb = int(a.sum()), int(b.sum())
    if na < sd.SMALL_N or nb < sd.SMALL_N:
        return None, 0
    if w_then is None:
        w_then = w[a] if weighted else np.ones(na)
        w_now = w[b] if weighted else np.ones(nb)
    if kind == "grp":
        pa = np.bincount(codes[a], weights=w_then, minlength=nbins) / w_then.sum()
        pb = np.bincount(codes[b], weights=w_now, minlength=nbins) / w_now.sum()
        tvd = 0.5 * float(np.abs(pb - pa).sum())
        ea, eb = effective_n(w_then), effective_n(w_now)
        pool = (pa * ea + pb * eb) / (ea + eb)
        small = pool < 0.01
        if small.any():
            pa, pb, pool = (np.append(p[~small], p[small].sum()) for p in (pa, pb, pool))
        keep = pool > 0
        chi = (ea * eb / (ea + eb)) * float((((pb - pa)[keep]) ** 2 / pool[keep]).sum())
        df = int(keep.sum()) - 1
        return round(tvd, 3) + 0.0, int(df >= 1 and tvd >= TREND_MIN_TVD and chi > sd.GENRE_CHI2[df])
    xv = codes.astype(float) if kind == "band" else x
    r = 2 * weighted_auc(xv[b], w_now, xv[a], w_then) - 1
    se = rank_biserial_se(effective_n(w_now), effective_n(w_then))
    clear = abs(r) >= TREND_MIN_R and abs(r) / se >= TREND_Z
    return round(r, 3) + 0.0, (int(math.copysign(1, r)) if clear else 0)  # never "-0.0"


def mix_fixed_weights(ok: np.ndarray, window: np.ndarray, g: np.ndarray, w: np.ndarray, n_genres: int) -> np.ndarray:
    """Weights for one window's stories that give every genre (indices 1 .. n_genres) the same share of the window as it
    has among all the option's stories with the characteristic (weighted by sampling weight): within a genre, its
    stories in the window share that share equally."""
    out = np.zeros(len(ok))
    total = w[ok].sum()
    for gi in range(1, n_genres + 1):
        k = window & ok & (g == gi)
        if k.any():
            out[k] = w[ok & (g == gi)].sum() / total / k.sum()
    return out


def trend_entries(name: str, kind: str, fmt: str, x: np.ndarray, codes: np.ndarray, nbins: int, skip: set[str],
                  S: dict[str, Any]) -> dict[str, dict[str, dict[str, Any]]]:
    """One characteristic in every option (but `skip`) and genre: {option: {genre: entry}}. S holds the shared arrays:
    g (genre index per story; 0 is All genres), w, year, genre_ids, subsets (the options' masks) and trend_periods."""
    g, w, year, genre_ids = S["g"], S["w"], S["year"], S["genre_ids"]
    periods = S["trend_periods"]
    pmask = [(year >= lo) & (year <= hi) for lo, hi in periods]
    then = (year >= TREND_THEN[0]) & (year <= TREND_THEN[1])
    now = year >= TREND_NOW_FROM
    out: dict[str, dict[str, dict[str, Any]]] = {}
    for sid in S["trend_subsets"]:
        if sid in skip:
            continue
        smask = S["subsets"][sid]
        per: dict[str, dict[str, Any]] = {}
        for gi, gid in enumerate(genre_ids):
            gm = smask if gid == "all" else smask & (g == gi)
            weighted = gid == "all"
            e: dict[str, Any] = {"k": kind}
            if kind in ("num", "zero"):
                e["fmt"] = fmt
            e["q"] = [trend_cell(kind, fmt, x, codes, nbins, gm & pm, w, weighted) for pm in pmask]
            e["t"] = trend_cell(kind, fmt, x, codes, nbins, gm & then, w, weighted)
            e["r"], e["f"] = trend_compare(kind, x, codes, nbins, gm & then, gm & now, w, weighted)
            if gid == "all":
                ok = gm & (codes >= 0)
                a, b = ok & then, ok & now
                e["rm"], e["fm"] = trend_compare(
                    kind, x, codes, nbins, a, b, w, True,
                    mix_fixed_weights(ok, then, g, w, len(genre_ids) - 1)[a],
                    mix_fixed_weights(ok, now, g, w, len(genre_ids) - 1)[b])
            per[gid] = e
        out[sid] = per
    return out


def trend_task(name: str, kind: str, fmt: str, x: np.ndarray, codes: np.ndarray, nbins: int,
               skip: set[str]) -> dict[str, dict[str, dict[str, Any]]]:
    """trend_entries on the arrays shared with the worker processes (site_data._init)."""
    return trend_entries(name, kind, fmt, x, codes, nbins, skip, sd._S)


def trend_file(sid: str, gid: str, periods: list[list[int]], n: list[int], entries: dict[str, Any]) -> dict[str, Any]:
    """trends/<included>/<genre>.json: the option and genre, the rule, the periods and windows, the stories per period
    in this option and genre (any count), and one entry per characteristic."""
    return {"s": sid, "g": gid, "rule": {"min_r": TREND_MIN_R, "z": TREND_Z, "min_tvd": TREND_MIN_TVD, "min_n": sd.SMALL_N},
            "periods": periods, "then": list(TREND_THEN), "now": [TREND_NOW_FROM, periods[-1][1]], "n": n, "c": entries}


def window_counts(periods: list[list[int]], n: list[int]) -> tuple[int, int]:
    """The two windows' stories from the periods' counts (a file's `n`): the periods inside TREND_THEN, and those from
    TREND_NOW_FROM on (the page's windowCounts in lib/trends.js)."""
    then = sum(k for (lo, hi), k in zip(periods, n) if lo >= TREND_THEN[0] and hi <= TREND_THEN[1])
    now = sum(k for (lo, _), k in zip(periods, n) if lo >= TREND_NOW_FROM)
    return then, now


def trend_too_few(periods: list[list[int]], counts: dict[str, dict[str, list[int]]]) -> dict[str, list[str]]:
    """For each option, the genres whose two windows can't be compared (fewer than SMALL_N stories in either; the page's
    windowsCompared), their ids A-Z: the genre select says so before the reader picks one."""
    return {sid: sorted(gid for gid, n in per.items() if min(window_counts(periods, n)) < sd.SMALL_N)
            for sid, per in counts.items()}


def trend_meta(periods: list[list[int]], subsets: list[str], excluded: list[str],
               counts: dict[str, dict[str, list[int]]]) -> dict[str, Any]:
    """meta.json's "trend": the periods, the windows, the rule, the options, the left-out characteristics and, per
    option, the genres too few to compare (`counts`: the stories per period of every option and genre)."""
    return {"periods": periods, "then": list(TREND_THEN), "now": [TREND_NOW_FROM, periods[-1][1]],
            "rule": {"min_r": TREND_MIN_R, "level": 0.999, "min_tvd": TREND_MIN_TVD, "min_n": sd.SMALL_N},
            "subsets": subsets, "excluded": excluded, "too_few": trend_too_few(periods, counts)}
