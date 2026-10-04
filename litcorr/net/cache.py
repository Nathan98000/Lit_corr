"""On-disk page cache. Every successfully downloaded page is stored gzip-compressed,
keyed by the SHA-1 of its normalized URL, so it is never downloaded twice and all
parsing can be redone offline."""

from __future__ import annotations

import gzip
import hashlib
import os
import zlib
from pathlib import Path


class PageCache:
    def __init__(self, cache_dir: Path):
        self.root = cache_dir / "pages"
        self.root.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def key_for(url: str) -> str:
        return hashlib.sha1(url.encode("utf-8")).hexdigest()

    def path_for(self, key: str) -> Path:
        return self.root / key[:2] / f"{key}.html.gz"

    def put(self, url: str, body: bytes) -> tuple[str, str, int]:
        """Store body; return (cache_key, sha1_of_content, size_in_bytes)."""
        key = self.key_for(url)
        path = self.path_for(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        with open(tmp, "wb") as raw:
            with gzip.GzipFile(fileobj=raw, mode="wb", compresslevel=6) as fh:
                fh.write(body)
            raw.flush()
            os.fsync(raw.fileno())  # on disk before it is renamed into place and recorded as saved
        os.replace(tmp, path)
        return key, hashlib.sha1(body).hexdigest(), len(body)

    def get(self, key: str | None) -> bytes | None:
        if not key:
            return None
        path = self.path_for(key)
        if not path.exists():
            return None
        try:
            with gzip.open(path, "rb") as fh:
                return fh.read()
        except (OSError, EOFError, zlib.error):  # unreadable (e.g. cut short by a power failure)
            return None

    def has(self, key: str | None) -> bool:
        return bool(key) and self.path_for(key).exists()
