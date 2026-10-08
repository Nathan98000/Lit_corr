"""Stage 2 site aggregates: the statistics, the grouping of stories, and a full build from a small synthetic
handoff zip (sample sizes, medians, weights, suppression of small groups, no per-story data)."""

from __future__ import annotations

import json
import re

import numpy as np
import pandas as pd
import pytest

from litcorr.stage2 import site_data as sd
from litcorr.stage2 import wording as W
from litcorr.stage2.synthetic import write_synthetic_handoff
from litcorr.stage2.stats import (rank_biserial_se, sig, weighted_auc, weighted_mean, weighted_quantiles,
                                  weighted_spearman)

RNG = np.random.default_rng(7)


# ----------------------------------------------------------------------------------------------- statistics
def test_weighted_quantiles_match_numpy_hazen_with_equal_weights():
    x = RNG.lognormal(3, 1, 501)
    qs = [0.1, 0.25, 0.5, 0.75, 0.9]
    got = weighted_quantiles(x, np.ones_like(x), qs)
    assert np.allclose(got, np.quantile(x, qs, method="hazen"))


def test_integer_weights_equal_repeated_rows():
    x = RNG.normal(size=60)
    y = x + RNG.normal(size=60)
    w = RNG.integers(1, 4, size=60).astype(float)
    xr, yr = np.repeat(x, w.astype(int)), np.repeat(y, w.astype(int))
    assert np.allclose(weighted_quantiles(x, w, [0.5]), weighted_quantiles(xr, np.ones_like(xr), [0.5]))
    assert weighted_mean(x, w) == pytest.approx(xr.mean())
    ranks = pd.DataFrame({"x": xr, "y": yr}).rank()
    assert weighted_spearman(x, y, w) == pytest.approx(ranks["x"].corr(ranks["y"]))


def test_weighted_auc_matches_counting_pairs():
    a, b = RNG.integers(0, 6, 40).astype(float), RNG.integers(0, 6, 30).astype(float)
    wa, wb = RNG.uniform(0.5, 2, 40), RNG.uniform(0.5, 2, 30)
    pairs = sum(wa[i] * wb[j] * (1.0 if a[i] > b[j] else 0.5 if a[i] == b[j] else 0.0)
                for i in range(40) for j in range(30))
    assert weighted_auc(a, wa, b, wb) == pytest.approx(pairs / (wa.sum() * wb.sum()))
    assert rank_biserial_se(100, 100) == pytest.approx(np.sqrt(201 / 30000))


def test_sig_rounds_for_compact_json():
    assert sig(22437.2) == 22400 and sig(0.0123456) == 0.0123 and sig(4.4219) == 4.42
    assert sig(float("nan")) is None and sig(0.0) == 0


# ------------------------------------------------------------------------------------------------- grouping
def test_nice_boundaries():
    assert [sd.nice(v) for v in (1529, 2504, 3968, 6747, 0.0588, 0.33)] == [1500, 2500, 4000, 7000, 0.06, 0.3]


def test_bins_for_skewed_counts_zero_heavy_rates_and_shares():
    w = np.ones(2000)
    words = pd.Series(np.round(RNG.lognormal(8, 0.8, 2000)))
    b = sd.make_bins("story_words", "count", "words", words, w)
    assert b.type == "ranges" and len(b.labels) == 5 and b.labels[0].startswith("Under ") and b.labels[-1].endswith("+")
    assert all(float(e) == sd.nice(e) for e in b.edges)
    rate = pd.Series(np.where(RNG.uniform(size=2000) < 0.6, 0.0, RNG.uniform(0.1, 3, 2000)))
    z = sd.make_bins("emo_anger_per_1k", "continuous", "per 1,000 words", rate, w)
    assert z.zero and z.labels[0] == "None"
    codes = z.codes(rate.to_numpy())
    assert (codes[rate.to_numpy() == 0] == 0).all() and (codes[rate.to_numpy() > 0] >= 1).all()
    share = pd.Series(RNG.uniform(0, 0.6, 2000))
    s = sd.make_bins("dlg_word_share", "share", "share (0–1)", share, w)
    assert all(lab.endswith("%") or lab.endswith("%+") for lab in s.labels)
    pages = pd.Series(np.minimum(RNG.geometric(0.5, 2000), 30).astype(float))
    p = sd.make_bins("story_pages", "count", "pages", pages, w)
    assert p.labels[:3] == ["1", "2", "3"] and p.labels[-1].endswith("+")


