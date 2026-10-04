"""Categories and listing pages (the sampling frame).

1. Categories: read once from the site's story index (``/stories``) or home page,
   falling back to the built-in list. Selection follows ``scope.categories`` /
   ``scope.exclude_categories``.
2. Listing layout, learned once from the first category and stored:
   * ``letters`` (Literotica's current layout): a category's landing page
     (``/c/<slug>``) is a showcase of "hot"/"new" stories and is NOT used as the
     frame. Instead the frame is the category's browse-by-title index
     (``/c/<slug>/A`` … ``/c/<slug>/Z``, ``/c/<slug>/*``), which lists every
     story regardless of popularity.
   * ``pages``: a single paginated list (``?page=N`` or ``/N-page``).
3. Per category, the frame is an ordered sequence of listing pages (for
   ``letters``: page 1…n of every letter; page 1 of each letter is read to learn
   n). A systematic sample of at least MIN_CLUSTERS pages is then taken across
   the whole sequence (random start, fixed seed), so every listing page, and so
   every story, has the same chance of being in the frame. Stories are later
   sampled only from those planned pages. With ``listing_strategy = "all"`` every
   page is read.
"""

from __future__ import annotations

import json
import math
import random
from typing import Any

from ..log import get_logger
from ..site.categories import BUILTIN_CATEGORIES, NOT_STORY_CATEGORY, parse_category_links
from ..site.parse_listing import ListingPage, parse_listing_page
from ..site.urls import normalize_url
from .session import Ctx

log = get_logger("discover")

FIRST_PAGE_CANDIDATES = ("{base}/c/{slug}", "{base}/c/{slug}/1-page")
CATEGORY_INDEX_PAGES = ("{base}/stories", "{base}/")
MAX_CATEGORY_TRIES = 3
MIN_CLUSTERS = 20  # spread the frame over at least this many listing pages (when the category has that many)


# ------------------------------------------------------------------ categories
def discover_categories(ctx: Ctx, refresh: bool = False) -> list[dict[str, Any]]:
    state = ctx.state
    if refresh or state.get_meta("categories_source") != "discovered":
        found, read_ok = [], False
        for tpl in CATEGORY_INDEX_PAGES:
            url = tpl.format(base=ctx.base_url)
            res = ctx.fetcher.fetch(url, "category_index")
            if res.body:
                found = parse_category_links(res.body, res.final_url or url)
            read_ok = read_ok or res.ok
            if len(found) >= 8:
                break
        builtin = {c.slug: c for c in BUILTIN_CATEGORIES}
        if len(found) >= 8:
            for c in found:
                b = builtin.get(c.slug)
                state.upsert_category(c.slug, name=c.name or (b.name if b else c.slug),
                                      url=f"{ctx.base_url}/c/{c.slug}", source="discovered",
                                      site_id=b.site_id if b else None)
            found_slugs = {c.slug for c in found}
            for c in state.categories():  # earlier built-in guesses the site does not list
                if c["source"] == "builtin" and c["slug"] not in found_slugs:
                    state.upsert_category(c["slug"], source="builtin_unlisted")
            state.set_meta("categories_source", "discovered")
            log.info("Found %d story categories on the site.", len(found))
        elif not state.categories():
            log.warning("Could not read the category list from the site (%d links found); using the built-in "
                        "list.", len(found))
            for c in BUILTIN_CATEGORIES:
                state.upsert_category(c.slug, name=c.name, url=f"{ctx.base_url}/c/{c.slug}", source="builtin",
                                      site_id=c.site_id)
            if read_ok:  # pages were read but list no categories: retrying them will not help
                state.set_meta("categories_source", "builtin")
    _apply_selection(ctx)
    return state.categories(selected_only=True)


