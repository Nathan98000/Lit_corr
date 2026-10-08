"""Choose which stories get their full text collected.

Within each category, the stories seen on the planned listing pages (the
systematic sample of listing pages; see discover.py) are shuffled with a fixed
seed and the first ``max_stories_per_category`` are queued. Stories seen only
on other pages (e.g. the "hot"/"new" showcase of a category's landing page, or
a letter's page 1 that was read just to count pages) are never sampled. Queue order interleaves categories (1st story of every category, then
the 2nd of every category, ...), so stopping at any point leaves a sample that
is balanced across categories. Because the shuffle is deterministic, raising
``max_stories_per_category`` later only appends stories; nothing is re-drawn.

A sampled story that cannot be collected (gone from the site, unavailable, or
still failing after ``max_attempts_per_url`` runs) does not count towards its
category's quota: the next story in the category's shuffled order is queued in
its place, so each category still gets its full quota. Stories disallowed by
robots.txt are not replaced, since they are queued again if robots.txt later
allows them.
"""

from __future__ import annotations

import json
import random
from typing import Any

from ..log import get_logger
from ..site.parse_common import parse_date
from ..state import FAILED, GONE, UNAVAILABLE
from .session import Ctx

log = get_logger("sample")

REPLACED_STATUSES = (FAILED, GONE, UNAVAILABLE)  # sampled but cannot be collected: the next story takes its place


def _year_ok(date_text: str | None, min_year: int, max_year: int) -> bool:
    if not (min_year or max_year):
        return True
    iso = parse_date(date_text) if date_text else None
    if not iso:
        return True  # unknown date: keep (filtering happens later, with the story's own date)
    y = int(iso[:4])
    return (not min_year or y >= min_year) and (not max_year or y <= max_year)


def build_queue(ctx: Ctx) -> dict[str, Any]:
    scope, state = ctx.settings.scope, ctx.state
    cats = state.categories(selected_only=True)
    order = {c["slug"]: i for i, c in enumerate(cats)}
    given_up = {r["story_slug"] for r in state.stories(REPLACED_STATUSES)}
    summary: dict[str, Any] = {}
    for c in cats:
        if c["listing_status"] != "done":
            continue
        if c["listing_plan_json"] is not None and not json.loads(c["listing_plan_json"]):
            continue  # an empty plan means no usable frame for this category: sample nothing
        plan = json.loads(c["listing_plan_json"] or "[]")
        plan_urls = {p for p in plan if isinstance(p, str)}
        plan_pages = {p for p in plan if isinstance(p, int)}  # older plans stored page numbers
        by_slug: dict[str, dict[str, Any]] = {}
        for it in state.listing_items(c["slug"]):
            if plan_urls and it["listing_url"] not in plan_urls:
                continue  # only stories on the planned (systematically sampled) listing pages
            if plan_pages and it["page_no"] not in plan_pages:
                continue
            by_slug.setdefault(it["story_slug"], it)
        candidates = sorted(by_slug.values(), key=lambda r: r["story_slug"])
        candidates = [r for r in candidates if _year_ok(r["date_text"], scope.min_year, scope.max_year)]
        rng = random.Random(f"{scope.random_seed}:{c['slug']}:sample")
        rng.shuffle(candidates)
        chosen, counted = [], 0
        for r in candidates:  # the quota counts stories that are collected or may still be
            if counted == scope.max_stories_per_category:
                break
            chosen.append(r)
            counted += r["story_slug"] not in given_up
        added = sum(state.queue_story(r["story_slug"], c["slug"], i * 1000 + order[c["slug"]])
                    for i, r in enumerate(chosen))
        summary[c["slug"]] = {"frame": len(candidates), "chosen": len(chosen), "newly_queued": added,
                              "not_collectable": len(chosen) - counted}
        state.set_meta(f"frame:{c['slug']}", json.dumps(summary[c["slug"]]))
    total_new = sum(v["newly_queued"] for v in summary.values())
    if summary:
        log.info("Sample queue: %d stories chosen across %d categories (%d newly queued).",
                 sum(v["chosen"] for v in summary.values()), len(summary), total_new)
        lost = sum(v["not_collectable"] for v in summary.values())
        if lost:
            log.info("%d sampled stories could not be collected; the next stories in their categories' shuffled "
                     "order take their places.", lost)
    return summary
