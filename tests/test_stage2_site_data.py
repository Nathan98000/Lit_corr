"""Stage 2 site aggregates: the statistics, the grouping of stories, and a full build from a small synthetic
handoff zip (sample sizes, medians, weights, suppression of small groups, no per-story data)."""

from __future__ import annotations

import json
import re

import numpy as np
import pandas as pd
import pytest

from litcorr.stage2 import site_data as sd
from litcorr.stage2 import trends as TR
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
    """Every string in meta.json that a visitor can read (not ids, dates or file names, and not the search-only
    synonyms, which keep the spellings people type, such as "humour")."""
    skip = {"id", "generated_at", "source", "var", "metric", "genre", "kind", "unit", "ids", "topic",
            "default_metric", "format", "excluded_reasons", "syn", "too_few"}
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


def test_ratings_lead_the_menu_and_the_measures_keep_their_order(built):
    for meta in _metas(built):
        assert meta["metric_groups"] == ["Rating", "Per 1,000 views", "Per month online", "Totals so far"]
        assert meta["default_metric"] == W.DEFAULT_METRIC == "pop_rating"
        # the aggregate files hold the measures by their position in meta.metrics, which follows METRICS
        ids = [m["id"] for m in meta["metrics"]]
        assert ids == [m["id"] for m in W.METRICS if m["id"] in ids]
    real = _metas(built)[-1]
    if len(real["variables"]) > 100:  # the real aggregates offer all ten measures, the average rating last
        assert [m["id"] for m in real["metrics"]] == [m["id"] for m in W.METRICS]


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
            # visitors are assumed to know the median and the interquartile range (round 3)
            assert not re.search(r"typical story|typical age|middle half", text, re.I), text


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


def test_search_synonyms_are_search_only_and_keep_their_spelling(built):
    assert "1st person" in W.synonyms_for("pov_class") and "first person" in W.synonyms_for("pov_is_first_person")
    assert W.synonyms_for("humor_per_1k") == "humour"
    assert "kissing" in W.synonyms_for("rel_intimacy_per_1k") and "kiss" not in W.synonyms_for("emo_affection_per_1k")
    assert W.synonyms_for("sex_action_per_1k") == "explicit orgasm climax"  # with the "sex_" prefix's word
    assert "oral" not in " ".join(W.SYNONYMS.values()).split()  # not in any word list, so not offered
    for meta in _metas(built):
        syn = {v["id"]: v.get("syn", "") for v in meta["variables"]}
        assert "1st person" in syn["pov_class"]
        if "humor_per_1k" in syn:  # the real aggregates
            assert syn["humor_per_1k"] == "humour"  # not turned into "humor" by us_english()
            assert next(v for v in meta["variables"] if v["id"] == "humor_per_1k")["label"] == "Humor and laughter"


# ---------------------------------------------------------------------------------------------- patterns.json
def _check_patterns(meta, out):
    pats = json.loads((out / "patterns.json").read_text())
    assert set(pats) == {"key", "g"} and set(pats["g"]) == {g["id"] for g in meta["genres"]}
    ids = [v["id"] for v in meta["variables"]]
    files = {v: _file(out, v) for v in ids}
    for g, per_metric in pats["g"].items():
        assert len(per_metric) == len(meta["metrics"])
        for k, codes in enumerate(per_metric):
            assert isinstance(codes, str) and len(codes) == len(ids)
            for v, c in zip(ids, codes):
                p = files[v]["g"][g]["p"][k]
                assert c == sd.pattern_code(p), (g, k, v)
                if p[1] is None:
                    assert c == "."
                else:  # direction and strength band decode back to the per-characteristic file
                    d, band = next(key for key, code in sd.PATTERN_CODES.items() if code == c)
                    assert d == p[0] and band == sd.strength_band(p[1])
    return pats


def test_pattern_index_repackages_the_per_characteristic_files(built):
    _, meta, out, _ = built
    pats = _check_patterns(meta, out)
    assert pats["g"]["all"][0][0] == "i"  # dialogue share: a clear, strong pattern in the synthetic data


def test_real_pattern_index_is_small_and_holds_nothing_else():
    if not REAL_META.exists():
        pytest.skip("site aggregates not generated")
    import gzip
    meta = json.loads(REAL_META.read_text())
    out = REAL_META.parent
    _check_patterns(meta, out)
    raw = (out / "patterns.json").read_bytes()
    assert len(gzip.compress(raw, 9)) <= 40_000
    assert set(raw.decode()) <= set('{}[]":,abcdefghi.' + "".join({c for g in meta["genres"] for c in g["id"]}) + "keyg")