def _apply_selection(ctx: Ctx) -> None:
    scope, state = ctx.settings.scope, ctx.state
    wanted = [s.strip().lower() for s in scope.categories if s.strip()]
    excluded = {s.strip().lower() for s in scope.exclude_categories}
    known = {c["slug"] for c in state.categories()}
    for slug in wanted:
        if slug not in known:
            log.warning("Category %r from config is not in the discovered list; adding it as given.", slug)
            state.upsert_category(slug, name=slug, url=f"{ctx.base_url}/c/{slug}", source="config")
    for c in state.categories():
        if wanted:
            sel = c["slug"] in wanted
        else:
            sel = (c["slug"] not in excluded and not NOT_STORY_CATEGORY.search(c["slug"])
                   and c["source"] != "builtin_unlisted")
        state.upsert_category(c["slug"], selected=int(sel))


# ------------------------------------------------------------------ tries
def _tries(ctx: Ctx, slug: str) -> int:
    return int(ctx.state.get_meta(f"listing_tries:{slug}") or 0)


def _count_try(ctx: Ctx, slug: str) -> int:
    n = _tries(ctx, slug) + 1
    ctx.state.set_meta(f"listing_tries:{slug}", str(n))
    if n >= MAX_CATEGORY_TRIES:
        ctx.state.upsert_category(slug, listing_status="failed")
        log.warning("Category %s: listing pages failed %d times; giving up on it.", slug, n)
    return n


# ------------------------------------------------------------------ layout
def _generalize(template: str, base: str, slug: str, letter: str | None = None) -> str:
    t = template.replace(base, "{base}")
    if letter is not None:
        for form in (f"/c/{slug}/{letter}", f"/c/{slug}/{letter.replace('*', '%2A')}"):
            t = t.replace(form, "/c/{slug}/{letter}")
    return t.replace(f"/c/{slug}", "/c/{slug}")


def letter_url(layout: dict[str, Any], base: str, slug: str, letter: str, n: int = 1) -> str:
    if n <= 1 or not layout.get("page"):
        return layout["letter_url"].format(base=base, slug=slug, letter=letter)
    return layout["page"].format(base=base, slug=slug, letter=letter, n=n)


def ensure_listing_layout(ctx: Ctx, cats: list[dict[str, Any]], tries: int = 3) -> dict[str, Any] | None:
    """Learn the listing URL layout from the first category (up to ``tries`` categories) that has one."""
    stored = ctx.state.get_meta("listing_layout")
    if stored:
        return json.loads(stored)
    for cat in cats[:tries]:
        layout = _detect_layout(ctx, cat)
        if layout is not None:
            ctx.state.set_meta("listing_layout", json.dumps(layout))
            log.info("Listing layout: %s", layout)
            return layout
        _count_try(ctx, cat["slug"])
    log.error("No listing page with story links was found for %s. Run `python -m litcorr probe` and share "
              "data/logs/probe_report.md so the parser can be adjusted.", ", ".join(c["slug"] for c in cats[:tries]))
    return None


# Common first letters of English titles: the likeliest letter pages to need several pages.
_BUSY_LETTERS = ("S", "T", "M", "B", "A", "C", "L", "D", "F", "H")
# Other ways a letter's page 2 might be addressed (tried only if a full-looking page shows no page links).
PAGE2_CANDIDATES = ("{base}/c/{slug}/{letter}/2-page", "{base}/c/{slug}/{letter}/2")
FULL_LOOKING_PAGE = 50  # a letter page with at least this many stories may be the first of several


def try_page2_patterns(ctx: Ctx, slug: str, letter: str, page1: ListingPage) -> tuple[str | None, ListingPage | None]:
    """Test the other page-2 address patterns; return (template with {n}, page 2) for one that shows new stories."""
    base = ctx.base_url
    page1_url = normalize_url(f"{base}/c/{slug}/{letter}", base)
    seen = {s["story_slug"] for s in page1.stubs}
    for cand in PAGE2_CANDIDATES:
        url2 = cand.format(base=base, slug=slug, letter=letter)
        r = ctx.fetcher.fetch(url2, "listing")
        if not r.ok or not r.body or normalize_url(r.final_url or url2, base) == page1_url:
            continue  # missing, or redirected back to page 1
        lp2 = parse_listing_page(r.body, r.final_url or url2, base)
        if {s["story_slug"] for s in lp2.stubs} - seen:
            return cand.replace("/2-page", "/{n}-page") if cand.endswith("/2-page") else cand[:-1] + "{n}", lp2
    return None, None


