"""`demo`: run the complete pipeline against a local, synthetic imitation of the site.

Nothing here contacts Literotica. A small web server on 127.0.0.1 serves
made-up stories using the page structures the real parsers expect (hashed CSS
class names, SolidStart/seroval embedded data, JSON-LD, pagination, a
"popular" sidebar, robots.txt rules). It also includes awkward cases: a removed
story, a story awaiting approval, a story with only abbreviated statistics, a
robots-disallowed story, and private author profile fields that must never be
stored. The popularity numbers are invented, so any pattern in the demo output
is synthetic. The automated tests reuse this module.
"""

from __future__ import annotations

import html
import json
import math
import random
import re
import threading
from dataclasses import dataclass, field
from datetime import date, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable
from urllib.parse import parse_qs, unquote, urlsplit

CATEGORIES = [
    ("adult-romance", "Romance", 15), ("loving-wives", "Loving Wives", 12), ("erotic-couplings", "Erotic Couplings", 2),
    ("science-fiction-fantasy", "Sci-Fi & Fantasy", 38), ("bdsm-stories", "BDSM", 31), ("mature-sex", "Mature", 26),
    ("lesbian-sex-stories", "Lesbian Sex", 11), ("erotic-horror", "Erotic Horror", 51),
]
NAMES = ["Anna", "Ben", "Clara", "David", "Elena", "Frank", "Grace", "Henry", "Iris", "Jack", "Kate", "Leo", "Mia",
         "Noah", "Olivia", "Paul"]
PER_PAGE = 10
TODAY = date(2026, 9, 1)

FIRST = ["I walked to the window and watched the rain for a long time.", "My heart was racing as I waited for {n}.",
         "I could not stop thinking about the way {n} had smiled at me.", "I remembered the first night we met.",
         "I felt the warm air on my skin and closed my eyes.", "I wanted to say something, but I stayed quiet.",
         "We sat together on the porch until the sun went down.", "I reached for {n}'s hand and held it gently."]
THIRD = ["{n} walked to the window and watched the rain for a long time.", "Her heart was racing as she waited.",
         "He could not stop thinking about the way {n} had smiled at him.", "{n} remembered the first night they met.",
         "She felt the warm air on her skin and closed her eyes.", "He wanted to say something, but he stayed quiet.",
         "They sat together on the porch until the sun went down.", "{n} reached for his hand and held it gently."]
LINES = ["Come here", "I missed you", "Are you sure?", "Please don't go", "Tell me everything", "I love you",
         "We should talk", "What happened?", "Kiss me", "Stay with me tonight", "Maybe tomorrow", "Of course"]
FIRST_WORDS = ["Amber", "Blue", "Crimson", "Distant", "Evening", "Forbidden", "Golden", "Hidden", "Island", "Jade",
               "Kindred", "Lost", "Midnight", "Northern", "Ocean", "Perfect", "Quiet", "Restless", "Second", "Tender",
               "Unspoken", "Velvet", "Winter", "Yellow", "Zero", "1001"]
SENSUAL = ["They kissed slowly, and the desire between them was impossible to hide.",
           "She felt aroused and a little shy as he touched her bare shoulder.",
           "They lay naked under the warm blanket, listening to the storm."]


@dataclass
class FakeStory:
    slug: str
    title: str
    author: str
    author_id: int
    category: tuple[str, str, int]
    published: date
    description: str
    pages: list[list[str]]
    views: int
    favorites: int
    comments: int
    rating: float
    tags: list[str]
    lit_id: int
    votes: int = 0
    embedded: bool = True
    status: str = "ok"  # ok | gone | removed | awaiting
    series: tuple[int, str, int, int] | None = None  # (id, title, index, count)


