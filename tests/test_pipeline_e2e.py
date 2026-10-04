"""End to end against the local mock site: collect -> build-raw -> analyze -> report -> handoff,
plus resumability (interrupt, resume, rerun = no new requests)."""

from __future__ import annotations

import io
import zipfile

import pandas as pd

from litcorr.collect.discover import collect_listings, discover_categories
from litcorr.collect.sample import build_queue
from litcorr.collect.session import collector_session
from litcorr.collect.stories import collect_stories
from litcorr.demo import run_pipeline
from litcorr.docs import render_methodology
from litcorr.export import IDENTIFYING
from litcorr.paths import DataPaths
from litcorr.schema import BY_NAME, ORDER
from litcorr.settings import PROJECT_ROOT


def _collect(settings, factory):
    with collector_session(settings, "test", fetcher_factory=factory) as ctx:
        collect_listings(ctx, discover_categories(ctx))
        build_queue(ctx)
        collect_stories(ctx)


def test_full_pipeline_and_resume(server, make_settings, factory):
    site, base = server
    s = make_settings(base, max_requests_per_session=25)
    _collect(s, factory)  # stops early on the session cap
    first_hits = len(site.hits)
    assert first_hits == 25
    s.politeness.max_requests_per_session = 1_000_000
    result = run_pipeline(s, fetcher_factory=factory)  # resumes where it stopped
    story_hits = [h for h in site.hits if h.startswith("/s/")]
    assert len(story_hits) == len(set(story_hits)), "a page was downloaded twice"
    n_before = len(site.hits)
    _collect(s, factory)  # everything is cached: a rerun makes no requests at all
    assert len(site.hits) == n_before

    paths = DataPaths(s.data_dir)
    df = pd.read_parquet(paths.features)
    ok = [x for x in site.stories if x.status == "ok" and x.slug != "secret-story"]
    assert int(df["has_text"].sum()) == len(ok)
    assert set(df.columns) >= set(ORDER)
    assert set(df["category_name"].dropna()) <= {c[1] for c in __import__("litcorr.demo").demo.CATEGORIES}
    flags = {f for fl in df["qc_flags"] for f in fl}
    assert {"status_gone", "status_robots_disallowed", "status_unavailable"} <= flags
    included = df[df["analysis_include"]]
    assert included["pop_views"].notna().all() and included["pov_class"].notna().all()
    # Every processed column is documented, and every documented variable exists.
    undocumented = [c for c in df.columns if c not in BY_NAME]
    assert not undocumented, undocumented

    # Handoff: no story text, no identifiers.
    z = zipfile.ZipFile(result["handoff"])
    h = pd.read_parquet(io.BytesIO(z.read("stories_features.parquet")))
    assert not set(h.columns) & set(IDENTIFYING)
    assert "data_dictionary.json" in z.namelist() and "quality_report.md" in z.namelist()
    assert result["report"]["stories_with_text"] == len(ok)


def test_recheck_fetches_only_missing_pages(server, make_settings, factory):
    from litcorr.collect.stories import recheck_page_counts
    from litcorr.state import DONE

    site, base = server
    s = make_settings(base)
    _collect(s, factory)
    multi = next(x for x in site.stories if len(x.pages) == 3 and x.status == "ok")
    with collector_session(s, "test", fetcher_factory=factory) as ctx:
        # Pretend an older parser missed the pagination: only page 1 was collected.
        ctx.state.update_story(multi.slug, status=DONE, pages_fetched=1, pages_expected=1)
        for n in (2, 3):
            ctx.state.conn.execute("DELETE FROM pages WHERE url=?", (f"{base}/s/{multi.slug}?page={n}",))
        before = len(site.hits)
        assert recheck_page_counts(ctx) == 1
        assert len(site.hits) == before  # rechecking itself is offline
        collect_stories(ctx)
        assert ctx.state.get_story(multi.slug)["pages_fetched"] == 3
    new = site.hits[before:]
    assert sorted(new) == sorted([f"/s/{multi.slug}?page=2", f"/s/{multi.slug}?page=3"])


def test_methodology_template_tables_render():
    from litcorr.schema import REG

    tpl = (PROJECT_ROOT / "docs" / "methodology_template.md").read_text(encoding="utf-8")
    out = render_methodology(tpl)
    assert "{{table:" not in out and "| Variable |" in out
    missing = {x.group for x in REG if f"{{{{table:{x.group}}}}}" not in tpl}
    assert not missing, f"variable groups not explained in the methodology: {missing}"
