"""A collection session: lock (so only ONE collector ever runs), state, cache,
fetcher, run bookkeeping, and turning stop conditions into cooldowns."""

from __future__ import annotations

import os
import re
import signal
import threading
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator
from urllib.parse import urlsplit

from ..log import get_logger, setup_logging
from ..net.cache import PageCache
from ..net.fetcher import PoliteFetcher, StopCollection
from ..paths import DataPaths
from ..settings import PROJECT_ROOT, Settings
from ..state import State

log = get_logger("session")


class AlreadyRunning(RuntimeError):
    pass


@dataclass
class Ctx:
    settings: Settings
    paths: DataPaths
    state: State
    cache: PageCache
    fetcher: PoliteFetcher
    session_id: str

    @property
    def base_url(self) -> str:
        return self.settings.scope.base_url.rstrip("/")


class _Lock:
    """Exclusive lock on a file; guarantees concurrency = 1 across processes."""

    def __init__(self, path: Path):
        self.path = path
        self.fh = None

    def acquire(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.fh = open(self.path, "a+")
        try:
            import fcntl

            fcntl.flock(self.fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except ImportError:  # pragma: no cover - Windows
            import msvcrt

            try:
                msvcrt.locking(self.fh.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError as e:
                raise AlreadyRunning("Another collector process is already running.") from e
        except OSError as e:
            self.fh.close()
            raise AlreadyRunning(
                f"Another collector process is already running (lock: {self.path}). "
                "Only one may run at a time."
            ) from e
        self.fh.seek(0)
        self.fh.truncate()
        self.fh.write(str(os.getpid()))
        self.fh.flush()

    def release(self) -> None:
        if self.fh is not None:
            try:
                import fcntl

                fcntl.flock(self.fh.fileno(), fcntl.LOCK_UN)
            except ImportError:  # pragma: no cover
                pass
            self.fh.close()
            self.fh = None


def _stop_on_signals() -> dict:
    """Closing the Terminal window (SIGHUP) or `kill` (SIGTERM) stops a session the same clean way as Ctrl-C,
    so the run is recorded as ended. Returns the previous handlers."""
    if threading.current_thread() is not threading.main_thread():
        return {}

    def _handler(signum, frame):
        raise KeyboardInterrupt

    previous = {}
    for name in ("SIGTERM", "SIGHUP"):
        sig = getattr(signal, name, None)
        if sig is not None:
            previous[sig] = signal.signal(sig, _handler)
    return previous


def _restore_signals(previous: dict) -> None:
    for sig, handler in previous.items():
        signal.signal(sig, handler if handler is not None else signal.SIG_DFL)


def stop_file_path(settings: Settings) -> Path:
    base = settings.config_path.parent if settings.config_path else PROJECT_ROOT
    return base / "STOP"


def site_lock_path(settings: Settings) -> Path:
    """One lock per website per machine (not per data folder), so a second config file or a copied
    project folder cannot run a parallel collector against the same site."""
    root = Path(os.environ.get("LITCORR_LOCK_DIR") or (Path.home() / ".litcorr"))
    parts = urlsplit(settings.scope.base_url)
    host = re.sub(r"[^A-Za-z0-9.-]", "_", f"{parts.hostname}_{parts.port or ''}")
    return root / f"{host}.lock"


@contextmanager
def collector_session(settings: Settings, command: str, *, verbose: bool = False,
                      fetcher_factory=None) -> Iterator[Ctx]:
    paths = DataPaths(settings.data_dir).ensure()
    setup_logging(paths.logs, verbose)
    site_lock = _Lock(site_lock_path(settings))
    site_lock.acquire()
    lock = _Lock(paths.lock_file)
    state = None
    try:
        lock.acquire()
        state = State(paths.state_db)
        cache = PageCache(paths.cache)
        session_id = time.strftime("%Y%m%dT%H%M%S") + f"-{os.getpid()}-{uuid.uuid4().hex[:6]}"
        factory = fetcher_factory or PoliteFetcher
        fetcher = factory(settings, state, cache, session_id, stop_file=stop_file_path(settings),
                          log_dir=paths.logs)
        fetcher.check_cooldown()
    except BaseException:
        if state is not None:
            state.close()
        lock.release()
        site_lock.release()
        raise
    state.start_run(session_id, command, settings.to_dict())
    ctx = Ctx(settings, paths, state, cache, fetcher, session_id)
    stop_reason = "completed"
    log.info("Session %s started (%s). Create a file named STOP in %s to stop cleanly.",
             session_id, command, stop_file_path(settings).parent)
    previous_handlers = _stop_on_signals()
    try:
        yield ctx
    except StopCollection as e:
        stop_reason = e.reason
        log.warning("STOPPED: %s", e.message)
        if e.cooldown_hours > 0:
            until = time.time() + e.cooldown_hours * 3600
            state.set_cooldown(until, e.message[:400])
            log.warning("Cooldown recorded until %s.", time.strftime("%Y-%m-%d %H:%M", time.localtime(until)))
    except KeyboardInterrupt:
        stop_reason = "interrupted"
        log.warning("Stopped (Ctrl-C, window closed or process ended); progress is saved. "
                    "Run the same command again to resume.")
    except Exception:
        stop_reason = "crashed"
        log.error("Stopped by an unexpected error: a bug in this program, not a problem with the site. "
                  "Progress is saved. Please send the error message shown below.")
        raise
    finally:
        _restore_signals(previous_handlers)
        try:
            state.end_run(session_id, fetcher.session_requests, stop_reason)
            log.info("Session %s ended: %s, %d network requests.", session_id, stop_reason,
                     fetcher.session_requests)
            state.close()
        finally:
            if hasattr(fetcher, "http"):
                fetcher.http.close()
            lock.release()
            site_lock.release()