@dataclass
class MockSite:
    stories: list[FakeStory]
    by_slug: dict[str, FakeStory] = field(default_factory=dict)
    # Test hooks: path -> list of responses to serve first, e.g. [429, 503, "challenge", "drop"]
    faults: dict[str, list] = field(default_factory=dict)
    hits: list[str] = field(default_factory=list)
    user_agents: list[str] = field(default_factory=list)
    # Like the real site: /c/<slug> is a showcase; the full list is browse-by-title (/c/<slug>/A ...).
    # False = the older layout where /c/<slug> itself is the paginated list (fallback path).
    browse_letters: bool = True
    # How a letter's later pages work: "dash" (as on the real site: /c/<slug>/S-2, with a bar linking the
    # previous/next pages of the whole A-Z sequence; other page forms redirect to page 1), "links" (?page=N,
    # linked), "hidden" (only at /<n>-page, no links), "none" (only page 1 exists).
    letter_paging: str = "dash"
    letter_per_page: int = 10
    # Listing quirks for tests: no visible page numbers / site serves its last page for any higher number.
    hide_pagination: bool = False
    repeat_last_page: bool = False

    def __post_init__(self) -> None:
        self.by_slug = {s.slug: s for s in self.stories}

    def in_category(self, slug: str) -> list[FakeStory]:
        return sorted([s for s in self.stories if s.category[0] == slug and s.status != "unlisted"],
                      key=lambda s: (s.published, s.slug), reverse=True)


def _paragraphs(rng: random.Random, pov: str, dialogue: float, n_paras: int, sensual: float) -> list[str]:
    out = []
    for _ in range(n_paras):
        name = rng.choice(NAMES)
        if rng.random() < dialogue:
            line = rng.choice(LINES)
            end = "" if line.endswith("?") else rng.choice([",", "."])
            tag = f"{name} said" if pov == "third" else rng.choice(["I said", f"{name} said", "I whispered"])
            if end == ",":
                out.append(f"“{line},” {tag}. “{rng.choice(LINES)}”")
            else:
                out.append(f"“{line}{'' if line.endswith('?') else '.'}” {rng.choice(THIRD).format(n=name)}")
        else:
            pool = FIRST if pov == "first" else THIRD
            sents = [rng.choice(pool).format(n=name) for _ in range(rng.randint(2, 5))]
            if rng.random() < sensual:
                sents.append(rng.choice(SENSUAL))
            out.append(" ".join(sents))
    return out


def make_site(seed: int = 7, n_per_category: int = 25, only: tuple[str, ...] = ()) -> MockSite:
    """``only``: generate stories for these category slugs only (others are listed but empty)."""
    rng = random.Random(seed)
    stories: list[FakeStory] = []
    lit_id = 1_000_000
    for ci, cat in enumerate(CATEGORIES):
        if only and cat[0] not in only:
            continue
        for i in range(n_per_category):
            lit_id += 1
            pov = rng.choice(["first", "third"])
            dialogue = rng.uniform(0.05, 0.6)
            sensual = rng.uniform(0.0, 0.5)
            n_pages = rng.choice([1, 1, 1, 2, 2, 3])
            age = rng.randint(20, 7000)
            pages = [_paragraphs(rng, pov, dialogue, rng.randint(25, 45), sensual) for _ in range(n_pages)]
            views = int(math.exp(rng.gauss(math.log(800 + 25 * age ** 0.8), 0.5)))
            fav_rate = 0.003 + 0.012 * dialogue + (0.004 if pov == "first" else 0.0) + rng.uniform(-0.002, 0.002)
            title = f"{rng.choice(FIRST_WORDS)} {rng.choice(['Rain', 'Letters', 'Chances', 'Train', 'Harbor', 'Lights'])}"
            slug = f"{title.lower().replace(' ', '-')}-{cat[0][:3]}{ci}{i:03d}"
            series = None
            if i % 9 == 4:
                title += f" Ch. {1 + i % 3:02d}"
                series = (5000 + i, title.rsplit(" Ch.", 1)[0], 1 + i % 3, 3)
            stories.append(FakeStory(
                slug=slug, title=title, author=f"writer{rng.randint(1, 60)}", author_id=rng.randint(1, 9999),
                category=cat, published=TODAY - timedelta(days=age),
                description=rng.choice(["A reunion on a rainy night.", "Old friends, new feelings.",
                                        "A long weekend away.", "Letters that change everything."]),
                pages=pages, views=views, favorites=max(0, int(views * max(fav_rate, 0.0005))),
                comments=max(0, int(views * rng.uniform(0.0002, 0.0015))),
                rating=round(min(5.0, max(1.0, rng.gauss(3.9 + 0.8 * dialogue, 0.35))), 2),
                tags=rng.sample(["romance", "slow burn", "reunion", "office", "vacation", "first love", "rain"], 3),
                lit_id=lit_id, votes=max(1, int(views * rng.uniform(0.002, 0.012))), embedded=not (i % 11 == 7),
                series=series))
    # Awkward cases (listed in the first category so they are always sampled in small demos).
    first = CATEGORIES[0]
    for slug, status in (("vanished-story", "gone"), ("removed-story", "removed"), ("pending-story", "awaiting"),
                         ("secret-story", "ok")):
        lit_id += 1
        stories.append(FakeStory(slug=slug, title=slug.replace("-", " ").title(), author="writer1", author_id=1,
                                 category=first, published=TODAY - timedelta(days=3000), description="Edge case.",
                                 pages=[_paragraphs(rng, "third", 0.3, 30, 0.1)], views=100, favorites=1, comments=0,
                                 rating=4.0, tags=["test"], lit_id=lit_id, status=status))
    return MockSite(stories)