# ------------------------------------------------------------------------------------------------ genres page
SUBSET_IDS = {s[0] for s in W.SUBSETS}


@pytest.fixture(scope="module")
def built_genres(tmp_path_factory):
    """The extended synthetic handoff (more characteristics, three of which differ between genres on purpose)."""
    tmp = tmp_path_factory.mktemp("genres")
    path, df = write_synthetic_handoff(tmp, extended=True)
    out = tmp / "aggregates"
    sd.build_site_data(path, out, workers=2)
    meta = json.loads((out / "meta.json").read_text())
    return path, meta, out, df[df.analysis_include].reset_index(drop=True)


def _genres(out, subset="all"):
    return json.loads((out / "genres" / f"{subset}.json").read_text())


def test_one_genres_file_per_option_and_no_other_files(built, built_genres):
    for _, meta, out, *_ in (built, built_genres):
        assert {p.stem for p in (out / "genres").iterdir()} == {s["id"] for s in meta["subsets"]} == SUBSET_IDS
        assert {p.name for p in out.iterdir()} == {"meta.json", "patterns.json", "v", "genres", "trends"}
        assert all(p.suffix == ".json" for p in (out / "genres").iterdir())
        assert all(p.is_dir() and all(f.suffix == ".json" for f in p.iterdir()) for p in (out / "v").iterdir())


def test_genres_meta_has_the_rule_and_the_direction_words(built_genres):
    _, meta, _, _ = built_genres
    assert meta["genre_rule"] == {"min_r": 0.2, "level": 0.999, "min_tvd": 0.2, "min_n": 30}
    words = {v["id"]: (v.get("more_word"), v.get("less_word")) for v in meta["variables"]}
    assert words["story_words"] == ("Longer", "Shorter") and words["sex_terms_per_1k"] == ("More", "Less")
    assert all((w == W.DIRECTION_WORDS[i]) if i in W.DIRECTION_WORDS else w == (None, None) for i, w in words.items())
    # the 20 of D10 and the five "where ... peaks" positions (Later / Earlier, the review's F72)
    assert len(W.DIRECTION_WORDS) == 25
    peaks = [k for k in W.DIRECTION_WORDS if k.endswith("_peak_position")]
    assert len(peaks) == 5 and all(W.DIRECTION_WORDS[k] == ("Later", "Earlier") for k in peaks)


def test_genres_arrays_cells_and_shares(built_genres):
    _, meta, out, _ = built_genres
    genre_ids = [g["id"] for g in meta["genres"]]
    for sid in SUBSET_IDS:
        data = _genres(out, sid)
        assert data["s"] == sid and data["genres"] == genre_ids
        assert data["rule"] == {"min_r": 0.2, "z": 3.29, "min_tvd": 0.2, "min_n": 30}
        assert len(data["n"]) == len(data["age"]) == len(genre_ids)
        assert all((a is None) == (n < sd.MIN_N) for n, a in zip(data["n"], data["age"]))
        for name, e in data["c"].items():
            arrays = [e["q"], e["r"], e["f"]] + ([e["z"]] if e["k"] == "zero" else [])
            assert all(len(a) == len(genre_ids) for a in arrays), name
            for i, cell in enumerate(e["q"]):
                if cell is None:
                    assert e["r"][i] is None and e["f"][i] == 0
                    continue
                n = cell[0]
                assert n >= sd.MIN_N and (e["r"][i] is None) == (i == 0 or n < sd.SMALL_N), (sid, name, i)
                if e["k"] == "num":
                    quart = cell[2:5] if i == 0 else cell[1:4]
                    assert quart[0] <= quart[1] <= quart[2] and len(cell) == (6 if i == 0 else 4)
                    if i == 0:
                        assert cell[1] <= cell[2] and cell[4] <= cell[5]  # p10 and p90 around the quartiles
                elif e["k"] == "zero":
                    z = e["z"][i]
                    assert cell == [n] and 0 <= z[0] <= n
                    share, quart = (z[1], z[2:]) if i == 0 else (None, z[1:])
                    assert share is None or 0 <= share <= 1
                    assert (len(quart) == 3) == (z[0] >= sd.MIN_N) and (not quart or quart[0] <= quart[1] <= quart[2])
                elif e["k"] == "bin":
                    assert len(cell) == 2 and 0 <= cell[1] <= 1
                else:
                    assert all(0 <= s <= 1 for s in cell[1:]) and abs(sum(cell[1:]) - 1) <= 0.002, (sid, name, i)
                assert e["f"][i] in ((0, 1) if e["k"] == "grp" else (-1, 0, 1))


