"""Regression tests for the text-measure review: each reproduces a reported mis-measurement."""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from litcorr.settings import Analysis, Settings
from litcorr.text.doc import TextDoc, split_sentences
from litcorr.text.features import Measurer

M = Measurer(analysis=Analysis(min_words_for_pacing=200, window_tokens=100))


def _sents(p):
    return [(p[s:e].strip(), t) for s, e, t in split_sentences(p)]


# 1. statements starting with You/We/They are not commands; vocatives with a comma are skipped
def test_commands_only_real_commands():
    paras = ['"You look beautiful tonight," he said.', '"You feel so good," she whispered.',
             '"We don\'t have much time," he said.', '"They say it will rain," she said.',
             '"Come here," he said.', '"Sarah, sit down," he said.'] * 5
    out = M.measure(paras)
    assert out["agency_command_share_of_speech"] == 2 / 6


# 3. a question followed by a dialogue tag is still a question
def test_tagged_questions_and_exclamations_count():
    s = _sents('"Where are you going?" she asked. "Stop!" he shouted. She left.')
    assert [t for _, t in s] == ["?", "!", "."]


# 5. sentence splitting edge cases
def test_sentence_splitting_edge_cases():
    assert len(_sents('"No." He turned away.')) == 2
    assert len(_sents("So did I. Then we left.")) == 2
    assert len(_sents("He was 6.2 feet tall at 10.30 that night.")) == 1
    assert len(_sents("Thanks, hon. See you later.")) == 2
    assert len(_sents("Room No. 5 was empty.")) == 1


# 7. the first word of a quote is not a mid-sentence name
def test_interjections_are_not_names():
    paras = ['She moaned, "Ohhh, yes." Sarah smiled at Tom.', 'He groaned, "Mmmm, Sarah." Tom laughed.',
             'She sighed, "Ugh, fine." Then Sarah kissed Tom.'] * 3
    out = M.measure(paras * 3)
    assert out["char_recurring_names"] == 2  # Sarah and Tom only


# 8. numbers in titles are not part numbers without other series evidence
def test_title_numbers_and_series_parts():
    base = ["Words for the story body go here and continue for a while."] * 15
    assert M.measure(base, {"title": "Summer of 69"})["series_is_part"] is False
    assert M.measure(base, {"title": "Route 66"})["title_has_chapter_marker"] is False
    out = M.measure(base, {"title": "Midnight Train Ch. 03"})
    assert out["series_is_part"] and out["series_part_number"] == 3 and out["series_is_later_part"] is True
    out = M.measure(base, {"title": "Midnight Train 2", "series_id": "123"})
    assert out["series_part_number"] == 2
    out = M.measure(base, {"title": "Midnight Train", "series_id": "123"})
    assert math.isnan(out["series_is_later_part"])  # unknown, not "no"


# 9. <br><br> inside one <p> separates paragraphs
def test_br_br_splits_paragraphs():
    from litcorr.site.parse_story import extract_paragraphs
    from litcorr.site.parse_common import make_soup

    html = '<div itemprop="articleBody"><p>"Hello," she said.<br><br>He nodded.<br>Then he left.</p></div>'
    paras, _, _ = extract_paragraphs(make_soup(html))
    assert paras == ['"Hello," she said.', "He nodded. Then he left."]


# 10. lexicon precision fixes
def test_lexicon_precision():
    out = M.measure(["The ship fired its thrusters near the condominium. The lamp next to the bed was dim. "
                     "She cried out his name. He was not sure. Could you pass the salt? The kind of man he was."] * 5)
    assert out["sex_terms"] == 0
    assert out["emo_sadness_per_1k"] == 0
    assert out["rel_closeness_per_1k"] == 0
    assert out["hedge_per_1k"] == 0 and out["hedge_certainty_per_1k"] == 0


