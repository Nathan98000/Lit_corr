"""Popularity measures: raw totals, per-view ratios and simple age normalisation.

Raw totals (views, favorites, comments) are kept exactly as displayed. Two
families of derived measures are added and named so they cannot be confused
with the raw totals:

  pop_*_per_1k_views   engagement per reader: favorites (comments, ratings,
                       reading-list adds) for every 1,000 views
  pop_*_per_month      the total divided by months online (minimum 1 month)

These are descriptive conveniences, not statistical corrections.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

DAYS_PER_MONTH = 30.4375


def add_popularity(df: pd.DataFrame, min_views_for_rates: int = 100) -> pd.DataFrame:
    out = df.copy()
    views = pd.to_numeric(out.get("pop_views"), errors="coerce").astype(float)
    enough = views >= max(1, min_views_for_rates)

    def ratio(col: str) -> pd.Series:
        num = pd.to_numeric(out.get(col), errors="coerce").astype(float)
        return (num / views * 1000.0).where(enough & num.notna())

    out["pop_fav_per_1k_views"] = ratio("pop_favorites")
    out["pop_comments_per_1k_views"] = ratio("pop_comments")
    out["pop_ratings_per_1k_views"] = ratio("pop_rating_count")
    out["pop_reading_lists_per_1k_views"] = ratio("pop_reading_lists")
    out["pop_log10_views"] = np.log10(views + 1)

    published = pd.to_datetime(out.get("date_published"), errors="coerce", utc=True)
    observed = pd.to_datetime(out.get("stats_observed_at"), errors="coerce", utc=True)
    age_days = (observed - published).dt.days.astype(float)
    age_days = age_days.where(age_days >= 0)
    out["age_days"] = age_days
    out["age_years"] = age_days / 365.25
    months = (age_days / DAYS_PER_MONTH).clip(lower=1.0)
    for col, new in (("pop_views", "pop_views_per_month"), ("pop_favorites", "pop_favorites_per_month"),
                     ("pop_comments", "pop_comments_per_month")):
        num = pd.to_numeric(out.get(col), errors="coerce").astype(float)
        out[new] = num / months
    return out