def _direct(df, name, kind, genre, subset_mask=None):
    """The comparison of one genre with all genres, recomputed from scratch: (n, r, se) by counting pairs, or for
    named groups (n, tvd, chi-square, degrees of freedom)."""
    w = df["sampling_weight"].to_numpy()
    keep = np.ones(len(df), bool) if subset_mask is None else subset_mask
    if kind == "grp":
        levels = [v for v, _ in W.LEVELS[name]]
        x = df[name].to_numpy()
        ok = keep & np.isin(x, levels)
        g = ok & (df["queue_category_slug"] == genre).to_numpy()
        pa = np.array([w[ok & (x == v)].sum() for v in levels]) / w[ok].sum()
        pg = np.array([(x[g] == v).sum() for v in levels]) / g.sum()
        small = pa < 0.01
        pa2 = np.append(pa[~small], pa[small].sum()) if small.any() else pa
        pg2 = np.append(pg[~small], pg[small].sum()) if small.any() else pg
        live = pa2 > 0
        return int(g.sum()), 0.5 * np.abs(pg - pa).sum(), g.sum() * (((pg2 - pa2)[live]) ** 2 / pa2[live]).sum(), \
            int(live.sum()) - 1
    x = pd.to_numeric(df[name], errors="coerce").astype(float).to_numpy()
    ok = keep & np.isfinite(x)
    g = ok & (df["queue_category_slug"] == genre).to_numpy()
    xa, wa, xg = x[ok], w[ok], x[g]
    wins = sum(wa[xa < v].sum() + 0.5 * wa[xa == v].sum() for v in xg)  # pairs a genre story wins, ties half
    r = 2 * wins / (len(xg) * wa.sum()) - 1
    n_eff = wa.sum() ** 2 / (wa ** 2).sum()
    n = len(xg)
    return n, r, np.sqrt((n + n_eff + 1) / (3 * n * n_eff))


def test_genre_flags_match_a_direct_recomputation(built_genres):
    _, meta, out, df = built_genres
    genre_ids = [g["id"] for g in meta["genres"]]
    recent = (df["pub_year"] >= 2020).to_numpy()
    flagged = 0
    for sid, mask in (("all", None), ("y2020", recent)):
        data = _genres(out, sid)
        for name in ("sex_terms_per_1k", "pov_is_first_person", "author_stories_count", "emo_anger_per_1k",
                     "narr_tense_class", "pov_class"):
            e = data["c"][name]
            for i, gid in enumerate(genre_ids[1:], start=1):
                if e["q"][i] is None or e["q"][i][0] < sd.SMALL_N:
                    assert e["f"][i] == 0
                    continue
                if e["k"] == "grp":
                    n, tvd, chi, dof = _direct(df, name, "grp", gid, mask)
                    assert e["r"][i] == pytest.approx(round(tvd, 2), abs=1e-9)
                    should = tvd >= 0.2 and dof >= 1 and chi > sd.GENRE_CHI2[dof]
                    assert e["f"][i] == int(should), (sid, name, gid)
                else:
                    n, r, se = _direct(df, name, e["k"], gid, mask)
                    assert e["q"][i][0] == n and e["r"][i] == pytest.approx(round(r, 2), abs=1e-9)
                    should = abs(r) >= 0.2 and abs(r) / se >= 3.29
                    assert e["f"][i] == (int(np.sign(r)) if should else 0), (sid, name, gid)
                flagged += e["f"][i] != 0
    assert flagged >= 4  # Romance differs on purpose: fewer sexual terms, present tense, first person, prolific authors


def test_all_genres_quartiles_and_shares_match_a_weighted_computation(built_genres):
    _, meta, out, df = built_genres
    data = _genres(out)
    w = df["sampling_weight"].to_numpy()
    x = df["sex_terms_per_1k"].to_numpy()
    assert data["c"]["sex_terms_per_1k"]["q"][0] == [len(df)] + [sig(v) for v in weighted_quantiles(x, w, [.1, .25, .5, .75, .9])]
    a = df["emo_anger_per_1k"].to_numpy()
    pos = a > 0
    z = data["c"]["emo_anger_per_1k"]["z"][0]
    assert z[:2] == [int(pos.sum()), round(w[pos].sum() / w.sum(), 3)]
    assert z[2:] == [sig(v) for v in weighted_quantiles(a[pos], w[pos], [.25, .5, .75])]
    rom = (df["queue_category_slug"] == "romance").to_numpy()
    zr = data["c"]["emo_anger_per_1k"]["z"][meta["genres"].index(next(g for g in meta["genres"] if g["id"] == "romance"))]
    assert zr == [int((pos & rom).sum())] + [sig(v) for v in np.quantile(a[pos & rom], [.25, .5, .75], method="hazen")]
    first = df["pov_is_first_person"].to_numpy()
    ok = np.isfinite(first)
    assert data["c"]["pov_is_first_person"]["q"][0] == [int(ok.sum()), round(w[ok & (first == 1)].sum() / w[ok].sum(), 3)]
    tense = df["narr_tense_class"].to_numpy()
    shares = [w[tense == t].sum() / w.sum() for t in ("past", "present", "mixed")]
    assert data["c"]["narr_tense_class"]["q"][0][1:] == pytest.approx(shares, abs=0.0011)
    ages = df["age_years"].to_numpy()
    assert data["age"][0] == round(weighted_quantiles(ages, w, [0.5])[0], 1)
    assert data["n"] == [len(df)] + [int((df["queue_category_slug"] == g["id"]).sum()) for g in meta["genres"][1:]]


