"""Fetch story pages in queue order.

Page 1 of a story tells us how many pages it has; the remaining pages are then
fetched one at a time (up to ``max_pages_per_story``). Every page is cached,
so an interrupted story resumes from the first missing page and nothing is
downloaded twice. Text and metadata are *not* extracted here; ``build-raw``
does that later from the cache, which keeps parsing fixable without new requests.

A story that fails is not retried again in the same session (it waits for a
later session, up to ``max_attempts_per_url`` attempts), and a request the
server refuses as invalid (4xx other than 404/410/429) is not retried at all.

If a downloaded page 1 cannot be read by the parser (an unexpected page format),
the story stays queued and the error is logged; the next run reads the saved
copy again (no new request), so a parser fix needs no new downloads. Several
such pages in a row stop the session, since that points to a format change.
"""

from __future__ import annotations

import time
from typing import Any

from ..log import get_logger
from ..net.fetcher import StopCollection
from ..site.parse_story import parse_story_page
from ..site.urls import story_page_url, story_slug
from ..state import DISALLOWED, DONE, FAILED, GONE, PARTIAL, QUEUED, UNAVAILABLE
from .session import Ctx

log = get_logger("stories")

PARSE_ERROR = "parse_error"  # outcome only: the story itself stays queued
PARSE_ERRORS_IN_A_ROW_LIMIT = 5


class ParserTrouble(StopCollection):
    reason = "parser"


def _failed_status(row: dict[str, Any], max_attempts: int, http_status: int | None) -> tuple[str, int]:
    attempts = (row.get("attempts") or 0) + 1
    permanent = http_status is not None and 400 <= http_status < 500 and http_status not in (404, 408, 410, 429)
    return (FAILED if permanent or attempts >= max_attempts else QUEUED), attempts


def fetch_story(ctx: Ctx, row: dict[str, Any]) -> str:
    p, scope, state = ctx.settings.politeness, ctx.settings.scope, ctx.state
    slug = row["story_slug"]
    url1 = story_page_url(ctx.base_url, slug, 1)
    res = ctx.fetcher.fetch(url1, "story")
    now = time.time()
    if res.outcome == "gone":
        state.update_story(slug, status=GONE, last_error=res.detail or f"HTTP {res.status}", last_fetched_at=now)
        return GONE
    if res.outcome in ("robots_disallowed", "policy_denied"):
        state.update_story(slug, status=DISALLOWED, last_error=res.outcome, last_fetched_at=now)
        return DISALLOWED
    if not res.ok or not res.body:
        status, attempts = _failed_status(row, p.max_attempts_per_url, res.status)
        state.update_story(slug, status=status, attempts=attempts, last_error=res.detail or res.outcome,
                           last_fetched_at=now)
        return status

    final_url = res.final_url or url1
    canonical = story_slug(final_url) or slug
    try:
        sp = parse_story_page(res.body, final_url)
    except Exception as e:  # an unexpected page format must not stop the whole collection
        err = f"parse error: {type(e).__name__}: {e}"[:300]
        log.error("Story %s: the page is saved but could not be read (%s). It stays queued; the saved copy is "
                  "read again next run.", slug, err)
        ctx.fetcher.error_log.write(session=ctx.session_id, url=final_url, kind="story", error=err)
        state.update_story(slug, last_error=err, last_fetched_at=now)
        return PARSE_ERROR
    if sp.status == "unavailable":
        state.update_story(slug, status=UNAVAILABLE, last_error=",".join(sp.warnings), last_fetched_at=now,
                           canonical_url=final_url)
        return UNAVAILABLE
    total_pages = sp.max_page or 1
    expected = 1 if scope.text_mode == "first_page" else min(total_pages, scope.max_pages_per_story)
    state.update_story(slug, pages_expected=expected, canonical_url=final_url,
                       first_fetched_at=row.get("first_fetched_at") or res.fetched_at or now)
    fetched = 1
    status = DONE
    for n in range(2, expected + 1):
        r = ctx.fetcher.fetch(story_page_url(ctx.base_url, canonical, n), "story")
        if r.ok:
            fetched += 1
        elif r.outcome == "gone":
            log.info("Story %s: page %d does not exist (the page count was %d); keeping %d page(s).",
                     slug, n, total_pages, fetched)
            expected = fetched
            break
        else:
            status = PARTIAL
            break
    if status == PARTIAL:
        attempts = (row.get("attempts") or 0) + 1
        if attempts >= p.max_attempts_per_url:
            status = DONE  # keep what we have; build-raw flags it as incomplete
        state.update_story(slug, status=status, pages_fetched=fetched, pages_expected=expected,
                           attempts=attempts, last_fetched_at=time.time(), last_error="missing pages")
        return status
    state.update_story(slug, status=DONE, pages_fetched=fetched, pages_expected=expected,
                       last_fetched_at=time.time(), last_error=None)
    return DONE


