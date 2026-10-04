"""Politeness guarantees, tested against the local mock site with a fake clock."""

from __future__ import annotations

import pytest

from litcorr.collect.session import AlreadyRunning, _Lock, collector_session
from litcorr.net.fetcher import (BudgetExhausted, CooldownActive, RateLimited, SiteBlocked, StopRequested)
from litcorr.net.robots import hard_denied, policy_from_response
from litcorr.paths import DataPaths


def _story_slug(site):
    return next(s.slug for s in site.stories if s.status == "ok" and s.slug != "secret-story")


def test_robots_disallowed_and_hard_denied_urls_are_never_requested(server, make_settings, factory):
    site, base = server
    s = make_settings(base)
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        r1 = ctx.fetcher.fetch(f"{base}/s/secret-story", "story")
        r2 = ctx.fetcher.fetch(f"{base}/api/3/stories/x", "story")
        r3 = ctx.fetcher.fetch(f"{base}/tags/romance", "listing")
    assert r1.outcome == "robots_disallowed"
    assert r2.outcome == "policy_denied" and r3.outcome == "policy_denied"
    assert site.hits == ["/robots.txt"]  # nothing else was requested


def test_ai_agent_groups_apply_only_to_those_agents():
    from litcorr.demo import ROBOTS

    pol = policy_from_response("x", 200, ROBOTS)
    assert pol.allowed("https://www.literotica.com/s/story", "LitCorrResearch")
    assert not pol.allowed("https://www.literotica.com/s/story", "ClaudeBot")
    assert not pol.allowed("https://www.literotica.com/s/secret-story", "LitCorrResearch")
    assert not pol.allowed("https://www.literotica.com/x?dialog=login", "LitCorrResearch")
    assert hard_denied("https://www.literotica.com/my/settings") and not hard_denied("https://www.literotica.com/s/comments-on-love")


def test_honest_user_agent_and_cache_means_one_download(server, make_settings, factory):
    site, base = server
    s = make_settings(base)
    url = f"{base}/s/{_story_slug(site)}"
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        a = ctx.fetcher.fetch(url, "story")
        b = ctx.fetcher.fetch(url, "story")
    assert a.ok and b.ok and b.from_cache and a.body == b.body
    assert site.hits.count(url[len(base):]) == 1
    assert all("LitCorrResearch" in ua and "Mozilla" not in ua and "Chrome" not in ua for ua in site.user_agents)


def test_pacing_and_jitter_between_requests(server, make_settings, factory, clock):
    site, base = server
    s = make_settings(base, base_delay_seconds=8.0, jitter_seconds=4.0)
    slugs = [x.slug for x in site.stories if x.status == "ok" and x.slug != "secret-story"][:4]
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        for slug in slugs:
            ctx.fetcher.fetch(f"{base}/s/{slug}", "story")
        ts = [r[0] for r in ctx.state.conn.execute("SELECT ts FROM requests ORDER BY id")]
    gaps = [b - a for a, b in zip(ts, ts[1:])]
    assert len(gaps) == len(slugs)  # robots.txt + 4 pages
    assert all(8.0 <= g <= 12.5 for g in gaps), gaps
    assert len({round(g, 3) for g in gaps}) > 1  # jitter actually varies


def test_retry_with_backoff_on_503(server, make_settings, factory, clock):
    site, base = server
    slug = _story_slug(site)
    site.faults[f"/s/{slug}"] = [503, 503]
    s = make_settings(base, backoff_base_seconds=60.0, backoff_max_seconds=1800.0, max_retries=3)
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        r = ctx.fetcher.fetch(f"{base}/s/{slug}", "story")
    assert r.ok
    assert site.hits.count(f"/s/{slug}") == 3
    assert sum(clock.sleeps) >= 0.8 * (60 + 120)  # exponential backoff waited


def test_404_is_not_retried(server, make_settings, factory):
    site, base = server
    with collector_session(make_settings(base), "test", fetcher_factory=factory) as ctx:
        r = ctx.fetcher.fetch(f"{base}/s/vanished-story", "story")
        r2 = ctx.fetcher.fetch(f"{base}/s/vanished-story", "story")
    assert r.outcome == "gone" and r2.outcome == "gone"
    assert site.hits.count("/s/vanished-story") == 1


def test_redirect_to_homepage_means_gone(server, make_settings, factory):
    site, base = server
    with collector_session(make_settings(base), "test", fetcher_factory=factory) as ctx:
        r = ctx.fetcher.fetch(f"{base}/s/removed-story", "story")
    assert r.outcome == "gone" and "/" not in site.hits[1:]  # the homepage itself was not fetched


