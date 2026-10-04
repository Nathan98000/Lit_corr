"""The sampling frame on Literotica's current layout: browse-by-title letter pages, not the
category landing page's "hot"/"new" showcase."""

from __future__ import annotations

import json

from litcorr.collect.discover import MIN_CLUSTERS, collect_listings, discover_categories
from litcorr.collect.sample import build_queue
from litcorr.collect.session import collector_session
from litcorr.demo import landing_page, letter_page, make_site, start_server
from litcorr.paths import DataPaths
from litcorr.site.parse_listing import parse_listing_page
from litcorr.state import State

BASE = "https://www.literotica.com"


def test_landing_page_browse_links_and_letter_pages_parse():
    site = make_site(seed=2, n_per_category=60)
    lp = parse_listing_page(landing_page(site, "loving-wives"), f"{BASE}/c/loving-wives", BASE)
    assert len(lp.browse_segments) >= 10 and all(len(s) == 1 for s in lp.browse_segments)
    big = max(lp.browse_segments, key=lambda c: sum(1 for s in site.in_category("loving-wives")
                                                    if s.title[:1].upper() == c))
    lp2 = parse_listing_page(letter_page(site, "loving-wives", big, 1), f"{BASE}/c/loving-wives/{big}", BASE)
    n_big = sum(1 for s in site.in_category("loving-wives") if s.title[:1].upper() == big)
    assert lp2.strategy == "cards" and len(lp2.stubs) == min(n_big, site.letter_per_page)
    nav = lp2.letter_nav  # the page bar of the whole A-Z sequence, like the real site's
    assert nav["first"] == ("*", 1) and nav["active_number"] and nav["max_number"] >= nav["active_number"]
    if n_big > site.letter_per_page:
        assert nav["next"] == (big, 2)


def _run(settings, factory):
    with collector_session(settings, "test", fetcher_factory=factory) as ctx:
        collect_listings(ctx, discover_categories(ctx))
        build_queue(ctx)


def test_showcase_is_not_the_frame_and_pages_spread_over_letters(make_settings, factory):
    site = make_site(seed=4, n_per_category=500, only=("loving-wives",))  # ~19 stories per letter: 2+ pages
    httpd, base = start_server(site)
    try:
        s = make_settings(base)
        s.scope.categories = ["loving-wives"]
        s.scope.listing_strategy = "spread"
        s.scope.max_stories_per_category = 30
        s.scope.listing_oversample = 1.0
        _run(s, factory)
    finally:
        httpd.shutdown()
        httpd.server_close()
    st = State(DataPaths(s.data_dir).state_db)
    try:
        layout = json.loads(st.get_meta("listing_layout"))
        assert layout["frame"] == "letters" and layout["page"] == "{base}/c/{slug}/{letter}-{n}"
        cat = st.get_category("loving-wives")
        plan = json.loads(cat["listing_plan_json"])
        letters_info = json.loads(st.get_meta("letters:loving-wives"))
        n_pages = sum(x["pages"] for x in letters_info)
        assert len(plan) == min(n_pages, MIN_CLUSTERS)  # at least MIN_CLUSTERS pages when the category has them
        assert len({u.split("/c/loving-wives/")[1].split("?")[0] for u in plan}) >= 10  # spread over many letters
        assert all("/c/loving-wives/" in u for u in plan)  # never the landing page
        assert cat["total_stories_reported"] == len(site.in_category("loving-wives"))
        queued = {r["story_slug"] for r in st.stories() if r["category_slug"] == "loving-wives"}
        planned_stubs = {r["story_slug"] for r in st.listing_items("loving-wives") if r["listing_url"] in set(plan)}
        assert queued and queued <= planned_stubs
        # The landing page's hot/new showcase is read only for its browse links; its stories never enter the frame.
        assert not [r for r in st.listing_items("loving-wives") if r["listing_url"].endswith("/c/loving-wives")]
    finally:
        st.close()


def test_probe_reports_frame_without_titles(make_settings, factory, server):
    from litcorr.collect.probe import run_probe

    site, base = server
    s = make_settings(base)
    with collector_session(s, "probe", fetcher_factory=factory) as ctx:
        report = run_probe(ctx)
    text = report.read_text(encoding="utf-8")
    assert "Layout used by `collect`" in text and '"frame": "letters"' in text
    assert "Missing important fields:** none" in text
    titles = {x.title for x in site.stories}
    assert not any(t in text for t in titles), "the probe report must not contain story titles"
    skeleton = (report.parent / "probe_skeleton_letter.html").read_text(encoding="utf-8")
    assert not any(t in skeleton for t in titles) and "_card_" in skeleton