def test_values_on_a_boundary_go_to_the_upper_group():
    b = sd.Bins("ranges", ["Under 2", "2–5", "5+"], ordered=True, edges=[2.0, 5.0])
    assert list(b.codes(np.array([1.99, 2.0, 4.99, 5.0, np.nan]))) == [0, 1, 1, 2, -1]
    lv = sd.Bins("levels", ["A", "B"], ordered=False, values=["a", "b"])
    assert list(lv.codes(np.array(["b", "a", None, "c"], dtype=object))) == [1, 0, -1, -1]


# -------------------------------------------------------------------------------------------- full build
@pytest.fixture(scope="module")
def built(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("site")
    path, df = write_synthetic_handoff(tmp)
    out = tmp / "aggregates"
    summary = sd.build_site_data(path, out, workers=2)
    meta = json.loads((out / "meta.json").read_text())
    return summary, meta, out, df[df.analysis_include]


def _file(out, var, subset="all"):
    return json.loads((out / "v" / var / f"{subset}.json").read_text())


def test_meta_lists_genres_measures_and_characteristics(built):
    summary, meta, out, df = built
    assert [g["id"] for g in meta["genres"]] == ["all", "fetish", "romance", "tiny"]  # alphabetical by name
    assert meta["genres"][0]["n"] == len(df) and meta["counts"]["excluded_reasons"] == {"no_text": 1}
    ids = [m["id"] for m in meta["metrics"]]
    assert "pop_fav_per_1k_views" in ids and "pop_views" in ids and "pop_rating" not in ids  # 50% coverage
    assert [v["id"] for v in meta["variables"]] == ["dlg_word_share", "dlg_has_dialogue", "pov_class",
                                                   "emo_anger_per_1k"]
    assert {s["id"] for s in meta["subsets"]} >= {"all", "y2020", "long"}
    assert meta["source"]["collected_from"] == "2026-10-01" and summary["variables"] == 4


def test_sample_sizes_and_medians_match_the_handoff(built):
    _, meta, out, df = built
    ids = [m["id"] for m in meta["metrics"]]
    k = ids.index("pop_fav_per_1k_views")
    edges = next(v for v in meta["variables"] if v["id"] == "dlg_word_share")
    bins = sd.make_bins("dlg_word_share", "share", "share (0–1)", df["dlg_word_share"], df["sampling_weight"].to_numpy())
    assert bins.labels == edges["bins"]["labels"]
    codes = bins.codes(df["dlg_word_share"].to_numpy())
    data = _file(out, "dlg_word_share")["g"]
    rom = (df["queue_category_slug"] == "romance").to_numpy()
    for b in range(len(bins.labels)):
        mask = rom & (codes == b)
        cell = data["romance"]["b"][b]
        if mask.sum() < sd.MIN_N:
            assert cell is None
            continue
        assert cell[0] == mask.sum()
        y = df["pop_fav_per_1k_views"].to_numpy()[mask]
        med, p25, p75, mean = cell[2 + k][:4]
        assert med == sig(np.quantile(y, 0.5, method="hazen")) and mean == sig(y.mean())
        assert p25 == sig(np.quantile(y, 0.25, method="hazen")) and p75 == sig(np.quantile(y, 0.75, method="hazen"))
    # "All genres" weights each story by its category's sampling weight
    allc = data["all"]["o"]
    y, w = df["pop_fav_per_1k_views"].to_numpy(), df["sampling_weight"].to_numpy()
    assert allc[0] == len(df) and allc[2 + k][0] == sig(weighted_quantiles(y, w, [0.5])[0])
    assert allc[2 + k][3] == sig(np.average(y, weights=w))


def test_small_groups_are_hidden_and_no_story_level_data_leaks(built):
    _, meta, out, df = built
    tiny = _file(out, "dlg_word_share")["g"]["tiny"]  # 8 stories in all
    assert tiny["n"] == 8 and tiny["o"] is None and all(c is None for c in tiny["b"])
    text = "".join(p.read_text() for p in out.rglob("*.json"))
    assert "kromance" not in text and "kfetish" not in text and "story_key" not in text


def test_filters_cover_the_right_stories(built):
    _, meta, out, df = built
    recent = _file(out, "pov_class", "y2020")["g"]["all"]
    assert recent["n"] == int(((df["pub_year"] >= 2020) & df["pov_class"].isin(["first", "third"])).sum())
    assert next(s for s in meta["subsets"] if s["id"] == "long")["n"] == int((df["story_words"] >= 5000).sum())


def test_patterns_are_reported_only_when_clear(built):
    _, meta, out, df = built
    ids = [m["id"] for m in meta["metrics"]]
    k = ids.index("pop_fav_per_1k_views")
    assert _file(out, "dlg_word_share")["g"]["all"]["p"][k][0] == 1      # built into the synthetic data
    assert _file(out, "emo_anger_per_1k")["g"]["all"]["p"][k][0] == 0    # unrelated noise
    assert _file(out, "dlg_has_dialogue")["g"]["all"]["p"][k][0] == 1    # binary: with dialogue > without
    assert all(p[0] == 0 for p in _file(out, "pov_class")["g"]["all"]["p"])  # categorical: never worded


def test_binary_and_categorical_groups_keep_their_order(built):
    _, meta, _, _ = built
    var = {v["id"]: v for v in meta["variables"]}
    assert var["dlg_has_dialogue"]["bins"]["labels"] == ["Has dialogue", "No dialogue"]
    assert var["dlg_has_dialogue"]["yes_subject"] == "Stories with dialogue"
    assert var["pov_class"]["bins"]["labels"][0] == "First person (I)"
    assert var["emo_anger_per_1k"]["bins"]["labels"][0] == "None"


# ------------------------------------------------------------------------------------------------ wording
REAL_META = sd.DEFAULT_OUT / "meta.json"
UK_SPELLINGS = re.compile(
    r"\b(humour\w*|neighbour\w*|favourit\w*|colour\w*|behaviour\w*|centre|labelled|labelling|signalled|"
    r"travelled|modelling|\w+isation\w*|organis\w*|recognis\w*|realis\w*|summaris\w*|capitalis\w*|italicis\w*|"
    r"unrecognis\w*|analys(e|ed|ing)|emphasis(e|ed)|apologis\w*|categoris\w*|criticis\w*|grey|towards)\b|"
    r"\bat the weekend", re.I)
CAUSAL = re.compile(r"\b(cause[sd]?|causing|drives?|driven|driving|makes? readers|leads? to|led to|boosts?|"
                    r"because of|effect of|impacts?|results? in)\b", re.I)


def _visitor_strings(meta):
    """Every string in meta.json that a visitor can read (not ids, dates or file names)."""
    skip = {"id", "generated_at", "source", "var", "metric", "genre", "mode", "kind", "unit", "ids", "topic",
            "default_metric", "format", "excluded_reasons"}
    out = []

    def walk(x, key=None):
        if key in skip:
            return
        if isinstance(x, str):
            out.append(x)
        elif isinstance(x, dict):
            for k, v in x.items():
                walk(v, k)
        elif isinstance(x, list):
            for v in x:
                walk(v, key)
    walk(meta)
    return out


def _metas(built):
    metas = [built[1]]
    if REAL_META.exists():
        metas.append(json.loads(REAL_META.read_text()))
    return metas


def test_topics_cover_every_characteristic_once_and_popular_ids_exist(built):
    for meta in _metas(built):
        ids = [v["id"] for v in meta["variables"]]
        listed = [i for t in meta["topics"] for i in t["ids"]]
        assert sorted(listed) == sorted(ids) and len(listed) == len(set(listed))
        assert all(v["topic"] == t["id"] for t in meta["topics"] for v in meta["variables"] if v["id"] in t["ids"])
        assert set(meta["popular"]) <= set(ids)
        assert all(t["label"] and t["blurb"] for t in meta["topics"])
    real = _metas(built)[-1]
    if len(real["variables"]) > 100:  # the real aggregates: eight topics and the full Popular list
        assert [t["label"] for t in real["topics"]] == [t[1] for t in W.TOPICS]
        assert real["popular"] == W.POPULAR


def test_visitor_text_is_us_english_and_never_causal(built):
    for meta in _metas(built):
        for text in _visitor_strings(meta):
            assert not UK_SPELLINGS.search(text), text
            assert not CAUSAL.search(text), text
            assert "'" not in text, text  # typographic quotes and apostrophes only


def test_us_english_and_generated_phrases():
    assert W.us_english("Humour and 'filter' words, the author's favourite") == \
        "Humor and ‘filter’ words, the author’s favorite"
    assert W.us_english("published at the weekend") == "published on the weekend"
    assert W.NOUN["pace_action_peak_position"] == "where action verbs peak"
    assert W.MORE["pace_action_shift"] == "Stories in which action verbs build up more"
    assert W.MORE["pace_dialogue_peak_position"] == "Stories in which dialogue peaks later"
    assert W.more_for("meta_tag_count", "Number of tags") == "Stories with more tags"
    assert "with" not in W.noun_for("dlg_paragraph_share", "Paragraphs with dialogue")
    assert W.noun_for("emo_affection_per_1k", "Affection & love") == "affection and love"
    assert W.synonyms_for("pov_is_first_person").startswith("pov point of view")