def test_publication_years_are_whole_years(built_genres):
    _, _, out, df = built_genres
    q = _genres(out)["c"]["pub_year"]["q"]
    years = [v for cell in q if cell for v in cell[1:]]
    assert all(isinstance(v, int) and 2000 <= v <= 2026 for v in years)
    assert any(v % 10 for v in years)  # not rounded to the decade, as sig(2013, 3) would
    w = df["sampling_weight"].to_numpy()
    assert q[0][3] == int(np.floor(weighted_quantiles(df["pub_year"].to_numpy(), w, [0.5])[0] + 0.5))


def test_excluded_characteristics_and_conflicting_options_are_absent(built_genres):
    _, meta, out, _ = built_genres
    ids = [v["id"] for v in meta["variables"]]
    assert "pub_month" in ids  # still on Explore
    for sid in SUBSET_IDS:
        c = _genres(out, sid)["c"]
        group = next(s[2] for s in W.SUBSETS if s[0] == sid)
        assert not set(c) & W.GENRE_PAGE_EXCLUDED
        assert list(c) == [i for i in ids if i not in W.GENRE_PAGE_EXCLUDED and not sd.subset_conflict(group, i)]
    assert "story_words" not in _genres(out, "short")["c"] and "story_words" in _genres(out, "y2000")["c"]
    assert not {"pub_year", "age_years"} & set(_genres(out, "y2020")["c"]) and "pub_year" in _genres(out, "long")["c"]
    kinds = {i: e["k"] for i, e in _genres(out)["c"].items()}
    assert kinds == {"dlg_word_share": "num", "dlg_has_dialogue": "bin", "pov_class": "grp", "emo_anger_per_1k": "zero",
                     "pub_year": "num", "story_words": "num", "age_years": "num", "author_stories_count": "band",
                     "sex_terms_per_1k": "num", "narr_tense_class": "grp", "pov_is_first_person": "bin",
                     "punct_comma_per_1k": "num"}


def test_genres_and_trends_output_is_deterministic(built_genres, tmp_path):
    path, _, out, _ = built_genres
    again = tmp_path / "again"
    sd.build_site_data(path, again, workers=1)
    for f in (out / "genres").iterdir():
        assert f.read_bytes() == (again / "genres" / f.name).read_bytes(), f.name
    for f in (out / "trends").rglob("*.json"):
        assert f.read_bytes() == (again / "trends" / f.relative_to(out / "trends")).read_bytes(), f.name


def test_genres_builder_reads_only_the_characteristic_genre_weight_and_age(built_genres):
    _, meta, _, df = built_genres
    genre_ids = [g["id"] for g in meta["genres"]]
    g = df["queue_category_slug"].map({gid: i for i, gid in enumerate(genre_ids)}).to_numpy()
    w = df["sampling_weight"].to_numpy()
    sd._init({"g": g, "w": w, "genre_ids": genre_ids, "subsets": {"all": np.ones(len(df), bool)}})  # no popularity
    x = df["sex_terms_per_1k"].to_numpy()
    codes = np.zeros(len(df), dtype=np.int16)
    entry = sd._genre_task("sex_terms_per_1k", "num", "num", x, codes, 1, set())["all"]
    assert set(entry) == {"k", "fmt", "q", "r", "f"}
    payload = sd.genre_file("all", np.ones(len(df), bool), g, w, df["age_years"].to_numpy(), genre_ids, {"x": entry})
    assert set(payload) == {"s", "rule", "genres", "n", "age", "c"}
    text = json.dumps(payload)
    assert "kromance" not in text and "story_key" not in text


def test_real_genres_files_are_small():
    if not (REAL_META.parent / "genres").exists():
        pytest.skip("site aggregates not generated")
    import gzip
    for f in (REAL_META.parent / "genres").iterdir():
        assert len(gzip.compress(f.read_bytes(), 9)) <= 60_000, f.name


