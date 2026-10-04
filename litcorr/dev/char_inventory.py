"""`char_inventory`: corpus-wide character and markup inventory of the story text (counts only, never text).

  python -m litcorr.dev.char_inventory [--out data/dev/char_inventory] [--top 60]

Counts, over all stories with text, both occurrences and the number of stories containing each item:
  * every non-ASCII character (with its Unicode name);
  * quote, apostrophe, dash and ellipsis variants (including "--", spaced hyphens and ". . .");
  * leftover HTML tags (tag names only) and HTML entities;
  * mojibake (UTF-8 read as Windows-1252, e.g. "â€™");
  * zero-width, non-breaking and other unusual spaces, soft hyphens, control and replacement characters;
  * structural oddities: line breaks inside a paragraph, empty paragraphs.
"""

from __future__ import annotations

import argparse
import re
import unicodedata
from collections import Counter
from pathlib import Path

import pandas as pd

from .common import dev_dir, load_texts, settings

VARIANTS = {
    "quote": {'"': "straight double", "“": "left double", "”": "right double", "„": "low double",
              "‟": "high reversed double", "«": "left guillemet", "»": "right guillemet", "″": "double prime",
              "＂": "fullwidth double"},
    "apostrophe/single quote": {"'": "straight single", "‘": "left single", "’": "right single",
                                "‚": "low single", "‛": "high reversed single", "′": "prime", "`": "backtick",
                                "´": "acute accent", "‹": "left single guillemet", "›": "right single guillemet"},
    "dash/hyphen": {"-": "hyphen-minus", "‐": "hyphen", "‑": "non-breaking hyphen", "‒": "figure dash",
                    "–": "en dash", "—": "em dash", "―": "horizontal bar", "−": "minus sign", "~": "tilde"},
    "ellipsis": {"…": "ellipsis character"},
}
PATTERNS = {
    "double hyphen --": re.compile(r"(?<!-)--(?!-)"),
    "triple+ hyphen ---": re.compile(r"-{3,}"),
    "spaced hyphen ' - '": re.compile(r"(?<=\s)-(?=\s)"),
    "hyphen glued between words 'a-b' with letters": re.compile(r"(?<=[^\W\d_])-(?=[^\W\d_])"),
    "spaced en dash ' – '": re.compile(r"\s–\s"),
    "unspaced em dash 'a—b'": re.compile(r"(?<=\S)—(?=\S)"),
    "three dots ...": re.compile(r"(?<!\.)\.\.\.(?!\.)"),
    "four+ dots ....": re.compile(r"\.{4,}"),
    "two dots .. (not part of more)": re.compile(r"(?<![.])\.\.(?![.])"),
    "spaced dots . . .": re.compile(r"\.(?: \.){2,}"),
    "ellipsis char + dot …. or ….": re.compile(r"…\."),
    "missing space after sentence punctuation (a.B)": re.compile(r"(?<=[a-z])[.!?](?=[A-Z][a-z])"),
    "missing space after comma (a,b)": re.compile(r"(?<=[^\W\d_]),(?=[^\W\d_])"),
}
TAG = re.compile(r"</?([a-zA-Z][a-zA-Z0-9]{0,15})(?:\s[^<>]{0,200})?/?>")
ENTITY = re.compile(r"&(?:[a-zA-Z]{2,10}|#\d{2,7}|#x[0-9a-fA-F]{2,6});")
BROKEN_ENTITY = re.compile(r"&(?:nbsp|amp|quot|lt|gt|apos|rsquo|lsquo|rdquo|ldquo|mdash|ndash|hellip)(?![;a-z])", re.I)
MOJIBAKE = re.compile(r"(?:â€[\u0080-¿™œ\u009d“”˜¦¢–—\"]|Ã[\u0080-¿]|Â[\u0080-¿]|Ã¢â‚¬|ï»¿|â€)")
SPECIAL = {
    " ": "no-break space", " ": "narrow no-break space", " ": "figure space",
    "​": "zero width space", "‌": "zero width non-joiner", "‍": "zero width joiner",
    "⁠": "word joiner", "﻿": "byte order mark", "­": "soft hyphen", "�": "replacement character",
    "\t": "tab", "\r": "carriage return", " ": "line separator", " ": "paragraph separator",
}