DASH_TEMPLATE = "{base}/c/{slug}/{letter}-{n}"  # Literotica: /c/<slug>/S-2 is letter S, page 2


def _nav_shows_dash_pages(nav: dict[str, Any]) -> bool:
    return any(pos and pos[1] >= 2 for pos in (nav.get("prev"), nav.get("next"), nav.get("first"), nav.get("last")))


def _learn_letter_template(ctx: Ctx, layout: dict[str, Any], lp: ListingPage, slug: str, letter: str) -> None:
    """Learn (once) how a letter's pages 2, 3, ... are addressed, from any letter page that links to them."""
    if layout.get("page"):
        return
    if _nav_shows_dash_pages(lp.letter_nav):
        layout.update(page=DASH_TEMPLATE, paging="letter_nav")
    elif lp.page_url_template:
        layout.update(page=_generalize(lp.page_url_template, ctx.base_url, slug, letter), paging="numbered")
    else:
        return
    ctx.state.set_meta("listing_layout", json.dumps(layout))
    log.info("Learned how letter pages are numbered: %s", layout["page"])


def _detect_letters(ctx: Ctx, slug: str, segments: list[str]) -> dict[str, Any] | None:
    """Confirm the browse-by-letter pages list stories, and learn how they are paginated if a page shows it."""
    base = ctx.base_url
    order = [s for s in _BUSY_LETTERS if s in segments] + [s for s in segments if s not in _BUSY_LETTERS]
    layout: dict[str, Any] | None = None
    for letter in order[:3]:
        url = f"{base}/c/{slug}/{letter}"
        res = ctx.fetcher.fetch(url, "listing")
        if not res.ok or not res.body:
            continue
        lp = parse_listing_page(res.body, res.final_url or url, base)
        log.info("Letter page %s: %d stories (strategy %s), pagination template %s, last page %s, total %s",
                 url, len(lp.stubs), lp.strategy, lp.page_url_template, lp.max_page, lp.total_items)
        if not lp.stubs:
            continue
        layout = layout or {"frame": "letters", "first": "{base}/c/{slug}", "letter_url": "{base}/c/{slug}/{letter}",
                            "page": None, "paging": "per_letter", "strategy": lp.strategy}
        if _nav_shows_dash_pages(lp.letter_nav):
            layout.update(page=DASH_TEMPLATE, paging="letter_nav")
            return layout
        if lp.page_url_template:
            layout.update(page=_generalize(lp.page_url_template, base, slug, letter), paging="numbered")
            return layout
        if lp.max_page and lp.max_page > 1:
            # The page knows it has more pages but shows no links to them: check that ?page=2 works.
            url2 = normalize_url(url + "?page=2", base)
            res2 = ctx.fetcher.fetch(url2, "listing")
            if res2.ok and res2.body and normalize_url(res2.final_url or url2, base) != normalize_url(url, base):
                lp2 = parse_listing_page(res2.body, res2.final_url or url2, base)
                if {s["story_slug"] for s in lp2.stubs} - {s["story_slug"] for s in lp.stubs}:
                    layout.update(page="{base}/c/{slug}/{letter}?page={n}", paging="numbered")
                    return layout
        if len(lp.stubs) >= FULL_LOOKING_PAGE and not layout.get("tested_page2"):
            # A full-looking page without page links: test the other ways page 2 might be addressed (once).
            layout["tested_page2"] = True
            tpl, lp2 = try_page2_patterns(ctx, slug, letter, lp)
            if tpl:
                layout.update(page=tpl, paging="numbered" if lp2 and lp2.page_url_template else "sequential")
                return layout
        # This letter fits on one page; try a busier letter to see how pages are numbered.
    return layout  # pagination (if any) is learned later from the first letter page that shows it


