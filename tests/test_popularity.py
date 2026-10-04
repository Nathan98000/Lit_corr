import math

import pandas as pd

from litcorr.popularity import add_popularity


def test_ratios_age_normalisation_and_guards():
    df = pd.DataFrame({
        "pop_views": [10_000, 50, 1_000, None],
        "pop_favorites": [100, 5, 10, 3],
        "pop_comments": [20, 1, None, 0],
        "pop_rating_count": [None, None, None, None],
        "pop_reading_lists": [30, 0, 1, 0],
        "date_published": ["2020-01-01", "2026-08-25", "2027-01-01", "2020-01-01"],
        "stats_observed_at": pd.to_datetime(["2026-09-01"] * 4, utc=True),
    })
    out = add_popularity(df, min_views_for_rates=100)
    assert out.loc[0, "pop_fav_per_1k_views"] == 10.0
    assert math.isnan(out.loc[1, "pop_fav_per_1k_views"])  # too few views for a stable ratio
    assert math.isnan(out.loc[2, "pop_comments_per_1k_views"])  # missing numerator stays missing
    assert math.isnan(out.loc[0, "pop_ratings_per_1k_views"])
    # A 1-week-old story is treated as 1 month old (no exploding per-month rates).
    assert out.loc[1, "pop_views_per_month"] == 50
    # Publication after observation = impossible age -> missing, not negative.
    assert math.isnan(out.loc[2, "age_days"]) and math.isnan(out.loc[3, "pop_views_per_month"])
    months = out.loc[0, "age_days"] / 30.4375
    assert abs(out.loc[0, "pop_views_per_month"] - 10_000 / months) < 1e-6
