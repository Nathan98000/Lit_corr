"""SQLite progress database.

Everything needed to stop and resume lives here: which URLs were fetched (and
where their cached copy is), the listing-page sampling frame, the story queue,
the per-request log used for rate limiting, and any active cooldown.
"""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any, Iterable

SCHEMA_VERSION = 1

_SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    session_id TEXT,
    url TEXT NOT NULL,
    kind TEXT,
    attempt INTEGER,
    status INTEGER,
    outcome TEXT,
    bytes INTEGER,
    elapsed_ms INTEGER,
    note TEXT
);
CREATE INDEX IF NOT EXISTS idx_requests_ts ON requests(ts);

CREATE TABLE IF NOT EXISTS pages (
    url TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    http_status INTEGER,
    final_url TEXT,
    cache_key TEXT,
    content_sha1 TEXT,
    bytes INTEGER,
    fetched_at REAL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    headers_json TEXT
);

CREATE TABLE IF NOT EXISTS categories (
    slug TEXT PRIMARY KEY,
    name TEXT,
    url TEXT,
    source TEXT,
    site_id INTEGER,
    selected INTEGER NOT NULL DEFAULT 1,
    page_url_template TEXT,
    total_pages INTEGER,
    stories_per_page INTEGER,
    total_stories_reported INTEGER,
    listing_plan_json TEXT,
    listing_status TEXT NOT NULL DEFAULT 'pending',
    updated_at REAL
);

CREATE TABLE IF NOT EXISTS listing_items (
    story_slug TEXT NOT NULL,
    category_slug TEXT NOT NULL,
    listing_url TEXT NOT NULL,
    page_no INTEGER,
    position INTEGER,
    strategy TEXT,
    title TEXT,
    author TEXT,
    description TEXT,
    date_text TEXT,
    rating_text TEXT,
    views_text TEXT,
    extra_json TEXT,
    seen_at REAL,
    PRIMARY KEY (story_slug, listing_url)
);
CREATE INDEX IF NOT EXISTS idx_listing_cat ON listing_items(category_slug);

CREATE TABLE IF NOT EXISTS stories (
    story_slug TEXT PRIMARY KEY,
    category_slug TEXT,
    sample_rank INTEGER,
    status TEXT NOT NULL,
    pages_expected INTEGER,
    pages_fetched INTEGER NOT NULL DEFAULT 0,
    canonical_url TEXT,
    first_fetched_at REAL,
    last_fetched_at REAL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status, sample_rank);

CREATE TABLE IF NOT EXISTS runs (
    session_id TEXT PRIMARY KEY,
    command TEXT,
    started_at REAL,
    ended_at REAL,
    requests INTEGER,
    stop_reason TEXT,
    config_json TEXT
);

CREATE TABLE IF NOT EXISTS cooldown (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    until_ts REAL,
    reason TEXT
);
"""

# Story statuses
QUEUED, PARTIAL, DONE = "queued", "partial", "done"
FAILED, GONE, DISALLOWED, UNAVAILABLE, SKIPPED = "failed", "gone", "robots_disallowed", "unavailable", "skipped"
OPEN_STATUSES = (QUEUED, PARTIAL)


def _is_wal_file(path: Path) -> bool:
    """True if the database file's header says WAL mode (file format version bytes 18-19 are 2)."""
    with open(path, "rb") as fh:
        head = fh.read(20)
    return len(head) == 20 and head[18] == 2 and head[19] == 2


