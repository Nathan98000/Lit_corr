"""`probe`: a tiny, safe check of whether collection will work.

Makes at most ~5 requests (robots.txt, the home page, one listing page, one
story page) and writes:

  data/logs/probe_report.md          what was found, field by field
  data/logs/probe_skeleton_*.html    the page *structure* with all text removed
                                     (tag names, CSS classes, data keys only)

The skeleton files contain no story text, titles or author names, so they can
be shared to get the parsers adjusted if the site's markup changed.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

from bs4 import Comment, NavigableString, Tag

from ..log import get_logger
from ..site.categories import parse_category_links
from ..site.parse_common import make_soup
from ..site.parse_listing import parse_listing_page
from ..site.parse_story import parse_story_page
from ..site.urls import story_page_url
from ..site.urls import normalize_url
from .discover import (FIRST_PAGE_CANDIDATES, PAGE2_CANDIDATES, discover_categories, ensure_listing_layout,
                       letter_url)
from .session import Ctx

log = get_logger("probe")

_KEY = re.compile(r"([A-Za-z_$][\w$]*)\s*:")


def _collapse_runs(soup: Any, keep: int = 3) -> None:
    """Replace long runs of identical sibling elements (e.g. 150 story cards) by the first few + a count,
    so the skeleton shows the whole page, including what comes after a long list."""
    for parent in soup.find_all(True):
        if parent.decomposed:
            continue
        kids = [c for c in parent.children if isinstance(c, Tag)]
        i = 0
        while i < len(kids):
            sig = (kids[i].name, tuple(sorted(kids[i].get("class") or [])))
            j = i
            while j + 1 < len(kids) and (kids[j + 1].name, tuple(sorted(kids[j + 1].get("class") or []))) == sig:
                j += 1
            run = j - i + 1
            if run > keep:
                for t in kids[i + keep: j + 1]:
                    t.decompose()
                kids[i + keep - 1].insert_after(Comment(f" {run - keep} more <{sig[0]} class='{' '.join(sig[1])}'> "))
            i = j + 1


def html_skeleton(html: str, limit_chars: int = 1_500_000) -> str:
    """The page with every text node, attribute value that could carry content,
    and script value removed; only structure and key names remain."""
    soup = make_soup(html)
    for c in soup.find_all(string=lambda s: isinstance(s, Comment)):
        c.extract()
    _collapse_runs(soup)
    for s in soup.find_all(["script", "style"]):
        body = s.string if s.string is not None else s.get_text()
        if s.name == "script" and body:
            keys = Counter(_KEY.findall(body))
            top = ", ".join(f"{k}({n})" for k, n in keys.most_common(150))
            s.string = f"/* {len(body)} chars; markers: " + \
                       ", ".join(m for m in ("_$HY", "$R[", "__NEXT_DATA__", "ld+json") if m in body or m in str(s.attrs)) + \
                       f"; keys: {top} */"
        else:
            s.string = "/* style removed */"
    for node in soup.find_all(string=True):
        if isinstance(node, Comment):
            continue
        if isinstance(node, NavigableString) and node.parent and node.parent.name not in ("script", "style"):
            t = node.strip()
            if t:
                node.replace_with(f"[text {len(t)}]")
    for el in soup.find_all(True):
        for attr in list(el.attrs):
            if attr in ("class", "id", "itemprop", "itemtype", "type", "role", "rel", "name", "property",
                        "data-tab", "title", "aria-label"):
                if attr in ("title", "aria-label"):
                    el[attr] = "[text]" if el[attr] else ""
                continue
            if attr == "href":
                href = el["href"]
                href = re.sub(r"/s/[^/?#\"]+", "/s/<slug>", href)
                href = re.sub(r"/authors/[^/?#\"]+", "/authors/<name>", href)
                href = re.sub(r"/series/se/[^/?#\"]+", "/series/se/<id>", href)
                el["href"] = href
            elif attr in ("content", "alt", "src", "srcset", "value", "datetime", "data-value"):
                el[attr] = f"[{attr}]"
            elif attr.startswith("data-"):
                el[attr] = "[data]"
    out = str(soup)
    return out[:limit_chars]


def _fmt(v: Any) -> str:
    if isinstance(v, list):
        return f"list of {len(v)}"
    if isinstance(v, str):
        return f"text ({len(v)} chars)"
    return repr(v)


def _order_share(values: list[Any], descending: bool = False) -> str:
    """Share of neighbouring pairs in order (says whether a list is sorted, without showing the values)."""
    vals = [v for v in values if v not in (None, "")]
    pairs = list(zip(vals, vals[1:]))
    if not pairs:
        return "n/a"
    ok = sum((a >= b) if descending else (a <= b) for a, b in pairs)
    return f"{ok}/{len(pairs)}"


def _probe_frame(ctx: Ctx, cat: dict[str, Any]) -> list[str]:
    """Show the sampling frame the collector will use (stores the detected layout for `collect`)."""
    base, logs, f = ctx.base_url, ctx.paths.logs, ctx.fetcher
    lines = ["## Sampling frame", ""]
    ctx.state.conn.execute("DELETE FROM meta WHERE key = 'listing_layout'")  # always re-detect (pages are cached)
    layout = ensure_listing_layout(ctx, [cat], tries=1)
    if layout is None:
        return lines + ["**No usable listing layout found.** Please share this report and the skeleton files.", ""]
    lines += [f"Layout used by `collect`: `{json.dumps(layout)}`", ""]
    if layout.get("frame") != "letters":
        return lines
    slug = cat["slug"]
    landing = f.cached_body(layout["first"].format(base=base, slug=slug))
    landing_lp = parse_listing_page(landing, f"{base}/c/{slug}", base) if landing else None
    segments = landing_lp.browse_segments if landing_lp else []
    if landing_lp and landing_lp.category_sizes:
        sizes = landing_lp.category_sizes
        lines += ["Stories per category, as the site counts them (`submission_count`): " + ", ".join(
            f"{k} {v:,}" for k, v in sorted(sizes.items(), key=lambda kv: -kv[1])), ""]
    letter = next((s for s in ("S", "T", "M", "B", "A") if s in segments), segments[0] if segments else "A")
    pages = []
    for n in (1, 2):
        url = letter_url(layout, base, slug, letter, n)
        if n == 2 and not layout.get("page"):
            # No way to page 2 found: show what was tried (from the local record, no new requests).
            tried = [c.format(base=base, slug=slug, letter=letter) for c in PAGE2_CANDIDATES] + \
                    [normalize_url(f"{base}/c/{slug}/{letter}?page=2", base)]
            lines += ["**No way to reach a letter's page 2 was found.** Addresses tried:", ""]
            for t in tried:
                pg = ctx.state.get_page(normalize_url(t, base))
                lines.append(f"- `{t}`: " + (f"{pg['status']}, HTTP {pg['http_status']}, ended at "
                                             f"`{pg['final_url']}`" if pg else "not tried"))
            lines.append("")
            break
        res = f.fetch(url, "listing")
        lines += [f"### Letter page `{url}`", "", f"Outcome: **{res.outcome}** (HTTP {res.status}) {res.detail}", ""]
        if res.body and n == 1:
            (logs / "probe_skeleton_letter.html").write_text(html_skeleton(res.body), encoding="utf-8")
        if not res.ok or not res.body:
            break
        lp = parse_listing_page(res.body, res.final_url or url, base)
        pages.append(lp)
        titles = [(s.get("title") or "").casefold() for s in lp.stubs]
        dates = [s.get("date_text") for s in lp.stubs if s.get("date_text") and str(s["date_text"])[:4].isdigit()]
        nav = lp.letter_nav

        def _pos(p: Any) -> str:
            return "none" if not p else (p[0] if p[1] == 1 else f"{p[0]}-{p[1]}")

        lines += [f"- stories parsed: **{len(lp.stubs)}** (strategy: {lp.strategy}); last page {lp.max_page}; "
                  f"embedded total {lp.total_items}, per page {lp.per_page}",
                  f"- page bar: previous {_pos(nav.get('prev'))}, next {_pos(nav.get('next'))}, "
                  f"last {_pos(nav.get('last'))}; position {nav.get('active_number')} of {nav.get('max_number')} "
                  f"in the category's whole A-Z sequence",
                  f"- order check (neighbouring pairs in order): titles A→Z {_order_share(titles)}, "
                  f"dates newest→oldest {_order_share(dates, descending=True)}",
                  f"- diagnostics: `{json.dumps(lp.diagnostics, default=str)}`", ""]
    if len(pages) == 2:
        overlap = {s["story_slug"] for s in pages[0].stubs} & {s["story_slug"] for s in pages[1].stubs}
        lines += [f"Page 2 vs page 1: {len(pages[1].stubs)} stories, {len(overlap)} repeated from page 1 "
                  f"(should be 0).", ""]
    return lines


def run_probe(ctx: Ctx) -> Path:
    base, logs = ctx.base_url, ctx.paths.logs
    lines = ["# Probe report", "", f"Session `{ctx.session_id}`; base URL {base}.", ""]
    f = ctx.fetcher

    f.ensure_robots()
    assert f.robots is not None
    lines += ["## robots.txt", "", "```", json.dumps(f.robots.summary(f.token), indent=2), "```", ""]
    tests = ["/s/example-story", "/c/adult-romance", "/series/se/123", "/api/3/stories/x", "/tags/x", "/authors/x/works/stories"]
    lines += ["| path | allowed for us |", "|---|---|"]
    for t in tests:
        lines.append(f"| `{t}` | {f.permitted(base + t)[0]} |")
    lines.append("")

    cats = discover_categories(ctx)
    lines += ["## Categories", "", f"Source: {ctx.state.get_meta('categories_source')}; selected: {len(cats)}", ""]
    lines += [", ".join(c["slug"] for c in cats), ""]

    cat = next((c for c in cats if c["slug"] == "adult-romance"), cats[0] if cats else None)
    story_rows: list[dict[str, Any]] = []
    if cat is not None:
        for cand in FIRST_PAGE_CANDIDATES:
            url = cand.format(base=base, slug=cat["slug"])
            res = f.fetch(url, "listing")
            lines += [f"## Listing page `{url}`", "",
                      f"Outcome: **{res.outcome}** (HTTP {res.status}) {res.detail}", ""]
            if res.body:  # also for pages rejected as 'no recognisable content', to diagnose why
                (logs / "probe_skeleton_listing.html").write_text(html_skeleton(res.body), encoding="utf-8")
            if not res.ok or not res.body:
                continue
            lp = parse_listing_page(res.body, res.final_url or url, base)
            lines += [f"- stories parsed: **{len(lp.stubs)}** (strategy: {lp.strategy})",
                      f"- pagination: last page {lp.max_page}, template {lp.page_url_template}",
                      f"- embedded total/per page: {lp.total_items}/{lp.per_page}",
                      f"- diagnostics: `{json.dumps(lp.diagnostics, default=str)}`", ""]
            lines += [f"- browse-by-title links: **{len(lp.browse_segments)}** ({' '.join(lp.browse_segments)})", ""]
            if lp.stubs:
                fields = Counter(k for s in lp.stubs for k, v in s.items() if v not in (None, "", {}, []))
                lines += ["Fields present on stubs: " + ", ".join(f"{k} ({n})" for k, n in sorted(fields.items())), ""]
                story_rows = lp.stubs[:5]
                break
        lines += _probe_frame(ctx, cat)
    for story_row in story_rows:
        url = story_page_url(base, story_row["story_slug"], 1)
        res = f.fetch(url, "story")
        lines += ["## Story page (from the listing)", "",
                  f"Outcome: **{res.outcome}** (HTTP {res.status}) {res.detail}", ""]
        if not res.ok:
            continue  # removed, disallowed or failed: try the next story
        if res.body:
            (logs / "probe_skeleton_story.html").write_text(html_skeleton(res.body), encoding="utf-8")
        if res.ok and res.body:
            sp = parse_story_page(res.body, res.final_url or url)
            if sp.status == "unavailable":
                lines += ["(not publicly readable yet; trying another story)", ""]
                continue
            words = sum(len(p.split()) for p in sp.paragraphs)
            lines += [f"- status: {sp.status}; warnings: {sp.warnings or 'none'}",
                      f"- text: {len(sp.paragraphs)} paragraphs, ~{words} words on this page (source: {sp.text_source})",
                      f"- pages in story: {sp.max_page}", "", "| field | value (summarised) | source |", "|---|---|---|"]
            for k in sorted(sp.fields):
                v = sp.fields[k]
                shown = v if isinstance(v, (int, float, bool)) else _fmt(v)  # text is summarised, never shown
                lines.append(f"| {k} | {shown} | {sp.sources.get(k, '')} |")
            wanted = ["title", "category_name", "date_published", "views", "favorites", "comments", "rating",
                      "author_name", "tags"]
            missing = [w for w in wanted if w not in sp.fields]
            lines += ["", f"**Missing important fields:** {', '.join(missing) if missing else 'none'}", ""]
        break
    lines += ["## Requests this probe", "", f"{f.session_requests} network request(s).", ""]
    report = logs / "probe_report.md"
    report.write_text("\n".join(lines), encoding="utf-8")
    log.info("Probe report written to %s", report)
    return report
