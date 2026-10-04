"""Odd values in real pages (a tag stored as the number 16, a numeric title) must be read, and a page the
parser still cannot read must not stop the collection or the build: the story stays queued and its saved
page is read again later, without a new download."""

from __future__ import annotations

import json

import pytest

from litcorr.build import raw_corpus
from litcorr.collect import stories
from litcorr.collect.discover import collect_listings, discover_categories
from litcorr.collect.sample import build_queue
from litcorr.collect.session import collector_session
from litcorr.demo import make_site, story_page
from litcorr.net.cache import PageCache
from litcorr.paths import DataPaths
from litcorr.site.parse_common import clean_text
from litcorr.site.parse_story import parse_story_page
from litcorr.site.urls import story_slug
from litcorr.state import DONE, QUEUED, State


def test_clean_text_accepts_numbers_and_ignores_other_values():
    assert clean_text(16) == "16" and clean_text(1984.0) == "1984" and clean_text(2.5) == "2.5"
    assert clean_text(True) == "" and clean_text(None) == "" and clean_text({"a": 1}) == ""
    assert clean_text(float("nan")) == "" and clean_text(" a &amp;  b ") == "a & b"


def test_numbers_in_json_ld_are_read_as_text():
    ld = {"@context": "https://schema.org", "@type": "Article", "headline": 1984,
          "keywords": ["romance", 16, {"name": "first time"}, None, True, 2.5],
          "interactionStatistic": ["not an object",
                                   {"interactionType": {"@type": ["ReadAction"]}, "userInteractionCount": 42}]}
    html = (f'<html><head><script type="application/ld+json">{json.dumps(ld)}</script></head>'
            '<body><div itemprop="articleBody"><p>Some text.</p></div></body></html>')
    sp = parse_story_page(html, "https://www.literotica.com/s/x")
    assert sp.fields["title"] == "1984"
    assert sp.fields["tags"] == ["16", "2.5", "first time", "romance"]
    assert sp.fields["views"] == 42


def test_numeric_tag_in_embedded_data_is_kept():
    site = make_site(seed=3, n_per_category=2)
    s = next(x for x in site.stories if x.embedded and x.status == "ok")
    html = story_page(site, s.slug, 1).replace("tags:$R[6]=[", "tags:$R[6]=[{tag:16},", 1)
    sp = parse_story_page(html, f"https://www.literotica.com/s/{s.slug}")
    assert sp.sources["tags"] == "embedded" and "16" in sp.fields["tags"]


def _queue(ctx):
    collect_listings(ctx, discover_categories(ctx))
    build_queue(ctx)


def test_an_unreadable_page_is_skipped_and_read_again_next_run(server, make_settings, factory, monkeypatch):
    site, base = server
    s = make_settings(base)
    real = stories.parse_story_page
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        _queue(ctx)
        bad = {r["story_slug"] for r in ctx.state.next_open_stories(2)}

        def flaky(html, url):
            if story_slug(url) in bad:
                raise AttributeError("'int' object has no attribute 'get'")
            return real(html, url)

        monkeypatch.setattr(stories, "parse_story_page", flaky)
        counts = stories.collect_stories(ctx)
        assert counts[stories.PARSE_ERROR] == 2 and counts[DONE] >= 1  # the run went on past them
        for slug in bad:
            row = ctx.state.get_story(slug)
            assert row["status"] == QUEUED and row["last_error"].startswith("parse error: AttributeError")
    monkeypatch.setattr(stories, "parse_story_page", real)  # "the parser is fixed"
    hits_before = list(site.hits)
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        stories.collect_stories(ctx)
        assert all(ctx.state.get_story(slug)["status"] == DONE for slug in bad)
    new_hits = site.hits[len(hits_before):]
    assert not [slug for slug in bad if f"/s/{slug}" in new_hits]  # page 1 read from the saved copy, not downloaded


def test_many_unreadable_pages_in_a_row_stop_the_session(server, make_settings, factory, monkeypatch):
    site, base = server
    s = make_settings(base)

    def broken(html, url):
        raise AttributeError("format changed")

    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        _queue(ctx)
        assert len(ctx.state.next_open_stories(100)) > stories.PARSE_ERRORS_IN_A_ROW_LIMIT
        monkeypatch.setattr(stories, "parse_story_page", broken)
        stories.collect_stories(ctx)
        pytest.fail("should have stopped")
    st = State(DataPaths(s.data_dir).state_db)
    try:
        assert st.runs()[-1]["stop_reason"] == "parser" and st.get_cooldown() is None
        errors = [r for r in st.stories() if (r["last_error"] or "").startswith("parse error")]
        assert len(errors) == stories.PARSE_ERRORS_IN_A_ROW_LIMIT
    finally:
        st.close()


def test_an_unexpected_error_is_recorded_as_a_crash(server, make_settings, factory):
    site, base = server
    s = make_settings(base)
    with pytest.raises(RuntimeError):
        with collector_session(s, "test", fetcher_factory=factory):
            raise RuntimeError("bug")
    st = State(DataPaths(s.data_dir).state_db)
    try:
        assert st.runs()[-1]["stop_reason"] == "crashed"
    finally:
        st.close()


def test_build_raw_flags_a_page_the_parser_cannot_read(tmp_path, monkeypatch):
    cache = PageCache(tmp_path)
    key, _, _ = cache.put("https://www.literotica.com/s/x", b"<html><h1>T</h1></html>")

    def broken(html, url):
        raise AttributeError("odd page")

    monkeypatch.setattr(raw_corpus, "parse_story_page", broken)
    task = {"slug": "x", "pages": [{"path": str(cache.path_for(key)), "page_no": 1,
                                    "url": "https://www.literotica.com/s/x", "headers_json": None, "fetched_at": 0.0}]}
    out = raw_corpus._parse_story_task(task)
    assert out["warnings"] == ["page1:parse_error:AttributeError"] and out["paragraphs"] == []


def test_site_wide_json_ld_genre_is_not_taken_as_the_category():
    ld = {"@context": "https://schema.org", "@type": "Article", "headline": "T", "genre": "Erotica",
          "articleSection": "Erotica"}
    html = (f'<html><head><script type="application/ld+json">{json.dumps(ld)}</script></head><body>'
            '<nav class="_breadcrumbs_list_b1k1"><a href="/">Home</a><a href="/c/adult-romance">Romance</a></nav>'
            '<div itemprop="articleBody"><p>Some text.</p></div></body></html>')
    sp = parse_story_page(html, "https://www.literotica.com/s/x")
    assert sp.fields["category_name"] == "Romance" and sp.fields["category_slug"] == "adult-romance"


def test_processed_category_names_come_from_the_site_category_list():
    import pandas as pd

    from litcorr.analyze import build_processed
    from litcorr.settings import load_settings

    raw = pd.DataFrame([{"story_key": "k1", "category_slug": "adult-romance", "category_name": "Erotica"},
                        {"story_key": "k2", "category_slug": "not-in-list", "category_name": "Odd"}])
    cats = pd.DataFrame([{"slug": "adult-romance", "name": "Romance"}])
    df = build_processed(raw, cats, load_settings(None))
    assert list(df["category_name"]) == ["Romance", "Odd"]