class State:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self.conn = sqlite3.connect(str(path), isolation_level=None, timeout=30)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA synchronous=NORMAL")
        self.conn.executescript(_SCHEMA)
        if self.get_meta("schema_version") is None:
            self.set_meta("schema_version", str(SCHEMA_VERSION))

    @classmethod
    def snapshot(cls, path: Path) -> "State":
        """A read-only, in-memory copy of the database, for the offline commands (build-raw, analyze, report,
        status, categories). They never write the database, and the collector can keep running meanwhile.

        A read-only SQLite connection to a database in WAL mode creates the -wal and -shm files when they do not
        exist, and cannot remove them again. So when no collector has the database open (no -wal file), the main
        file is read as immutable, which creates no files at all; if a collector opened the database during
        the copy, the copy is taken again the normal way. While a collector runs (-wal present), the copy is
        taken through SQLite's ordinary read-only path: it sees everything the collector has committed, never
        writes the database or its WAL, and like every reader only shares the -shm index. The copy takes well
        under a second, so it never holds up the collector's checkpoints.
        """
        if not path.exists():
            raise FileNotFoundError(f"{path} not found")
        wal = path.with_name(path.name + "-wal")
        mem = sqlite3.connect(":memory:", isolation_level=None)
        for _ in range(3):
            immutable = _is_wal_file(path) and not wal.exists()
            src = sqlite3.connect(f"{path.resolve().as_uri()}?{'immutable=1' if immutable else 'mode=ro'}",
                                  uri=True, timeout=30, isolation_level=None)
            try:
                src.backup(mem)
            finally:
                src.close()
            if not (immutable and wal.exists()):
                break
        obj = cls.__new__(cls)
        obj.path = path
        obj.conn = mem
        mem.row_factory = sqlite3.Row
        mem.execute("PRAGMA query_only=1")
        return obj

    def close(self) -> None:
        self.conn.close()

    # -- meta -------------------------------------------------------------
    def get_meta(self, key: str) -> str | None:
        row = self.conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
        return row["value"] if row else None

    def set_meta(self, key: str, value: str) -> None:
        self.conn.execute(
            "INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )

    # -- request log (network requests only; cache hits are not logged) ---
    def log_request_start(self, ts: float, session_id: str, url: str, kind: str, attempt: int) -> int:
        """Record a request BEFORE it is sent, so an interrupted request still counts toward the caps."""
        cur = self.conn.execute(
            "INSERT INTO requests(ts, session_id, url, kind, attempt, outcome) VALUES(?, ?, ?, ?, ?, 'in_flight')",
            (ts, session_id, url, kind, attempt),
        )
        return int(cur.lastrowid)

    def log_request_end(self, row_id: int, ts: float, status: int | None, outcome: str, nbytes: int,
                        elapsed_ms: int, note: str | None) -> None:
        self.conn.execute(
            "UPDATE requests SET ts=?, status=?, outcome=?, bytes=?, elapsed_ms=?, note=? WHERE id=?",
            (ts, status, outcome, nbytes, elapsed_ms, note, row_id),
        )

    def count_requests_since(self, ts: float) -> int:
        return self.conn.execute("SELECT COUNT(*) FROM requests WHERE ts > ?", (ts,)).fetchone()[0]

    def count_outcome_since(self, ts: float, outcome: str) -> int:
        return self.conn.execute("SELECT COUNT(*) FROM requests WHERE ts > ? AND outcome = ?",
                                 (ts, outcome)).fetchone()[0]

    def oldest_request_since(self, ts: float) -> float | None:
        row = self.conn.execute("SELECT MIN(ts) FROM requests WHERE ts > ?", (ts,)).fetchone()
        return row[0]

    def last_request_ts(self) -> float | None:
        return self.conn.execute("SELECT MAX(ts) FROM requests").fetchone()[0]

    def request_outcome_counts(self) -> dict[str, int]:
        rows = self.conn.execute("SELECT outcome, COUNT(*) n FROM requests GROUP BY outcome").fetchall()
        return {r["outcome"]: r["n"] for r in rows}

    # -- pages ------------------------------------------------------------
    def get_page(self, url: str) -> dict[str, Any] | None:
        row = self.conn.execute("SELECT * FROM pages WHERE url=?", (url,)).fetchone()
        return dict(row) if row else None

    def upsert_page(self, url: str, kind: str, status: str, **fields: Any) -> None:
        existing = self.get_page(url)
        data = dict(existing) if existing else {"url": url, "attempts": 0}
        data.update(fields)
        data["kind"], data["status"] = kind, status
        cols = ["url", "kind", "status", "http_status", "final_url", "cache_key", "content_sha1",
                "bytes", "fetched_at", "attempts", "last_error", "headers_json"]
        self.conn.execute(
            f"INSERT OR REPLACE INTO pages({', '.join(cols)}) VALUES({', '.join('?' for _ in cols)})",
            [data.get(c) for c in cols],
        )

    def bump_page_attempts(self, url: str, kind: str) -> int:
        page = self.get_page(url)
        attempts = (page["attempts"] if page else 0) + 1
        if page:
            self.conn.execute("UPDATE pages SET attempts=? WHERE url=?", (attempts, url))
        else:
            self.upsert_page(url, kind, "pending", attempts=attempts)
        return attempts

    def unbump_page_attempts(self, url: str) -> None:
        self.conn.execute("UPDATE pages SET attempts=MAX(COALESCE(attempts, 0) - 1, 0) WHERE url=?", (url,))

    def all_pages(self) -> list[dict[str, Any]]:
        return [dict(r) for r in self.conn.execute("SELECT * FROM pages ORDER BY fetched_at")]

    # -- categories -------------------------------------------------------
    def upsert_category(self, slug: str, **fields: Any) -> None:
        row = self.conn.execute("SELECT * FROM categories WHERE slug=?", (slug,)).fetchone()
        data = dict(row) if row else {"slug": slug, "selected": 1, "listing_status": "pending"}
        data.update(fields)
        data["updated_at"] = time.time()
        cols = ["slug", "name", "url", "source", "site_id", "selected", "page_url_template", "total_pages",
                "stories_per_page", "total_stories_reported", "listing_plan_json", "listing_status", "updated_at"]
        self.conn.execute(
            f"INSERT OR REPLACE INTO categories({', '.join(cols)}) VALUES({', '.join('?' for _ in cols)})",
            [data.get(c) for c in cols],
        )

    def categories(self, selected_only: bool = False) -> list[dict[str, Any]]:
        q = "SELECT * FROM categories" + (" WHERE selected=1" if selected_only else "") + " ORDER BY slug"
        return [dict(r) for r in self.conn.execute(q)]

    def get_category(self, slug: str) -> dict[str, Any] | None:
        row = self.conn.execute("SELECT * FROM categories WHERE slug=?", (slug,)).fetchone()
        return dict(row) if row else None

    # -- listing items (sampling frame) ------------------------------------
    def add_listing_items(self, rows: Iterable[dict[str, Any]]) -> int:
        cols = ["story_slug", "category_slug", "listing_url", "page_no", "position", "strategy", "title",
                "author", "description", "date_text", "rating_text", "views_text", "extra_json", "seen_at"]
        n = 0
        self.conn.execute("BEGIN")
        try:
            for r in rows:
                r = dict(r)
                if isinstance(r.get("extra_json"), (dict, list)):
                    r["extra_json"] = json.dumps(r["extra_json"], ensure_ascii=False, default=str)
                r.setdefault("seen_at", time.time())
                self.conn.execute(
                    f"INSERT OR IGNORE INTO listing_items({', '.join(cols)}) VALUES({', '.join('?' for _ in cols)})",
                    [r.get(c) for c in cols],
                )
                n += 1
            self.conn.execute("COMMIT")
        except BaseException:  # including Ctrl-C: leave no half-written transaction behind
            self.conn.execute("ROLLBACK")
            raise
        return n

    def listing_items(self, category_slug: str | None = None) -> list[dict[str, Any]]:
        if category_slug is None:
            q, args = "SELECT * FROM listing_items ORDER BY category_slug, page_no, position", ()
        else:
            q, args = "SELECT * FROM listing_items WHERE category_slug=? ORDER BY page_no, position", (category_slug,)
        return [dict(r) for r in self.conn.execute(q, args)]

    # -- stories ----------------------------------------------------------
    def queue_story(self, slug: str, category_slug: str | None, sample_rank: int) -> bool:
        cur = self.conn.execute(
            "INSERT OR IGNORE INTO stories(story_slug, category_slug, sample_rank, status) VALUES(?, ?, ?, ?)",
            (slug, category_slug, sample_rank, QUEUED),
        )
        return cur.rowcount > 0

    def get_story(self, slug: str) -> dict[str, Any] | None:
        row = self.conn.execute("SELECT * FROM stories WHERE story_slug=?", (slug,)).fetchone()
        return dict(row) if row else None

    def update_story(self, slug: str, **fields: Any) -> None:
        if not fields:
            return
        sets = ", ".join(f"{k}=?" for k in fields)
        self.conn.execute(f"UPDATE stories SET {sets} WHERE story_slug=?", [*fields.values(), slug])

    def next_open_stories(self, limit: int = 50) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT * FROM stories WHERE status IN (?, ?) ORDER BY sample_rank, story_slug LIMIT ?",
            (*OPEN_STATUSES, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    def stories(self, statuses: Iterable[str] | None = None) -> list[dict[str, Any]]:
        if statuses:
            st = list(statuses)
            q = f"SELECT * FROM stories WHERE status IN ({', '.join('?' for _ in st)}) ORDER BY sample_rank"
            return [dict(r) for r in self.conn.execute(q, st)]
        return [dict(r) for r in self.conn.execute("SELECT * FROM stories ORDER BY sample_rank")]

    def story_status_counts(self) -> dict[str, int]:
        rows = self.conn.execute("SELECT status, COUNT(*) n FROM stories GROUP BY status").fetchall()
        return {r["status"]: r["n"] for r in rows}

    def max_sample_rank(self) -> int:
        v = self.conn.execute("SELECT MAX(sample_rank) FROM stories").fetchone()[0]
        return int(v) if v is not None else -1

    # -- runs and cooldown -------------------------------------------------
    def start_run(self, session_id: str, command: str, config: dict[str, Any]) -> None:
        self.conn.execute(
            "INSERT INTO runs(session_id, command, started_at, config_json) VALUES(?, ?, ?, ?)",
            (session_id, command, time.time(), json.dumps(config, default=str)),
        )

    def end_run(self, session_id: str, requests: int, stop_reason: str) -> None:
        self.conn.execute(
            "UPDATE runs SET ended_at=?, requests=?, stop_reason=? WHERE session_id=?",
            (time.time(), requests, stop_reason, session_id),
        )

    def runs(self) -> list[dict[str, Any]]:
        return [dict(r) for r in self.conn.execute("SELECT * FROM runs ORDER BY started_at")]

    def set_cooldown(self, until_ts: float, reason: str) -> None:
        current = self.get_cooldown()
        if current and current[0] >= until_ts:
            return
        self.conn.execute("INSERT OR REPLACE INTO cooldown(id, until_ts, reason) VALUES(1, ?, ?)", (until_ts, reason))

    def get_cooldown(self) -> tuple[float, str] | None:
        row = self.conn.execute("SELECT until_ts, reason FROM cooldown WHERE id=1").fetchone()
        return (row["until_ts"], row["reason"]) if row else None
