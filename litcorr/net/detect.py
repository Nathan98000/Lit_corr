"""Recognise responses that are not real content: bot challenges, CAPTCHAs,
access-denied pages and age gates. The collector never tries to get past any of
these; it stops and tells you what it saw."""

from __future__ import annotations

import re
from dataclasses import dataclass

# Markers that only appear on interstitial challenge / block pages.
_CHALLENGE = (
    "<title>just a moment",
    "attention required! | cloudflare",
    'id="challenge-form"',
    "window._cf_chl_opt",
    "cf-chl-widget",
    "cf-browser-verification",
    "checking your browser before accessing",
    "sorry, you have been blocked",
    "error code: 1020",
    "<title>access denied",
    "px-captcha",
    "_incapsula_resource",
    "captcha-delivery.com",
)
_CAPTCHA = ("g-recaptcha", "h-captcha", "hcaptcha.com", "cf-turnstile", "recaptcha/api.js")
_DENIED = (
    "access denied",
    "you don't have permission to access",
    "request blocked",
    "your ip address has been blocked",
    "automated access",
    "unusual traffic",
)
_AGE_GATE = (
    "verify your age",
    "age verification",
    "confirm your age",
    "you must be 18",
    "are you over 18",
    "are you 18",
    "enter your date of birth",
)

_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)


@dataclass
class Detection:
    verdict: str  # ok | challenge | captcha | denied | age_gate | tiny | not_html | no_content
    detail: str = ""

    @property
    def blocking(self) -> bool:
        return self.verdict in ("challenge", "captcha", "denied", "age_gate")


CONTENT_KINDS = ("story", "listing", "category_index")


def looks_like_content(kind: str, low: str) -> bool:
    if kind == "story":
        if "awaiting moderator" in low:  # a real, if unpublished, story page
            return True
        return "<h1" in low and any(
            m in low for m in ("articlebody", "_article__content_", "aa_ht", "b-story-body")
        )
    if kind == "listing":
        return "/s/" in low  # even a browse-by-letter page for a rare initial lists at least one story
    if kind == "category_index":
        return low.count("/c/") >= 5
    return len(low) > 2000


def classify(kind: str, status: int | None, content_type: str, body: bytes) -> Detection:
    if kind == "robots":
        return Detection("ok")
    if content_type and "html" not in content_type.lower():
        return Detection("not_html", content_type)
    text = body[:400_000].decode("utf-8", errors="replace")
    low = text.lower()
    title_m = _TITLE_RE.search(text)
    title = (title_m.group(1).strip() if title_m else "")[:120]
    has_content = looks_like_content(kind, low)

    for marker in _CHALLENGE:
        if marker in low and not has_content:
            return Detection("challenge", f"marker {marker!r}; title {title!r}")
    if not has_content:
        for marker in _AGE_GATE:
            if marker in low:
                return Detection("age_gate", f"marker {marker!r}; title {title!r}")
        for marker in _CAPTCHA:
            if marker in low:
                return Detection("captcha", f"marker {marker!r}; title {title!r}")
        if len(body) < 30_000:
            for marker in _DENIED:
                if marker in low:
                    return Detection("denied", f"marker {marker!r}; title {title!r}")
    if len(body) < 1000 and not has_content:
        return Detection("tiny", f"{len(body)} bytes; title {title!r}")
    if kind in CONTENT_KINDS and not has_content:
        # Probably an interstitial, maintenance or error page served with HTTP 200: never cache it as content.
        return Detection("no_content", f"{len(body)} bytes; title {title!r}")
    return Detection("ok", title)
