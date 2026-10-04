"""robots.txt handling plus a hard-coded safety denylist.

The collector checks every URL against the live robots.txt (parsed with
Protego, which supports the ``*`` and ``$`` wildcards Literotica uses). On top
of that, a few path families are *never* requested even if robots.txt were to
allow them: the JSON API, account/login areas, tag pages, interactive
endpoints (voting, favourites, comments), and dialog URLs.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from urllib.parse import urlsplit

from protego import Protego

from ..settings import ALLOWED_HOSTS

# Paths we never request regardless of robots.txt (defence in depth).
HARD_DENY = [
    re.compile(p, re.I)
    for p in (
        r"^/api(/|$)",
        r"^/my(/|$)",
        r"^/authenticate",
        r"^/beta(/|$)",
        r"^/tags(/|$)",
        r"^/stories/[^?]*\.php",  # legacy interactive endpoints (vote, favourites, comments...)
        r"^/(login|logout|signup|register)",
        r"[?&]dialog=",
        r"^/(vote|comment|comments|favorite|favorites|follow)(/|$|\?)",
    )
]


def hard_denied(url: str) -> bool:
    parts = urlsplit(url)
    target = parts.path + (("?" + parts.query) if parts.query else "")
    return any(p.search(target) for p in HARD_DENY)


def host_allowed(url: str, allowed_hosts: frozenset[str] = ALLOWED_HOSTS) -> bool:
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    if parts.port:
        host = f"{host}:{parts.port}"
    return host in allowed_hosts


@dataclass
class RobotsPolicy:
    host: str
    fetched_at: float
    status: int | None  # HTTP status of robots.txt (None = could not fetch)
    text: str
    mode: str  # "rules" | "allow_all" | "deny_all"

    def __post_init__(self) -> None:
        self._parser = Protego.parse(self.text) if self.mode == "rules" else None

    def allowed(self, url: str, token: str) -> bool:
        if self.mode == "allow_all":
            return True
        if self.mode == "deny_all":
            return False
        return bool(self._parser.can_fetch(url, token))

    def crawl_delay(self, token: str) -> float | None:
        if self._parser is None:
            return None
        d = self._parser.crawl_delay(token)
        return float(d) if d is not None else None

    def is_stale(self, max_age_seconds: float = 86400) -> bool:
        return time.time() - self.fetched_at > max_age_seconds

    def summary(self, token: str) -> dict[str, object]:
        disallow = [l.split(":", 1)[1].strip() for l in self.text.splitlines()
                    if l.lower().startswith("disallow:")]
        return {
            "host": self.host,
            "status": self.status,
            "mode": self.mode,
            "crawl_delay": self.crawl_delay(token),
            "disallow_lines_total": len(disallow),
            "user_agents_named": sorted({l.split(":", 1)[1].strip() for l in self.text.splitlines()
                                         if l.lower().startswith("user-agent:")}),
        }


def policy_from_response(host: str, status: int | None, text: str) -> RobotsPolicy:
    """Map a robots.txt response to a policy, conservatively.

    200 -> obey the rules; 404/410 -> no robots file, allowed; anything else
    (401/403, 5xx, network failure) -> treat the whole site as disallowed.
    """
    if status == 200:
        mode = "rules"
    elif status in (404, 410):
        mode = "allow_all"
    else:
        mode = "deny_all"
    return RobotsPolicy(host=host, fetched_at=time.time(), status=status, text=text or "", mode=mode)
