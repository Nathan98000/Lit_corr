"""Literotica's own story categories.

The collector discovers the current category list from the site's navigation
(one request). If that fails, it falls back to the list below, compiled from
public open-source Literotica tools (2025–2026); numeric ids are the site's
own category ids. Names shown on the website are taken from the story pages
themselves whenever available.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit

from .parse_common import make_soup, text_of
from .urls import category_slug_from_url


@dataclass(frozen=True)
class Category:
    slug: str
    name: str
    site_id: int | None = None


BUILTIN_CATEGORIES: tuple[Category, ...] = (
    Category("anal-sex-stories", "Anal", 37),
    Category("bdsm-stories", "BDSM", 31),
    Category("celebrity-stories", "Celebrities & Fan Fiction", 27),
    Category("chain-stories", "Chain Stories", 28),
    Category("erotic-couplings", "Erotic Couplings", 2),
    Category("erotic-horror", "Erotic Horror", 51),
    Category("exhibitionist-voyeur", "Exhibitionist & Voyeur", 4),
    Category("fetish-stories", "Fetish", 5),
    Category("first-time-sex-stories", "First Time", 40),
    Category("gay-sex-stories", "Gay Male", 6),
    Category("group-sex-stories", "Group Sex", 7),
    Category("adult-how-to", "How To", 8),
    Category("adult-humor", "Humor & Satire", 34),
    Category("illustrated-erotic-fiction", "Illustrated", 45),
    Category("taboo-sex-stories", "Incest/Taboo", 9),
    Category("interracial-erotic-stories", "Interracial Love", 10),
    Category("lesbian-sex-stories", "Lesbian Sex", 11),
    Category("erotic-letters", "Letters & Transcripts", 53),
    Category("loving-wives", "Loving Wives", 12),
    Category("mature-sex", "Mature", 26),
    Category("mind-control", "Mind Control", 29),
    Category("non-consent-stories", "Non-Consent/Reluctance", 13),
    Category("non-erotic-stories", "Non-Erotic", 35),
    Category("non-human-stories", "NonHuman", 14),
    Category("erotic-novels", "Novels and Novellas", 33),
    Category("reviews-and-essays", "Reviews & Essays", 3),
    Category("adult-romance", "Romance", 15),
    Category("science-fiction-fantasy", "Sci-Fi & Fantasy", 38),
    Category("masturbation-stories", "Toys & Masturbation", 16),
    Category("transgender", "Transgender", 48),
    Category("crossdressing", "Crossdressing", 58),
    Category("audio-sex-stories", "Audio", 39),
    Category("non-english-stories", "Non-English", 32),
)

# Category families that are not prose stories (poems, pictures, comics).
NOT_STORY_CATEGORY = re.compile(r"(poetry|poems?|comics?|erotic-art|^art$|^illustrations?$)", re.I)


def parse_category_links(html: str, page_url: str) -> list[Category]:
    """Every distinct ``/c/<slug>`` link on a page (e.g. the site navigation)."""
    soup = make_soup(html)
    found: dict[str, Category] = {}
    for a in soup.find_all("a", href=True):
        href = urljoin(page_url, a["href"])
        parts = urlsplit(href)
        if parts.hostname and "literotica.com" not in parts.hostname and parts.hostname not in (urlsplit(page_url).hostname,):
            continue
        slug = category_slug_from_url(parts.path)
        if not slug or parts.path.rstrip("/").count("/") != 2:  # exactly /c/<slug>
            continue
        if NOT_STORY_CATEGORY.search(slug):
            continue
        name = text_of(a)
        if slug not in found or (name and not found[slug].name):
            found[slug] = Category(slug, name)
    return sorted(found.values(), key=lambda c: c.slug)