def inventory(texts: pd.Series) -> dict[str, pd.DataFrame]:
    nonascii_occ: Counter[str] = Counter()
    nonascii_st: Counter[str] = Counter()
    pat_occ: Counter[str] = Counter()
    pat_st: Counter[str] = Counter()
    tag_occ: Counter[str] = Counter()
    tag_st: Counter[str] = Counter()
    ent_occ: Counter[str] = Counter()
    ent_st: Counter[str] = Counter()
    moj_occ: Counter[str] = Counter()
    moj_st: Counter[str] = Counter()
    struct_occ: Counter[str] = Counter()
    struct_st: Counter[str] = Counter()
    ascii_occ: Counter[str] = Counter()
    ascii_st: Counter[str] = Counter()
    for text in texts:
        c = Counter(text)
        for ch, n in c.items():
            if ord(ch) > 127:
                nonascii_occ[ch] += n
                nonascii_st[ch] += 1
            elif ch in "\"'`-~\t\r" or (ord(ch) < 32 and ch != "\n") or ord(ch) == 127:
                ascii_occ[ch] += n
                ascii_st[ch] += 1
        for name, rx in PATTERNS.items():
            n = len(rx.findall(text))
            if n:
                pat_occ[name] += n
                pat_st[name] += 1
        seen = set()
        for m in TAG.finditer(text):
            t = "<" + m.group(1).lower() + ">"
            tag_occ[t] += 1
            seen.add(t)
        for t in seen:
            tag_st[t] += 1
        seen = set()
        for m in ENTITY.finditer(text):
            ent_occ[m.group(0).lower()] += 1
            seen.add(m.group(0).lower())
        for m in BROKEN_ENTITY.finditer(text):
            k = m.group(0).lower() + " (no ;)"
            ent_occ[k] += 1
            seen.add(k)
        for t in seen:
            ent_st[t] += 1
        seen = set()
        for m in MOJIBAKE.finditer(text):
            moj_occ[m.group(0)] += 1
            seen.add(m.group(0))
        for t in seen:
            moj_st[t] += 1
        paras = text.split("\n\n")
        checks = {
            "line break inside a paragraph": len(re.findall(r"(?<!\n)\n(?!\n)", text)),
            "empty paragraph": sum(1 for p in paras if not p.strip()),
            "paragraph with leading/trailing space": sum(1 for p in paras if p != p.strip()),
            "paragraph of 1,000+ characters": sum(1 for p in paras if len(p) >= 1000),
            "paragraph of 5,000+ characters": sum(1 for p in paras if len(p) >= 5000),
        }
        for k, n in checks.items():
            if n:
                struct_occ[k] += n
                struct_st[k] += 1

    def table(occ: Counter[str], st: Counter[str], key: str, describe=None) -> pd.DataFrame:
        rows = [{key: k, "occurrences": occ[k], "stories": st[k], **(describe(k) if describe else {})}
                for k in occ]
        return pd.DataFrame(rows).sort_values(["occurrences", key], ascending=[False, True]) if rows else \
            pd.DataFrame(columns=[key, "occurrences", "stories"])

    def chdesc(ch: str) -> dict[str, str]:
        group = next((g for g, d in VARIANTS.items() if ch in d), "")
        return {"codepoint": f"U+{ord(ch):04X}", "name": unicodedata.name(ch, SPECIAL.get(ch, "?")), "group": group,
                "special": SPECIAL.get(ch, "")}

    nonascii = table(nonascii_occ, nonascii_st, "char", chdesc)
    asc = table(ascii_occ, ascii_st, "char", chdesc)
    return {"non_ascii": nonascii, "ascii_variants": asc, "patterns": table(pat_occ, pat_st, "pattern"),
            "html_tags": table(tag_occ, tag_st, "tag"), "html_entities": table(ent_occ, ent_st, "entity"),
            "mojibake": table(moj_occ, moj_st, "sequence"), "structure": table(struct_occ, struct_st, "check")}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m litcorr.dev.char_inventory", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=None)
    ap.add_argument("--top", type=int, default=60)
    args = ap.parse_args(argv)
    s = settings()
    raw = load_texts(s)
    tables = inventory(raw["text"])
    out = Path(args.out) if args.out else dev_dir(s) / "char_inventory"
    out.mkdir(parents=True, exist_ok=True)
    print(f"Character inventory over {len(raw):,} stories with text\n")
    for name, t in tables.items():
        t.to_csv(out / f"{name}.tsv", sep="\t", index=False)
        print(f"== {name} ({len(t)} distinct)")
        if len(t):
            show = t.head(args.top).copy()
            if "char" in show:
                show["char"] = show["char"].map(lambda c: repr(c) if (c.isspace() or not c.isprintable()) else c)
            print(show.to_string(index=False))
        print()
    print(f"tables written to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
