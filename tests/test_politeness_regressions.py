"""Regression tests for the politeness review: each test reproduces a scenario that used to
let the collector keep going (or go faster) when it should have stopped or slowed down."""

from __future__ import annotations

import pytest

from litcorr.collect.discover import collect_listings, discover_categories
from litcorr.collect.sample import build_queue
from litcorr.collect.session import AlreadyRunning, collector_session
from litcorr.collect.stories import collect_stories
from litcorr.demo import CHALLENGE
from litcorr.net.fetcher import GONE_STREAK_LIMIT, CooldownActive
from litcorr.paths import DataPaths
from litcorr.state import GONE, QUEUED, State


def _ok_slugs(site, n):
    return [s.slug for s in site.stories if s.status == "ok" and s.slug != "secret-story"][:n]


def _state(settings) -> State:
    return State(DataPaths(settings.data_dir).state_db)


def _collect(settings, factory):
    with collector_session(settings, "test", fetcher_factory=factory) as ctx:
        collect_listings(ctx, discover_categories(ctx))
        build_queue(ctx)
        collect_stories(ctx)


# 1. robots.txt answered with an HTML page must not mean "everything allowed"
def test_robots_served_as_html_stops(server, make_settings, factory):
    site, base = server
    site.faults["/robots.txt"] = [{"status": 200, "body": "<!DOCTYPE html><html><body>" + "x" * 3000 + "</body></html>"}]
    with collector_session(make_settings(base), "test", fetcher_factory=factory) as ctx:
        ctx.fetcher.fetch(f"{base}/s/secret-story", "story")
        pytest.fail("should have stopped")
    assert site.hits == ["/robots.txt"]


# 2. robots.txt redirects are followed (RFC 9309); odd statuses stop instead of closing all work
def test_robots_redirect_followed_and_odd_status_stops(server, make_settings, factory):
    from litcorr.demo import ROBOTS

    site, base = server
    site.faults["/robots.txt"] = [{"status": 301, "headers": {"Location": "/robots-new.txt"}}]
    site.faults["/robots-new.txt"] = [{"status": 200, "body": ROBOTS, "ctype": "text/plain"}]
    with collector_session(make_settings(base), "test", fetcher_factory=factory) as ctx:
        assert ctx.fetcher.fetch(f"{base}/s/secret-story", "story").outcome == "robots_disallowed"
    assert site.hits == ["/robots.txt", "/robots-new.txt"]


def test_robots_unexpected_status_stops_without_marking_stories(server, make_settings, factory, tmp_path):
    site, base = server
    site.faults["/robots.txt"] = [{"status": 400, "body": "bad request"}]
    s = make_settings(base)
    _collect(s, factory)
    st = _state(s)
    assert st.story_status_counts() == {}  # nothing was marked disallowed or failed
    assert site.hits == ["/robots.txt"]
    st.close()


# 3. redirects to login / off-site pages are blocks; long runs of missing pages are a soft block
def test_redirect_to_login_or_offsite_is_a_block(server, make_settings, factory):
    site, base = server
    a, b = _ok_slugs(site, 2)
    site.faults[f"/s/{a}"] = [{"status": 302, "headers": {"Location": "/login?next=/s/x"}}]
    s = make_settings(base, cooldown_after_block_hours=24)
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        ctx.fetcher.fetch(f"{base}/s/{a}", "story")
        pytest.fail("should have stopped")
    st = _state(s)
    assert st.get_cooldown() is not None and st.get_page(f"{base}/s/{a}")["status"] == "blocked"
    st.close()
    s2 = make_settings(base)  # fresh run (no cooldown): off-site redirect
    s2.storage.data_dir = s.storage.data_dir + "_2"
    site.faults[f"/s/{b}"] = [{"status": 302, "headers": {"Location": "https://challenge.example.net/check"}}]
    with collector_session(s2, "test", fetcher_factory=factory) as ctx:
        ctx.fetcher.fetch(f"{base}/s/{b}", "story")
        pytest.fail("should have stopped")