# ---------------------------------------------------------------- HTML
def _js(s: object) -> str:
    return json.dumps(s, ensure_ascii=False).replace("<", "\\u003c")


def _abbrev(n: int) -> str:
    return f"{n / 1000:.1f}k" if n >= 1000 else str(n)


def _mdY(d: date) -> str:
    return d.strftime("%m/%d/%Y")


def _seroval_item(s: FakeStory) -> str:
    c = s.category
    return (f"{{id:{s.lit_id},title:{_js(s.title)},url:{_js(s.slug)},type:\"story\",date_approve:{_js(_mdY(s.published))},"
            f"rate_all:{s.rating},rate_count:{s.votes},view_count:{s.views},description:{_js(s.description)},"
            f"category_info:{{id:{c[2]},name:{_js(c[1])},pageUrl:{_js(c[0])}}},authorname:{_js(s.author)},"
            f"is_hot:{'!0' if s.rating >= 4.5 else '!1'}}}")


def homepage(site: MockSite) -> str:
    links = "".join(f'<a class="_nav__link_n2" href="/c/{c[0]}">{html.escape(c[1])}</a>' for c in CATEGORIES)
    links += '<a href="/c/erotic-poetry">Erotic Poetry</a><a href="/authors/someone">Someone</a>'
    return f"<!DOCTYPE html><html><head><title>Literotica</title></head><body><header><nav>{links}</nav></header>" \
           f"<main><h1>Welcome</h1></main></body></html>"


def listing_page(site: MockSite, slug: str, page: int) -> str | None:
    cat = next((c for c in CATEGORIES if c[0] == slug), None)
    if cat is None:
        return None
    items = site.in_category(slug)
    last = max(1, math.ceil(len(items) / PER_PAGE))
    if page > last:
        if not site.repeat_last_page:
            return None
        page = last
    chunk = items[(page - 1) * PER_PAGE: page * PER_PAGE]
    cards = "".join(
        f'<div class="_works_item_w2k1"><a class="_item_title_w3k1" href="/s/{s.slug}">{html.escape(s.title)}</a>'
        f'<p class="_item_description_w4k1">{html.escape(s.description)}</p>'
        f'<a class="_item_authorname_link_w5k1" href="/authors/{s.author}/works/stories">{s.author}</a>'
        f'<time class="_date_approve_w6k1">{_mdY(s.published)}</time>'
        f'<span class="_work_item__stat_w7k1"><span>Rating</span><span class="_stats__text_w8k1">{s.rating}</span></span>'
        f'</div>' for s in chunk)
    nums = sorted({1, 2, 3, page, last} & set(range(1, last + 1)))
    pager = "".join(f'<a class="_pagination__item_p2k1" href="/c/{slug}?page={n}">{n}</a>' for n in nums)
    data = ",".join(f"$R[{10 + i}]={_seroval_item(s)}" for i, s in enumerate(chunk))
    script = (f'(self.$R=self.$R||{{}})["s1"]=[];_$HY.r["CategoryWorks[\\"{slug}\\",{page}]"]=$R[0]=('
              f'$R[1]=new Promise(r=>r),$R[2]={{current_page:{page},last_page:{last},total:{len(items)},'
              f'per_page:{PER_PAGE},data:$R[3]=[{data}]}});')
    if site.hide_pagination:
        pager = ""
        script = f'_$HY.r["CategoryWorks[\\"{slug}\\",{page}]"]=$R[0]=$R[3]=[{data}];'
    popular = max(site.stories, key=lambda s: s.views)
    return (f"<!DOCTYPE html><html><head><title>{html.escape(cat[1])} - Literotica.com</title></head><body>"
            f"<header class=\"_header_h1k1\"><nav><a href=\"/\">Home</a></nav></header>"
            f"<main class=\"_main_m1k1\"><h1>{html.escape(cat[1])}</h1><div class=\"_works_list_w1k1\">{cards}</div>"
            f"<nav class=\"_pagination_p1k1\">{pager}</nav></main>"
            f"<aside class=\"_sidebar_s1k1\"><h3>Popular</h3><a href=\"/s/{popular.slug}\">{html.escape(popular.title)}</a></aside>"
            f"<script>{script}</script></body></html>")