# ----------------------------------------------------------------------------------------------------- trends page
def _trend(out, sid, gid):
    return json.loads((out / "trends" / sid / f"{gid}.json").read_text())


def test_trend_periods_start_at_the_first_year_and_end_with_the_newest():
    assert TR.trend_periods(np.array([2000, 2026])) == [[2000, 2004], [2005, 2009], [2010, 2014], [2015, 2019], [2020, 2026]]
    assert TR.trend_periods(np.array([2003, 2021])) == [[2003, 2007], [2008, 2012], [2013, 2017], [2018, 2019], [2020, 2021]]
    assert TR.trend_periods(np.array([2001, 2012])) == [[2001, 2005], [2006, 2010], [2011, 2015], [2016, 2019]]


def test_trends_one_file_per_option_and_genre(built, built_genres):
    for _, meta, out, *_ in (built, built_genres):
        genre_ids = [g["id"] for g in meta["genres"]]
        assert {p.name for p in (out / "trends").iterdir()} == set(W.TREND_SUBSETS) == set(meta["trend"]["subsets"])
        for sid in W.TREND_SUBSETS:
            assert sorted(p.name for p in (out / "trends" / sid).iterdir()) == sorted(f"{g}.json" for g in genre_ids)


def test_trend_meta_periods_and_windows(built_genres):
    _, meta, out, df = built_genres
    t, newest = meta["trend"], int(df["pub_year"].max())
    assert t["periods"] == [[2000, 2004], [2005, 2009], [2010, 2014], [2015, 2019], [2020, newest]]
    assert t["then"] == [2000, 2009] and t["now"] == [2020, newest] == t["periods"][-1]  # "now" is the last period
    assert t["rule"] == {"min_r": 0.2, "level": 0.999, "min_tvd": 0.2, "min_n": 30}
    assert t["subsets"] == ["all", "short", "medium", "long"] and t["excluded"] == list(W.TREND_PAGE_EXCLUDED)
    for sid in W.TREND_SUBSETS:
        for gid in [g["id"] for g in meta["genres"]]:
            d = _trend(out, sid, gid)
            assert list(d) == ["s", "g", "rule", "periods", "then", "now", "n", "c"] and (d["s"], d["g"]) == (sid, gid)
            assert d["rule"] == {"min_r": 0.2, "z": 3.29, "min_tvd": 0.2, "min_n": 30}
            assert (d["periods"], d["then"], d["now"]) == (t["periods"], t["then"], t["now"])


def test_trend_arrays_cells_and_shares(built_genres):
    """Every array as long as the periods; cells only for 10 stories or more, in the Genres page's forms and nothing
    else (no minimum, maximum or per-story value); shares that add up to 1; the mix check in All genres' files only."""
    _, meta, out, _ = built_genres
    for sid in W.TREND_SUBSETS:
        for gid in [g["id"] for g in meta["genres"]]:
            d = _trend(out, sid, gid)
            assert len(d["n"]) == len(d["periods"])
            for name, e in d["c"].items():
                assert len(e["q"]) == len(d["periods"]), name
                for i, cell in enumerate(e["q"] + [e["t"]]):
                    if cell is None:
                        continue
                    n, extra = cell[0], int(gid == "all")
                    assert n >= sd.MIN_N and (i == len(e["q"]) or n <= d["n"][i]), (sid, gid, name, i)
                    if e["k"] == "num":
                        assert len(cell) == 4 and cell[1] <= cell[2] <= cell[3]
                    elif e["k"] == "bin":
                        assert len(cell) == 2 and 0 <= cell[1] <= 1
                    elif e["k"] == "zero":
                        assert 0 <= cell[1] <= n and (not extra or 0 <= cell[2] <= 1)
                        assert len(cell) == (5 + extra if cell[1] >= sd.MIN_N else 2 + extra)
                        quart = cell[2 + extra:]
                        assert not quart or quart[0] <= quart[1] <= quart[2]
                    else:
                        assert all(0 <= v <= 1 for v in cell[1:]) and abs(sum(cell[1:]) - 1) <= 0.002, (sid, gid, name, i)
                assert e["f"] in ((0, 1) if e["k"] == "grp" else (-1, 0, 1)) and (e["f"] == 0 or e["r"] is not None)
                assert ("rm" in e) == ("fm" in e) == (gid == "all"), (sid, gid, name)


