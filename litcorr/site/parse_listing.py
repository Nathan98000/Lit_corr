"""Parse a category listing page into story "stubs" (the sampling frame).

Strategies, in order of preference (the strategy is recorded per stub):

  js_list   the page's embedded main list: the ``data`` array that sits next to
            ``current_page/last_page/total`` in the serialized page data
  cards     story cards in the HTML (hashed CSS classes such as ``_works_item_``)
  legacy    the classic Literotica list markup (``b-sl-item``, ``td.mcol`` ...)
  links     last resort: story links in the main content, outside navigation and
            sidebars ("hot", "popular", "related" ...), so the frame is not
            biased toward already-popular stories

Pagination is detected from the page's own links (``?page=N`` or ``/N-page``)
and/or the embedded ``last_page`` value, never guessed.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import parse_qsl, unquote, urljoin, urlsplit

from bs4 import BeautifulSoup, Tag

from .jsdata import JSData
from .parse_common import clean_text, make_soup, page_jsdata, parse_count, parse_date, parse_float, text_of
from .urls import category_slug_from_url, normalize_url, page_number, story_slug

_SIDEBAR = re.compile(
    r"(?:^|[_\-\s])(sidebar|aside|popular|featured|trending|hot|top|related|recommend(?:ed|ations)?|promo|"
    r"footer|header|nav|navbar|menu)(?=[_\-\s]|$)",
    re.I,
)
_SLUG_OK = re.compile(r"^[a-z0-9][a-z0-9_-]*$")


@dataclass
class ListingPage:
    url: str
    category_slug: str | None
    page_no: int
    stubs: list[dict[str, Any]] = field(default_factory=list)
    max_page: int | None = None
    page_url_template: str | None = None
    total_items: int | None = None
    per_page: int | None = None
    strategy: str | None = None
    browse_segments: list[str] = field(default_factory=list)  # A-Z / * browse-by-title links, in page order
    category_sizes: dict[str, int] = field(default_factory=dict)  # embedded submission_count per category slug
    letter_nav: dict[str, Any] = field(default_factory=dict)  # prev/next/last pages of the browse-by-title sequence
    diagnostics: dict[str, Any] = field(default_factory=dict)


_BROWSE_SEGMENT = re.compile(r"^(?:[A-Za-z0-9]|\*|%2[Aa]|#|%23|0-9)$")
_LETTER_PAGE = re.compile(r"^/c/([^/]+)/([^/]+?)(?:-(\d+))?/?$")


def letter_nav(soup: BeautifulSoup, page_url: str, category_slug: str | None) -> dict[str, Any]:
    """Read the pagination bar of a browse-by-title page.

    Literotica numbers a category's title index as one sequence of pages addressed by letter:
    ``/c/<slug>/*``, ``/c/<slug>/A``, ``/c/<slug>/A-2`` ... ``/c/<slug>/Z``. The bar links to the
    previous and next pages (the previous page of a letter's first page is the LAST page of the
    previous letter, e.g. ``R-8``), the first and last pages, and shows the current page's position.
    Returns {prev, next, first, last: (letter, n) or None, active_number, max_number: int or None}.
    """
    out: dict[str, Any] = {"prev": None, "next": None, "first": None, "last": None,
                           "active_number": None, "max_number": None}
    if not category_slug:
        return out
    nav = soup.select_one('nav[class*="pagination"]')
    if nav is None:
        return out
    numbered: list[tuple[str, int, int | None]] = []
    for el in nav.find_all(["a", "span"]):
        cls = " ".join(el.get("class") or [])
        txt = text_of(el).replace(",", "")
        if el.name == "span" and "active" in cls and txt.isdigit():
            out["active_number"] = int(txt)
        if el.name != "a" or not el.get("href"):
            continue
        m = _LETTER_PAGE.match(unquote(urlsplit(urljoin(page_url, el["href"])).path))
        if not m or m.group(1).lower() != category_slug.lower() or not _BROWSE_SEGMENT.match(m.group(2)):
            continue
        pos = (m.group(2), int(m.group(3) or 1))
        label = " ".join([cls, el.get("title") or "", el.get("aria-label") or "", " ".join(el.get("rel") or [])]).lower()
        if "prev" in label:
            out["prev"] = pos
        elif "next" in label:
            out["next"] = pos
        else:
            numbered.append((pos[0], pos[1], int(txt) if txt.isdigit() else None))
    if numbered:
        out["first"] = numbered[0][:2]
        out["last"] = max(numbered, key=lambda t: t[2] if t[2] is not None else -1)[:2]
        nums = [t[2] for t in numbered if t[2] is not None] + ([out["active_number"]] if out["active_number"] else [])
        out["max_number"] = max(nums) if nums else None
    return out


def browse_segments(soup: BeautifulSoup, page_url: str, category_slug: str | None) -> list[str]:
    """Path segments of the category's browse-by-title links (``/c/<slug>/A``, ``/c/<slug>/*``)."""
    if not category_slug:
        return []
    out: list[str] = []
    for a in soup.find_all("a", href=True):
        path = urlsplit(urljoin(page_url, a["href"])).path
        prefix = f"/c/{category_slug}/"
        if not path.lower().startswith(prefix):
            continue
        seg = unquote(path[len(prefix):].strip("/"))
        if _BROWSE_SEGMENT.match(seg) and seg not in out:
            out.append(seg)
    return out


def _stub(slug: str, url: str, strategy: str, **kw: Any) -> dict[str, Any]:
    d = {"story_slug": slug, "url": url, "strategy": strategy, "title": None, "author": None, "description": None,
         "date_text": None, "rating_text": None, "views_text": None, "category_hint": None, "extra": {}}
    d.update({k: v for k, v in kw.items() if v not in (None, "")})
    return d


# ------------------------------------------------------------------ embedded
def _stub_from_js(js: JSData, d: dict[str, Any], base_url: str, strategy: str) -> dict[str, Any] | None:
    R = js.resolve
    u = R(d.get("url"))
    if not isinstance(u, str):
        return None
    slug = u.strip("/").rsplit("/", 1)[-1].lower()
    typ = R(d.get("type"))
    if not _SLUG_OK.match(slug) or (isinstance(typ, str) and typ.lower() not in ("story", "")):
        return None
    if d.get("work_count") is not None or R(d.get("parts")) is not None:
        return None  # a series wrapper, not a story
    title = R(d.get("title"))
    if not isinstance(title, str):
        return None
    ci = R(d.get("category_info"))
    cat = R(ci.get("pageUrl")) if isinstance(ci, dict) else None
    author = R(d.get("authorname"))
    if author is None and isinstance(R(d.get("author")), dict):
        author = R(R(d.get("author")).get("username"))
    extra = {}
    for k in ("id", "view_count", "favorite_count", "comment_count", "rate_all", "words_count", "is_hot",
              "writers_pick", "reading_lists_count"):
        v = R(d.get(k))
        if isinstance(v, (int, float, bool)):
            extra[k] = v
    desc = R(d.get("description"))
    return _stub(
        slug, normalize_url(f"/s/{slug}", base_url), strategy,
        title=clean_text(title), author=clean_text(str(author)) if author is not None else None,
        description=clean_text(desc) if isinstance(desc, str) else None,
        date_text=parse_date(R(d.get("date_approve"))) or R(d.get("date_approve")),
        rating_text=str(R(d.get("rate_all"))) if R(d.get("rate_all")) is not None else None,
        views_text=str(R(d.get("view_count"))) if R(d.get("view_count")) is not None else None,
        category_hint=cat.lower() if isinstance(cat, str) else None, extra=extra,
    )


def _from_js(js: JSData, base_url: str) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    R = js.resolve
    pager = None
    main: list[dict[str, Any]] = []
    for d in js.iter_dicts():
        if "last_page" in d and "current_page" in d:
            items = R(d.get("data"))
            if isinstance(items, list) and (pager is None or len(items) > len(main)):
                pager = {k: R(d.get(k)) for k in ("current_page", "last_page", "total", "per_page")}
                main = []
                for it in items:
                    it = R(it)
                    if isinstance(it, dict):
                        s = _stub_from_js(js, it, base_url, "js_list")
                        if s:
                            main.append(s)
            elif pager is None:
                pager = {k: R(d.get(k)) for k in ("current_page", "last_page", "total", "per_page")}
    return main, pager


def js_lists(js: JSData) -> list[dict[str, Any]]:
    """Every paginated list embedded in the page: its page numbers, total and length (numbers only)."""
    R = js.resolve
    out = []
    for d in js.iter_dicts():
        if "current_page" in d or "last_page" in d or ("total" in d and "data" in d):
            items = R(d.get("data"))
            out.append({k: R(d.get(k)) for k in ("current_page", "last_page", "total", "per_page")
                        if isinstance(R(d.get(k)), (int, float))} | {"items": len(items) if isinstance(items, list) else None})
    return out


def category_sizes(js: JSData) -> dict[str, int]:
    """Embedded category objects ({pageUrl, submission_count}): number of submissions per category slug."""
    R = js.resolve
    out: dict[str, int] = {}
    for d in js.iter_dicts():
        pu, n = R(d.get("pageUrl")), R(d.get("submission_count"))
        if isinstance(pu, str) and isinstance(n, int) and not isinstance(n, bool) and n >= 0:
            out[pu.strip("/").lower()] = n
    return out


def _js_any(js: JSData, base_url: str) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for d in js.iter_dicts():
        if "url" in d and "title" in d and ("date_approve" in d or "category_info" in d or "rate_all" in d):
            s = _stub_from_js(js, d, base_url, "js_any")
            if s:
                out.setdefault(s["story_slug"], s)
    return out


# ----------------------------------------------------------------------- DOM
def _in_sidebar(el: Tag) -> bool:
    for parent in [el, *el.parents]:
        if not isinstance(parent, Tag):
            continue
        if parent.name in ("nav", "aside", "header", "footer"):
            return True
        ident = " ".join(parent.get("class") or []) + " " + (parent.get("id") or "")
        if ident.strip() and _SIDEBAR.search(ident):
            return True
    return False


def _story_link(card: Tag, base_url: str) -> tuple[str, str, Tag] | None:
    for sel in ('a[class*="_item_title_"]', 'a[class*="_title_link_"]', 'a[class*="_title_"]', "h3 a", "h2 a",
                'a[href*="/s/"]'):
        a = card.select_one(sel)
        if a is not None and a.get("href"):
            url = normalize_url(urljoin(base_url + "/", a["href"]), base_url)
            slug = story_slug(url)
            if slug:
                return slug, url, a
    return None


def _card_stats(card: Tag) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for el in card.select('[class*="_view_stat_"][title]'):
        kind, val = (el.get("title") or "").strip().lower(), el.get("data-value") or text_of(el)
        if kind == "rating":
            out["rating_text"] = val
        elif kind == "views":
            out["views_text"] = val
    for el in card.select('[class*="_work_item__stat_"], [class*="_stats__item_"]'):
        t = text_of(el)
        if "rating" in t.lower() or el.select_one('[class*="_star_"]'):
            r = parse_float(t)
            if r and 0 < r <= 5:
                out.setdefault("rating_text", str(r))
        elif "view" in t.lower() or el.select_one('[class*="_diagram_"], [class*="_eye_"]'):
            out.setdefault("views_text", t)
    return out


def _from_cards(soup: BeautifulSoup, base_url: str) -> list[dict[str, Any]]:
    cards = [el for el in soup.find_all(["article", "div", "li"])
             if any(any(f in c for f in ("_works_item_", "_work_item_", "_card_", "_story_item_")) for c in
                    (el.get("class") or []))]
    cards = [c for c in cards if not any(c is not o and c in o.descendants for o in cards)]
    out = []
    for card in cards:
        if _in_sidebar(card):
            continue
        hit = _story_link(card, base_url)
        if not hit:
            continue
        slug, url, a = hit
        desc = card.select_one('[class*="_item_description_"], p[class*="_description_"], [class*="_desc"]')
        auth = card.select_one('a[class*="_item_authorname_link_"], a[class*="_author_link_"], a[href*="/authors/"]')
        date = card.select_one('time[datetime], [class*="_date_approve_"], [class*="_date_"]')
        cat_a = card.select_one('a[href*="/c/"]')
        date_val = None
        if date is not None:
            date_val = parse_date(date.get("datetime")) or parse_date(text_of(date)) or text_of(date)
        out.append(_stub(slug, url, "cards", title=text_of(a), author=text_of(auth) if auth else None,
                         description=text_of(desc) if desc else None, date_text=date_val,
                         category_hint=category_slug_from_url(cat_a["href"]) if cat_a else None, **_card_stats(card)))
    return out


def _from_legacy(soup: BeautifulSoup, base_url: str) -> list[dict[str, Any]]:
    out = []
    for row in soup.select("div.b-sl-item-r, div.b-story-list-box, table.tbl tr, div.b-story-list > div"):
        hit = _story_link(row, base_url)
        if not hit:
            continue
        slug, url, a = hit
        desc = row.select_one("span.b-sli-description, span.des, .b-story-list-box p")
        auth = row.select_one('span.b-sli-author a, a[href*="/authors/"], a[href*="memberpage"]')
        date = row.select_one("span.b-sli-date, td.dt")
        rating = row.select_one("span.b-sli-rating, td.ratecount span")
        out.append(_stub(slug, url, "legacy", title=text_of(a), author=text_of(auth) if auth else None,
                         description=(desc.get("title") or text_of(desc)) if desc else None,
                         date_text=(parse_date(text_of(date)) or text_of(date)) if date else None,
                         rating_text=text_of(rating) if rating else None))
    return out


def _from_links(soup: BeautifulSoup, base_url: str) -> list[dict[str, Any]]:
    root = soup.select_one("main") or soup.body or soup
    out, seen = [], set()
    for a in root.find_all("a", href=True):
        url = normalize_url(urljoin(base_url + "/", a["href"]), base_url)
        slug = story_slug(url)
        if not slug or slug in seen or _in_sidebar(a):
            continue
        seen.add(slug)
        out.append(_stub(slug, url, "links", title=text_of(a) or None))
    return out


# ----------------------------------------------------------------- pagination
def detect_pagination(soup: BeautifulSoup, page_url: str, category_slug: str | None) -> tuple[int | None, str | None]:
    pages: dict[int, str] = {}
    for a in soup.find_all("a", href=True):
        url = normalize_url(urljoin(page_url, a["href"]))
        if category_slug and category_slug_from_url(url) != category_slug:
            continue
        parts = urlsplit(url)
        n = None
        for k, v in parse_qsl(parts.query):
            if k == "page" and v.isdigit():
                n = int(v)
        m = re.search(r"/(\d+)-page$", parts.path)
        if m:
            n = int(m.group(1))
        if n and n < 100_000:
            pages[n] = url
    if not pages:
        return None, None
    n, example = max(pages.items())
    if re.search(rf"/{n}-page$", urlsplit(example).path):
        template = re.sub(rf"/{n}-page$", "/{n}-page", example)
    else:
        template = re.sub(rf"([?&])page={n}(?=&|$)", r"\1page={n}", example)
    return max(pages), template


def parse_listing_page(html: str, url: str, base_url: str) -> ListingPage:
    soup = make_soup(html)
    cat = category_slug_from_url(url)
    lp = ListingPage(url=url, category_slug=cat, page_no=page_number(url))
    js = page_jsdata(soup)
    main, pager = _from_js(js, base_url)
    extra_js = _js_any(js, base_url)
    cards = _from_cards(soup, base_url)
    if main and cards:
        # Trust the embedded list only if it IS the visible list (mostly the same stories, not shorter);
        # otherwise it is some other list on the page (e.g. a sidebar) and the visible cards win.
        card_slugs = {s["story_slug"] for s in cards}
        overlap = sum(1 for s in main if s["story_slug"] in card_slugs) / len(main)
        if overlap < 0.5 or len(cards) > len(main):
            main, pager = [], None
    legacy = [] if (main or cards) else _from_legacy(soup, base_url)
    links = [] if (main or cards or legacy) else _from_links(soup, base_url)

    for strategy, stubs in (("js_list", main), ("cards", cards), ("legacy", legacy), ("links", links)):
        if stubs:
            lp.strategy, lp.stubs = strategy, stubs
            break
    # Enrich chosen stubs with any extra details found by other strategies.
    by_slug = {s["story_slug"]: s for s in cards}
    for s in lp.stubs:
        for other in (by_slug.get(s["story_slug"]), extra_js.get(s["story_slug"])):
            if other and other is not s:
                for k, v in other.items():
                    if k == "extra":
                        for ek, ev in v.items():
                            s["extra"].setdefault(ek, ev)
                    elif s.get(k) in (None, "") and v not in (None, ""):
                        s[k] = v
    # Deduplicate, keep order.
    seen: set[str] = set()
    lp.stubs = [s for s in lp.stubs if not (s["story_slug"] in seen or seen.add(s["story_slug"]))]
    for i, s in enumerate(lp.stubs):
        s["position"] = i

    lp.browse_segments = browse_segments(soup, url, cat)
    lp.category_sizes = category_sizes(js)
    lp.letter_nav = letter_nav(soup, url, cat)
    if any(lp.letter_nav.get(k) for k in ("prev", "next", "first", "last")):
        pager = None  # the site's own page bar is authoritative; embedded list numbers describe other lists
    dom_max, template = detect_pagination(soup, url, cat)
    js_last = pager.get("last_page") if pager else None
    lp.max_page = max([x for x in (dom_max, js_last if isinstance(js_last, int) else None) if x] or [0]) or None
    lp.page_url_template = template
    if pager:
        lp.total_items = pager.get("total") if isinstance(pager.get("total"), int) else None
        lp.per_page = pager.get("per_page") if isinstance(pager.get("per_page"), int) else None
    lp.diagnostics = {
        "js_lists": js_lists(js),
        "story_link_hrefs": len(re.findall(r'href="[^"]*/s/[^"]+"', html)),
        "stubs_js_list": len(main), "stubs_cards": len(cards), "stubs_legacy": len(legacy),
        "stubs_links": len(links), "js_story_objects": len(extra_js), "pagination_links_max": dom_max,
        "js_pager": pager, "template": template, "browse_segments": len(lp.browse_segments),
        "letter_nav": lp.letter_nav,
    }
    return lp
