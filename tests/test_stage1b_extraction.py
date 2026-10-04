"""Stage 1B phase 2 regression tests: what the measures see is the story and only the story.
All text here is written from scratch for the tests."""

from __future__ import annotations

import math

import pandas as pd

from litcorr.settings import Analysis, Settings
from litcorr.site.parse_common import make_soup
from litcorr.site.parse_story import extract_paragraphs
from litcorr.text.features import Measurer
from litcorr.text.paratext import classify, detect, is_separator
from litcorr.text.prepare import normalize_paragraph, prepare

M = Measurer(analysis=Analysis(min_words_for_pacing=200, window_tokens=100))
BODY = ["She walked along the harbour wall while the boats came in, counting the gulls and the ropes and the "
        "minutes until the ferry would leave without her."] * 30


# --------------------------------------------------------------------- extraction (HTML -> paragraphs)
def test_lists_headings_and_loose_text_next_to_paragraphs_are_kept_in_order():
    html = ('<div itemprop="articleBody"><div class="intro"><p>First paragraph here.</p>'
            '<h3>A heading line</h3>Loose text between blocks.<p></p>'
            '<ol><li>Item one text<p></p><ol><li>Nested item</li></ol></li><li><em>Item two</em> text</li></ol>'
            '<blockquote>Quoted block without p</blockquote><center>Centered line</center>'
            '<p>Last <i>para</i>graph.<br><br>Split by a blank line.</p><!-- a comment --></div>'
            '<a class="_report_block_x1">Report</a></div>')
    paras, em, _ = extract_paragraphs(make_soup(html))
    assert paras == ["First paragraph here.", "A heading line", "Loose text between blocks.", "Item one text",
                     "Nested item", "Item two text", "Quoted block without p", "Centered line", "Last paragraph.",
                     "Split by a blank line."]
    assert em == 2


def test_plain_paragraph_pages_are_unchanged():
    html = '<div itemprop="articleBody"><p>"Hello," she said.<br><br>He nodded.<br>Then he left.</p><p>Two.</p></div>'
    paras, _, _ = extract_paragraphs(make_soup(html))
    assert paras == ['"Hello," she said.', "He nodded. Then he left.", "Two."]


# --------------------------------------------------------------------- paratext
def test_opening_note_closed_by_separator_and_closing_reader_note_are_paratext():
    paras = (["Author's note: thanks to my editor for the help with this one.", "All characters are over eighteen.",
              "* * *", "Chapter One"] + BODY +
             ["To be continued...", "Thanks for reading! Please vote and leave a comment.", "Cheers,", "Jo"])
    pt = detect(paras, title="Harbour Lights Ch. 01")
    assert pt.lead_end == 3 and pt.tail_start == len(paras) - 4
    assert set(pt.labels.values()) == {"note", "separator", "heading", "end"}  # thanks/vote lines are notes
    assert pt.story_indices == list(range(4, 4 + len(BODY)))


def test_story_text_is_not_mistaken_for_paratext():
    letter = ["Dear John,"] + BODY + ["I hope this letter finds you well.", "Sincerely,", "Jane"]
    assert detect(letter).labels == {}
    ending = BODY + ["* * *", "Later.", "She smiled."]  # a short last scene after a break is story text
    assert detect(ending).labels == {}
    framing = ["We still tell the story of that night to our friends, and I smile when I read it."] + BODY
    assert detect(framing).labels == {}
    assert classify("Day one was hard.", position=0) is None and classify("By then it was late.", position=0) is None
    assert classify("Part of me wanted to stay.") is None


def test_headings_title_lines_bylines_tags_and_disclaimers():
    assert classify("Chapter 3: The Return") == "heading" and classify("EPILOGUE") == "heading"
    assert classify("IV.") == "heading" and classify("~ The Long Night ~") == "heading"
    assert classify("Night Falls On Brook Street", position=0) == "heading"
    assert classify("A short story by Somebody", position=1) == "heading"
    assert classify("#romance #beach #summer", position=0) == "note"
    assert classify("Summary: two strangers meet at a harbour.", position=1) == "note"
    assert classify("These characters do not belong to me.") == "note"
    assert classify("To be continued...") == "end" and classify("-End-") == "end"
    assert classify("Hello readers:") == "reader" and classify("I hope you enjoy this chapter!") == "reader"