def _initial(title: str) -> str:
    c = title[:1].upper()
    return c if "A" <= c <= "Z" else "*"


def _card_html(s: FakeStory) -> str:
    return (f'<article class="_card_c1k1"><div class="_content_c2k1"><h3 class="_title_c3k1">'
            f'<a class="_title_link_c4k1" href="/s/{s.slug}">{html.escape(s.title)}</a></h3>'
            f'<p class="_description_c5k1">{html.escape(s.description)}</p><div class="_meta_c6k1">'
            f'<span class="_stat_c7k1"><i class="icon icon-star"></i><span class="_stats_text_c8k1">{s.rating}</span></span>'
            f'<a class="_author_link_c9k1" href="/authors/{s.author}/works/stories">{s.author}</a>'
            f'<a class="_category_c0k1" href="/c/{s.category[0]}">{html.escape(s.category[1])}</a>'
            f'<time class="_date_c1k2">{_mdY(s.published)}</time></div></div></article>')


def _browse_bar(site: MockSite, slug: str) -> str:
    letters = sorted({_initial(s.title) for s in site.in_category(slug)}, key=lambda c: (c != "*", c))
    return '<div class="_browse_b1k1">' + "".join(
        f'<a class="_letter_link_b2k1 _inactive_b3k1" href="/c/{slug}/{c}">{c}</a>' for c in letters) + "</div>"


def stories_index(site: MockSite) -> str:
    links = "".join(f'<li><a href="/c/{c[0]}">{html.escape(c[1])}</a></li>' for c in CATEGORIES)
    return (f"<!DOCTYPE html><html><head><title>Story categories</title></head><body><main><h1>Stories</h1>"
            f"<ul>{links}</ul></main></body></html>")


def landing_page(site: MockSite, slug: str) -> str | None:
    """A category landing page like the real site's: a showcase (hot / new), not the full list."""
    cat = next((c for c in CATEGORIES if c[0] == slug), None)
    if cat is None:
        return None
    items = site.in_category(slug)
    hot = sorted(items, key=lambda s: (-s.rating, s.slug))[:10]
    new = items[:10]
    data = ",".join(f"$R[{10 + i}]={_seroval_item(s)}" for i, s in enumerate(new))
    script = (f'_$HY.r["NewWorks[\\"{slug}\\"]"]=$R[0]=($R[1]=new Promise(r=>r),$R[2]={{current_page:1,'
              f'last_page:3,total:139,per_page:50,data:$R[3]=[{data}]}});')  # a short "new" list, not the category
    cats_js = ",".join(f"{{id:{c[2]},name:{_js(c[1])},pageUrl:{_js(c[0])},submission_count:{len(site.in_category(c[0]))}}}"
                       for c in CATEGORIES)
    script += f'_$HY.r["Categories"]=$R[700]=[{cats_js}];'
    return (f"<!DOCTYPE html><html><head><title>{html.escape(cat[1])} Stories - Literotica.com</title></head><body>"
            f"<header><nav><a href=\"/\">Home</a><a href=\"/stories\">Stories</a></nav></header><main>"
            f"<section class=\"_core_s1k1\"><h1>{html.escape(cat[1])}</h1>{_browse_bar(site, slug)}"
            f"<h2>Hot</h2><div class=\"_list_l1k1\">{''.join(_card_html(s) for s in hot)}</div>"
            f"<h2>New</h2><div class=\"_list_l1k1\">{''.join(_card_html(s) for s in new)}</div></section></main>"
            f"<script>{script}</script></body></html>")


