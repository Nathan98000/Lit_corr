"""`inspect_text`: the masked view of one story, with the pipeline's decisions overlaid.

  python -m litcorr.dev.inspect_text STORY_KEY [--paras 0:40] [--no-overlay] [--lex LEX1,LEX2|all]
                                               [--names] [--flat] [--reveal-sentence N]

Default output: one line per sentence, `[s<number> <terminal>]`, quoted spans between ⟪ ⟫, paragraph headers
with word count, a dialogue flag and the pipeline's paragraph tags (scene break, author note, ...).

--reveal-sentence N prints exactly ONE sentence unmasked (capped at 50 words), and only to confirm a specific
suspected bug. It refuses sentences that contain the story's title or author name. Never copy its output into a
file, a test or a document.
"""

from __future__ import annotations

import argparse
import re
import sys

import pandas as pd

from ..text.doc import TOKEN_RE, TextDoc
from ..text.features import _AUTHOR_NOTE, _FEEDBACK, _SCENE_BREAK, Measurer
from ..text.lexicons import load_all
from .common import load_texts, paragraphs_of, paths, settings
from .mask import format_views, render, sentence_spans

REVEAL_MAX_WORDS = 50


def pipeline_para_tags(paragraphs: list[str]) -> dict[int, list[str]]:
    """The paragraph-level decisions the pipeline makes (as tags for the overlay)."""
    tags: dict[int, list[str]] = {}
    n = len(paragraphs)
    head_tail = set(range(min(3, n))) | set(range(max(0, n - 3), n))
    try:  # paratext detection added in Stage 1B (Phase 2); absent in the baseline pipeline
        from ..text.paratext import classify_paragraphs
    except ImportError:  # pragma: no cover
        classify_paragraphs = None
    for i, p in enumerate(paragraphs):
        t = []
        if _SCENE_BREAK.match(p.strip()):
            t.append("SCENE-BREAK")
        q = p.replace("’", "'")
        window = "" if i in head_tail else " (outside head/tail: not counted)"
        if _AUTHOR_NOTE.search(q):
            t.append("author-note-regex" + window)
        if _FEEDBACK.search(q):
            t.append("feedback-regex" + window)
        if t:
            tags[i] = t
    if classify_paragraphs is not None:
        for i, label in classify_paragraphs(paragraphs).items():
            tags.setdefault(i, []).append(f"PARATEXT:{label}")
    return tags


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def reveal(paragraphs: list[str], n: int, forbidden: list[str]) -> str:
    for pi, row in enumerate(sentence_spans(paragraphs)):
        for s, e, term, g in row:
            if g == n:
                text = paragraphs[pi][s:e].strip()
                low = _norm(text)
                for f in forbidden:
                    if f and len(f) >= 3 and f in low:
                        return "(refused: this sentence contains the story's title or author name)"
                words = list(TOKEN_RE.finditer(text))
                if len(words) > REVEAL_MAX_WORDS:
                    text = text[: words[REVEAL_MAX_WORDS - 1].end()] + " [... truncated at 50 words]"
                return f"¶{pi} s{g} [{term or '∅'}]: {text}"
    return f"(no sentence {n})"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m litcorr.dev.inspect_text", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("story_key")
    ap.add_argument("--paras", default=None, help="paragraph range a:b (Python-style, end excluded)")
    ap.add_argument("--no-overlay", action="store_true")
    ap.add_argument("--flat", action="store_true", help="one line per paragraph instead of one per sentence")
    ap.add_argument("--lex", default=None, help="comma-separated lexicon names to show as [name], or 'all'")
    ap.add_argument("--names", action="store_true", help="mark the tokens counted as recurring names")
    ap.add_argument("--reveal-sentence", type=int, default=None)
    args = ap.parse_args(argv)
    s = settings()
    cols = ("story_key", "text", "category_slug", "title", "author_name")
    raw = load_texts(s, [args.story_key], columns=cols)
    if raw.empty:
        print("no text for that story_key", file=sys.stderr)
        return 1
    row = raw.iloc[0]
    paragraphs = paragraphs_of(row["text"])
    if args.reveal_sentence is not None:
        print("WARNING: unmasked story text below (one sentence). Use only to confirm a specific suspected bug; "
              "do not copy it into any file, test or document.", file=sys.stderr)
        forbidden = [_norm(x) for x in (row.get("title"), row.get("author_name")) if isinstance(x, str)]
        print(reveal(paragraphs, args.reveal_sentence, forbidden))
        return 0
    lex = load_all()
    lex_names = None
    if args.lex:
        from ..text.features import LEXICON_MEASURES, SUPPORT_LEXICONS

        lex_names = sorted(LEXICON_MEASURES | (SUPPORT_LEXICONS - {"stopwords"})) if args.lex == "all" \
            else args.lex.split(",")
    names = None
    if args.names:
        names = set(Measurer(lex).recurring_names(TextDoc(paragraphs))[0])
    rng = None
    if args.paras:
        a, b = args.paras.split(":")
        rng = (int(a or 0), int(b) if b else len(paragraphs))
    feats = pd.read_parquet(paths(s).features, columns=["story_key", "pov_class", "narr_tense_class",
                                                        "qc_quote_style", "story_words"])
    f = feats[feats["story_key"] == args.story_key]
    info = f.iloc[0].to_dict() if len(f) else {}
    print(f"story {args.story_key} | category {row['category_slug']} | {len(paragraphs)} paragraphs | "
          f"words {info.get('story_words')} | quotes {info.get('qc_quote_style')} | POV {info.get('pov_class')} | "
          f"tense {info.get('narr_tense_class')}")
    views = render(paragraphs, lexicons=lex, overlay=not args.no_overlay, lex_names=lex_names, name_tokens=names,
                   para_tags=pipeline_para_tags(paragraphs), paras=rng)
    print(format_views(views, per_sentence=not args.flat and not args.no_overlay))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
