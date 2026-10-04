"""The polite fetcher: the only code in this project that touches the network.

For every URL it, in order:
  1. normalizes the URL and serves it from the local cache if already fetched;
  2. refuses hosts other than the configured one and the hard-coded denylist;
  3. checks robots.txt (fetched at most once per 24 hours) for our user agent;
  4. waits for the rolling per-minute / per-hour / per-day caps and the session
     cap (all counted from the persistent request log, so restarts don't reset them);
  5. waits ``base_delay`` (or robots Crawl-delay, if larger) plus random jitter
     since the previous request;
  6. sends ONE request (no parallelism anywhere), follows redirects manually so
     each hop is checked and paced, and classifies the answer.

Retries happen only for timeouts, dropped connections and HTTP 500/502/503/504,
with exponential backoff. A 429 slows everything down and pauses for a long
time (the pause is recorded first, so a restart also waits) or ends the
session. A 403/451, a challenge/CAPTCHA page (with any status), an age gate, a
redirect to a login/verification page or off-site, a server that refuses
connections, or a run of "missing" pages (a sign of a soft block) ends the
session and starts a cooldown. Pages without recognisable content are never
cached. Nothing here tries to get around any of those.

Failures on this computer's side (no internet, DNS lookup failed, a Wi-Fi login
page intercepting secure connections) never reach the site, so they are not
read as a block: the session stops without a cooldown (at once if nothing has
worked yet this session; otherwise after the usual retries and error streak).
"""

from __future__ import annotations

import email.utils
import errno
import json
import random
import re
import socket
import ssl
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urljoin, urlsplit

import requests

from ..log import JsonlLog, get_logger
from ..settings import Settings
from ..site.urls import is_homepage, normalize_url
from ..state import State
from .cache import PageCache
from .detect import classify
from .robots import RobotsPolicy, hard_denied, host_allowed, policy_from_response

log = get_logger("fetch")

TRANSIENT_STATUSES = frozenset({500, 502, 503, 504})
REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})
MAX_REDIRECTS = 5
GONE_STREAK_LIMIT = 8  # this many missing pages in a row looks like a soft block, not real deletions
_LOGIN_LIKE = re.compile(
    r"^/(login|log-in|signin|sign-in|signup|sign-up|register|authenticate|auth|account|my|age|verify|verification|"
    r"age-verification|age-gate|consent|captcha|challenge|blocked|denied)(/|$)", re.I)


class StopCollection(Exception):
    """Ends the current session cleanly. ``cooldown_hours`` > 0 blocks new sessions for a while."""

    reason = "stop"

    def __init__(self, message: str, cooldown_hours: float = 0.0):
        super().__init__(message)
        self.message = message
        self.cooldown_hours = cooldown_hours
        self.reverted_urls: list[str] = []


class BudgetExhausted(StopCollection):
    reason = "budget"


class SiteBlocked(StopCollection):
    reason = "blocked"


class RateLimited(StopCollection):
    reason = "rate_limited"


class RobotsUnavailable(StopCollection):
    reason = "robots_unavailable"


class StopRequested(StopCollection):
    reason = "stop_requested"


class CooldownActive(StopCollection):
    reason = "cooldown"


class TooManyErrors(StopCollection):
    reason = "errors"


class Offline(StopCollection):
    """This computer has no working connection; nothing reached the site, so no cooldown is needed."""

    reason = "offline"


LOCAL_NETWORK_ERROR = "no internet connection"
# Network down / no route from this computer. (EHOSTUNREACH is left out: a firewall in front of the site can cause it.)
_LOCAL_ERRNOS = frozenset({errno.ENETUNREACH, errno.ENETDOWN})