def _detect_layout(ctx: Ctx, cat: dict[str, Any]) -> dict[str, Any] | None:
    slug, base = cat["slug"], ctx.base_url
    for cand in FIRST_PAGE_CANDIDATES:
        url = cand.format(base=base, slug=slug)
        res = ctx.fetcher.fetch(url, "listing")
        if not res.ok or not res.body:
            continue
        lp = parse_listing_page(res.body, res.final_url or url, base)
        log.info("Listing candidate %s: %d stories (strategy %s), pagination template %s, last page %s, "
                 "%d browse-by-title links", url, len(lp.stubs), lp.strategy, lp.page_url_template, lp.max_page,
                 len(lp.browse_segments))
        if len(lp.browse_segments) >= 3:
            layout = _detect_letters(ctx, slug, lp.browse_segments)
            if layout is not None:
                return layout
        if len(lp.stubs) < 3:
            continue
        layout = {"frame": "pages", "first": cand, "page": None, "paging": "none", "strategy": lp.strategy}
        if lp.page_url_template:
            layout.update(page=_generalize(lp.page_url_template, base, slug), paging="numbered")
        else:
            url2 = normalize_url(url + "?page=2", base)
            res2 = ctx.fetcher.fetch(url2, "listing")
            if res2.ok and res2.body:
                lp2 = parse_listing_page(res2.body, res2.final_url or url2, base)
                new = {s["story_slug"] for s in lp2.stubs} - {s["story_slug"] for s in lp.stubs}
                if len(new) >= max(3, len(lp.stubs) // 2):
                    layout.update(page=_generalize(url2.replace("page=2", "page={n}"), base, slug),
                                  paging="sequential")
        return layout
    return None


# ------------------------------------------------------------------ planning
def systematic_sample(n_items: int, k: int, rng: random.Random) -> list[int]:
    """k indices spread evenly over range(n_items) with a random start (systematic sampling)."""
    if k >= n_items:
        return list(range(n_items))
    step = n_items / k
    offset = rng.uniform(0, step)
    return sorted({min(n_items - 1, int(offset + i * step)) for i in range(k)})


def frame_size(per_page: float, target: int, n_pages: int, strategy: str, cap: int) -> int:
    if strategy == "all":
        k = n_pages
    else:
        k = min(n_pages, max(math.ceil(target / max(per_page, 1)), MIN_CLUSTERS))
    return min(k, cap) if cap and cap > 0 else k


def plan_pages(total: int | None, per_page: int, target: int, strategy: str, cap: int,
               rng: random.Random) -> list[int]:
    """Page numbers (1-based) to read from a single paginated list of ``total`` pages."""
    if not total or total <= 1:
        return [1]
    k = frame_size(per_page, target, total, strategy, cap)
    return [i + 1 for i in systematic_sample(total, k, rng)]


def _store(ctx: Ctx, slug: str, lp: ListingPage, page_no: int) -> int:
    rows = [
        dict(story_slug=s["story_slug"], category_slug=slug, listing_url=lp.url, page_no=page_no,
             position=s.get("position"), strategy=s.get("strategy"), title=s.get("title"), author=s.get("author"),
             description=s.get("description"), date_text=s.get("date_text"), rating_text=s.get("rating_text"),
             views_text=s.get("views_text"), extra_json={**(s.get("extra") or {}), "category_hint": s.get("category_hint")})
        for s in lp.stubs
    ]
    return ctx.state.add_listing_items(rows)


def _target(ctx: Ctx) -> int:
    scope = ctx.settings.scope
    return math.ceil(scope.max_stories_per_category * scope.listing_oversample)


# ------------------------------------------------------------------ frame: browse-by-letter
MAX_LETTER_PAGES = 256


def find_last_page(ctx: Ctx, layout: dict[str, Any], slug: str, letter: str, page1: ListingPage) -> int:
    """How many pages a letter has, when its pages show no page numbers: try pages 2, 4, 8, ... until one
    does not exist (missing, or redirected back to page 1, or no new stories), then bisect. Pages read on the
    way are stored like any other listing page; only the planned ones are used for sampling."""
    base = ctx.base_url
    page1_url = normalize_url(letter_url(layout, base, slug, letter, 1), base)
    seen = {s["story_slug"] for s in page1.stubs}
    known: dict[int, bool] = {1: True}

    def exists(n: int) -> bool:
        if n not in known:
            url = normalize_url(letter_url(layout, base, slug, letter, n), base)
            r = ctx.fetcher.fetch(url, "listing")
            ok = bool(r.ok and r.body) and normalize_url(r.final_url or url, base) != page1_url
            if ok:
                lp = parse_listing_page(r.body, r.final_url or url, base)
                _store(ctx, slug, lp, n)
                ok = bool({s["story_slug"] for s in lp.stubs} - seen)
            known[n] = ok
        return known[n]

    lo, hi = 1, 2
    while hi <= MAX_LETTER_PAGES and exists(hi):
        lo, hi = hi, hi * 2
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if exists(mid):
            lo = mid
        else:
            hi = mid
    return lo


def _collect_letters(ctx: Ctx, cat: dict[str, Any], layout: dict[str, Any]) -> None:
    scope, state, base, slug = ctx.settings.scope, ctx.state, ctx.base_url, cat["slug"]
    landing_url = layout["first"].format(base=base, slug=slug)
    res = ctx.fetcher.fetch(landing_url, "listing")
    if not res.ok or not res.body:
        n = _count_try(ctx, slug)
        log.warning("Category %s: landing page unavailable (%s); try %d of %d.", slug, res.outcome, n,
                    MAX_CATEGORY_TRIES)
        return
    landing = parse_listing_page(res.body, res.final_url or landing_url, base)
    segments = landing.browse_segments
    if landing.category_sizes:  # the site's own story counts per category (used for sampling weights)
        state.set_meta("category_sizes", json.dumps(landing.category_sizes))
    if not segments:
        log.warning("Category %s: no browse-by-title links on its landing page; skipping it.", slug)
        state.upsert_category(slug, listing_status="done", listing_plan_json=json.dumps([]))
        return
    # Phase 1: page 1 of every letter -> how many listing pages each letter has.
    letters, missing, firsts = [], 0, {}
    nav_pages: dict[str, int] = {}  # letter -> pages, from "previous" links of the next letter and the "last" link
    position: dict[str, int] = {}  # letter -> position of its first page in the whole sequence
    nav_total = 0
    for seg in segments:
        url1 = normalize_url(letter_url(layout, base, slug, seg), base)
        r = ctx.fetcher.fetch(url1, "listing")
        if r.outcome == "gone":
            continue
        if not r.ok or not r.body:
            missing += 1
            continue
        lp = parse_listing_page(r.body, r.final_url or url1, base)
        _store(ctx, slug, lp, 1)
        _learn_letter_template(ctx, layout, lp, slug, seg)
        nav = lp.letter_nav
        if nav.get("prev"):  # the page before a letter's first page is the previous letter's last page
            w, m = nav["prev"]
            nav_pages[w] = max(nav_pages.get(w, 0), m)
        if nav.get("last"):
            z, m = nav["last"]
            nav_pages[z] = max(nav_pages.get(z, 0), m)
        if nav.get("active_number"):
            position[seg] = nav["active_number"]
        nav_total = max(nav_total, nav.get("max_number") or 0)
        firsts[seg] = lp
        letters.append({"letter": seg, "pages": None, "per_page": len(lp.stubs), "total": lp.total_items,
                        "url1": url1})
    # Pages per letter: from the links above; else from positions in the sequence; else by searching.
    ordered = sorted((p, s) for s, p in position.items())
    from_positions = {s: (ordered[i + 1][0] - p if i + 1 < len(ordered) else (nav_total - p + 1 if nav_total else None))
                      for i, (p, s) in enumerate(ordered)}
    for x in letters:
        seg, lp = x["letter"], firsts[x["letter"]]
        pages = nav_pages.get(seg) or from_positions.get(seg) or lp.max_page
        if not pages and layout.get("page") and len(lp.stubs) >= FULL_LOOKING_PAGE:
            pages = find_last_page(ctx, layout, slug, seg, lp)  # full page and no page numbers anywhere
        x["pages"] = max(1, int(pages or 1))
        if seg in nav_pages and from_positions.get(seg) and nav_pages[seg] != from_positions[seg]:
            log.warning("Category %s, letter %s: links say %d pages, positions say %d; using the links.",
                        slug, seg, nav_pages[seg], from_positions[seg])
    if nav_total and letters and sum(x["pages"] for x in letters) != nav_total:
        log.warning("Category %s: letter page counts add up to %d but the site shows %d pages in total.",
                    slug, sum(x["pages"] for x in letters), nav_total)
    if any(x["pages"] > 1 for x in letters) and not layout.get("page"):
        log.warning("Category %s: some letters have several pages but no page links were found; only their first "
                    "pages are used. Please run `probe` and share the report.", slug)
        for x in letters:
            x["pages"] = 1
    if missing:
        n = _count_try(ctx, slug)
        log.warning("Category %s: %d letter page(s) could not be read; retried later (try %d of %d).",
                    slug, missing, n, MAX_CATEGORY_TRIES)
        if n < MAX_CATEGORY_TRIES:
            return
    # Phase 2: systematic sample of listing pages over the whole letter-by-letter sequence.
    sequence = [(x["letter"], p) for x in letters for p in range(1, x["pages"] + 1)]
    per_page = (sum(x["per_page"] for x in letters) / len(letters)) if letters else 1
    rng = random.Random(f"{scope.random_seed}:{slug}:plan")
    k = frame_size(per_page, _target(ctx), len(sequence), scope.listing_strategy, scope.max_listing_pages_per_category)
    planned = [sequence[i] for i in systematic_sample(len(sequence), k, rng)]
    plan_urls = [normalize_url(letter_url(layout, base, slug, seg, n), base) for seg, n in planned]
    totals = [x["total"] for x in letters]
    site_size = json.loads(state.get_meta("category_sizes") or "{}").get(slug)
    if isinstance(site_size, int) and site_size > 0:
        est_total = site_size  # the site's own count
    elif letters and all(isinstance(t, int) for t in totals):
        est_total = sum(totals)
    else:
        est_total = round(sum(x["pages"] * x["per_page"] for x in letters))
    if not layout.get("page") and any(x["per_page"] >= FULL_LOOKING_PAGE and x["pages"] == 1 for x in letters):
        log.warning("Category %s: some letter pages look full but no way to reach their next pages was found; "
                    "the frame uses each letter's first page only (see the probe report).", slug)
    state.upsert_category(slug, total_pages=len(sequence), stories_per_page=round(per_page),
                          total_stories_reported=est_total, page_url_template=layout.get("page"),
                          listing_plan_json=json.dumps(plan_urls), listing_status="planned")
    state.set_meta(f"letters:{slug}", json.dumps([{k2: v for k2, v in x.items() if k2 != "url1"} for x in letters]))
    log.info("Category %s: %d letters, %d listing pages (~%d stories); reading %d of them.", slug, len(letters),
             len(sequence), est_total, len(plan_urls))
    failed = 0
    for (seg, n), url in zip(planned, plan_urls):
        if n == 1:
            continue  # already read in phase 1
        r = ctx.fetcher.fetch(url, "listing")
        if not r.ok or not r.body:
            failed += 0 if r.outcome == "gone" else 1
            continue
        _store(ctx, slug, parse_listing_page(r.body, r.final_url or url, base), n)
    if failed:
        n = _count_try(ctx, slug)
        if n < MAX_CATEGORY_TRIES:
            log.warning("Category %s: %d planned listing page(s) failed; retried later.", slug, failed)
            return
    state.upsert_category(slug, listing_status="done")


# ------------------------------------------------------------------ frame: one paginated list
def _collect_pages(ctx: Ctx, cat: dict[str, Any], layout: dict[str, Any]) -> None:
    scope, state, base, slug = ctx.settings.scope, ctx.state, ctx.base_url, cat["slug"]
    first_url = normalize_url(layout["first"].format(base=base, slug=slug), base)
    res = ctx.fetcher.fetch(first_url, "listing")
    if not res.ok or not res.body:
        n = _count_try(ctx, slug)
        log.warning("Category %s: first listing page unavailable (%s); try %d of %d.", slug, res.outcome, n,
                    MAX_CATEGORY_TRIES)
        return
    lp1 = parse_listing_page(res.body, res.final_url or first_url, base)
    _store(ctx, slug, lp1, 1)
    per_page = max(len(lp1.stubs), 1)
    target = _target(ctx)
    rng = random.Random(f"{scope.random_seed}:{slug}:plan")
    if layout["paging"] == "numbered":
        total = lp1.max_page
        plan = plan_pages(total, per_page, target, scope.listing_strategy, scope.max_listing_pages_per_category, rng)
    elif layout["paging"] == "sequential":
        total = None
        n_needed = max(math.ceil(target / per_page), MIN_CLUSTERS)
        cap = scope.max_listing_pages_per_category or (10_000 if scope.listing_strategy == "all" else n_needed)
        plan = list(range(1, cap + 1))
    else:
        total, plan = 1, [1]

    def page_url(n: int) -> str:
        return first_url if n == 1 else normalize_url(layout["page"].format(base=base, slug=slug, n=n), base)

    est_total = lp1.total_items or (total * per_page if total else None)
    state.upsert_category(slug, total_pages=total, stories_per_page=per_page, total_stories_reported=est_total,
                          page_url_template=layout.get("page"),
                          listing_plan_json=json.dumps([page_url(n) for n in plan]), listing_status="planned")
    log.info("Category %s: %s listing pages, ~%s stories/page; reading %d page(s).", slug,
             total if total else "unknown number of", per_page, len(plan))
    seen = {s["story_slug"] for s in lp1.stubs}
    missing = 0
    read = [1]
    for n in plan:
        if n == 1:
            continue
        r = ctx.fetcher.fetch(page_url(n), "listing")
        if not r.ok or not r.body:
            if layout["paging"] == "sequential" and (r.outcome == "gone" or r.detail == "no_content"):
                break  # past the end of the list
            if r.outcome != "gone":
                missing += 1
            continue
        lp = parse_listing_page(r.body, r.final_url or page_url(n), base)
        _store(ctx, slug, lp, n)
        read.append(n)
        new = {s["story_slug"] for s in lp.stubs} - seen
        seen |= new
        if layout["paging"] == "sequential":
            if not new:
                break  # an empty page, or the site repeating its last page: the end of the list
            if scope.listing_strategy != "all" and len(seen) >= target:
                break
    if layout["paging"] == "sequential":
        state.upsert_category(slug, listing_plan_json=json.dumps([page_url(n) for n in read]))
    if missing:
        n = _count_try(ctx, slug)
        log.warning("Category %s: %d listing page(s) could not be read; they will be retried (try %d of %d).",
                    slug, missing, n, MAX_CATEGORY_TRIES)
        if n < MAX_CATEGORY_TRIES:
            return
    state.upsert_category(slug, listing_status="done")


def collect_category_listing(ctx: Ctx, cat: dict[str, Any], layout: dict[str, Any]) -> None:
    if layout.get("frame") == "letters":
        _collect_letters(ctx, cat, layout)
    else:
        _collect_pages(ctx, cat, layout)


def collect_listings(ctx: Ctx, cats: list[dict[str, Any]]) -> None:
    pending = [c for c in cats if c["listing_status"] != "done" and _tries(ctx, c["slug"]) < MAX_CATEGORY_TRIES]
    if not pending:
        return
    layout = ensure_listing_layout(ctx, pending)
    if layout is None:
        return
    pending = [c for c in ctx.state.categories(selected_only=True)
               if c["listing_status"] != "done" and _tries(ctx, c["slug"]) < MAX_CATEGORY_TRIES]
    for i, cat in enumerate(pending, 1):
        log.info("Listing pages for category %d/%d: %s", i, len(pending), cat["slug"])
        collect_category_listing(ctx, cat, layout)
