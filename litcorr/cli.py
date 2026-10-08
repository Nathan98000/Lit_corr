"""Command-line interface: ``python -m litcorr <command>``.

Network commands (talk to Literotica, slowly):  probe, collect
Offline commands (never touch the network):     status, categories, build-raw, analyze, report, refresh,
                                                docs, export-handoff, process, demo, site-data
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .log import setup_logging
from .settings import ConfigError, load_settings, validate


def _settings(args: argparse.Namespace):
    s = load_settings(args.config)
    for w in validate(s):
        print(f"WARNING: {w}", file=sys.stderr)
    return s


def cmd_probe(args):
    from .collect.probe import run_probe
    from .collect.session import collector_session

    s = _settings(args)
    report = None
    with collector_session(s, "probe", verbose=args.verbose) as ctx:
        report = run_probe(ctx)
    if report:
        print(f"\nProbe report: {report}\nSkeleton files (no story text) are next to it in {report.parent}.")
    else:
        print("\nThe probe stopped before finishing (see the STOPPED message above). Nothing was worked around. "
              "See 'If the site blocks the collector' in README.md and docs/SITE_RULES.md.", file=sys.stderr)


def cmd_collect(args):
    from .collect.discover import collect_listings, discover_categories
    from .collect.sample import build_queue
    from .collect.session import collector_session
    from .collect.stories import collect_stories, recheck_page_counts, requeue_newly_allowed
    from .status import status_text

    s = _settings(args)
    if args.max_requests:
        s.politeness.max_requests_per_session = args.max_requests
    with collector_session(s, "collect", verbose=args.verbose) as ctx:
        cats = discover_categories(ctx)
        collect_listings(ctx, cats)
        build_queue(ctx)
        requeue_newly_allowed(ctx)
        if args.recheck:
            recheck_page_counts(ctx)
        if not args.listings_only:
            collect_stories(ctx)
    print()
    print(status_text(s))


def cmd_status(args):
    from .status import status_text

    print(status_text(load_settings(args.config)))


def cmd_categories(args):
    from .paths import DataPaths
    from .site.categories import BUILTIN_CATEGORIES
    from .state import State

    s = load_settings(args.config)
    p = DataPaths(s.data_dir)
    if p.state_db.exists():
        st = State.snapshot(p.state_db)
        cats = st.categories()
        st.close()
        if cats:
            for c in cats:
                print(f"{'*' if c['selected'] else ' '} {c['slug']:<32} {c['name'] or ''}  [{c['source']}]")
            print("\n* = selected by config.toml")
            return
    print("Categories have not been discovered yet (run `probe`). Built-in list:")
    for c in BUILTIN_CATEGORIES:
        print(f"  {c.slug:<32} {c.name}")


def cmd_build_raw(args):
    from .build.raw_corpus import build_raw

    s = load_settings(args.config)
    setup_logging(None, args.verbose)
    print(build_raw(s, workers=args.workers, full=getattr(args, "full", False)))


def cmd_analyze(args):
    from .analyze import run_analyze

    s = load_settings(args.config)
    setup_logging(None, args.verbose)
    print(run_analyze(s, workers=args.workers, write_csv=not args.no_csv, full=getattr(args, "full", False)))


def cmd_report(args):
    from .build.quality import quality_report
    from .paths import DataPaths

    s = load_settings(args.config)
    quality_report(s)
    print(DataPaths(s.data_dir).quality_md.read_text(encoding="utf-8"))


def cmd_refresh(args):
    """build-raw + analyze (both incremental) + report + a profile comparison with the previous refresh."""
    from .refresh import run_refresh

    s = load_settings(args.config)
    setup_logging(None, args.verbose)
    print(run_refresh(s, workers=args.workers, full=args.full))


def cmd_docs(args):
    from .docs import write_docs

    for p in write_docs():
        print(f"wrote {p}")


def cmd_export(args):
    from .export import export_handoff

    s = load_settings(args.config)
    setup_logging(None, args.verbose)
    print(f"\nGive this file back for Stage 2: {export_handoff(s)}")


def cmd_process(args):
    """Everything after collection, in order (all offline)."""
    args.no_csv = False
    cmd_build_raw(args)
    cmd_analyze(args)
    from .build.quality import quality_report

    quality_report(load_settings(args.config))
    cmd_docs(args)
    cmd_export(args)


def cmd_site_data(args):
    """Stage 2: the website's aggregates, from the handoff zip only."""
    from .stage2.site_data import build_site_data

    setup_logging(None, args.verbose)
    summary = build_site_data(Path(args.handoff) if args.handoff else None, Path(args.out) if args.out else None,
                              workers=args.workers)
    print(f"Site aggregates: {summary}")