def _letter_sequence(site: MockSite, slug: str) -> list[tuple[str, int]]:
    """The whole browse-by-title index of a category as one sequence of (letter, page) pairs."""
    per = site.letter_per_page
    letters = sorted({_initial(s.title) for s in site.in_category(slug)}, key=lambda c: (c != "*", c))
    seq = []
    for L in letters:
        n_items = sum(1 for s in site.in_category(slug) if _initial(s.title) == L)
        seq += [(L, n) for n in range(1, math.ceil(n_items / per) + 1)]
    return seq


def _letter_href(slug: str, letter: str, n: int) -> str:
    return f"/c/{slug}/{letter}" if n == 1 else f"/c/{slug}/{letter}-{n}"


def _dash_nav(site: MockSite, slug: str, letter: str, page: int) -> str:
    """Pagination bar like the real one: prev, next, 1, …, g-1, [g], g+1, …, last."""
    seq = _letter_sequence(site, slug)
    i = seq.index((letter, page))
    g, total = i + 1, len(seq)
    item = "_pagination__item_tl9pc_2"
    out = []
    if i > 0:
        out.append(f'<a class="{item} _pagination__item--prev_tl9pc_49" href="{_letter_href(slug, *seq[i - 1])}" '
                   f'title="Previous Page" aria-label="Previous Page"><i class="icon-angle-left"></i></a>')
    if i + 1 < total:
        out.append(f'<a class="{item} _pagination__item--next_tl9pc_50" href="{_letter_href(slug, *seq[i + 1])}" '
                   f'title="Next Page" aria-label="Next Page"><i class="icon-angle-right"></i></a>')
    shown = sorted({1, max(1, g - 1), g, min(total, g + 1), total})
    prev_k = 0
    for k in shown:
        if k - prev_k > 1:
            out.append(f'<span class="{item} _pagination__item--dots_tl9pc_97">...</span>')
        if k == g:
            out.append(f'<span class="{item} _active_tl9pc_3" aria-label="Page {k}">{k}</span>')
        else:
            out.append(f'<a class="{item}" href="{_letter_href(slug, *seq[k - 1])}" aria-label="Page {k}">{k}</a>')
        prev_k = k
    return f'<nav class="panel _pagination_tl9pc_1" aria-label="Pagination">{"".join(out)}</nav>'


def letter_page(site: MockSite, slug: str, letter: str, page: int) -> str | None:
    cat = next((c for c in CATEGORIES if c[0] == slug), None)
    if cat is None:
        return None
    items = sorted([s for s in site.in_category(slug) if _initial(s.title) == letter], key=lambda s: s.title.casefold())
    per = site.letter_per_page
    last = max(1, math.ceil(len(items) / per))
    if not items or page > last:
        return None
    chunk = items[(page - 1) * per: page * per]
    pager = "".join(f'<a class="_pagination__item_p2k1" href="/c/{slug}/{letter}?page={n}">{n}</a>'
                    for n in range(1, last + 1)) if last > 1 and site.letter_paging == "links" else ""
    data = ",".join(f"$R[{10 + i}]={_seroval_item(s)}" for i, s in enumerate(chunk))
    if site.letter_paging == "links":
        script = (f'_$HY.r["CategoryLetter[\\"{slug}\\",\\"{letter}\\",{page}]"]=$R[0]=($R[1]=new Promise(r=>r),'
                  f'$R[2]={{current_page:{page},last_page:{last},total:{len(items)},per_page:{per},data:$R[3]=[{data}]}});')
    else:  # like the real site: the visible list is not in a pager; a small unrelated (top-rated) list is
        top = sorted(site.in_category(slug), key=lambda s: (-s.rating, s.slug))[:5]
        decoy = ",".join(f"$R[{900 + i}]={_seroval_item(s)}" for i, s in enumerate(top))
        script = (f'_$HY.r["CategoryLetter[\\"{slug}\\",\\"{letter}\\"]"]=$R[0]=$R[3]=[{data}];'
                  f'_$HY.r["Sidebar"]=$R[800]={{current_page:1,last_page:7,total:33,per_page:5,data:[{decoy}]}};')
        if site.letter_paging == "dash":
            pager = _dash_nav(site, slug, letter, page)
    return (f"<!DOCTYPE html><html><head><title>{html.escape(cat[1])} Stories: {letter}</title></head><body><main>"
            f"<h1>{html.escape(cat[1])}</h1>{_browse_bar(site, slug)}<div class=\"_list_l1k1\">"
            f"{''.join(_card_html(s) for s in chunk)}</div>"
            f"{pager if pager.startswith('<nav') else f'<nav class=_pagination_p1k1>{pager}</nav>'}</main>"
            f"<script>{script}</script></body></html>")