def test_separators():
    for sep in ("* * *", "-----", "......", "o0o", "-x-x-x-", "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~", "•"):
        assert is_separator(sep), sep
    for not_sep in ('"..."', "?!", "Ok.", "", "x" * 200):
        assert not is_separator(not_sep), not_sep


def test_normalisation_of_line_separators_and_odd_apostrophes():
    assert normalize_paragraph("I don`t know  what to say") == "I don't know what to say"
    assert normalize_paragraph("plain text") == "plain text"


# --------------------------------------------------------------------- measures on story text only
def test_measures_ignore_paratext_and_count_new_separators_and_dashes():
    story = ["She waited - then she laughed, and the sea went on and on."] * 30
    paras = ["Author's note: this is my first story, please vote!", "* * *"] + story[:15] + \
            ["................................................"] + story[15:] + ["THE END"]
    out = M.measure(paras, {"title": "Sea Glass"})
    plain = M.measure(story)
    assert out["story_words"] == plain["story_words"]  # notes, separators and the end marker are not story words
    assert out["story_has_author_note"] is True and out["story_requests_feedback"] is True
    assert out["story_scene_breaks"] == 1  # the dotted line inside the story, not the opening separator
    assert out["punct_dash_per_1k"] == plain["punct_dash_per_1k"] > 0  # spaced hyphen counts; separators do not
    assert out["punct_ellipsis_per_1k"] == 0


def test_truncated_long_stories_are_not_excluded_as_too_short():
    from litcorr.analyze import build_processed

    base = {"story_slug": "s", "queue_category_slug": "adult-romance", "category_slug": "adult-romance",
            "category_name": "Romance", "collection_status": "done", "date_published": "2020-01-01", "views": 1000,
            "favorites": 10, "comments": 1, "rating": 4.0, "stats_observed_at": pd.Timestamp("2026-09-01", tz="UTC"),
            "n_pages_parsed": 20, "n_pages_expected": 20, "n_pages_fetched": 20, "tags": ["x"], "title": "T",
            "site_words_count": 1000}
    text = "\n\n".join(BODY)
    raw = pd.DataFrame([{**base, "story_key": "a", "text": text, "text_sha1": "1", "text_truncated": True},
                        {**base, "story_key": "b", "text": None, "text_sha1": None, "text_truncated": False,
                         "collection_status": "queued", "n_pages_parsed": None, "n_pages_expected": 6,
                         "n_pages_fetched": 0}])
    df = build_processed(raw, None, Settings(), workers=1).set_index("story_key")
    assert bool(df.loc["a", "analysis_include"]) and math.isnan(df.loc["a", "story_words"])
    assert "text_too_short" not in df.loc["a", "qc_flags"] and "text_truncated" in df.loc["a", "qc_flags"]
    assert "text_truncated" not in df.loc["b", "qc_flags"]  # no text collected yet: not "truncated"
    assert not any(c.startswith("_") for c in df.columns)


def test_site_word_count_check_includes_paratext():
    from litcorr.analyze import build_processed

    note = ["Author's note: " + " ".join(["word"] * 400)]
    text = "\n\n".join(note + BODY)
    n_all = len(prepare(text.split("\n\n")).paragraphs[0].split()) - 2 + 30 * len(BODY[0].split())
    raw = pd.DataFrame([{"story_key": "a", "story_slug": "a", "queue_category_slug": "x", "category_slug": "x",
                         "category_name": "X", "collection_status": "done", "date_published": "2020-01-01",
                         "views": 500, "stats_observed_at": pd.Timestamp("2026-09-01", tz="UTC"),
                         "n_pages_parsed": 1, "n_pages_expected": 1, "n_pages_fetched": 1, "text_truncated": False,
                         "tags": [], "title": "T", "text": text, "text_sha1": "1", "site_words_count": n_all}])
    df = build_processed(raw, None, Settings(), workers=1)
    assert "site_word_count_mismatch" not in df.loc[0, "qc_flags"]