def cmd_demo(args):
    from .demo import run_demo

    run_demo(Path(args.out), n_per_category=args.stories, verbose=args.verbose)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m litcorr", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default=None, help="path to config.toml (default: the project's config.toml)")
    ap.add_argument("-v", "--verbose", action="store_true", help="more detailed console output")
    sub = ap.add_subparsers(dest="command", required=True)
    sub.add_parser("probe", help="tiny check (~5 requests) that collection works; writes data/logs/probe_report.md")
    c = sub.add_parser("collect", help="collect listing pages and stories (resumable; respects all caps)")
    c.add_argument("--max-requests", type=int, default=0, help="request cap for this session (overrides config)")
    c.add_argument("--listings-only", action="store_true", help="stop after listing pages and the sample queue")
    c.add_argument("--recheck", action="store_true",
                   help="after a parser fix: re-read cached first pages and fetch any story pages that were missed")
    sub.add_parser("status", help="offline progress summary")
    sub.add_parser("categories", help="list categories and which are selected")
    b = sub.add_parser("build-raw", help="parse the page cache into data/raw/*.parquet (offline)")
    b.add_argument("--workers", type=int, default=0)
    b.add_argument("--full", action="store_true", help="parse every story again instead of reusing unchanged ones")
    a = sub.add_parser("analyze", help="compute text measures + popularity -> data/processed (offline)")
    a.add_argument("--workers", type=int, default=0)
    a.add_argument("--no-csv", action="store_true", help="skip the CSV export")
    a.add_argument("--full", action="store_true", help="measure every story again instead of using the cache")
    sub.add_parser("report", help="write and print the data-quality report (offline)")
    r = sub.add_parser("refresh", help="build-raw + analyze (incremental) + report + profile comparison; no export")
    r.add_argument("--workers", type=int, default=0)
    r.add_argument("--full", action="store_true", help="redo every story (no caches)")
    sub.add_parser("docs", help="regenerate docs/DATA_DICTIONARY.md and docs/METHODOLOGY.md tables")
    sub.add_parser("export-handoff", help="zip the processed data for Stage 2 (no text, no identifiers)")
    p = sub.add_parser("process", help="build-raw + analyze + report + docs + export-handoff (offline)")
    p.add_argument("--workers", type=int, default=0)
    sd = sub.add_parser("site-data", help="Stage 2: build the website's aggregates from the handoff zip (offline)")
    sd.add_argument("--handoff", default=None, help="handoff zip (default: the newest in data/handoff/)")
    sd.add_argument("--out", default=None, help="output folder (default: site/public/aggregates/)")
    sd.add_argument("--workers", type=int, default=0)
    d = sub.add_parser("demo", help="run the whole pipeline against a local synthetic site (no internet)")
    d.add_argument("--out", default="data_demo", help="output folder for the demo (default data_demo/)")
    d.add_argument("--stories", type=int, default=40, help="synthetic stories per category")
    args = ap.parse_args(argv)
    handlers = {"probe": cmd_probe, "collect": cmd_collect, "status": cmd_status, "categories": cmd_categories,
                "build-raw": cmd_build_raw, "analyze": cmd_analyze, "report": cmd_report, "refresh": cmd_refresh,
                "docs": cmd_docs,
                "export-handoff": cmd_export, "process": cmd_process, "site-data": cmd_site_data, "demo": cmd_demo}
    from .collect.session import AlreadyRunning
    from .net.fetcher import StopCollection

    try:
        handlers[args.command](args)
    except ConfigError as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        return 2
    except (AlreadyRunning, StopCollection) as e:
        print(str(e), file=sys.stderr)
        return 3
    except FileNotFoundError as e:
        print(str(e), file=sys.stderr)
        return 4
    return 0