def story_page(site: MockSite, slug: str, page: int) -> str | None:
    s = site.by_slug.get(slug)
    if s is None or page > len(s.pages):
        return None
    c = s.category
    n = len(s.pages)
    paras = "".join(f"<p>{html.escape(p)}</p>" for p in s.pages[page - 1])
    if page == 1:
        paras += '<p class="_report_r1k1">Report</p>'  # site chrome inside the story body; must be ignored
    pager = ""
    if n > 1:
        pager = "".join(f'<a class="_pagination__item_p2k1" href="?page={k}">{k}</a>' for k in range(1, n + 1))
        if page < n:
            pager += f'<a class="_pagination__next_p3k1" title="Next Page" href="?page={page + 1}">Next</a>'
        pager = f'<nav class="_pagination_p1k1">{pager}</nav>'
    tags = ""
    if page == n:
        tags = '<div class="_widget__tags_t1k1">' + "".join(
            f'<a class="_tags__link_t2k1" href="https://tags.literotica.com/{t.replace(" ", "%20")}">{t}</a>'
            for t in s.tags) + "</div>"
    series = f'<a class="_files__link_f1k1" href="/series/se/{s.series[0]}">{html.escape(s.series[1])}</a>' if s.series else ""
    ld = json.dumps({"@context": "https://schema.org", "@type": "Article", "headline": s.title,
                     "author": {"@type": "Person", "name": s.author}, "datePublished": s.published.isoformat(),
                     "description": s.description, "keywords": ", ".join(s.tags)})
    stats = (f'<div class="_stats__list_s0k1">'
             f'<div class="_stats__item_s1k1"><i class="_star_i1k1"></i><span>{s.rating}</span></div>'
             f'<div class="_stats__item_s1k1"><i class="_diagram_i2k1"></i><span>{_abbrev(s.views)}</span></div>'
             f'<div class="_stats__item_s1k1"><i class="_heart_i3k1"></i><span>{_abbrev(s.favorites)}</span></div>'
             f'<div class="_stats__item_s1k1"><i class="_comment_i4k1"></i><span>{s.comments}</span></div></div>')
    script = ""
    if s.embedded:
        series_js = "null"
        if s.series:
            items = ",".join(f"{{id:{s.lit_id - s.series[2] + k},url:{_js(s.slug if k == s.series[2] else f'{s.slug}-part{k}')}}}"
                             for k in range(1, s.series[3] + 1))
            series_js = f"{{meta:{{id:{s.series[0]},title:{_js(s.series[1])}}},items:[{items}]}}"
        sub = (f"$R[3]={{allow_vote:!0,author:$R[4]={{userid:{s.author_id},username:{_js(s.author)},stories_count:12,"
               f"followers_count:34,location:\"Private Town\",bio:\"private biography\",sex:\"private\"}},"
               f"authorname:{_js(s.author)},category:{c[2]},category_info:$R[5]={{id:{c[2]},name:{_js(c[1])},"
               f"pageUrl:{_js(c[0])}}},comment_count:{s.comments},date_approve:{_js(_mdY(s.published))},"
               f"description:{_js(s.description)},favorite_count:{s.favorites},id:{s.lit_id},is_hot:"
               f"{'!0' if s.rating >= 4.5 else '!1'},rate_all:{s.rating},rate_count:{s.votes},reading_lists_count:{s.favorites // 3},"
               f"tags:$R[6]=[{','.join('{tag:' + _js(t) + '}' for t in s.tags)}],title:{_js(s.title)},type:\"story\","
               f"url:{_js(s.slug)},view_count:{s.views},words_count:{sum(len(p.split()) for pg in s.pages for p in pg)},"
               f"series:{series_js}}}")
        script = (f'<script>_$HY.r["workData[\\"{s.slug}\\"]"]=$R[0]=($R[1]=new Promise(r=>r),$R[2]={{meta:'
                  f'{{pages_count:{n},id:{s.lit_id}}},submission:{sub},pageText:""}});</script>')
    body = (f'<nav class="_breadcrumbs_list_b1k1"><a href="/">Home</a><a href="/c/{c[0]}">{html.escape(c[1])}</a></nav>'
            f'<h1 class="_title_x1k1">{html.escape(s.title)}</h1>'
            f'<a class="_author__title_x2k1" href="/authors/{s.author}/works/stories">{s.author}</a>{stats}{series}'
            f'<div class="_article__content_a1k1"><div class="_article__text_a2k1">{paras}</div></div>'
            f'{pager}{tags}')
    if s.status == "awaiting":
        body = "<h1>Pending</h1><p>This submission is awaiting moderator's approval.</p>"
    return (f"<!DOCTYPE html><html><head><title>{html.escape(s.title)} - Literotica.com</title>"
            f'<meta name="description" content="{html.escape(s.description)}">'
            f'<script type="application/ld+json">{ld}</script></head><body>{body}{script}</body></html>')


