"""URL normalization and story identifiers.

A story's stable identifier is its URL slug: ``/s/<slug>`` -> ``<slug>``
(lower-cased). Pages of the same story are ``/s/<slug>?page=N``. The slug is
what deduplicates records across listing pages and reruns; the numeric
submission id embedded in the page is kept as a cross-check.
"""

from __future__ import annotations

import re
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

_DROP_PARAMS = re.compile(r"^(utm_.*|ref|fbclid|gclid|source|from)$", re.I)
_STORY_PATH = re.compile(r"^/s/([^/?#]+)/?$")
_SERIES_PATH = re.compile(r"^/series/se/([A-Za-z0-9_-]+)/?$")
_CATEGORY_PATH = re.compile(r"^/c/([^/?#]+)")


def normalize_url(url: str, base: str = "https://www.literotica.com") -> str:
    url = urljoin(base + "/", url.strip())
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    if host == "literotica.com":
        host = "www.literotica.com"
    path = re.sub(r"/{2,}", "/", parts.path or "/")
    if (path.startswith("/s/") or path.startswith("/c/") or path.startswith("/series/")) and len(path) > 1:
        path = path.rstrip("/")
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if not _DROP_PARAMS.match(k)]
    query = [(k, v) for k, v in query if not (k == "page" and v in ("", "1"))]
    query.sort()
    port = f":{parts.port}" if parts.port and parts.port not in (80, 443) else ""
    scheme = "https" if parts.scheme in ("http", "https") and not port else (parts.scheme or "https")
    return urlunsplit((scheme, host + port, path, urlencode(query), ""))


def story_slug(url: str) -> str | None:
    m = _STORY_PATH.match(urlsplit(url).path)
    return m.group(1).lower() if m else None


def story_page_url(base_url: str, slug: str, page: int = 1) -> str:
    url = f"{base_url.rstrip('/')}/s/{slug}"
    return url if page <= 1 else f"{url}?page={page}"


def page_number(url: str) -> int:
    for k, v in parse_qsl(urlsplit(url).query):
        if k == "page" and v.isdigit():
            return int(v)
    m = re.search(r"/(\d+)-page/?$", urlsplit(url).path)
    return int(m.group(1)) if m else 1


def series_id(url: str) -> str | None:
    m = _SERIES_PATH.match(urlsplit(url).path)
    return m.group(1) if m else None


def category_slug_from_url(url: str) -> str | None:
    m = _CATEGORY_PATH.match(urlsplit(url).path)
    return m.group(1).lower() if m else None


def is_homepage(url: str) -> bool:
    return urlsplit(url).path in ("", "/")


def same_host(url_a: str, url_b: str) -> bool:
    return (urlsplit(url_a).hostname or "").lower() == (urlsplit(url_b).hostname or "").lower()