def test_trend_windows_and_counts_match_a_direct_computation(built_genres):
    _, _, out, df = built_genres
    w, year = df["sampling_weight"].to_numpy(), df["pub_year"].to_numpy()
    then, now = (year >= 2000) & (year <= 2009), year >= 2020
    x, first = df["sex_terms_per_1k"].to_numpy(), df["pov_is_first_person"].to_numpy()
    for gid in ("all", "romance", "fetish"):
        d = _trend(out, "all", gid)
        g = np.ones(len(df), bool) if gid == "all" else (df["queue_category_slug"] == gid).to_numpy()
        wg = w if gid == "all" else np.ones(len(df))  # All genres weighted, a genre's stories all the same
        num, yes = d["c"]["sex_terms_per_1k"], d["c"]["pov_is_first_person"]
        for window, cells in ((then, (num["t"], yes["t"])), (now, (num["q"][-1], yes["q"][-1]))):
            m = g & window & np.isfinite(x)
            assert cells[0] == [int(m.sum())] + [sig(v) for v in weighted_quantiles(x[m], wg[m], [0.25, 0.5, 0.75])]
            m = g & window & np.isfinite(first)
            assert cells[1] == [int(m.sum()), round(float(wg[m & (first == 1)].sum() / wg[m].sum()), 3)]
        assert d["n"] == [int((g & (year >= lo) & (year <= hi)).sum()) for lo, hi in d["periods"]]


def _trend_direct(df, name, kind, gid, sub, fixed=False):
    """2020 or later against 2000-2009 for one option and genre, from scratch: (r, se) by counting pairs, or for named
    groups (tvd, chi-square, degrees of freedom); None when a window has fewer than 30 stories. `fixed`: All genres with
    each genre's share of both windows held at its share of the option's stories with the characteristic."""
    w, year, genre = df["sampling_weight"].to_numpy(), df["pub_year"].to_numpy(), df["queue_category_slug"].to_numpy()
    if kind == "grp":
        levels = [v for v, _ in W.LEVELS[name]]
        x = df[name].to_numpy()
        ok = sub & np.isin(x, levels)
    else:
        x = pd.to_numeric(df[name], errors="coerce").astype(float).to_numpy()
        ok = sub & np.isfinite(x)
    if gid != "all":
        ok &= genre == gid
    a, b = ok & (year >= 2000) & (year <= 2009), ok & (year >= 2020)
    if a.sum() < 30 or b.sum() < 30:
        return None
    if gid != "all":
        wa, wb = np.ones(a.sum()), np.ones(b.sum())
    elif not fixed:
        wa, wb = w[a], w[b]
    else:
        share = {gg: w[ok & (genre == gg)].sum() / w[ok].sum() for gg in set(genre[ok])}
        wa = np.array([share[gg] / (a & (genre == gg)).sum() for gg in genre[a]])
        wb = np.array([share[gg] / (b & (genre == gg)).sum() for gg in genre[b]])
    ea, eb = wa.sum() ** 2 / (wa ** 2).sum(), wb.sum() ** 2 / (wb ** 2).sum()
    if kind == "grp":
        pa = np.array([wa[x[a] == v].sum() for v in levels]) / wa.sum()
        pb = np.array([wb[x[b] == v].sum() for v in levels]) / wb.sum()
        tvd = 0.5 * np.abs(pb - pa).sum()
        pool = (pa * ea + pb * eb) / (ea + eb)
        small = pool < 0.01
        if small.any():
            pa, pb, pool = (np.append(p[~small], p[small].sum()) for p in (pa, pb, pool))
        live = pool > 0
        return tvd, (ea * eb / (ea + eb)) * (((pb - pa)[live]) ** 2 / pool[live]).sum(), int(live.sum()) - 1
    xa, xb = x[a], x[b]
    wins = sum(wv * (wa[xa < v].sum() + 0.5 * wa[xa == v].sum()) for v, wv in zip(xb, wb))  # pairs a newer story wins
    return 2 * wins / (wb.sum() * wa.sum()) - 1, np.sqrt((ea + eb + 1) / (3 * ea * eb))


def test_trend_flags_and_the_mix_check_match_a_direct_recomputation(built_genres):
    _, meta, out, df = built_genres
    flagged = 0
    for sid in W.TREND_SUBSETS:
        col, lo, hi = next((c, a, b) for s, _, _, c, a, b in W.SUBSETS if s == sid)
        sub = sd._subset_mask(df, col, lo, hi)
        for gid in [g["id"] for g in meta["genres"]]:
            d = _trend(out, sid, gid)
            for name in ("dlg_word_share", "sex_terms_per_1k", "emo_anger_per_1k", "pov_is_first_person",
                         "narr_tense_class"):
                e = d["c"][name]
                for fixed in ((False, True) if gid == "all" else (False,)):
                    rk, fk = ("rm", "fm") if fixed else ("r", "f")
                    got = _trend_direct(df, name, e["k"], gid, sub, fixed)
                    if got is None:  # r is null exactly when a window has fewer than 30 stories
                        assert e[rk] is None and e[fk] == 0, (sid, gid, name, fixed)
                        continue
                    if e["k"] == "grp":
                        tvd, chi, dof = got
                        assert e[rk] == pytest.approx(round(tvd, 3), abs=1e-9)
                        assert e[fk] == int(tvd >= 0.2 and dof >= 1 and chi > sd.GENRE_CHI2[dof]), (sid, gid, name)
                    else:
                        r, se = got
                        assert e[rk] == pytest.approx(round(r, 3), abs=1e-9), (sid, gid, name, fixed)
                        assert e[fk] == (int(np.sign(r)) if abs(r) >= 0.2 and abs(r) / se >= 3.29 else 0)
                    flagged += e[fk] != 0
    assert flagged >= 4  # dialogue rises with the publication year on purpose (synthetic.py)


