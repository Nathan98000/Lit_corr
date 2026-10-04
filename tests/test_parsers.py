from litcorr.demo import homepage, listing_page, make_site, story_page
from litcorr.site.categories import parse_category_links
from litcorr.site.parse_common import parse_count, parse_date
from litcorr.site.parse_listing import parse_listing_page
from litcorr.site.parse_story import parse_story_page

BASE = "https://www.literotica.com"
SITE = make_site(seed=3, n_per_category=12)


def _story(embedded: bool, multi: bool = False):
    return next(s for s in SITE.stories if s.status == "ok" and s.embedded == embedded and (len(s.pages) > 1) == multi
                and s.slug != "secret-story")


def test_parse_count_and_date():
    assert parse_count("12.3k") == (12300, True)
    assert parse_count("1,234 views") == (1234, False)
    assert parse_count("2M") == (2_000_000, True)
    assert parse_count(None) == (None, False)
    assert parse_date("03/15/2023") == "2023-03-15"
    assert parse_date("2023-03-15T10:00:00Z") == "2023-03-15"
    assert parse_date("13/45/2023") is None


def test_story_page_embedded_exact_values_and_privacy():
    s = _story(embedded=True)
    sp = parse_story_page(story_page(SITE, s.slug, 1), f"{BASE}/s/{s.slug}")
    f = sp.fields
    assert sp.status == "ok" and sp.paragraphs
    assert f["views"] == s.views and f["views_approx"] is False and sp.sources["views"] == "embedded"
    assert f["favorites"] == s.favorites and f["comments"] == s.comments and f["rating"] == s.rating
    assert f["category_name"] == s.category[1] and f["category_slug"] == s.category[0]
    assert f["date_published"] == s.published.isoformat()
    assert f["author_name"] == s.author and f["author_stories_count"] == 12
    # Only allow-listed author fields are read; profile details never are.
    assert not any(k for k in f if "location" in k or "bio" in k or k == "author_sex")
    assert "Private Town" not in str(f) and "private biography" not in str(f)
    assert "Report" not in sp.paragraphs  # site chrome inside the body is dropped
    assert sorted(f["tags"]) == sorted(s.tags)


def test_story_page_dom_fallback_is_flagged_approximate():
    s = next(x for x in SITE.stories if not x.embedded and x.views >= 1000)
    sp = parse_story_page(story_page(SITE, s.slug, 1), f"{BASE}/s/{s.slug}")
    assert sp.fields["views_approx"] is True and sp.sources["views"] == "dom"
    assert abs(sp.fields["views"] - s.views) <= 50
    assert sp.fields["date_published"] == s.published.isoformat()  # from JSON-LD


def test_story_pagination_and_awaiting_approval():
    s = _story(embedded=True, multi=True)
    sp = parse_story_page(story_page(SITE, s.slug, 1), f"{BASE}/s/{s.slug}")
    assert sp.max_page == len(s.pages)
    sp2 = parse_story_page(story_page(SITE, "pending-story", 1), f"{BASE}/s/pending-story")
    assert sp2.status == "unavailable"


def test_listing_page_uses_main_list_not_sidebar():
    cat = SITE.stories[0].category[0]
    lp = parse_listing_page(listing_page(SITE, cat, 1), f"{BASE}/c/{cat}", BASE)
    popular = max(SITE.stories, key=lambda s: s.views)
    assert lp.strategy == "js_list" and len(lp.stubs) == 10
    assert popular.slug not in {x["story_slug"] for x in lp.stubs} or popular.category[0] == cat
    assert lp.max_page >= 2 and lp.page_url_template.endswith("?page={n}")
    assert lp.total_items == len(SITE.in_category(cat))
    first = lp.stubs[0]
    assert first["title"] and first["date_text"] and first["rating_text"]


def test_listing_cards_fallback_and_sidebar_exclusion():
    cat = "loving-wives"
    html = listing_page(SITE, cat, 1)
    html = html.split("<script>")[0] + "</body></html>"  # remove embedded data -> HTML cards only
    lp = parse_listing_page(html, f"{BASE}/c/{cat}", BASE)
    assert lp.strategy == "cards" and len(lp.stubs) == 10
    popular = max(SITE.stories, key=lambda s: s.views)
    if popular.category[0] != cat:
        assert popular.slug not in {x["story_slug"] for x in lp.stubs}


def test_listing_links_fallback_ignores_sidebar():
    html = ('<html><body><main><ul><li><a href="/s/one">One</a></li><li><a href="/s/two">Two</a></li>'
            '<li><a href="/s/three">Three</a></li></ul></main>'
            '<aside class="_sidebar_x1"><a href="/s/hot-story">Hot</a></aside>'
            '<div class="top-stories"><a href="/s/top-story">Top</a></div></body></html>')
    lp = parse_listing_page(html, f"{BASE}/c/adult-romance", BASE)
    assert lp.strategy == "links"
    assert [s["story_slug"] for s in lp.stubs] == ["one", "two", "three"]


def test_legacy_listing_markup():
    html = ('<html><body><div class="b-story-list">' + "".join(
        f'<div class="b-sl-item-r"><h3><a href="https://www.literotica.com/s/old-{i}">Old {i}</a></h3>'
        f'<span class="b-sli-description">desc</span><span class="b-sli-author"><a href="/authors/a">a</a></span>'
        f'<span class="b-sli-date">01/0{i}/2009</span><span class="b-sli-rating">4.5{i}</span></div>'
        for i in range(1, 5)) + '</div><div class="b-alpha-links"><ul><li><a href="/c/adult-romance/1-page">1</a>'
        '</li><li><a href="/c/adult-romance/57-page">57</a></li></ul></div></body></html>')
    lp = parse_listing_page(html, f"{BASE}/c/adult-romance/1-page", BASE)
    assert lp.strategy == "legacy" and len(lp.stubs) == 4
    assert lp.stubs[0]["date_text"] == "2009-01-01" and lp.stubs[0]["rating_text"] == "4.51"
    assert lp.max_page == 57 and lp.page_url_template.endswith("/{n}-page")


def test_category_links_skip_poetry():
    cats = parse_category_links(homepage(SITE), BASE + "/")
    slugs = {c.slug for c in cats}
    assert "adult-romance" in slugs and "erotic-poetry" not in slugs and len(cats) == 8
