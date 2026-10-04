from __future__ import annotations

import functools
import time
from pathlib import Path

import pytest

from litcorr.demo import demo_settings, make_site, start_server
from litcorr.net.fetcher import PoliteFetcher


class FakeClock:
    """Deterministic clock: sleep() advances time instantly and records each wait."""

    def __init__(self, start: float | None = None):
        self.now = start if start is not None else time.time()
        self.sleeps: list[float] = []

    def time(self) -> float:
        return self.now

    def sleep(self, dt: float) -> None:
        self.sleeps.append(dt)
        self.now += max(0.0, dt)


@pytest.fixture(autouse=True)
def _lock_dir(tmp_path, monkeypatch):
    """Keep the machine-wide collector lock inside the test's temp folder."""
    monkeypatch.setenv("LITCORR_LOCK_DIR", str(tmp_path / "locks"))


@pytest.fixture
def site():
    return make_site(seed=11, n_per_category=4)


@pytest.fixture
def server(site):
    httpd, base = start_server(site)
    yield site, base
    httpd.shutdown()
    httpd.server_close()


@pytest.fixture
def clock():
    return FakeClock()


@pytest.fixture
def make_settings(tmp_path: Path):
    def _make(base: str, **politeness):
        s = demo_settings(base, tmp_path / "data", n_per_category=4)
        s.config_path = tmp_path / "config.toml"  # STOP file lives next to it
        for k, v in politeness.items():
            setattr(s.politeness, k, v)
        return s

    return _make


@pytest.fixture
def factory(clock):
    return functools.partial(PoliteFetcher, clock=clock.time, sleep=clock.sleep)
