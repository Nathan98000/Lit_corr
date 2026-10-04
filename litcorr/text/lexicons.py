"""Load the editable word lists in ``lexicons/`` and match them against a document.

See ``lexicons/README.md`` for the file format. Matching rules:
  * whole words only, case-insensitive, curly apostrophes normalised;
  * ``word*`` matches any word starting with ``word``;
  * multi-word entries match consecutive words within one paragraph;
  * within one lexicon, a word is counted at most once: phrases are matched
    first (longest first) and the words they cover are not counted again.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from ..settings import PROJECT_ROOT

LEXICON_DIR = PROJECT_ROOT / "lexicons"


def norm_token(t: str) -> str:
    return t.lower().replace("’", "'").replace("‘", "'")


@dataclass
class Lexicon:
    name: str
    label: str = ""
    description: str = ""
    notes: str = ""
    words: frozenset[str] = frozenset()
    prefixes: tuple[str, ...] = ()
    phrases: dict[str, list[tuple[str, ...]]] = field(default_factory=dict)
    n_entries: int = 0

    def __post_init__(self) -> None:
        self._cache: dict[str, bool] = {}

    def word_matches(self, w: str) -> bool:
        r = self._cache.get(w)
        if r is None:
            r = w in self.words or (bool(self.prefixes) and w.startswith(self.prefixes))
            self._cache[w] = r
        return r

    def entries(self) -> list[str]:
        out = sorted(self.words) + [p + "*" for p in self.prefixes]
        out += [" ".join(ph) for phs in self.phrases.values() for ph in phs]
        return out


def load_lexicon(path: Path) -> Lexicon:
    meta: dict[str, str] = {}
    words: set[str] = set()
    prefixes: set[str] = set()
    phrases: dict[str, list[tuple[str, ...]]] = {}
    n = 0
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#"):
            body = line[1:].strip()
            if ":" in body:
                k, v = body.split(":", 1)
                if k.strip() in ("name", "label", "description", "notes"):
                    meta[k.strip()] = v.strip()
            continue
        if "  #" in line:
            line = line.split("  #", 1)[0].strip()
        entry = norm_token(line)
        parts = entry.split()
        n += 1
        if len(parts) == 1:
            if entry.endswith("*"):
                prefixes.add(entry[:-1])
            else:
                words.add(entry)
        else:
            if any("*" in p for p in parts):
                raise ValueError(f"{path.name}: wildcards are not supported inside phrases ({line!r})")
            phrases.setdefault(parts[0], []).append(tuple(parts))
    for k in phrases:
        phrases[k] = sorted(set(phrases[k]), key=len, reverse=True)
    name = meta.get("name") or path.stem
    if name != path.stem:
        raise ValueError(f"{path.name}: '# name: {name}' must match the file name")
    return Lexicon(name=name, label=meta.get("label", name), description=meta.get("description", ""),
                   notes=meta.get("notes", ""), words=frozenset(words), prefixes=tuple(sorted(prefixes)),
                   phrases=phrases, n_entries=n)


def load_all(directory: Path = LEXICON_DIR) -> dict[str, Lexicon]:
    return {p.stem: load_lexicon(p) for p in sorted(directory.glob("*.txt"))}


def lexicon_hash(directory: Path = LEXICON_DIR) -> str:
    """A short fingerprint of every word list (file names and contents): any edit changes it."""
    import hashlib

    h = hashlib.sha256()
    for p in sorted(directory.glob("*.txt")):
        h.update(p.name.encode("utf-8") + b"\0" + p.read_bytes() + b"\0")
    return h.hexdigest()[:16]


def match(lex: Lexicon, vocab: list[str], type_ids: np.ndarray, para_idx: np.ndarray,
          positions_by_type: dict[int, np.ndarray] | None = None) -> np.ndarray:
    """Return an int8 array with 1 at the first word of every match of ``lex``."""
    n = len(type_ids)
    hits = np.zeros(n, dtype=np.int8)
    if n == 0:
        return hits
    consumed = np.zeros(n, dtype=bool)
    if lex.phrases:
        index = {w: i for i, w in enumerate(vocab)}
        starts_list = []
        for first in lex.phrases:
            tid = index.get(first)
            if tid is not None:
                starts_list.append(positions_by_type[tid] if positions_by_type is not None
                                   else np.nonzero(type_ids == tid)[0])
        # Left to right; at each position the longest phrase wins.
        for p in np.sort(np.concatenate(starts_list)) if starts_list else ():
            if consumed[p]:
                continue
            for ph in lex.phrases[vocab[type_ids[p]]]:
                L = len(ph)
                if p + L > n or para_idx[p + L - 1] != para_idx[p]:
                    continue
                if all(vocab[type_ids[p + j]] == ph[j] for j in range(1, L)) and not consumed[p:p + L].any():
                    hits[p] = 1
                    consumed[p:p + L] = True
                    break
    type_bool = np.fromiter((lex.word_matches(w) for w in vocab), dtype=bool, count=len(vocab))
    single = type_bool[type_ids] & ~consumed
    hits[single] = 1
    return hits
