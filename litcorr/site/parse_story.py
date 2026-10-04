"""Parse one page of a Literotica story (``/s/<slug>`` or ``/s/<slug>?page=N``).

Each field is taken from the most precise source available, and the source is
recorded:

  embedded  the page's own serialized data (exact numbers, e.g. view_count)
  jsonld    schema.org JSON-LD metadata
  dom       visible page elements (stats may be abbreviated, e.g. "12.3k")
  meta      <meta> tags

Only publicly displayed story information is kept. Of the author object
embedded in the page, only an explicit allow-list is read (public username and
numeric id, and public story/follower counts); profile details such as
location, age, orientation or biography are never stored.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import parse_qsl, urlsplit

from bs4 import BeautifulSoup, CData, NavigableString, Tag

from .jsdata import JSData
from .parse_common import (
    clean_text,
    jsonld_objects,
    ld_type_is,
    make_soup,
    meta_content,
    page_jsdata,
    parse_count,
    parse_date,
    parse_float,
    text_of,
)
from .urls import category_slug_from_url, page_number, series_id, story_slug

SUBMISSION_KEYS = frozenset({
    "date_approve", "view_count", "favorite_count", "comment_count", "rate_all", "words_count",
    "reading_lists_count", "category_info", "authorname", "allow_vote", "is_hot", "writers_pick",
    "tags", "description", "contest_winner", "reading_time", "enable_comments",
})
RATING_COUNT_KEYS = ("rate_count", "rates_count", "votes_count", "vote_count", "ratings_count", "num_votes")
AUTHOR_KEEP = {  # embedded author key -> our field
    "userid": "author_id", "user_id": "author_id", "username": "author_name",
    "stories_count": "author_stories_count", "submissions_count": "author_submissions_count",
    "followers_count": "author_followers_count", "joindate": "author_joindate",
}

CONTENT_SELECTORS = (
    'div[itemprop="articleBody"]',
    'div[class*="_article__content_"]',
    "div.aa_ht",
    'div[class*="b-story-body"]',
)
_STRIP_INSIDE = ("script", "style", "noscript", "iframe", "button", "form", "nav", "aside", "svg", "img",
                 "picture", "figure", "video", "audio", "select", "input", "textarea", "header", "footer")
_NON_STORY_CLASS = re.compile(r"(^|_)(report|advert|ads?|banner|share|widget|vote|rating)(_|$)", re.I)
_AWAITING = re.compile(r"awaiting (?:a )?moderator'?s? approval", re.I)
_TITLE_SUFFIX = re.compile(r"\s*[-|–]\s*Literotica(\.com)?\s*$", re.I)


@dataclass
class StoryPage:
    url: str
    slug: str | None
    page_no: int
    status: str = "ok"  # ok | unavailable | malformed
    paragraphs: list[str] = field(default_factory=list)
    em_count: int = 0
    strong_count: int = 0
    max_page: int | None = None
    fields: dict[str, Any] = field(default_factory=dict)
    sources: dict[str, str] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    text_source: str | None = None

    def set(self, name: str, value: Any, source: str) -> None:
        if value is None or value == "" or value == []:
            return
        if name not in self.fields:
            self.fields[name] = value
            self.sources[name] = source

    def set_count(self, name: str, value: int | None, approx: bool, source: str) -> None:
        """Counts: exact values beat abbreviated ('12.3k') ones from any source."""
        if value is None or value < 0:
            return
        current_approx = self.fields.get(f"{name}_approx")
        if name not in self.fields or (current_approx and not approx):
            self.fields[name] = int(value)
            self.fields[f"{name}_approx"] = bool(approx)
            self.sources[name] = source


# ----------------------------------------------------------------- embedded
def _finite_int(v: Any) -> int | None:
    """An int for finite numbers; None for booleans, NaN, Infinity and non-numbers."""
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    return int(v) if math.isfinite(v) else None


def _slug_of(value: Any) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    v = value.strip()
    if "/" in v:
        v = urlsplit(v).path.rstrip("/").rsplit("/", 1)[-1]
    return v.lower()


def find_submission(js: JSData, slug: str | None) -> dict[str, Any] | None:
    best, best_score = None, 0
    for d in js.iter_dicts():
        if "url" not in d:
            continue
        s = _slug_of(js.resolve(d.get("url")))
        if s is None or (slug and s != slug):
            continue
        score = sum(1 for k in SUBMISSION_KEYS if k in d) + (1 if "title" in d else 0)
        if score > best_score:
            best, best_score = d, score
    return best if best_score >= 3 else None


def _from_embedded(sp: StoryPage, js: JSData) -> str | None:
    """Fill fields from the embedded submission object. Returns embedded pageText if present."""
    sub = find_submission(js, sp.slug)
    if sub is None:
        return None
    R = js.resolve
    src = "embedded"
    sp.set("lit_id", R(sub.get("id")) if isinstance(R(sub.get("id")), int) else None, src)
    sp.set("title", clean_text(R(sub.get("title"))) or None, src)
    sp.set("description", clean_text(R(sub.get("description"))) or None, src)
    sp.set("date_published", parse_date(R(sub.get("date_approve"))), src)
    rating = parse_float(R(sub.get("rate_all")))
    sp.set("rating", rating if rating else None, src)  # 0 means "no ratings yet" on the site
    for key in RATING_COUNT_KEYS:
        v = _finite_int(R(sub.get(key)))
        if v is not None:
            sp.set_count("rating_count", v, False, src)
            break
    for key, name in (("view_count", "views"), ("favorite_count", "favorites"), ("comment_count", "comments"),
                      ("reading_lists_count", "reading_lists")):
        sp.set_count(name, _finite_int(R(sub.get(key))), False, src)
    for key, name in (("words_count", "site_words_count"), ("reading_time", "site_reading_time")):
        sp.set(name, _finite_int(R(sub.get(key))), src)
    for key, name in (("is_hot", "is_hot"), ("is_new", "is_new"), ("writers_pick", "writers_pick"),
                      ("contest_winner", "contest_winner"), ("enable_comments", "comments_enabled"),
                      ("allow_vote", "voting_enabled")):
        v = R(sub.get(key))
        if v is not None:
            sp.set(name, bool(v), src)
    for key, name in (("type", "work_type"), ("status", "work_status")):
        v = R(sub.get(key))
        if isinstance(v, str):
            sp.set(name, v, src)
    lang = R(sub.get("language"))
    if isinstance(lang, int):
        sp.set("language_id", lang, src)
    cat_id = R(sub.get("category"))
    if isinstance(cat_id, int):
        sp.set("category_site_id", cat_id, src)
    ci = R(sub.get("category_info"))
    if isinstance(ci, dict):
        sp.set("category_name", clean_text(R(ci.get("name"))) or None, src)
        pu = R(ci.get("pageUrl"))
        sp.set("category_slug", pu.strip("/").lower() if isinstance(pu, str) else None, src)
        if isinstance(R(ci.get("id")), int):
            sp.set("category_site_id", R(ci.get("id")), src)
    an = R(sub.get("authorname"))
    if isinstance(an, (str, int)) and not isinstance(an, bool):
        sp.set("author_name", clean_text(str(an)), src)
    author = R(sub.get("author"))
    if isinstance(author, dict):
        for key, name in AUTHOR_KEEP.items():
            v = R(author.get(key))
            if name == "author_joindate":
                sp.set(name, parse_date(v), src)
            elif name == "author_name":
                sp.set(name, clean_text(str(v)) if isinstance(v, (str, int)) and not isinstance(v, bool) else None, src)
            else:
                sp.set(name, _finite_int(v), src)
    tags = R(sub.get("tags"))
    if isinstance(tags, list):
        names = []
        for t in tags:
            t = R(t)
            name = clean_text(R(t.get("tag")) if isinstance(t, dict) else t)  # a tag may be stored as a number
            if name:
                names.append(name.lower())
        sp.set("tags", sorted(set(names)), src)
    series = R(sub.get("series"))
    if isinstance(series, dict):
        meta = R(series.get("meta"))
        items = R(series.get("items"))
        if isinstance(meta, dict):
            sid = R(meta.get("id"))
            sp.set("series_id", str(sid) if sid is not None else None, src)
            sp.set("series_title", clean_text(R(meta.get("title"))) or None, src)
        if isinstance(items, list) and items:
            ids = []
            for it in items:
                it = R(it)
                if isinstance(it, dict):
                    ids.append((R(it.get("id")), _slug_of(R(it.get("url")))))
            sp.set("series_parts_count", len(ids), src)
            for i, (iid, iurl) in enumerate(ids, start=1):
                if (sp.slug and iurl == sp.slug) or (iid is not None and iid == sp.fields.get("lit_id")):
                    sp.set("series_part_index", i, src)
                    break
    # Parent object {meta: {pages_count}, submission: ..., pageText: ...}
    page_text = None
    for d in js.iter_dicts():
        if "submission" in d and R(d.get("submission")) is sub:
            meta = R(d.get("meta"))
            if isinstance(meta, dict):
                pc = R(meta.get("pages_count"))
                if isinstance(pc, int) and pc > 0:
                    sp.set("pages_count", pc, src)
            pt = R(d.get("pageText"))
            if isinstance(pt, str) and pt.strip():
                page_text = pt
            break
    return page_text


# ------------------------------------------------------------------- JSON-LD
def _ld_author(a: Any) -> str | None:
    if isinstance(a, list):
        names = [n for n in (_ld_author(x) for x in a) if n]
        return ", ".join(names) or None
    if isinstance(a, dict):
        return clean_text(a.get("name")) or None
    return clean_text(a) if isinstance(a, str) else None


def _from_jsonld(sp: StoryPage, objs: list[dict[str, Any]]) -> None:
    src = "jsonld"
    for o in objs:
        if not ld_type_is(o, "Article", "CreativeWork", "BlogPosting", "NewsArticle", "Book", "ShortStory"):
            continue
        sp.set("title", clean_text(o.get("headline") or o.get("name")) or None, src)
        sp.set("author_name", _ld_author(o.get("author")), src)
        sp.set("date_published", parse_date(o.get("datePublished")), src)
        sp.set("description", clean_text(o.get("description")) or None, src)
        kw = o.get("keywords")
        if isinstance(kw, str):
            kw = kw.split(",")
        elif kw is not None and not isinstance(kw, list):
            kw = [kw]  # a single keyword stored as a number or an object
        if isinstance(kw, list):
            tags = sorted({clean_text(k.get("name") if isinstance(k, dict) else k).lower() for k in kw} - {""})
            sp.set("tags", tags, src)
        # JSON-LD genre/articleSection is not used: Literotica labels every story "Erotica" there, which is not
        # its category. The category comes from the embedded data (slug) and the breadcrumbs (name).
        ar = o.get("aggregateRating")
        if isinstance(ar, dict):
            r = parse_float(ar.get("ratingValue"))
            sp.set("rating", r if r else None, src)
            rc, _ = parse_count(ar.get("ratingCount") or ar.get("reviewCount"))
            sp.set_count("rating_count", rc, False, src)
        wc, _ = parse_count(o.get("wordCount"))
        sp.set("site_words_count", wc, src)
        cc, _ = parse_count(o.get("commentCount"))
        sp.set_count("comments", cc, False, src)
        stats = o.get("interactionStatistic")
        for st in stats if isinstance(stats, list) else [stats] if isinstance(stats, dict) else []:
            if not isinstance(st, dict):
                continue
            it = st.get("interactionType")
            it = str((it.get("@type") if isinstance(it, dict) else it) or "").lower()
            n, _ = parse_count(st.get("userInteractionCount"))
            if "read" in it or "view" in it or "watch" in it:
                sp.set_count("views", n, False, src)
            elif "like" in it or "bookmark" in it or "favorite" in it:
                sp.set_count("favorites", n, False, src)
            elif "comment" in it:
                sp.set_count("comments", n, False, src)


# ----------------------------------------------------------------------- DOM
def _icon_kind(el: Tag) -> str | None:
    blob = " ".join(
        " ".join(x.get("class") or []) + " " + (x.get("title") or "") + " " + (x.get("aria-label") or "")
        for x in [el, *el.find_all(True)]
    ).lower()
    if any(k in blob for k in ("_star_", "rating", "star")):
        return "rating"
    if any(k in blob for k in ("_diagram_", "views", "view", "_eye_", "reads")):
        return "views"
    if any(k in blob for k in ("_heart_", "favorite", "favourite", "heart")):
        return "favorites"
    if any(k in blob for k in ("_comment_", "comment")):
        return "comments"
    if any(k in blob for k in ("reading list", "_list_", "bookmark")):
        return "reading_lists"
    return None


def _stats_from_dom(sp: StoryPage, soup: BeautifulSoup) -> None:
    src = "dom"
    items = soup.select('[class*="_stats__item_"]')
    for item in items:
        kind = _icon_kind(item)
        txt = text_of(item)
        if not kind or not txt:
            continue
        if kind == "rating":
            r = parse_float(txt)
            if r is not None and 0 < r <= 5:
                sp.set("rating", r, src)
        else:
            n, approx = parse_count(txt)
            sp.set_count(kind, n, approx, src)
    for el in soup.select('[class*="_view_stat_"][title]'):
        kind = (el.get("title") or "").strip().lower()
        val = el.get("data-value") or text_of(el)
        if kind == "rating":
            r = parse_float(val)
            if r and 0 < r <= 5:
                sp.set("rating", r, src)
        elif kind in ("views", "favorites", "comments"):
            n, approx = parse_count(val)
            sp.set_count(kind, n, approx, src)


def _category_from_breadcrumbs(sp: StoryPage, soup: BeautifulSoup) -> None:
    crumbs = (soup.select_one('nav[class*="_breadcrumbs_"]') or soup.select_one('ul[class*="_breadcrumbs_list_"]')
              or soup.select_one("div#BreadCrumbComponent") or soup.select_one('[itemtype*="BreadcrumbList"]'))
    if crumbs is None:
        return
    for a in crumbs.find_all("a", href=True):
        slug = category_slug_from_url(a["href"])
        if slug:
            sp.set("category_slug", slug, "dom")
            sp.set("category_name", text_of(a) or None, "dom")
            return
    names = [text_of(x) for x in crumbs.select('[itemprop="name"]')] or [text_of(x) for x in crumbs.find_all("a")]
    names = [n for n in names if n and n.lower() not in ("home", "literotica", "stories")]
    if names:
        sp.set("category_name", names[0], "dom")


def _tags_from_dom(soup: BeautifulSoup) -> list[str]:
    sel = ('a[class*="_tags__link_"], a[class*="_tag_item_"], div#tabpanel-tags a, '
           'div[data-tab="tabpanel-tags"] a, a[href*="tags.literotica.com"], a[href^="/tags/"]')
    tags = {text_of(a).lower() for a in soup.select(sel)}
    return sorted(t for t in tags if t and len(t) <= 60)


def _max_page_from_dom(soup: BeautifulSoup, slug: str | None) -> int | None:
    best = None
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "page=" not in href:
            continue
        parts = urlsplit(href)
        if parts.path not in ("", ".") and story_slug(parts.path) != slug:
            continue  # a link to some other page, not another page of this story
        for k, v in parse_qsl(parts.query):
            if k == "page" and v.isdigit():
                n = int(v)
                if 1 <= n <= 1000:
                    best = max(best or 1, n)
    return best


def _from_dom(sp: StoryPage, soup: BeautifulSoup) -> None:
    src = "dom"
    h1 = soup.find("h1")
    sp.set("title", text_of(h1) or None, src)
    author_a = (soup.select_one('a[class*="_author__title"]') or soup.select_one("a.y_eU")
                or soup.select_one('header a[href*="/authors/"]') or soup.select_one('a[href*="/authors/"]')
                or soup.select_one('a[href*="memberpage.php"]'))
    if author_a is not None:
        sp.set("author_name", text_of(author_a) or None, src)
        href = author_a.get("href") or ""
        m = re.search(r"/authors/([^/?#]+)", href) or re.search(r"[?&]uid=(\d+)", href)
        if m:
            sp.set("author_url_key", m.group(1), src)
    _category_from_breadcrumbs(sp, soup)
    tags = _tags_from_dom(soup)
    sp.set("tags", tags, src)
    _stats_from_dom(sp, soup)
    info = (soup.select_one('div[class*="_widget__info_"]') or soup.select_one("div#tabpanel-info div.bn_B")
            or soup.select_one('div[data-tab="tabpanel-info"] div'))
    if info is not None:
        sp.set("description", text_of(info) or None, src)
    for t in soup.select('[class*="_date_approve_"], [class*="_widget__info_"] time[datetime]'):
        sp.set("date_published", parse_date(t.get("datetime") or text_of(t)), src)
    a = soup.select_one('a[href*="/series/se/"]')
    if a is not None:
        m = re.search(r"/series/se/([\w-]+)", a["href"])
        sp.set("series_id", series_id(urlsplit(a["href"]).path) or (m.group(1) if m else None), src)


def _from_meta(sp: StoryPage, soup: BeautifulSoup) -> None:
    src = "meta"
    title = meta_content(soup, prop="og:title")
    if not title and soup.title is not None:
        title = clean_text(soup.title.get_text())
    if title:
        sp.set("title", _TITLE_SUFFIX.sub("", title) or None, src)
    sp.set("description", meta_content(soup, prop="og:description") or meta_content(soup, name="description"), src)
    sp.set("date_published", parse_date(meta_content(soup, prop="article:published_time")), src)
    sp.set("author_name", meta_content(soup, name="author"), src)
    kw = meta_content(soup, name="keywords")
    if kw:
        sp.set("tags", sorted({clean_text(k).lower() for k in kw.split(",")} - {""}), src)


# ----------------------------------------------------------------------- text
# Elements that start a new block of text. Everything else (em, strong, span, a, font, u, sup ...) is inline.
_BLOCK_TAGS = frozenset(
    "p div li ul ol dl dt dd h1 h2 h3 h4 h5 h6 blockquote pre table thead tbody tfoot tr td th caption section "
    "article main center hr address details summary figcaption".split())


def _split_block(text: str) -> list[str]:
    """One block of text. A blank line made with <br><br> inside it starts a new paragraph."""
    blocks = re.split(r"\n[ \t\u00a0]*\n", text)
    return [t for t in (clean_text(b.replace("\n", " ")) for b in blocks) if t]


def _block_texts(container: Tag) -> list[str]:
    """Paragraphs of a story body in document order: the text of every block element (<p>, list items,
    headings, block quotes, <div>s holding text directly ...) and of loose text between blocks. (Taking only the
    text inside <p> elements lost every list, heading or loose text run of bodies that mix them with <p>s.)"""
    for br in container.find_all("br"):
        br.replace_with(NavigableString("\n"))
    out: list[str] = []
    buf: list[str] = []

    def flush() -> None:
        if buf:
            out.extend(_split_block("".join(buf)))
            buf.clear()

    def walk(el: Tag) -> None:
        for ch in el.children:
            if isinstance(ch, NavigableString):
                if type(ch) is NavigableString or isinstance(ch, CData):  # not comments, doctypes ...
                    buf.append(str(ch))
            elif isinstance(ch, Tag):
                if ch.name in _BLOCK_TAGS:
                    flush()
                    walk(ch)
                    flush()
                else:
                    walk(ch)

    walk(container)
    flush()
    return out


def extract_paragraphs(root: Tag | BeautifulSoup) -> tuple[list[str], int, int]:
    """Return (paragraphs, number of <em>/<i>, number of <strong>/<b>) from the story body."""
    containers: list[Tag] = []
    for sel in CONTENT_SELECTORS:
        found = root.select(sel)
        if found:
            containers = [c for c in found if not any(c is not o and c in o.descendants for o in found)]
            break
    paragraphs: list[str] = []
    em = strong = 0
    for c in containers:
        for bad in c.find_all(_STRIP_INSIDE):
            bad.decompose()
        for bad in [el for el in c.find_all(True) if any(_NON_STORY_CLASS.search(x) for x in (el.get("class") or []))]:
            if not bad.decomposed:
                bad.decompose()
        em += len(c.find_all(["em", "i"]))
        strong += len(c.find_all(["strong", "b"]))
        if c.find("p") is not None:
            paragraphs.extend(_block_texts(c))
        else:
            for br in c.find_all("br"):
                br.replace_with(NavigableString("\n"))
            blocks = re.split(r"\n\s*\n", c.get_text(""))
            if len(blocks) <= 1:
                blocks = c.get_text("").split("\n")
            paragraphs.extend(t for t in (clean_text(b.replace("\n", " ")) for b in blocks) if t)
    return paragraphs, em, strong


def parse_story_page(html: str, url: str) -> StoryPage:
    soup = make_soup(html)
    sp = StoryPage(url=url, slug=story_slug(url), page_no=page_number(url))
    head_text = html[:200_000]
    if _AWAITING.search(head_text):
        sp.status = "unavailable"
        sp.warnings.append("awaiting_moderator_approval")
    js = page_jsdata(soup)
    page_text = _from_embedded(sp, js)
    _from_jsonld(sp, jsonld_objects(soup))
    _from_dom(sp, soup)
    _from_meta(sp, soup)

    dom_max = _max_page_from_dom(soup, sp.slug)
    candidates = [x for x in (sp.fields.get("pages_count"), dom_max, sp.page_no) if x]
    sp.max_page = max(candidates) if candidates else 1

    paragraphs, em, strong = extract_paragraphs(soup)
    sp.text_source = "dom" if paragraphs else None
    if not paragraphs and page_text:
        paragraphs, em, strong = extract_paragraphs(make_soup(f'<div itemprop="articleBody">{page_text}</div>'))
        sp.text_source = "embedded" if paragraphs else None
    sp.paragraphs, sp.em_count, sp.strong_count = paragraphs, em, strong

    f = sp.fields
    if not f.get("title"):
        sp.warnings.append("no_title")
    if not paragraphs and sp.status == "ok":
        sp.status = "malformed"
        sp.warnings.append("no_story_text")
    if f.get("rating") is not None and not (1.0 <= f["rating"] <= 5.0):
        sp.warnings.append("rating_out_of_range")
    if f.get("views") is not None and f.get("favorites") is not None and f["favorites"] > f["views"] > 0:
        sp.warnings.append("favorites_exceed_views")
    return sp
