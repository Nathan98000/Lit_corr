"""The Stage 1B developer tools: the masked view must never show content words; the profile, sampler and
inventory must be deterministic. All text here is synthetic."""

from __future__ import annotations

import math
import re

import numpy as np
import pandas as pd

from litcorr.dev.char_inventory import inventory
from litcorr.dev.handcheck import wilson
from litcorr.dev.inspect_text import reveal
from litcorr.dev.mask import format_views, mask_text, mask_token, render, visible_words
from litcorr.dev.measure_profile import build_profile, describe
from litcorr.dev.review_sample import draw

V = visible_words()


def test_mask_hides_content_keeps_function_words_endings_and_punctuation():
    p = '“Come here,” she whispered. He walked over and kissed Mary’s neck at 10.30 — twice!'
    m = mask_text(p, V)
    for content in ("Come", "whispered", "walked", "kissed", "Mary", "neck", "twice", "10"):
        assert content not in m
    assert m.startswith("“Xxxx here,” she xxxxxxxed. He xxxxed over and xxxxed Xxxx’s xxxx at 99.99 — xxxxx!")
    assert len(m) == len(p)  # one character for one character: punctuation and spacing are exact
    assert mask_token("Kissing", V) == "Xxxxing" and mask_token("dress", V) == "xxxxx"


def test_mask_never_leaves_letters_outside_function_words():
    p = "Zoë and Ångström met in São Paulo; ½ of 1984’s ﬁnest ΑΒΓ wrote naïvely."
    m = mask_text(p, V, endings=False)
    words = [w.removesuffix("'s") for w in m.replace("’", "'").split()]  # an inflectional ending may show
    letters = [w for w in words if any(c.isalpha() and c not in "xX" for c in w)]
    assert letters == ["and", "in", "of"]


def test_render_overlays_sentences_quotes_and_lexicons():
    paras = ['"Stop!" she said. Then he left.', "* * *"]
    views = render(paras, lex_names=["sensory_touch"], para_tags={1: ["SCENE-BREAK"]})
    out = format_views(views)
    assert '[s0 !] "⟪Xxxx!⟫" she xxxx.' in out and "[s1 .] Then he xxxx." in out
    assert "<SCENE-BREAK>" in out and "* * *" in out


def test_reveal_is_capped_and_refuses_titles():
    paras = ["word " * 80 + "end.", "The Secret Garden returns. Other words here."]
    out = reveal(paras, 0, ["the secret garden"])
    assert out.endswith("[... truncated at 50 words]") and len(re.findall(r"\bword\b", out)) == 50
    assert reveal(paras, 1, ["the secret garden"]).startswith("(refused")


def test_wilson_interval():
    lo, hi = wilson(45, 50)
    assert 0.78 < lo < 0.80 and 0.95 < hi < 0.97
    assert all(math.isnan(x) for x in wilson(0, 0))


def test_review_sample_is_stable_when_the_population_grows():
    keys = [f"k{i:03d}" for i in range(60)]
    df = pd.DataFrame({"story_key": keys, "category_slug": ["a", "b", "c"] * 20})
    s1 = draw(df, 3, seed=7)
    s2 = draw(pd.concat([df, pd.DataFrame({"story_key": ["new1", "new2"], "category_slug": ["a", "b"]})]), 3, seed=7)
    kept = set(s1["story_key"]) & set(s2["story_key"])
    assert len(s1) == 9 and len(kept) >= 7  # at most the two newcomers can displace earlier members
    s3 = draw(df, 3, seed=7, exclude=set(s1["story_key"]))
    assert not set(s3["story_key"]) & set(s1["story_key"])


def test_profile_statistics_and_population():
    df = pd.DataFrame({"story_key": list("abcdef"), "category_slug": ["x", "x", "x", "y", "y", "y"],
                       "analysis_include": [True] * 5 + [False], "has_text": [True] * 6,
                       "story_words": [100.0, 200.0, np.nan, 0.0, 400.0, 999.0], "pov_class": list("fftt?f")})
    d = describe(pd.Series([0.0, 1.0, np.nan, 3.0]))
    assert d["n"] == 3 and d["pct_missing"] == 25 and round(d["pct_zero"], 2) == 33.33 and d["median"] == 1
    prof = build_profile(df)
    row = prof["overall"].set_index("measure").loc["story_words"]
    assert row["n"] == 4 and row["max"] == 400  # the excluded story is not in the population
    assert set(prof["outliers"]["story_key"]) <= set("abcde")


def test_char_inventory_counts_variants_markup_and_mojibake():
    texts = pd.Series(["He said -- no. She - paused... “Fine.” It’s cafÃ© time &amp; <i>x</i>",
                       "Plain ascii text.\n\nSecond paragraph."])
    t = inventory(texts)
    pats = t["patterns"].set_index("pattern")["occurrences"]
    assert pats["double hyphen --"] == 1 and pats["spaced hyphen ' - '"] == 1 and pats["three dots ..."] == 1
    assert set(t["html_tags"]["tag"]) == {"<i>"} and set(t["html_entities"]["entity"]) == {"&amp;"}
    assert t["mojibake"]["occurrences"].sum() == 1
    na = t["non_ascii"].set_index("char")
    assert na.loc["’", "stories"] == 1 and "“" in na.index


def test_fragment_check_shows_at_most_five_words_around_each_match():
    from litcorr.dev.fragment_check import fragment
    from litcorr.text.doc import TextDoc
    from litcorr.text.features import Measurer, passive_matches

    doc = TextDoc(['The vase was quickly broken by the cat. "Come here and sit down with me now," she said.',
                   'Anna smiled at Anna\'s friend Tom, and Tom smiled at Anna. Later Tom and Anna left.'])
    (i, j), = passive_matches(doc)
    assert fragment(doc, f"t{i}-{j}") == "was quickly broken by"
    assert fragment(doc, "seg0") == '"Come here and sit ..."'
    assert Measurer().command_segments(doc) == [0]
    names = Measurer().recurring_names(doc)[0]
    assert [fragment(doc, f"n{k}") for k in range(len(names))] == names


def test_proposal_word_lists_load_and_contain_no_age_words():
    from litcorr.dev.prototype_measures import PROTO_LEX_DIR
    from litcorr.text.lexicons import load_lexicon

    age = {"teen", "teens", "teenage", "teenager", "young", "younger", "youth", "little", "child", "children", "kid",
           "kids", "minor", "underage", "school", "schoolgirl", "student", "barely", "campus", "dorm", "classroom"}
    files = sorted(PROTO_LEX_DIR.glob("*.txt"))
    assert len(files) >= 8
    for f in files:
        x = load_lexicon(f)
        words = set(x.words) | {w for phs in list(x.phrases.values()) + list(x.exclusions.values()) for ph in phs
                                for w in ph}
        assert x.n_entries > 0 and not (words & age), (f.name, words & age)
        assert not any(p.startswith(a) or a.startswith(p) for p in x.prefixes for a in age), f.name