def test_trend_left_out_characteristics_and_conflicting_options_are_absent(built_genres):
    _, meta, out, _ = built_genres
    ids = [v["id"] for v in meta["variables"]]
    for sid in W.TREND_SUBSETS:
        for gid in [g["id"] for g in meta["genres"]]:
            c = _trend(out, sid, gid)["c"]
            assert not set(c) & set(W.TREND_PAGE_EXCLUDED)
            assert list(c) == [i for i in ids if i not in W.TREND_PAGE_EXCLUDED and not sd.subset_conflict(
                "Length" if sid != "all" else "", i)]
    assert "story_words" in _trend(out, "all", "romance")["c"] and "story_words" not in _trend(out, "medium", "all")["c"]
    kinds = {i: e["k"] for i, e in _trend(out, "all", "all")["c"].items()}
    assert kinds == {"dlg_word_share": "num", "dlg_has_dialogue": "bin", "pov_class": "grp", "emo_anger_per_1k": "zero",
                     "story_words": "num", "sex_terms_per_1k": "num", "narr_tense_class": "grp", "pov_is_first_person": "bin",
                     "punct_comma_per_1k": "num"}


def test_trends_builder_reads_only_the_characteristic_genre_weight_year_and_length(built_genres):
    _, meta, _, df = built_genres
    genre_ids = [g["id"] for g in meta["genres"]]
    year, words = df["pub_year"].to_numpy(), df["story_words"].to_numpy()
    S = {"g": df["queue_category_slug"].map({gid: i for i, gid in enumerate(genre_ids)}).to_numpy(),
         "w": df["sampling_weight"].to_numpy(), "year": year, "genre_ids": genre_ids,
         "subsets": {"all": np.ones(len(df), bool), "short": words < 2000}, "trend_subsets": ["all", "short"],
         "trend_periods": TR.trend_periods(year)}  # no popularity, no age, nothing else about the stories
    x = df["sex_terms_per_1k"].to_numpy()
    entries = TR.trend_entries("sex_terms_per_1k", "num", "num", x, np.zeros(len(df), np.int16), 1, set(), S)
    assert set(entries) == {"all", "short"} and set(entries["all"]) == set(genre_ids)
    assert list(entries["all"]["all"]) == ["k", "fmt", "q", "t", "r", "f", "rm", "fm"]
    assert list(entries["all"]["romance"]) == ["k", "fmt", "q", "t", "r", "f"]
    payload = TR.trend_file("all", "all", S["trend_periods"], [0] * len(S["trend_periods"]), {"x": entries["all"]["all"]})
    text = json.dumps(payload)
    assert "kromance" not in text and "story_key" not in text


def test_real_trends_files_are_small_and_whole():
    if not (REAL_META.parent / "trends").exists():
        pytest.skip("site aggregates not generated")
    import gzip
    meta = json.loads(REAL_META.read_text())
    files = sorted((REAL_META.parent / "trends").rglob("*.json"))
    assert len(files) == len(meta["trend"]["subsets"]) * len(meta["genres"]) == 4 * 31
    for f in files:
        assert len(gzip.compress(f.read_bytes(), 9)) <= 16_000, f.name
        d = json.loads(f.read_bytes())
        assert d["periods"] == meta["trend"]["periods"] and len(d["n"]) == len(d["periods"])
        for e in d["c"].values():
            for cell in e["q"] + [e["t"]]:
                assert cell is None or cell[0] >= sd.MIN_N
                if cell is not None and e["k"] in ("grp", "band"):
                    assert abs(sum(cell[1:]) - 1) <= 0.002, f.name


# ------------------------------------------------------------------------------- the Trends review: meta additions
# The two small additions to meta.json the owner approved (O5): `plural` on characteristics whose noun is plural, and
# meta.trend.too_few. Nothing else in meta changes.
VARIABLE_KEYS = {"id", "label", "topic", "subgroup", "kind", "unit", "description", "caveat", "bins", "noun", "n", "syn",
                 "yes", "no", "yes_subject", "no_subject", "more", "more_word", "less_word", "plural"}


