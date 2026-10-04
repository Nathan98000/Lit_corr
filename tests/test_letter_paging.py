"""Letter pages as the real site serves them: a long visible list, a small unrelated embedded list,
?page=N redirected back to page 1, and later pages either only at /<n>-page or not at all."""

from __future__ import annotations

import json

import pytest

import litcorr.collect.discover as discover
from litcorr.collect.discover import collect_listings, discover_categories
from litcorr.collect.sample import build_queue
from litcorr.collect.session import collector_session
from litcorr.demo import _initial, make_site, start_server
from litcorr.paths import DataPaths
from litcorr.state import State

CAT = "loving-wives"


@pytest.fixture
def small_full_pages(monkeypatch):
    monkeypatch.setattr(discover, "FULL_LOOKING_PAGE", 8)  # mock pages hold 10 stories


def _run(site, make_settings, factory):
    httpd, base = start_server(site)
    try:
        s = make_settings(base)
        s.scope.categories = [CAT]
        s.scope.listing_strategy = "spread"
        s.scope.max_stories_per_category = 40
        s.scope.listing_oversample = 1.0
        with collector_session(s, "test", fetcher_factory=factory) as ctx:
            collect_listings(ctx, discover_categories(ctx))
            build_queue(ctx)
    finally:
        httpd.shutdown()
        httpd.server_close()
    return s


def test_hidden_pages_found_and_counted(small_full_pages, make_settings, factory):
    site = make_site(seed=9, n_per_category=600, only=(CAT,))
    site.letter_paging = "hidden"
    s = _run(site, make_settings, factory)
    st = State(DataPaths(s.data_dir).state_db)
    try:
        layout = json.loads(st.get_meta("listing_layout"))
        assert layout["page"] == "{base}/c/{slug}/{letter}/{n}-page"
        info = {x["letter"]: x["pages"] for x in json.loads(st.get_meta(f"letters:{CAT}"))}
        for letter, pages in info.items():
            true_n = sum(1 for x in site.in_category(CAT) if _initial(x.title) == letter)
            assert pages == -(-true_n // 10), (letter, pages, true_n)  # exact page count found by bisection
        cat = st.get_category(CAT)
        assert cat["total_stories_reported"] == len(site.in_category(CAT))  # the site's own count
        plan = json.loads(cat["listing_plan_json"])
        assert any(u.endswith("-page") for u in plan)  # later pages are part of the frame
        items = st.listing_items(CAT)
        assert {r["strategy"] for r in items} == {"cards"}  # the visible list, not the 5-item embedded decoy
        queued = {r["story_slug"] for r in st.stories()}
        assert queued <= {r["story_slug"] for r in items if r["listing_url"] in set(plan)}
    finally:
        st.close()


def test_no_later_pages_uses_first_pages_with_warning(small_full_pages, make_settings, factory):
    site = make_site(seed=9, n_per_category=600, only=(CAT,))
    site.letter_paging = "none"
    s = _run(site, make_settings, factory)
    st = State(DataPaths(s.data_dir).state_db)
    try:
        layout = json.loads(st.get_meta("listing_layout"))
        assert layout["page"] is None
        cat = st.get_category(CAT)
        assert cat["listing_status"] == "done"
        plan = json.loads(cat["listing_plan_json"])
        assert plan and not any("-page" in u or "page=" in u for u in plan)
        assert st.story_status_counts().get("queued", 0) > 0
    finally:
        st.close()


def test_real_dash_paging_counts_pages_from_the_page_bar(make_settings, factory):
    """Literotica's scheme: /c/<slug>/S-2, with a bar of the whole A-Z sequence. Page counts come from each
    letter's 'previous' link and the 'last' link: no extra requests, no guessing."""
    site = make_site(seed=9, n_per_category=600, only=(CAT,))
    site.letter_paging = "dash"
    s = _run(site, make_settings, factory)
    st = State(DataPaths(s.data_dir).state_db)
    try:
        layout = json.loads(st.get_meta("listing_layout"))
        assert layout["page"] == "{base}/c/{slug}/{letter}-{n}"
        info = {x["letter"]: x["pages"] for x in json.loads(st.get_meta(f"letters:{CAT}"))}
        for letter, pages in info.items():
            true_n = sum(1 for x in site.in_category(CAT) if _initial(x.title) == letter)
            assert pages == -(-true_n // 10), (letter, pages, true_n)
        assert sum(info.values()) == len([1 for _ in __import__("litcorr.demo").demo._letter_sequence(site, CAT)])
        listing_hits = [h for h in site.hits if h.startswith(f"/c/{CAT}")]
        assert not any("-page" in h or "page=" in h for h in listing_hits)  # no searching or guessing
        plan = json.loads(st.get_category(CAT)["listing_plan_json"])
        later = [u for u in plan if u.rsplit("/", 1)[1].count("-") == 1 and u.rsplit("-", 1)[1].isdigit()]
        assert later  # pages like .../S-2 are part of the frame
        # requests: landing + page 1 of every letter + the planned later pages (nothing else)
        assert len(listing_hits) == 1 + len(info) + len(later)
    finally:
        st.close()