def recheck_page_counts(ctx: Ctx) -> int:
    """Re-parse each finished story's cached first page with the current parser (offline). If it
    now finds more pages than were collected, re-queue the story so only the missing pages are fetched.
    Use after a parser fix; costs no requests by itself."""
    scope, n = ctx.settings.scope, 0
    if scope.text_mode == "first_page":
        return 0
    for row in ctx.state.stories([DONE]):
        url = row["canonical_url"] or story_page_url(ctx.base_url, row["story_slug"], 1)
        body = ctx.fetcher.cached_body(url)
        if not body:
            continue
        try:
            sp = parse_story_page(body, url)
        except Exception as e:
            log.warning("Recheck: could not read the saved first page of %s (%s); skipped.", row["story_slug"], e)
            continue
        expected = min(sp.max_page or 1, scope.max_pages_per_story)
        if expected > (row["pages_fetched"] or 0):
            ctx.state.update_story(row["story_slug"], status=PARTIAL, pages_expected=expected, attempts=0)
            n += 1
    log.info("Recheck: %d finished stories have pages that were not collected; they are queued again.", n)
    return n


def requeue_newly_allowed(ctx: Ctx) -> int:
    """Stories skipped because robots.txt disallowed them are re-queued if the current robots.txt allows them."""
    n = 0
    for row in ctx.state.stories([DISALLOWED]):
        allowed, _ = ctx.fetcher.permitted(story_page_url(ctx.base_url, row["story_slug"], 1))
        if allowed:
            ctx.state.update_story(row["story_slug"], status=QUEUED)
            n += 1
    if n:
        log.info("%d previously disallowed stories are allowed by the current robots.txt; queued again.", n)
    return n


def collect_stories(ctx: Ctx) -> dict[str, int]:
    counts: dict[str, int] = {}
    total_open = sum(n for s, n in ctx.state.story_status_counts().items() if s in (QUEUED, PARTIAL))
    tried: set[str] = set()  # each story is attempted at most once per session
    gone_run: list[str] = []  # consecutive stories just marked gone (undone if the fetcher detects a soft block)
    parse_errors_in_a_row = 0
    done_so_far = 0
    while True:
        batch = [r for r in ctx.state.next_open_stories(25 + len(tried)) if r["story_slug"] not in tried]
        if not batch:
            break
        for row in batch[:25]:
            tried.add(row["story_slug"])
            try:
                status = fetch_story(ctx, row)
            except StopCollection as e:
                if e.reverted_urls:
                    for slug in gone_run:
                        ctx.state.update_story(slug, status=QUEUED, last_error="retry: suspected soft block")
                    ctx.state.update_story(row["story_slug"], status=QUEUED)
                raise
            gone_run = gone_run + [row["story_slug"]] if status == GONE else []
            parse_errors_in_a_row = parse_errors_in_a_row + 1 if status == PARSE_ERROR else 0
            counts[status] = counts.get(status, 0) + 1
            done_so_far += 1
            log.info("Story %d/%d [%s] %s -> %s", done_so_far, total_open, row["category_slug"],
                     row["story_slug"][:60], status)
            if parse_errors_in_a_row >= PARSE_ERRORS_IN_A_ROW_LIMIT:
                raise ParserTrouble(
                    f"{parse_errors_in_a_row} story pages in a row could not be read; the site's page format may "
                    "have changed. The pages are saved, so nothing has to be downloaded again once the parser is "
                    "fixed. Please send data/logs/errors.jsonl.")
    return counts