def test_plural_nouns_are_decided_by_their_head_word():
    plural = {"story_long_paragraph_share": "very long paragraphs", "punct_comma_per_1k": "commas",
              "sex_scenes_per_10k": "sex scenes per 10,000 words", "read_mean_syllables_per_word": "syllables per word",
              "pace_action_early": "action verbs in the first fifth", "setting_home_per_1k": "home settings",
              "emo_affection_per_1k": "affection and love"}
    singular = {"story_pages": "the number of pages", "story_words": "story length in words",
                "pace_action_shift": "the build-up of action verbs", "pace_action_peak_position": "where action verbs peak",
                "rep_top10_content_share": "reliance on a few words",
                "rep_adjacent_sentence_overlap": "overlap between neighboring sentences",
                "series_part_number": "part number in a series", "rel_consent_per_1k": "consent and check-in language"}
    labels = {"punct_comma_per_1k": "Commas", "sex_scenes_per_10k": "Sex scenes per 10,000 words",
              "read_mean_syllables_per_word": "Syllables per word", "setting_home_per_1k": "Home settings",
              "emo_affection_per_1k": "Affection & love", "rel_consent_per_1k": "Consent and check-in language"}
    for name, noun in {**plural, **singular}.items():
        assert W.us_english(W.noun_for(name, labels.get(name, ""))) == noun, name
    assert set(plural) <= W.PLURAL and not set(singular) & W.PLURAL
    assert not W.PLURAL & set(W.BINARY)  # yes/no characteristics are asked about through "the share of …"


def test_meta_marks_plural_nouns_and_adds_nothing_else(built, built_genres):
    for meta in (built[1], built_genres[1]):
        for v in meta["variables"]:
            assert set(v) <= VARIABLE_KEYS, v["id"]
            assert v.get("plural") is (True if v["id"] in W.PLURAL else None), v["id"]
    assert [v["id"] for v in built_genres[1]["variables"] if v.get("plural")] == ["punct_comma_per_1k"]
    if REAL_META.exists():
        real = json.loads(REAL_META.read_text())
        ids = {v["id"] for v in real["variables"]}
        assert W.PLURAL <= ids  # every name in the list is a characteristic on the site
        trends = [v for v in real["variables"] if v["id"] not in real["trend"]["excluded"]]
        assert len(trends) == 180 and sum(bool(v.get("plural")) for v in trends) == len(W.PLURAL) == 78


def test_too_few_lists_the_genres_whose_windows_cannot_be_compared(built, built_genres):
    for _, meta, out, *_ in (built, built_genres):
        t = meta["trend"]
        assert list(t) == ["periods", "then", "now", "rule", "subsets", "excluded", "too_few"]
        assert list(t["too_few"]) == t["subsets"]
        for sid in t["subsets"]:
            assert t["too_few"][sid] == sorted(t["too_few"][sid])  # ids, A-Z
            for gid in [g["id"] for g in meta["genres"]]:
                d = _trend(out, sid, gid)
                then = sum(k for (lo, hi), k in zip(d["periods"], d["n"]) if lo >= d["then"][0] and hi <= d["then"][1])
                now = sum(k for (lo, _), k in zip(d["periods"], d["n"]) if lo >= d["now"][0])
                assert (gid in t["too_few"][sid]) == (min(then, now) < d["rule"]["min_n"]), (sid, gid)
                # nothing is compared in such a file: every r is null
                if gid in t["too_few"][sid]:
                    assert all(e["r"] is None for e in d["c"].values()), (sid, gid)
    assert built[1]["trend"]["too_few"]["all"] == ["tiny"]  # the synthetic data has a genre too small to compare


def test_meta_is_deterministic_but_for_its_time(built, tmp_path):
    path = sorted(built[2].parent.glob("*.zip"))[0]
    again = tmp_path / "again"
    sd.build_site_data(path, again, workers=1)
    a, b = json.loads((built[2] / "meta.json").read_text()), json.loads((again / "meta.json").read_text())
    a.pop("generated_at"), b.pop("generated_at")
    assert a == b


def test_real_too_few_genres():
    if not REAL_META.exists():
        pytest.skip("site aggregates not generated")
    too_few = json.loads(REAL_META.read_text())["trend"]["too_few"]
    assert too_few["all"] == ["chain-stories", "transgender"]
    assert {sid: len(ids) for sid, ids in too_few.items()} == {"all": 2, "short": 24, "medium": 16, "long": 29}