def test_429_pauses_then_second_429_stops_and_sets_cooldown(server, make_settings, factory, clock):
    site, base = server
    slug = _story_slug(site)
    site.faults[f"/s/{slug}"] = [429, 429]
    s = make_settings(base, pause_after_429_seconds=1800.0, stop_after_429_count=2, cooldown_after_429_hours=6)
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        ctx.fetcher.fetch(f"{base}/s/{slug}", "story")
        pytest.fail("should have stopped")
    assert any(w >= 1799 for w in clock.sleeps) or sum(clock.sleeps) >= 1799  # long pause after first 429
    with pytest.raises(CooldownActive):
        with collector_session(s, "test", fetcher_factory=factory):
            pass


def test_403_stops_immediately(server, make_settings, factory):
    site, base = server
    slug = _story_slug(site)
    site.faults[f"/s/{slug}"] = [403]
    s = make_settings(base, cooldown_after_block_hours=24)
    stopped = {}
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        try:
            ctx.fetcher.fetch(f"{base}/s/{slug}", "story")
        except SiteBlocked as e:
            stopped["e"] = e
            raise
    assert "e" in stopped and site.hits.count(f"/s/{slug}") == 1


def test_challenge_page_stops_and_is_not_cached(server, make_settings, factory):
    site, base = server
    slug = _story_slug(site)
    site.faults[f"/s/{slug}"] = ["challenge"]
    s = make_settings(base, cooldown_after_block_hours=24)
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        ctx.fetcher.fetch(f"{base}/s/{slug}", "story")
    from litcorr.state import State

    st = State(DataPaths(s.data_dir).state_db)
    page = st.get_page(f"{base}/s/{slug}")
    assert page["status"] == "blocked" and page["cache_key"] is None
    assert st.get_cooldown() is not None
    st.close()


def test_refused_connections_stop_the_session(server, make_settings, factory):
    site, base = server
    site.faults["/robots.txt"] = ["drop"]
    s = make_settings(base)
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        ctx.fetcher.fetch(f"{base}/s/{_story_slug(site)}", "story")
        pytest.fail("should have stopped")
    assert site.hits == ["/robots.txt"]


def test_session_cap(server, make_settings, factory):
    site, base = server
    s = make_settings(base, max_requests_per_session=3)
    slugs = [x.slug for x in site.stories if x.status == "ok" and x.slug != "secret-story"][:5]
    raised = []
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        try:
            for slug in slugs:
                ctx.fetcher.fetch(f"{base}/s/{slug}", "story")
        except BudgetExhausted as e:
            raised.append(e)
            raise
    assert raised and len(site.hits) == 3


def test_per_minute_cap_waits(server, make_settings, factory, clock):
    site, base = server
    s = make_settings(base, max_requests_per_minute=2)
    slugs = [x.slug for x in site.stories if x.status == "ok" and x.slug != "secret-story"][:3]
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        for slug in slugs:
            ctx.fetcher.fetch(f"{base}/s/{slug}", "story")
        ts = [r[0] for r in ctx.state.conn.execute("SELECT ts FROM requests ORDER BY id")]
    for i in range(2, len(ts)):
        assert ts[i] - ts[i - 2] >= 60  # never more than 2 in any 60 s window


def test_daily_cap_counts_previous_sessions(server, make_settings, factory):
    site, base = server
    s = make_settings(base, max_requests_per_day=2)
    slugs = [x.slug for x in site.stories if x.status == "ok" and x.slug != "secret-story"][:3]
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        ctx.fetcher.fetch(f"{base}/s/{slugs[0]}", "story")  # robots + 1 page = 2 requests
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        ctx.fetcher.fetch(f"{base}/s/{slugs[1]}", "story")
    assert len(site.hits) == 2


def test_stop_file(server, make_settings, factory):
    site, base = server
    s = make_settings(base)
    (s.config_path.parent / "STOP").write_text("")
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        ctx.fetcher.fetch(f"{base}/s/{_story_slug(site)}", "story")
        pytest.fail("should have stopped")
    assert site.hits == []


def test_only_one_collector_at_a_time(tmp_path):
    a, b = _Lock(tmp_path / "l"), _Lock(tmp_path / "l")
    a.acquire()
    with pytest.raises(AlreadyRunning):
        b.acquire()
    a.release()
    b.acquire()
    b.release()


def test_config_safety_floors(tmp_path):
    from litcorr.settings import ConfigError, load_settings

    cfg = tmp_path / "c.toml"
    cfg.write_text("[politeness]\nbase_delay_seconds = 0.5\n")
    with pytest.raises(ConfigError):
        load_settings(cfg)
    cfg.write_text('[scope]\nbase_url = "https://example.com"\n')
    with pytest.raises(ConfigError):
        load_settings(cfg)
    cfg.write_text("[politeness]\nmax_requests_per_minute = 60\n")
    with pytest.raises(ConfigError):
        load_settings(cfg)
    cfg.write_text("[politeness]\nbase_delay_secs = 9\n")  # typo is an error, not silently ignored
    with pytest.raises(ConfigError):
        load_settings(cfg)