ROBOTS = """User-agent: ClaudeBot
Disallow: /

User-agent: *
Disallow: /*?dialog=
Disallow: /api/
Disallow: /tags/
Disallow: /my/
Disallow: /s/secret-story
"""

CHALLENGE = ("<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>"
             "<div id=\"challenge-form\"></div><script>window._cf_chl_opt={}</script></body></html>")


def make_handler(site: MockSite) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a: object) -> None:  # keep test output quiet
            pass

        def _send(self, status: int, body: str = "", ctype: str = "text/html; charset=utf-8",
                  headers: dict[str, str] | None = None) -> None:
            data = body.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            for k, v in (headers or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self) -> None:  # noqa: N802
            site.hits.append(self.path)
            site.user_agents.append(self.headers.get("User-Agent", ""))
            parts = urlsplit(self.path)
            fault_list = site.faults.get(parts.path) or site.faults.get(self.path)
            if fault_list:
                f = fault_list.pop(0)
                if isinstance(f, dict):  # {"status": 302, "headers": {...}, "body": "..."}
                    return self._send(f.get("status", 200), f.get("body", ""),
                                      f.get("ctype", "text/html; charset=utf-8"), f.get("headers"))
                if f == "drop":
                    self.close_connection = True
                    self.connection.close()
                    return
                if f == "challenge":
                    return self._send(200, CHALLENGE)
                if f == 429:
                    return self._send(429, "slow down", headers={"Retry-After": "1"})
                if isinstance(f, int):
                    return self._send(f, f"error {f}")
            page = int((parse_qs(parts.query).get("page") or ["1"])[0])
            if parts.path == "/robots.txt":
                return self._send(200, ROBOTS, "text/plain")
            if parts.path == "/":
                return self._send(200, homepage(site))
            if parts.path.rstrip("/") == "/stories":
                return self._send(200, stories_index(site))
            if parts.path.startswith("/c/"):
                segs = unquote(parts.path[3:]).strip("/").split("/")
                if len(segs) == 2 and site.browse_letters and page > 1 and site.letter_paging != "links":
                    return self._send(301, "", headers={"Location": f"/c/{segs[0]}/{segs[1]}"})  # canonicalised
                if len(segs) == 3 and site.browse_letters and site.letter_paging == "hidden":
                    m = re.fullmatch(r"(\d+)-page", segs[2])
                    body = letter_page(site, segs[0], segs[1], int(m.group(1))) if m else None
                    return self._send(200, body) if body else self._send(404, "not found")
                if len(segs) == 3 and site.browse_letters and site.letter_paging == "dash":
                    return self._send(301, "", headers={"Location": f"/c/{segs[0]}/{segs[1]}"})  # like /S/2-page
                dm = re.fullmatch(r"(.+?)-(\d+)", segs[1]) if len(segs) == 2 else None
                if dm and site.browse_letters and site.letter_paging == "dash":
                    body = letter_page(site, segs[0], dm.group(1), int(dm.group(2)))
                    return self._send(200, body) if body else self._send(404, "not found")
                if len(segs) == 2 and site.browse_letters:
                    body = letter_page(site, segs[0], segs[1], page)
                elif len(segs) == 1 and site.browse_letters:
                    body = landing_page(site, segs[0])
                elif len(segs) == 1:
                    body = listing_page(site, segs[0], page)
                else:
                    body = None
                return self._send(200, body) if body else self._send(404, "not found")
            if parts.path.startswith("/s/"):
                slug = parts.path[3:].strip("/")
                s = site.by_slug.get(slug)
                if s is not None and s.status == "gone":
                    return self._send(404, "not found")
                if s is not None and s.status == "removed":
                    return self._send(302, "", headers={"Location": "/"})
                body = story_page(site, slug, page)
                return self._send(200, body) if body else self._send(404, "not found")
            return self._send(404, "not found")

    return Handler