def test_run_of_missing_pages_stops_and_is_undone(server, make_settings, factory):
    site, base = server
    for x in site.stories:
        site.faults[f"/s/{x.slug}"] = [404]
    s = make_settings(base, cooldown_after_block_hours=24)
    _collect(s, factory)
    st = _state(s)
    counts = st.story_status_counts()
    story_hits = [h for h in site.hits if h.startswith("/s/")]
    assert len(story_hits) == GONE_STREAK_LIMIT
    assert counts.get(GONE, 0) == 0 and counts.get(QUEUED, 0) > 0  # undone: retried after the cooldown
    assert st.get_cooldown() is not None
    st.close()


# 4. a 200 page without recognisable content is not cached as a story
def test_interstitial_200_page_is_not_cached(server, make_settings, factory):
    site, base = server
    slugs = _ok_slugs(site, 6)
    junk = {"status": 200, "body": "<html><head><title>Please wait</title></head><body>" + "<p>maintenance</p>" * 100
                                    + "</body></html>"}
    for sl in slugs:
        site.faults[f"/s/{sl}"] = [dict(junk)]
    s = make_settings(base, stop_after_error_streak=5)
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        for sl in slugs:
            r = ctx.fetcher.fetch(f"{base}/s/{sl}", "story")
            assert not r.ok and r.detail == "no_content" and r.body  # body kept for diagnostics only
        pytest.fail("should have stopped after 5 consecutive bad pages")
    st = _state(s)
    assert all(st.get_page(f"{base}/s/{sl}")["cache_key"] is None for sl in slugs[:5])
    st.close()


# 5. challenge pages served with 503 (or a cf-mitigated header), and HTTP 451, are blocks
def test_challenge_with_503_and_451_are_blocks(server, make_settings, factory):
    site, base = server
    a, b = _ok_slugs(site, 2)
    site.faults[f"/s/{a}"] = [{"status": 503, "body": CHALLENGE, "headers": {"cf-mitigated": "challenge"}}] * 4
    s = make_settings(base, cooldown_after_block_hours=24)
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        ctx.fetcher.fetch(f"{base}/s/{a}", "story")
        pytest.fail("should have stopped")
    assert site.hits.count(f"/s/{a}") == 1  # not retried as if it were a server hiccup
    s2 = make_settings(base)
    s2.storage.data_dir = s.storage.data_dir + "_2"
    site.faults[f"/s/{b}"] = [{"status": 451, "body": "unavailable for legal reasons"}]
    with collector_session(s2, "test", fetcher_factory=factory) as ctx:
        ctx.fetcher.fetch(f"{base}/s/{b}", "story")
        pytest.fail("should have stopped")


# 6. the 429 pause survives a restart, and the 429 limit counts across sessions
class _InterruptOnLongSleep:
    def __init__(self, clock):
        self.clock = clock

    def __call__(self, dt):
        if dt >= 5.0 and self.clock.now > 0:
            raise KeyboardInterrupt  # the user presses Ctrl-C during the long pause
        self.clock.sleep(dt)


def test_429_pause_is_recorded_before_waiting(server, make_settings, clock):
    import functools

    from litcorr.net.fetcher import PoliteFetcher

    site, base = server
    a = _ok_slugs(site, 1)[0]
    site.faults[f"/s/{a}"] = [429]
    s = make_settings(base, pause_after_429_seconds=1800.0, stop_after_429_count=2)
    interrupting = functools.partial(PoliteFetcher, clock=clock.time, sleep=_InterruptOnLongSleep(clock))
    with collector_session(s, "test", fetcher_factory=interrupting) as ctx:
        ctx.fetcher.fetch(f"{base}/s/{a}", "story")
    normal = functools.partial(PoliteFetcher, clock=clock.time, sleep=clock.sleep)
    with pytest.raises(CooldownActive):
        with collector_session(s, "test", fetcher_factory=normal):
            pass