# 11. NaN / Infinity in embedded data does not crash the parser
def test_non_finite_embedded_numbers():
    from litcorr.site.parse_story import parse_story_page

    html = ('<html><body><h1>T</h1><div itemprop="articleBody"><p>Text here.</p></div><script>'
            '$R[0]={url:"x-story",title:"T",view_count:Infinity,favorite_count:NaN,comment_count:3,'
            'date_approve:"01/02/2020",rate_all:4.1,words_count:-Infinity}</script></body></html>')
    sp = parse_story_page(html, "https://www.literotica.com/s/x-story")
    assert "views" not in sp.fields and sp.fields["comments"] == 3 and "site_words_count" not in sp.fields


# 2 & 4. truncated texts get blank whole-text measures; no crash when no story has enough text
def _raw(rows):
    base = {"story_slug": "s", "story_key": "k", "queue_category_slug": "adult-romance",
            "category_slug": "adult-romance", "category_name": "Romance", "collection_status": "done",
            "date_published": "2020-01-01", "views": 1000, "favorites": 10, "comments": 1, "rating": 4.0,
            "stats_observed_at": pd.Timestamp("2026-09-01", tz="UTC"), "n_pages_parsed": 1, "n_pages_expected": 1,
            "n_pages_fetched": 1, "text_truncated": False, "tags": ["x"], "title": "T", "text_sha1": None}
    return pd.DataFrame([{**base, **r} for r in rows])


def test_truncated_text_blanks_whole_text_measures():
    from litcorr.analyze import build_processed

    text = "\n\n".join(["She walked home slowly. He followed her and smiled. They talked."] * 40)
    raw = _raw([{"story_key": "a", "story_slug": "a", "text": text, "text_sha1": "1"},
                {"story_key": "b", "story_slug": "b", "text": text, "text_sha1": "2", "text_truncated": True}])
    df = build_processed(raw, None, Settings(), workers=1).set_index("story_key")
    assert df.loc["a", "story_words"] > 0 and math.isnan(df.loc["b", "story_words"])
    assert math.isnan(df.loc["b", "pace_dialogue_early"])
    assert df.loc["b", "pov_third_per_1k"] == df.loc["a", "pov_third_per_1k"]  # rates are kept


def test_analyze_survives_corpus_without_usable_text():
    from litcorr.analyze import build_processed

    raw = _raw([{"story_key": "a", "story_slug": "a", "text": "Too short."},
                {"story_key": "b", "story_slug": "b", "text": None, "collection_status": "queued",
                 "n_pages_parsed": None}])
    df = build_processed(raw, None, Settings(), workers=1).set_index("story_key")
    assert not df["analysis_include"].any()
    assert math.isnan(df.loc["b", "story_words"]) and math.isnan(df.loc["b", "meta_tag_count"])


# 6. the handoff cannot be traced back to stories or authors easily
def test_story_key_is_keyed_and_handoff_is_coarsened(tmp_path):
    import hashlib

    from litcorr.build.raw_corpus import story_key
    from litcorr.export import coarsen_for_handoff

    k1, k2 = story_key("my-story", b"secret-a"), story_key("my-story", b"secret-b")
    assert k1 != k2 and k1 != hashlib.sha1(b"literotica:my-story").hexdigest()[:16]
    assert story_key("my-story", b"secret-a") == k1  # stable
    df = pd.DataFrame({"story_key": list("abcdefghijklmnopqrstuvwxy"),
                       "tags": [["romance", "sarah jones"]] + [["romance"]] * 24,
                       "author_stories_count": [1, 3, 7, 25, 300] * 5, "author_followers_count": [0, 5, 50, 500, 5000] * 5,
                       "pop_views": [123456] * 25, "date_published": ["2020-01-01"] * 25, "age_days": [100.0] * 25})
    h = coarsen_for_handoff(df)
    assert h["tags"][0] == ["romance"]  # rare tag (possibly a name) dropped
    assert list(h["author_stories_count"][:5]) == [1, 2, 6, 21, 201]
    assert list(h["author_followers_count"][:5]) == [0, 0, 10, 100, 1000]
    assert h["pop_views"][0] == 123000 and "date_published" not in h and h["age_days"][0] == 98