def start_server(site: MockSite) -> tuple[ThreadingHTTPServer, str]:
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(site))
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}"


def demo_settings(base_url: str, out_dir: Path, n_per_category: int):
    """Settings for the LOCAL mock site only: no delays (validate() would refuse these for the real site)."""
    from .settings import Settings

    s = Settings()
    s.scope.base_url = base_url
    s.scope.max_stories_per_category = n_per_category + 5
    s.scope.listing_strategy = "all"
    s.storage.data_dir = str(out_dir.resolve())
    s.identity.user_agent = "LitCorrResearch/0.1 (demo against a local synthetic site)"
    p = s.politeness
    p.base_delay_seconds = p.jitter_seconds = 0.0
    p.max_requests_per_minute = p.max_requests_per_hour = p.max_requests_per_day = 1_000_000
    p.max_requests_per_session = 1_000_000
    p.backoff_base_seconds = p.backoff_max_seconds = p.pause_after_429_seconds = 0.01
    p.cooldown_after_429_hours = p.cooldown_after_block_hours = 0
    return s


def run_pipeline(settings, *, fetcher_factory: Callable | None = None, verbose: bool = False) -> dict:
    from .analyze import run_analyze
    from .build.quality import quality_report
    from .build.raw_corpus import build_raw
    from .collect.discover import collect_listings, discover_categories
    from .collect.sample import build_queue
    from .collect.session import collector_session
    from .collect.stories import collect_stories
    from .export import export_handoff

    with collector_session(settings, "demo", verbose=verbose, fetcher_factory=fetcher_factory) as ctx:
        cats = discover_categories(ctx)
        collect_listings(ctx, cats)
        build_queue(ctx)
        collect_stories(ctx)
    raw = build_raw(settings, workers=1)
    processed = run_analyze(settings, workers=2)
    report = quality_report(settings)
    handoff = export_handoff(settings)
    return {"raw": raw, "processed": processed, "report": report, "handoff": handoff}


DEMO_MARKER = ".litcorr_demo"


def _reset_demo_dir(out_dir: Path) -> None:
    """Start every demo from an empty folder. The mock site listens on a new random port each run, so the
    cached pages and story queue of an earlier demo never match the new addresses: a rerun into the same folder
    used to finish 'successfully' with no story text at all. Only a folder that is clearly a demo folder (our
    marker file, or a state database whose pages all come from the local mock site) is ever removed."""
    import shutil
    import sqlite3

    if not out_dir.exists() or not any(out_dir.iterdir()):
        return
    is_demo = (out_dir / DEMO_MARKER).exists()
    state = out_dir / "state.sqlite3"
    if not is_demo and state.exists():
        con = sqlite3.connect(f"file:{state}?mode=ro", uri=True)
        try:
            urls = [r[0] for r in con.execute("SELECT url FROM pages LIMIT 5000")]
        except sqlite3.DatabaseError:
            urls = []
        finally:
            con.close()
        is_demo = bool(urls) and all(urlsplit(u).hostname in ("127.0.0.1", "localhost") for u in urls)
    if not is_demo:
        raise SystemExit(f"{out_dir} is not empty and is not a demo folder; choose another --out folder.")
    shutil.rmtree(out_dir)


def run_demo(out_dir: Path, n_per_category: int = 25, verbose: bool = False) -> dict:
    _reset_demo_dir(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / DEMO_MARKER).write_text("Output of `python -m litcorr demo`; removed and rebuilt by every demo run.\n",
                                       encoding="utf-8")
    site = make_site(n_per_category=n_per_category)
    httpd, base = start_server(site)
    try:
        settings = demo_settings(base, out_dir, n_per_category)
        result = run_pipeline(settings, verbose=verbose)
    finally:
        httpd.shutdown()
        httpd.server_close()
    print("\nDemo finished (synthetic data; patterns are invented).")
    print(f"  requests served by the local mock site: {len(site.hits)}")
    print(f"  processed: {result['processed']}")
    print(f"  quality report: {out_dir / 'processed' / 'quality_report.md'}")
    print(f"  handoff zip: {result['handoff']}")
    return result
