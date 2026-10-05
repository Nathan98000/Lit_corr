"""Stage 1B phase 6: incremental re-runs give exactly what a full rebuild gives, the offline commands never write
the collector's state database, and a partial collection is labelled as such. Against the local mock site."""

from __future__ import annotations

import hashlib
import json

import pandas as pd

from litcorr.analyze import run_analyze
from litcorr.build.quality import quality_report
from litcorr.build.raw_corpus import build_raw
from litcorr.collect.discover import collect_listings, discover_categories
from litcorr.collect.sample import build_queue
from litcorr.collect.session import collector_session
from litcorr.collect.stories import collect_stories
from litcorr.paths import DataPaths
from litcorr.refresh import run_refresh
from litcorr.state import State
from litcorr.status import status_text


def _collect(settings, factory, cap=None):
    if cap:
        settings.politeness.max_requests_per_session = cap
    with collector_session(settings, "test", fetcher_factory=factory) as ctx:
        collect_listings(ctx, discover_categories(ctx))
        build_queue(ctx)
        collect_stories(ctx)
    settings.politeness.max_requests_per_session = 1_000_000


def _sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None


def _sidecars(db):
    return sorted(p.name for p in db.parent.glob(db.name + "-*"))


def test_incremental_runs_equal_a_full_rebuild(server, make_settings, factory):
    site, base = server
    s = make_settings(base)
    paths = DataPaths(s.data_dir)
    _collect(s, factory, cap=60)  # part of the collection
    build_raw(s, workers=1)
    first = run_analyze(s, workers=1)
    assert first["from_cache"] == 0
    _collect(s, factory)  # the rest arrives
    raw_inc = build_raw(s, workers=1)
    proc_inc = run_analyze(s, workers=1)
    assert raw_inc["reused"] > 0 and raw_inc["parsed"] > 0
    assert proc_inc["from_cache"] > 0 and proc_inc["measured"] > 0
    raw_i, feat_i = pd.read_parquet(paths.raw_stories), pd.read_parquet(paths.features)
    raw_full = build_raw(s, workers=1, full=True)
    proc_full = run_analyze(s, workers=1, full=True)
    assert raw_full["reused"] == 0 and proc_full["from_cache"] == 0
    pd.testing.assert_frame_equal(raw_i, pd.read_parquet(paths.raw_stories))
    pd.testing.assert_frame_equal(feat_i, pd.read_parquet(paths.features))
    # Nothing new: nothing is parsed or measured again.
    assert build_raw(s, workers=1)["parsed"] == 0
    assert run_analyze(s, workers=1)["measured"] == 0
    # A measure setting changes: every story is measured again.
    s.analysis.window_tokens += 100
    assert run_analyze(s, workers=1)["from_cache"] == 0


def test_offline_commands_never_write_the_state_database(server, make_settings, factory):
    site, base = server
    s = make_settings(base)
    _collect(s, factory)
    db = DataPaths(s.data_dir).state_db
    assert _sidecars(db) == []  # the collector closed the database cleanly
    before = _sha(db)
    build_raw(s, workers=1)
    run_analyze(s, workers=1)
    quality_report(s)
    assert "Story queue" in status_text(s)
    assert _sha(db) == before and _sidecars(db) == []  # not even -wal / -shm files were created

    # While a collector has the database open, with changes not yet checkpointed into the main file:
    writer = State(db)
    writer.conn.execute("PRAGMA wal_autocheckpoint=0")
    writer.set_meta("still_in_wal", "yes")
    main, wal = _sha(db), _sha(db.with_name(db.name + "-wal"))
    snap = State.snapshot(db)
    assert snap.get_meta("still_in_wal") == "yes"  # the reader sees what the collector committed
    snap.close()
    status_text(s)
    run_analyze(s, workers=1)
    quality_report(s)
    assert _sha(db) == main and _sha(db.with_name(db.name + "-wal")) == wal
    writer.close()


def test_a_partial_collection_is_labelled_and_refresh_compares_runs(server, make_settings, factory):
    site, base = server
    s = make_settings(base)
    paths = DataPaths(s.data_dir)
    _collect(s, factory, cap=60)
    first = run_refresh(s, workers=1)
    assert "PARTIAL" in first and "first refresh profile" in first
    manifest = json.loads(paths.manifest.read_text())
    prog = manifest["collection_progress"]
    assert prog["complete"] is False and manifest["sampling_weights_provisional"] is True
    assert prog["still_queued"] > 0 and prog["collected"] + prog["still_queued"] + prog["not_collectable"] == \
        prog["sampled"]
    assert "## Collection progress: PARTIAL" in paths.quality_md.read_text()
    _collect(s, factory)
    second = run_refresh(s, workers=1)
    assert "compared with the refresh of" in second and (paths.refresh_profiles / "latest_diff.md").exists()
    manifest = json.loads(paths.manifest.read_text())
    assert manifest["collection_progress"]["still_queued"] == 0
    # Profiles hold aggregate statistics only: no story keys.
    keys = set(pd.read_parquet(paths.features)["story_key"])
    for f in paths.refresh_profiles.rglob("*.tsv"):
        assert not any(k in f.read_text() for k in keys), f