def _local_network_problem(exc: BaseException) -> bool:
    """True when a request failed on this computer's side: DNS lookup failed, network down, or a secure
    connection that could not be verified (a Wi-Fi login page or network filter in the way). None of these
    reach the site, so they say nothing about how the site treats the collector."""
    seen: set[int] = set()
    todo: list[Any] = [exc]
    while todo:
        e = todo.pop()
        if not isinstance(e, BaseException) or id(e) in seen:
            continue
        seen.add(id(e))
        if isinstance(e, (socket.gaierror, ssl.SSLCertVerificationError)) or type(e).__name__ == "NameResolutionError":
            return True
        if isinstance(e, OSError) and e.errno in _LOCAL_ERRNOS:
            return True
        todo += [e.__cause__, e.__context__, getattr(e, "reason", None), *getattr(e, "args", ())]
    return False


@dataclass
class FetchResult:
    url: str
    kind: str
    outcome: str  # ok | gone | robots_disallowed | policy_denied | failed
    status: int | None = None
    final_url: str | None = None
    body: str | None = None  # for "failed" results with an unexpected page, the body (diagnostics only; not cached)
    from_cache: bool = False
    fetched_at: float | None = None
    detail: str = ""

    @property
    def ok(self) -> bool:
        return self.outcome == "ok"


def _decode(body: bytes | None, content_type: str | None) -> str | None:
    if body is None:
        return None
    charset = "utf-8"
    if content_type and "charset=" in content_type.lower():
        charset = content_type.lower().split("charset=", 1)[1].split(";")[0].strip() or "utf-8"
    try:
        return body.decode(charset, errors="replace")
    except LookupError:
        return body.decode("utf-8", errors="replace")


def _offline_message(err: str) -> str:
    return (f"No working internet connection on this computer ({err[:200]}). Nothing reached the site, so no "
            "cooldown is needed: run the same command again when you are back online.")


def _retry_after_seconds(resp: requests.Response, now: float) -> float | None:
    value = resp.headers.get("Retry-After")
    if not value:
        return None
    value = value.strip()
    if value.isdigit():
        return float(value)
    try:
        dt = email.utils.parsedate_to_datetime(value)
        return max(0.0, dt.timestamp() - now)
    except (TypeError, ValueError):
        return None


def _fmt_time(ts: float) -> str:
    return time.strftime("%Y-%m-%d %H:%M", time.localtime(ts))


def _is_html(resp: requests.Response) -> bool:
    ctype = (resp.headers.get("Content-Type") or "").lower()
    head = resp.content[:300].lstrip().lower()
    return "html" in ctype or head.startswith((b"<!doctype", b"<html"))


