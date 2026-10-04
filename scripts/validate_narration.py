"""Re-run the narrative-perspective validation described in docs/METHODOLOGY.md.

Downloads 14 public-domain books (about 9 MB) once into data/validation/: eight
from the NLTK Gutenberg sample on GitHub and six from a Project Gutenberg
mirror (the main gutenberg.org site asks automated tools to use mirrors). Each
book is cut into ~5,000-word passages and classified; the share of passages
labelled correctly is printed.

    python scripts/validate_narration.py
"""

from __future__ import annotations

import collections
import io
import re
import sys
import time
import zipfile
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from litcorr.text.features import Measurer  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "data" / "validation"
NLTK = "https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/gutenberg.zip"
MIRROR = "https://mirrors.xmission.com/gutenberg"
FIRST = {1260: "Jane Eyre", 1400: "Great Expectations", 120: "Treasure Island", 76: "Huckleberry Finn",
         1661: "Adventures of Sherlock Holmes", 64317: "The Great Gatsby"}
THIRD = ["austen-emma", "austen-persuasion", "austen-sense", "carroll-alice", "chesterton-thursday",
         "chesterton-brown", "chesterton-ball", "edgeworth-parents"]
UA = {"User-Agent": "litcorr-validation/0.1 (one-off download of public-domain texts)"}


def mirror_path(n: int) -> str:
    s = str(n)
    return "/".join(list(s[:-1]) + [s]) if len(s) > 1 else f"0/{s}"


def fetch_texts() -> dict[str, tuple[str, str]]:
    OUT.mkdir(parents=True, exist_ok=True)
    texts: dict[str, tuple[str, str]] = {}
    z = OUT / "gutenberg.zip"
    if not z.exists():
        z.write_bytes(requests.get(NLTK, headers=UA, timeout=60).content)
    with zipfile.ZipFile(z) as zf:
        for name in THIRD:
            texts[name] = ("third", zf.read(f"gutenberg/{name}.txt").decode("utf-8", "replace"))
    for n, title in FIRST.items():
        f = OUT / f"pg{n}.txt"
        if not f.exists():
            for fn in (f"{n}-0.txt", f"{n}.txt", f"{n}-8.txt"):
                r = requests.get(f"{MIRROR}/{mirror_path(n)}/{fn}", headers=UA, timeout=60)
                if r.status_code == 200:
                    f.write_bytes(r.content)
                    break
                time.sleep(2)
            time.sleep(2)
        texts[title] = ("first", f.read_text(encoding="utf-8", errors="replace"))
    return texts


def paragraphs(t: str) -> list[str]:
    m1, m2 = re.search(r"\*\*\* ?START OF.*?\*\*\*", t), re.search(r"\*\*\* ?END OF", t)
    if m1:
        t = t[m1.end(): m2.start() if m2 else None]
    return [p for p in (re.sub(r"\s+", " ", x).strip() for x in re.split(r"\n\s*\n", t)) if p]


def chunks(paras: list[str], size: int = 5000):
    cur, n = [], 0
    for p in paras:
        cur.append(p)
        n += len(p.split())
        if n >= size:
            yield cur
            cur, n = [], 0


def main() -> None:
    m = Measurer()
    total = collections.Counter()
    for name, (truth, text) in fetch_texts().items():
        res = collections.Counter(m.measure(c, {})["pov_class"] for c in chunks(paragraphs(text)))
        n = sum(res.values())
        total["n"] += n
        total["ok"] += res[truth]
        total["wrong"] += sum(v for k, v in res.items() if k in ("first", "second", "third") and k != truth)
        print(f"{truth:5}  {name:32} {res[truth] / n:5.0%} correct  {dict(res)}")
    print(f"\nOverall: {total['ok']}/{total['n']} passages correct ({total['ok'] / total['n']:.1%}); "
          f"confidently wrong: {total['wrong']} ({total['wrong'] / total['n']:.1%}).")


if __name__ == "__main__":
    main()