def test_429_limit_counts_across_sessions(server, make_settings, factory, clock):
    site, base = server
    a, b = _ok_slugs(site, 2)
    site.faults[f"/s/{a}"] = [429]
    site.faults[f"/s/{b}"] = [429]
    s = make_settings(base, pause_after_429_seconds=300.0, stop_after_429_count=2, cooldown_after_429_hours=6)
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        assert ctx.fetcher.fetch(f"{base}/s/{a}", "story").ok  # one 429, paused, then fine
    clock.now += 400  # restart after the pause
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        ctx.fetcher.fetch(f"{base}/s/{b}", "story")
        pytest.fail("second 429 within 24 h should stop")
    with pytest.raises(CooldownActive):
        with collector_session(s, "test", fetcher_factory=factory):
            pass


# 7. a failing story is tried once per session (with its normal retries), not again and again
def test_failed_story_not_retried_within_session(server, make_settings, factory):
    site, base = server
    victim = next(x for x in site.stories if x.category[0] == "adult-romance" and x.status == "ok"
                  and x.slug != "secret-story")
    site.faults[f"/s/{victim.slug}"] = [500] * 50
    s = make_settings(base, max_retries=3, stop_after_error_streak=20)
    _collect(s, factory)
    assert site.hits.count(f"/s/{victim.slug}") == 4  # 1 try + 3 retries, once
    st = _state(s)
    assert st.get_story(victim.slug)["status"] == QUEUED  # left for a later session
    st.close()


# 8. lists without page numbers stop when the site repeats its last page
def test_unnumbered_listing_stops_when_pages_repeat(make_settings, factory):
    from litcorr.demo import make_site, start_server

    site = make_site(seed=5, n_per_category=25)  # 3 listing pages per category
    site.browse_letters = False  # the older layout: /c/<slug> is itself the paginated list
    site.hide_pagination = True
    site.repeat_last_page = True
    httpd, base = start_server(site)
    try:
        s = make_settings(base)
        s.scope.listing_strategy = "all"
        with collector_session(s, "test", fetcher_factory=factory) as ctx:
            collect_listings(ctx, discover_categories(ctx))
            layout = ctx.state.get_meta("listing_layout")
    finally:
        httpd.shutdown()
        httpd.server_close()
    assert '"paging": "sequential"' in layout
    listing_hits = [h for h in site.hits if h.startswith("/c/loving-wives")]
    # pages 1-3 are real, page 4 repeats page 3 -> stop (instead of continuing to page 10,000)
    assert listing_hits == ["/c/loving-wives", "/c/loving-wives?page=2", "/c/loving-wives?page=3",
                            "/c/loving-wives?page=4"]


# 9. a temporary failure does not drop a category for good
def test_category_retried_after_transient_failure(server, make_settings, factory):
    site, base = server
    site.faults["/c/loving-wives"] = [503] * 4  # first listing page fails for one session
    s = make_settings(base)
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        collect_listings(ctx, discover_categories(ctx))
    st = _state(s)
    assert st.get_category("loving-wives")["listing_status"] != "done"
    st.close()
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        collect_listings(ctx, discover_categories(ctx))
    st = _state(s)
    assert st.get_category("loving-wives")["listing_status"] == "done"
    st.close()


# 10. one collector per site per machine, whatever the data folder
def test_site_lock_spans_data_folders(server, make_settings, factory):
    site, base = server
    s1 = make_settings(base)
    s2 = make_settings(base)
    s2.storage.data_dir = s1.storage.data_dir + "_other"
    with collector_session(s1, "test", fetcher_factory=factory):
        with pytest.raises(AlreadyRunning):
            with collector_session(s2, "test", fetcher_factory=factory):
                pass


# 11. the config file cannot switch the safety behaviour off
@pytest.mark.parametrize("snippet", [
    "[politeness]\nrespect_crawl_delay = false\n",
    "[politeness]\ncooldown_after_block_hours = 0\n",
    "[politeness]\npause_after_429_seconds = 0\n",
    "[politeness]\nstop_after_403_count = 50\n",
    '[identity]\nrobots_token = "Googlebot"\n',
    '[identity]\nuser_agent = "Mozilla/5.0 (Windows NT 10.0) Chrome/120 LitCorrResearch"\n',
])
def test_config_cannot_disable_safety(tmp_path, snippet):
    from litcorr.settings import ConfigError, load_settings

    cfg = tmp_path / "c.toml"
    cfg.write_text(snippet)
    with pytest.raises(ConfigError):
        load_settings(cfg)