class PoliteFetcher:
    def __init__(
        self,
        settings: Settings,
        state: State,
        cache: PageCache,
        session_id: str,
        *,
        http: requests.Session | None = None,
        clock: Callable[[], float] = time.time,
        sleep: Callable[[float], None] = time.sleep,
        rng: random.Random | None = None,
        stop_file: Path | None = None,
        log_dir: Path | None = None,
    ):
        self.settings = settings
        self.p = settings.politeness
        self.state = state
        self.cache = cache
        self.session_id = session_id
        self.clock = clock
        self._sleep_fn = sleep
        self.rng = rng or random.Random()
        self.stop_file = stop_file
        self.base_url = settings.scope.base_url.rstrip("/")
        base = urlsplit(self.base_url)
        host = (base.hostname or "").lower() + (f":{base.port}" if base.port else "")
        self.allowed_hosts = frozenset({host})
        self.token = settings.identity.robots_token
        self.http = http or requests.Session()
        self.http.headers.update(
            {
                "User-Agent": settings.identity.user_agent,
                "Accept": "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
                "Accept-Language": "en",
            }
        )
        self.request_log = JsonlLog(log_dir / "requests.jsonl" if log_dir else None)
        self.error_log = JsonlLog(log_dir / "errors.jsonl" if log_dir else None)
        self.session_requests = 0
        self.successes = 0
        self.error_streak = 0
        self.count_403 = 0
        self.slowdown = 1.0
        self.gone_streak: list[tuple[str, str]] = []
        self.robots: RobotsPolicy | None = None

    # ------------------------------------------------------------------ public
    def check_cooldown(self) -> None:
        cd = self.state.get_cooldown()
        if cd and cd[0] > self.clock():
            raise CooldownActive(
                f"A cooldown is active until {_fmt_time(cd[0])} because: {cd[1]}. "
                "Please wait; the collector will refuse to run before then."
            )

    def permitted(self, url: str) -> tuple[bool, str]:
        """(allowed?, reason) for a normalized URL. May fetch robots.txt."""
        if not host_allowed(url, self.allowed_hosts) or hard_denied(url):
            return False, "policy_denied"
        self.ensure_robots()
        assert self.robots is not None
        if not self.robots.allowed(url, self.token):
            return False, "robots_disallowed"
        return True, ""

    def fetch(self, url: str, kind: str, *, use_cache: bool = True) -> FetchResult:
        url = normalize_url(url, self.base_url)
        page = self.state.get_page(url)
        if use_cache and page and page["status"] == "ok" and self.cache.has(page["cache_key"]):
            res = self._from_cache(url, kind, page)
            if res.body is not None:
                return res
            log.warning("The saved copy of %s cannot be read (e.g. after a power cut); downloading it again.", url)
        if page and page["status"] == "gone":
            return FetchResult(url, kind, "gone", page["http_status"], page["final_url"], from_cache=True)
        if page and page["status"] in ("error", "blocked") and page["attempts"] >= self.p.max_attempts_per_url:
            return FetchResult(url, kind, "failed", page["http_status"], detail="max attempts per URL reached")
        allowed, why = self.permitted(url)
        if not allowed:
            self.state.upsert_page(url, kind, why)
            log.info("SKIP %s (%s)", url, why.replace("_", " "))
            return FetchResult(url, kind, why)
        return self._fetch_network(url, kind)

    def cached_body(self, url: str) -> str | None:
        """Body of an already-cached page, or None. Never touches the network."""
        page = self.state.get_page(normalize_url(url, self.base_url))
        if not page or page["status"] != "ok":
            return None
        return _decode(self.cache.get(page["cache_key"]), self._content_type(page))

    # ----------------------------------------------------------------- robots
    def ensure_robots(self) -> None:
        if self.robots is not None and not self.robots.is_stale():
            return
        robots_url = f"{self.base_url}/robots.txt"
        host = urlsplit(robots_url).netloc
        page = self.state.get_page(robots_url)
        if page and page["status"] == "ok" and page["fetched_at"] and self.clock() - page["fetched_at"] < 86400:
            body = self.cache.get(page["cache_key"])
            if body is not None:
                self.robots = policy_from_response(host, 200, _decode(body, None) or "")
                self.robots.fetched_at = page["fetched_at"]
                return
        url, resp = robots_url, None
        for hop in range(MAX_REDIRECTS + 1):  # RFC 9309: follow at least five redirects
            resp, err = self._send(url, "robots", 1)
            if err is not None:
                self.error_streak += 1
                if err.startswith(LOCAL_NETWORK_ERROR):
                    raise Offline(_offline_message(err))
                raise RobotsUnavailable(
                    f"Could not read robots.txt ({err}). The collector will not proceed without it. "
                    "If this keeps happening the site is probably refusing automated clients; "
                    "the collector will not try to get around that.",
                    1.0,
                )
            loc = resp.headers.get("Location")
            if resp.status_code in REDIRECT_STATUSES and loc and hop < MAX_REDIRECTS:
                target = normalize_url(urljoin(url, loc), self.base_url)
                if not host_allowed(target, self.allowed_hosts) or _LOGIN_LIKE.match(urlsplit(target).path):
                    raise SiteBlocked(f"robots.txt redirects to {target}; not following.",
                                      self.p.cooldown_after_block_hours)
                url = target
                continue
            break
        assert resp is not None
        status = resp.status_code
        if status == 200 and _is_html(resp):
            det = classify("story", status, resp.headers.get("Content-Type", ""), resp.content)
            if det.blocking:
                raise SiteBlocked(f"robots.txt request returned a {det.verdict} page ({det.detail}).",
                                  self.p.cooldown_after_block_hours)
            raise RobotsUnavailable("robots.txt returned a web page instead of robots rules; not proceeding.", 1.0)
        if status == 429:
            raise RateLimited("HTTP 429 while reading robots.txt.", self.p.cooldown_after_429_hours)
        if status in (401, 403, 451):
            raise SiteBlocked(f"HTTP {status} while reading robots.txt: automated access appears to be refused.",
                              self.p.cooldown_after_block_hours)
        if status not in (200, 404, 410):
            raise RobotsUnavailable(f"Unexpected HTTP {status} while reading robots.txt; not proceeding.", 1.0)
        text = resp.text if status == 200 else ""
        self.robots = policy_from_response(host, status, text)
        self.robots.fetched_at = self.clock()
        if status == 200:
            key, sha, n = self.cache.put(robots_url, resp.content)
            self.state.upsert_page(robots_url, "robots", "ok", http_status=200, final_url=url,
                                   cache_key=key, content_sha1=sha, bytes=n, fetched_at=self.clock())
            self.successes += 1
        log.info("robots.txt: HTTP %s, mode=%s, crawl-delay=%s", status, self.robots.mode,
                 self.robots.crawl_delay(self.token))

    # --------------------------------------------------------------- internals
    def _content_type(self, page: dict[str, Any]) -> str | None:
        try:
            return json.loads(page.get("headers_json") or "{}").get("Content-Type")
        except ValueError:
            return None

    def _from_cache(self, url: str, kind: str, page: dict[str, Any]) -> FetchResult:
        body = _decode(self.cache.get(page["cache_key"]), self._content_type(page))
        return FetchResult(url, kind, "ok", page["http_status"], page["final_url"], body, True, page["fetched_at"])

    def _check_stop_file(self) -> None:
        if self.stop_file is not None and self.stop_file.exists():
            raise StopRequested(f"Stop file found ({self.stop_file}); stopping cleanly. Delete it to continue later.")

    def _sleep(self, seconds: float, reason: str | None) -> None:
        if seconds <= 0:
            return
        if reason and seconds >= 30:
            log.info("Waiting %.0f s (%s); next request about %s", seconds, reason,
                     _fmt_time(self.clock() + seconds))
        end = self.clock() + seconds
        while True:
            self._check_stop_file()
            remaining = end - self.clock()
            if remaining <= 0:
                return
            self._sleep_fn(min(5.0, remaining))

    def _min_gap(self) -> float:
        gap = self.p.base_delay_seconds
        if self.robots is not None:
            cd = self.robots.crawl_delay(self.token)
            if cd:
                gap = max(gap, cd)  # a robots.txt Crawl-delay is always respected
        return gap

    def _recent_429s(self) -> int:
        return self.state.count_outcome_since(self.clock() - 86400, "http_429")

    def _wait_for_slot(self) -> None:
        p = self.p
        while True:
            self._check_stop_file()
            now = self.clock()
            if self.session_requests >= p.max_requests_per_session:
                raise BudgetExhausted(
                    f"Session cap reached ({p.max_requests_per_session} requests). "
                    "Run `collect` again later to continue where it stopped."
                )
            day = self.state.count_requests_since(now - 86400)
            if day >= p.max_requests_per_day:
                oldest = self.state.oldest_request_since(now - 86400) or now
                raise BudgetExhausted(
                    f"Daily cap reached ({day} requests in the last 24 hours). "
                    f"More requests are allowed after about {_fmt_time(oldest + 86400)}."
                )
            hour = self.state.count_requests_since(now - 3600)
            if hour >= p.max_requests_per_hour:
                oldest = self.state.oldest_request_since(now - 3600) or now
                self._sleep(oldest + 3600 - now + 1, "hourly cap reached")
                continue
            minute = self.state.count_requests_since(now - 60)
            if minute >= p.max_requests_per_minute:
                oldest = self.state.oldest_request_since(now - 60) or now
                self._sleep(oldest + 60 - now + 0.5, "per-minute cap reached")
                continue
            break
        # Any 429 in the last 24 hours (this session or an earlier one) keeps requests slower.
        self.slowdown = max(self.slowdown, min(8.0, 2.0 ** self._recent_429s()))
        last = self.state.last_request_ts()
        gap = self._min_gap() * self.slowdown + self.rng.uniform(0, p.jitter_seconds)
        if last is not None:
            self._sleep(last + gap - self.clock(), "pacing" if gap >= 30 else None)

    def _send(self, url: str, kind: str, attempt: int) -> tuple[requests.Response | None, str | None]:
        self._wait_for_slot()
        row_id = self.state.log_request_start(self.clock(), self.session_id, url, kind, attempt)
        self.session_requests += 1
        resp, err = None, None
        t0 = time.perf_counter()
        try:
            resp = self.http.get(
                url,
                timeout=(self.p.timeout_connect_seconds, self.p.timeout_read_seconds),
                allow_redirects=False,
            )
        except requests.Timeout:
            err = "timeout"
        except requests.ConnectionError as e:
            what = LOCAL_NETWORK_ERROR if _local_network_problem(e) else "connection error"
            err = f"{what}: {str(e)[:160]}"
        except requests.RequestException as e:
            err = f"request error: {str(e)[:160]}"
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        status = resp.status_code if resp is not None else None
        nbytes = len(resp.content) if resp is not None else 0
        outcome = "network_error" if err else f"http_{status}"
        self.state.log_request_end(row_id, self.clock(), status, outcome, nbytes, elapsed_ms, err)
        self.request_log.write(session=self.session_id, url=url, kind=kind, attempt=attempt, status=status,
                               outcome=outcome, bytes=nbytes, elapsed_ms=elapsed_ms, error=err)
        log.info("GET %s -> %s (%.0f KB, %.1f s) [#%d this session]", url, status if status else err,
                 nbytes / 1024, elapsed_ms / 1000, self.session_requests)
        return resp, err

    def _note_error(self, url: str, kind: str, message: str, *, network: bool = False) -> None:
        self.error_streak += 1
        self.error_log.write(session=self.session_id, url=url, kind=kind, error=message, streak=self.error_streak)
        log.warning("Problem with %s: %s (error streak %d)", url, message, self.error_streak)
        local = message.startswith(LOCAL_NETWORK_ERROR)
        if local and self.successes == 0:
            raise Offline(_offline_message(message))  # nothing has worked yet this session: no point retrying
        if network and not local and self.successes == 0 and self.error_streak >= 2:
            raise SiteBlocked(
                f"The server is refusing or dropping connections before any page was received ({message}). "
                "This usually means automated clients are being blocked. The collector will not try to get "
                "around that; see README 'If the site blocks the collector'.",
                self.p.cooldown_after_block_hours,
            )
        if self.error_streak >= self.p.stop_after_error_streak:
            if local:
                raise Offline(_offline_message(message))
            raise TooManyErrors(
                f"{self.error_streak} consecutive failed requests; stopping this session to be safe.",
                1.0,
            )

    def _note_gone(self, url: str, kind: str) -> None:
        """Count missing pages in a row; a long run of them suggests a soft block, so stop and undo."""
        self.gone_streak.append((url, kind))
        if len(self.gone_streak) >= GONE_STREAK_LIMIT:
            urls = [u for u, _ in self.gone_streak]
            for u, k in self.gone_streak:  # not proven gone: make them retryable later
                self.state.upsert_page(u, k, "error", last_error="suspected soft block (many missing pages in a row)")
            self.gone_streak = []
            err = SiteBlocked(
                f"{len(urls)} pages in a row were missing or redirected to the home page. Real deletions are rarely "
                "this clustered, so this looks like the site turning automated requests away. Stopping; these "
                "pages will be retried after the cooldown.",
                self.p.cooldown_after_block_hours,
            )
            err.reverted_urls = urls
            raise err

    def _backoff(self, attempt: int, why: str, minimum: float = 0.0) -> None:
        wait = min(self.p.backoff_max_seconds, self.p.backoff_base_seconds * 2 ** (attempt - 1))
        wait = max(minimum, wait * self.rng.uniform(0.8, 1.2))
        self._sleep(wait, f"backing off after {why} (retry {attempt}/{self.p.max_retries})")

    def _store_ok(self, url: str, current: str, kind: str, resp: requests.Response) -> FetchResult:
        key, sha, n = self.cache.put(url, resp.content)
        now = self.clock()
        headers = {k: resp.headers.get(k) for k in ("Content-Type", "Date", "Last-Modified", "ETag", "Server")
                   if resp.headers.get(k)}
        fields = dict(http_status=200, final_url=current, cache_key=key, content_sha1=sha, bytes=n,
                      fetched_at=now, last_error=None, headers_json=json.dumps(headers))
        self.state.upsert_page(url, kind, "ok", **fields)
        if current != url:  # alias, so the final URL is also served from cache later
            self.state.upsert_page(current, kind, "ok", **fields)
        self.successes += 1
        self.error_streak = 0
        self.gone_streak = []
        return FetchResult(url, kind, "ok", 200, current, _decode(resp.content, headers.get("Content-Type")),
                           False, now)

    def _gone(self, url: str, kind: str, status: int, final: str, detail: str = "") -> FetchResult:
        self.state.upsert_page(url, kind, "gone", http_status=status, final_url=final, fetched_at=self.clock(),
                               last_error=detail or None)
        self.error_streak = 0
        self._note_gone(url, kind)
        return FetchResult(url, kind, "gone", status, final, detail=detail)

    def _blocked(self, url: str, kind: str, status: int | None, message: str) -> None:
        self.state.upsert_page(url, kind, "blocked", http_status=status, last_error=message[:300])
        self.error_log.write(session=self.session_id, url=url, kind=kind, error=message)
        raise SiteBlocked(message, self.p.cooldown_after_block_hours)

    def _fetch_network(self, url: str, kind: str) -> FetchResult:
        self.state.bump_page_attempts(url, kind)
        try:
            return self._fetch_attempts(url, kind)
        except Offline:
            self.state.unbump_page_attempts(url)  # it never reached the site: don't count it against the page
            raise

    def _fetch_attempts(self, url: str, kind: str) -> FetchResult:
        p = self.p
        current, hops, attempt = url, 0, 0
        while True:
            attempt += 1
            resp, err = self._send(current, kind, attempt)
            if err is not None:
                self._note_error(current, kind, err, network=True)
                if attempt <= p.max_retries:
                    self._backoff(attempt, err)
                    continue
                self.state.upsert_page(url, kind, "error", last_error=err)
                return FetchResult(url, kind, "failed", detail=err)

            assert resp is not None
            status = resp.status_code
            ctype = resp.headers.get("Content-Type", "")

            if status in REDIRECT_STATUSES:
                loc = resp.headers.get("Location")
                if not loc or hops >= MAX_REDIRECTS:
                    self.state.upsert_page(url, kind, "error", http_status=status, last_error="bad redirect")
                    return FetchResult(url, kind, "failed", status, detail="bad redirect")
                target = normalize_url(urljoin(current, loc), self.base_url)
                hops += 1
                if not host_allowed(target, self.allowed_hosts):
                    self._blocked(url, kind, status, f"{current} redirected off-site to {target}. Not following; "
                                                     "this usually means a block, login or verification page.")
                if _LOGIN_LIKE.match(urlsplit(target).path):
                    self._blocked(url, kind, status, f"{current} redirected to {target} (login/verification/"
                                                     "consent page). The collector does not log in or get past such pages.")
                if is_homepage(target) and kind in ("story", "series", "listing"):
                    # Literotica sends removed/unknown stories to the homepage.
                    return self._gone(url, kind, status, target, "redirected to homepage")
                allowed, why = self.permitted(target)
                if not allowed:
                    self.state.upsert_page(url, kind, why, http_status=status, final_url=target)
                    return FetchResult(url, kind, why, status, target)
                tpage = self.state.get_page(target)
                if tpage and tpage["status"] == "ok" and self.cache.has(tpage["cache_key"]):
                    self.state.upsert_page(url, kind, "ok", http_status=200, final_url=target,
                                           cache_key=tpage["cache_key"], content_sha1=tpage["content_sha1"],
                                           bytes=tpage["bytes"], fetched_at=tpage["fetched_at"],
                                           headers_json=tpage["headers_json"])
                    return self._from_cache(url, kind, self.state.get_page(url) or tpage)
                current, attempt = target, 0
                continue

            if status != 200 and status not in (404, 410):
                # Challenge/CAPTCHA pages are often served with 403, 429 or 503.
                det = classify(kind, status, ctype, resp.content)
                if (resp.headers.get("cf-mitigated") or "").lower() == "challenge" or det.verdict in (
                        "challenge", "captcha", "age_gate"):
                    self._blocked(url, kind, status, f"HTTP {status} {det.verdict.replace('_', ' ')} page for "
                                                     f"{current} ({det.detail}). Stopping; not getting past it.")
                if status in (401, 403, 451):
                    self.count_403 += 1
                    if self.count_403 >= p.stop_after_403_count or status == 451:
                        self._blocked(url, kind, status, f"HTTP {status} (access refused) for {current}. Stopping and "
                                                         "cooling down; access refusals are not retried or worked around.")
                    self.state.upsert_page(url, kind, "blocked", http_status=status, last_error=f"HTTP {status}")
                    self._sleep(p.pause_after_429_seconds, f"pause after HTTP {status}")
                    return FetchResult(url, kind, "failed", status, detail=f"HTTP {status}")

            if status == 200:
                det = classify(kind, status, ctype, resp.content)
                if det.blocking:
                    self._blocked(url, kind, status, f"Received a {det.verdict.replace('_', ' ')} page instead of "
                                                     f"content for {current} ({det.detail}). Stopping: the collector "
                                                     "does not get past such pages.")
                if det.verdict != "ok":
                    self.state.upsert_page(url, kind, "error", http_status=status,
                                           last_error=f"{det.verdict}: {det.detail}")
                    self._note_error(current, kind, f"page without recognisable content ({det.verdict}: {det.detail})")
                    return FetchResult(url, kind, "failed", status, current,
                                       body=_decode(resp.content, ctype), detail=det.verdict)
                return self._store_ok(url, current, kind, resp)

            if status in (404, 410):
                return self._gone(url, kind, status, current)

            if status == 429:
                wait = max(_retry_after_seconds(resp, self.clock()) or 0, p.pause_after_429_seconds)
                recent = self._recent_429s()
                self.slowdown = max(self.slowdown, min(8.0, 2.0 ** recent))
                self.error_log.write(session=self.session_id, url=current, kind=kind, error="HTTP 429",
                                     recent_429s=recent, wait=wait)
                if recent >= p.stop_after_429_count or wait > 6 * 3600:
                    hours = max(p.cooldown_after_429_hours, wait / 3600)
                    self.state.upsert_page(url, kind, "error", http_status=429, last_error="HTTP 429")
                    raise RateLimited(
                        f"HTTP 429 Too Many Requests ({recent} in the last 24 hours). Stopping; new sessions are "
                        f"blocked for {hours:.1f} hours.", hours)
                # Record the pause first, so stopping and restarting during it does not skip it.
                self.state.set_cooldown(self.clock() + wait, f"pausing after HTTP 429 at {_fmt_time(self.clock())}")
                self._sleep(wait, f"HTTP 429; all requests now {self.slowdown:.0f}x slower")
                if attempt <= p.max_retries:
                    continue
                self.state.upsert_page(url, kind, "error", http_status=429, last_error="HTTP 429")
                return FetchResult(url, kind, "failed", 429)

            if status in TRANSIENT_STATUSES:
                self._note_error(current, kind, f"HTTP {status}")
                if attempt <= p.max_retries:
                    self._backoff(attempt, f"HTTP {status}", minimum=_retry_after_seconds(resp, self.clock()) or 0)
                    continue
                self.state.upsert_page(url, kind, "error", http_status=status, last_error=f"HTTP {status}")
                return FetchResult(url, kind, "failed", status)

            self.state.upsert_page(url, kind, "error", http_status=status, last_error=f"HTTP {status}")
            self._note_error(current, kind, f"HTTP {status} (not retried)")
            return FetchResult(url, kind, "failed", status, detail=f"HTTP {status}")
