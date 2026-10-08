"""`status`: offline progress summary (never touches the network)."""

from __future__ import annotations

import json
import time

from .paths import DataPaths
from .settings import Settings
from .state import State


def status_text(settings: Settings) -> str:
    paths = DataPaths(settings.data_dir)
    if not paths.state_db.exists():
        return "No collection state yet. Start with `python -m litcorr probe`."
    st = State.snapshot(paths.state_db)
    try:
        now = time.time()
        lines = ["Collection status", "=" * 17]
        cd = st.get_cooldown()
        if cd and cd[0] > now:
            lines.append(f"COOLDOWN until {time.strftime('%Y-%m-%d %H:%M', time.localtime(cd[0]))}: {cd[1]}")
        lines.append(f"Requests: last hour {st.count_requests_since(now - 3600)}, last 24 h "
                     f"{st.count_requests_since(now - 86400)}; outcomes {json.dumps(st.request_outcome_counts())}")
        cats = st.categories()
        sel = [c for c in cats if c["selected"]]
        done = [c for c in sel if c["listing_status"] == "done"]
        lines.append(f"Categories: {len(cats)} known ({st.get_meta('categories_source') or '?'}), "
                     f"{len(sel)} selected, listing finished for {len(done)}")
        layout = st.get_meta("listing_layout")
        if layout:
            lines.append(f"Listing layout: {layout}")
        frame = st.conn.execute("SELECT COUNT(DISTINCT story_slug) FROM listing_items").fetchone()[0]
        lines.append(f"Sampling frame: {frame} distinct stories seen on listing pages")
        counts = st.story_status_counts()
        total = sum(counts.values())
        lines.append(f"Story queue: {total} stories; " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())))
        unreadable = st.conn.execute("SELECT COUNT(*) FROM stories WHERE status IN ('queued', 'partial') "
                                     "AND last_error LIKE 'parse error%'").fetchone()[0]
        if unreadable:
            lines.append(f"Saved story pages the parser could not read: {unreadable} (they stay queued; "
                         "details in data/logs/errors.jsonl)")
        pages = st.conn.execute("SELECT kind, status, COUNT(*) n FROM pages GROUP BY kind, status").fetchall()
        lines.append("Pages: " + "; ".join(f"{r['kind']}/{r['status']} {r['n']}" for r in pages))
        rows = st.conn.execute(
            "SELECT s.category_slug, COUNT(*) n, SUM(s.status='done') d, "
            "SUM(s.status IN ('failed', 'gone', 'unavailable')) x FROM stories s GROUP BY s.category_slug"
        ).fetchall()
        if rows:
            lines.append("Per category (done / sampled, including replacements):")
            for r in rows:
                note = f"  ({r['x']} could not be collected)" if r["x"] else ""
                lines.append(f"  {r['category_slug']:<32} {r['d'] or 0:>6} / {r['n']}{note}")
        runs = st.runs()[-5:]
        if runs:
            lines.append("Recent sessions:")
            for r in runs:
                started = time.strftime("%Y-%m-%d %H:%M", time.localtime(r["started_at"] or 0))
                lines.append(f"  {started}  {r['command']:<8} {r['requests'] or 0:>5} requests  "
                             f"stop: {r['stop_reason'] or 'running?'}")
        return "\n".join(lines)
    finally:
        st.close()
