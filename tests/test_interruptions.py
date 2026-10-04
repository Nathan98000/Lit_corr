"""Starting and stopping at any time: no internet, a closed Terminal window, a power cut that leaves
a damaged saved page, and Ctrl-C in the middle of saving must never corrupt anything or be mistaken
for the site blocking the collector."""

from __future__ import annotations

import os
import signal
import socket
import time

import pytest
import requests
from urllib3.exceptions import MaxRetryError, NameResolutionError

from litcorr.build.raw_corpus import _parse_story_task
from litcorr.collect.session import collector_session
from litcorr.net.cache import PageCache
from litcorr.paths import DataPaths
from litcorr.state import State


def _story_slugs(site, n):
    return [s.slug for s in site.stories if s.status == "ok" and s.slug != "secret-story"][:n]


class _NoInternet:
    """Stands in for the HTTP session when this computer is offline: every lookup of the host fails."""

    def __init__(self):
        self.calls = 0

    def get(self, url, **kwargs):
        self.calls += 1
        gai = socket.gaierror(8, "nodename nor servname provided, or not known")
        nre = NameResolutionError("www.literotica.com", None, gai)
        nre.__cause__ = gai
        raise requests.ConnectionError(MaxRetryError(None, url, reason=nre))

    def close(self):
        pass


def _state(s):
    return State(DataPaths(s.data_dir).state_db)


def test_starting_without_internet_stops_at_once_without_a_cooldown(server, make_settings, factory):
    site, base = server
    s = make_settings(base)
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        ctx.fetcher.ensure_robots()  # an earlier run read robots.txt (still fresh)
    slug = _story_slugs(site, 1)[0]
    offline = _NoInternet()
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        ctx.fetcher.http = offline
        ctx.fetcher.fetch(f"{base}/s/{slug}", "story")
        pytest.fail("should have stopped")
    st = _state(s)
    try:
        assert st.runs()[-1]["stop_reason"] == "offline"
        assert st.get_cooldown() is None  # not mistaken for the site refusing connections
        assert offline.calls == 1  # no retries when nothing has worked yet
        assert (st.get_page(f"{base}/s/{slug}")["attempts"] or 0) == 0  # not counted against the page
    finally:
        st.close()


def test_losing_internet_mid_session_retries_then_stops_without_a_cooldown(server, make_settings, factory):
    site, base = server
    s = make_settings(base)
    first, second, third = _story_slugs(site, 3)
    offline = _NoInternet()
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        assert ctx.fetcher.fetch(f"{base}/s/{first}", "story").ok
        ctx.fetcher.http = offline  # e.g. the Mac went to sleep and Wi-Fi has not come back
        res = ctx.fetcher.fetch(f"{base}/s/{second}", "story")
        assert res.outcome == "failed" and offline.calls == 1 + s.politeness.max_retries  # retried with backoff
        ctx.fetcher.fetch(f"{base}/s/{third}", "story")
        pytest.fail("should have stopped")
    st = _state(s)
    try:
        assert st.runs()[-1]["stop_reason"] == "offline" and st.get_cooldown() is None
    finally:
        st.close()


def test_refused_connections_still_count_as_a_block(server, make_settings, factory):
    site, base = server
    s = make_settings(base, cooldown_after_block_hours=24)
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        ctx.fetcher.ensure_robots()
    first, second = _story_slugs(site, 2)
    site.faults[f"/s/{first}"] = ["drop"] * 5
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        ctx.fetcher.fetch(f"{base}/s/{first}", "story")
        pytest.fail("should have stopped")
    st = _state(s)
    try:
        assert st.runs()[-1]["stop_reason"] == "blocked" and st.get_cooldown() is not None
    finally:
        st.close()


def test_kill_or_closing_the_window_stops_cleanly(server, make_settings, factory):
    site, base = server
    s = make_settings(base)

    def _not_installed(signum, frame):
        raise AssertionError("the collector did not handle this signal")

    for sig in (signal.SIGTERM, signal.SIGHUP):
        old = signal.signal(sig, _not_installed)  # never let a missing handler kill the test run
        try:
            with collector_session(s, "test", fetcher_factory=factory):
                os.kill(os.getpid(), sig)
                time.sleep(1)
                pytest.fail("the signal should have stopped the session")
            assert signal.getsignal(sig) is _not_installed  # previous handler restored
        finally:
            signal.signal(sig, old)
    st = _state(s)
    try:
        assert [r["stop_reason"] for r in st.runs()][-2:] == ["interrupted", "interrupted"]
    finally:
        st.close()


def test_a_damaged_saved_page_is_downloaded_again(server, make_settings, factory):
    site, base = server
    s = make_settings(base)
    slug = _story_slugs(site, 1)[0]
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        good = ctx.fetcher.fetch(f"{base}/s/{slug}", "story")
        path = ctx.cache.path_for(ctx.state.get_page(f"{base}/s/{slug}")["cache_key"])
        path.write_bytes(path.read_bytes()[:20])  # cut short, as a power failure might leave it
        assert ctx.cache.get(ctx.state.get_page(f"{base}/s/{slug}")["cache_key"]) is None
        hits = len(site.hits)
        again = ctx.fetcher.fetch(f"{base}/s/{slug}", "story")
    assert again.ok and not again.from_cache and again.body == good.body
    assert len(site.hits) == hits + 1


def test_build_raw_skips_a_damaged_saved_page(tmp_path):
    cache = PageCache(tmp_path)
    key, _, _ = cache.put("https://www.literotica.com/s/x", b"<html><h1>T</h1></html>")
    path = cache.path_for(key)
    path.write_bytes(path.read_bytes()[:10])
    task = {"slug": "x", "pages": [{"path": str(path), "page_no": 1, "url": "https://www.literotica.com/s/x",
                                    "headers_json": None, "fetched_at": 0.0}]}
    out = _parse_story_task(task)
    assert out["warnings"] == ["page1:unreadable_in_cache"] and out["paragraphs"] == []


def test_ctrl_c_while_saving_listing_items_leaves_nothing_half_written(tmp_path):
    st = State(tmp_path / "state.sqlite3")

    def rows():
        yield {"story_slug": "a", "category_slug": "c", "listing_url": "u", "page_no": 1, "position": 1,
               "strategy": "cards"}
        raise KeyboardInterrupt

    try:
        with pytest.raises(KeyboardInterrupt):
            st.add_listing_items(rows())
        assert not st.conn.in_transaction and st.listing_items() == []
    finally:
        st.close()
