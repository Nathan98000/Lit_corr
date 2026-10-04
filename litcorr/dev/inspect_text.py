"""`inspect_text`: the masked view of one story, with the pipeline's decisions overlaid.

  python -m litcorr.dev.inspect_text STORY_KEY [--paras 0:40] [--no-overlay] [--lex LEX1,LEX2|all] [--meta]
                                               [--names] [--flat] [--reveal-sentence N]

Default output: one line per sentence, `[s<number> <terminal>]`, quoted spans between ⟪ ⟫, paragraph headers
with word count, a dialogue flag and the pipeline's paragraph tags (scene break, paratext label, author-note and
feedback regex hits). Sentence numbers count story sentences only, as the measures do; paratext shows "s-".

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
from ..text.features import _AUTHOR_NOTE, _FEEDBACK, Measurer
from ..text.lexicons import load_all
from ..text.paratext import is_separator
from ..text.prepare import Prepared, prepare
from .common import load_texts, paragraphs_of, paths, settings
from .mask import format_views, meta_lexicons, render, sentence_spans

REVEAL_MAX_WORDS = 50


def pipeline_para_tags(prep: Prepared) -> dict[int, list[str]]:
    """The paragraph-level decisions the pipeline makes, as tags for the overlay (original paragraph indices)."""
    tags: dict[int, list[str]] = {}
    pt = prep.paratext
    story = prep.story_index
    head_tail = set(story[:3] + story[-3:])
    for i, p in enumerate(prep.paragraphs):
        t = []
        if i in pt.labels:
            where = "open" if i <= pt.lead_end else "close" if i >= pt.tail_start else "inside"
            t.append(f"PARATEXT:{pt.labels[i]}/{where}")
        elif is_separator(p):
            t.append("SCENE-BREAK")
        q = p.replace("’", "'")
        if _AUTHOR_NOTE.search(q) and (i in pt.labels or i in head_tail):
            t.append("author-note-regex")
        if _FEEDBACK.search(q) and (i in pt.labels or i in head_tail):
            t.append("feedback-regex")
        if t:
            tags[i] = t
    return tags


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def reveal(paragraphs: list[str], n: int, forbidden: list[str], prep: Prepared | None = None) -> str:
    prep = prep or prepare(paragraphs)
    for pi, row in sentence_spans(prep).items():
        for s, e, term, g in row:
            if g == n:
                text = prep.paragraphs[pi][s:e].strip()
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
    ap.add_argument("--meta", action="store_true", help="show words about stories, readers and writing as [meta_*]")
    ap.add_argument("--names", action="store_true", help="mark the tokens counted as recurring names")
    ap.add_argument("--reveal-sentence", type=int, default=None)
    args = ap.parse_args(argv)
    s = settings()
    cols = ("story_key", "text", "category_slug", "title", "author_name", "description")
    raw = load_texts(s, [args.story_key], columns=cols)
    if raw.empty:
        print("no text for that story_key", file=sys.stderr)
        return 1
    row = raw.iloc[0]
    title = row["title"] if isinstance(row["title"], str) else None
    desc = row["description"] if isinstance(row["description"], str) else None
    prep = prepare(paragraphs_of(row["text"]), title, desc)
    if args.reveal_sentence is not None:
        print("WARNING: unmasked story text below (one sentence). Use only to confirm a specific suspected bug; "
              "do not copy it into any file, test or document.", file=sys.stderr)
        forbidden = [_norm(x) for x in (title, row.get("author_name")) if isinstance(x, str)]
        print(reveal(prep.paragraphs, args.reveal_sentence, forbidden, prep))
        return 0
    lex = load_all()
    lex_names: list[str] = []
    if args.meta:
        meta = meta_lexicons()
        lex = {**lex, **meta}
        lex_names += sorted(meta)
    if args.lex:
        from ..text.features import LEXICON_MEASURES, SUPPORT_LEXICONS

        lex_names += (sorted(LEXICON_MEASURES | (SUPPORT_LEXICONS - {"stopwords"})) if args.lex == "all"
                      else args.lex.split(","))
    names = set(Measurer(lex).recurring_names(TextDoc(prep.story))[0]) if args.names else None
    rng = None
    if args.paras:
        a, b = args.paras.split(":")
        rng = (int(a or 0), int(b) if b else len(prep.paragraphs))
    feats = pd.read_parquet(paths(s).features, columns=["story_key", "pov_class", "narr_tense_class",
                                                        "qc_quote_style", "story_words"])
    f = feats[feats["story_key"] == args.story_key]
    info = f.iloc[0].to_dict() if len(f) else {}
    print(f"story {args.story_key} | category {row['category_slug']} | {len(prep.paragraphs)} paragraphs "
          f"({len(prep.paratext.labels)} paratext) | words {info.get('story_words')} | quotes "
          f"{info.get('qc_quote_style')} | POV {info.get('pov_class')} | tense {info.get('narr_tense_class')}")
    views = render(prep.paragraphs, lexicons=lex, overlay=not args.no_overlay, lex_names=lex_names or None,
                   name_tokens=names, para_tags=pipeline_para_tags(prep), paras=rng, prep=prep)
    print(format_views(views, per_sentence=not args.flat and not args.no_overlay))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
