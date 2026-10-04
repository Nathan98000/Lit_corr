"""The masked view of story text, with the pipeline's own decisions overlaid.

Masking (what stays visible):
  * every letter becomes x / X (case pattern kept) and every digit 9;
  * punctuation, quote characters, symbols, spaces and paragraph breaks are kept exactly;
  * closed-class function words stay readable: lexicons/stopwords.txt, personal pronouns, auxiliaries and modals;
  * inflectional endings stay readable on masked words (xxxxed, xxxxing, xxxxs, Xxxxx's) so tense can be checked;
  * optionally, a lexicon match is shown as its lexicon name in brackets ([sensory_touch]) instead of the word.

Overlays (the pipeline's decisions, never the words): paragraph numbers, sentence boundaries and terminal type,
quoted spans (⟪ ⟫), scene breaks, paratext detection (author notes, feedback requests, headings, "to be
continued"), and the tokens counted as recurring names ([name]).

Everything is computed on the same view the measures use (``litcorr.text.prepare``): normalised paragraphs, with
sentences numbered over the story paragraphs only. Paratext paragraphs are shown with sentence number "s-".
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from ..text.doc import TOKEN_RE, TextDoc, quote_mode, quote_spans, split_sentences
from ..text.features import FEM, FP_PLUR, FP_SING, MASC, NEUTRAL, SECOND
from ..text.lexicons import Lexicon, load_all, match, norm_token
from ..text.prepare import Prepared, prepare

META_DIR = Path(__file__).resolve().parent / "meta_lexicons"
AUXILIARIES = frozenset(
    "am is are was were be been being have has had having do does did isn't aren't wasn't weren't hasn't haven't "
    "hadn't doesn't don't didn't ain't get gets got gotten getting".split())
_ENDINGS = ("ing", "ed", "s")
_CONTRACTION = re.compile(r"(['’](?:s|re|ve|d|ll|m|t)|n['’]t)$", re.I)


def meta_lexicons() -> dict[str, Lexicon]:
    """Dev-only word lists about stories, readers and writing, shown as [meta_*] in the masked view so that
    author's notes can be recognised without reading them."""
    return load_all(META_DIR)


def visible_words(lex: dict[str, Lexicon] | None = None) -> frozenset[str]:
    lex = lex if lex is not None else load_all()
    words = set(lex["stopwords"].words) | set(lex["modal_verbs"].words)
    return frozenset(words | FP_SING | FP_PLUR | SECOND | MASC | FEM | NEUTRAL | AUXILIARIES)


def _x(s: str) -> str:
    return "".join("X" if c.isupper() else "x" if c.isalpha() else "9" if c.isdigit() else c for c in s)


def mask_token(tok: str, visible: frozenset[str], endings: bool = True) -> str:
    """One word: readable if it is a function word, otherwise x/X/9 with its inflectional ending kept."""
    if norm_token(tok) in visible:
        return tok
    m = _CONTRACTION.search(tok)
    tail = m.group(0) if m else ""
    stem = tok[: len(tok) - len(tail)] if tail else tok
    if endings and not tail:
        low = stem.lower()
        for e in _ENDINGS:
            if low.endswith(e) and len(low) > len(e) + 2 and not (e == "s" and low.endswith("ss")):
                return _x(stem[: -len(e)]) + stem[-len(e):]
    return _x(stem) + tail


def mask_text(p: str, visible: frozenset[str], endings: bool = True,
              replace: dict[int, str] | None = None) -> str:
    """Mask one paragraph. ``replace`` maps a token's start offset to a label shown instead of the token."""
    out, last = [], 0
    for m in TOKEN_RE.finditer(p):
        out.append(_x(p[last:m.start()]))  # nothing alphabetic is expected here; masked anyway, just in case
        label = replace.get(m.start()) if replace else None
        out.append(label if label is not None else mask_token(m.group(0), visible, endings))
        last = m.end()
    out.append(_x(p[last:]))
    return "".join(out)


# ------------------------------------------------------------------------------------------- overlays
@dataclass
class ParaView:
    index: int
    text: str  # masked, with overlays
    sentences: list[tuple[int, str, str]] = field(default_factory=list)  # (global no, terminal, masked text)
    tags: list[str] = field(default_factory=list)
    words: int = 0
    has_dialogue: bool = False


def sentence_spans(prep: Prepared) -> dict[int, list[tuple[int, int, str, int | None]]]:
    """For every paragraph index: (start, end, terminal, sentence number or None). Sentences are numbered over
    the story paragraphs exactly as TextDoc numbers them (spans without any word are dropped there); paratext
    paragraphs get None."""
    out, g = {}, 0
    story = set(prep.story_index)
    for i, p in enumerate(prep.paragraphs):
        row = []
        for s, e, term in split_sentences(p):
            if i in story and TOKEN_RE.search(p, s, e) is not None:
                row.append((s, e, term, g))
                g += 1
            else:
                row.append((s, e, term, None))
        out[i] = row
    return out


def lexicon_labels(prep: Prepared, lexicons: dict[str, Lexicon], names: list[str]) -> dict[int, dict[int, str]]:
    """Paragraph index -> {token start offset -> '[lexicon]'} for every token matched in the story paragraphs
    (single words, and the first word of a phrase, as the measures count them)."""
    doc = TextDoc(prep.story)
    hits = {n: match(lexicons[n], doc.vocab, doc.type_ids, doc.para_idx, doc.positions_by_type()) for n in names}
    starts: list[tuple[int, int]] = []
    for i in prep.story_index:
        starts.extend((i, m.start()) for m in TOKEN_RE.finditer(prep.paragraphs[i]))
    out: dict[int, dict[int, str]] = {}
    for t in range(doc.n):
        hit = [n for n in names if hits[n][t]]
        if hit:
            pi, off = starts[t]
            out.setdefault(pi, {})[off] = "[" + "|".join(hit) + "]"
    return out


def render(paragraphs: list[str], *, lexicons: dict[str, Lexicon] | None = None, overlay: bool = True,
           lex_names: list[str] | None = None, name_tokens: set[str] | None = None,
           para_tags: dict[int, list[str]] | None = None, paras: tuple[int, int] | None = None,
           endings: bool = True, title: str | None = None, description: str | None = None,
           prep: Prepared | None = None) -> list[ParaView]:
    lexicons = lexicons if lexicons is not None else load_all()
    visible = visible_words(lexicons)
    prep = prep or prepare(paragraphs, title, description)
    mode = quote_mode(prep.story)
    sents = sentence_spans(prep)
    labels = lexicon_labels(prep, lexicons, lex_names) if lex_names else {}
    lo, hi = paras if paras else (0, len(prep.paragraphs))
    views = []
    for pi in range(max(0, lo), min(hi, len(prep.paragraphs))):
        p = prep.paragraphs[pi]
        rep = dict(labels.get(pi, {}))
        if name_tokens:
            for m in TOKEN_RE.finditer(p):
                base = m.group(0)[:-2] if m.group(0).endswith(("'s", "’s")) else m.group(0)
                if base in name_tokens and m.start() not in rep:
                    rep[m.start()] = "[name]"
        spans, _ = quote_spans(p, mode)
        v = ParaView(pi, "", words=len(TOKEN_RE.findall(p)),
                     has_dialogue=any(TOKEN_RE.search(p, s, e) for s, e in spans))
        v.tags = list((para_tags or {}).get(pi, []))
        if not overlay:
            v.text = mask_text(p, visible, endings, rep)
            views.append(v)
            continue
        marks: dict[int, str] = {}
        for s, e in spans:  # quote markers are inserted by offset, then each sentence piece is masked
            marks[s] = marks.get(s, "") + "⟪"
            marks[e] = "⟫" + marks.get(e, "")
        for s, e, term, g in sents[pi]:
            v.sentences.append((-1 if g is None else g, term, _with_marks(p, s, e, marks, visible, endings, rep)))
        v.text = " ".join(x[2] for x in v.sentences)
        views.append(v)
    return views


def _with_marks(p: str, s: int, e: int, marks: dict[int, str], visible: frozenset[str], endings: bool,
                rep: dict[int, str]) -> str:
    cuts = sorted(k for k in marks if s <= k <= e)
    pieces, last = [], s
    for k in cuts:
        pieces.append(_mask_slice(p, last, k, visible, endings, rep))
        pieces.append(marks[k])
        last = k
    pieces.append(_mask_slice(p, last, e, visible, endings, rep))
    return "".join(pieces).strip()


def _mask_slice(p: str, s: int, e: int, visible: frozenset[str], endings: bool, rep: dict[int, str]) -> str:
    if s >= e:
        return ""
    sub = p[s:e]
    shifted = {k - s: v for k, v in rep.items() if s <= k < e}
    return mask_text(sub, visible, endings, shifted)


def format_views(views: list[ParaView], per_sentence: bool = True) -> str:
    lines = []
    for v in views:
        head = f"¶{v.index:<4} {v.words:>4}w" + (" dlg" if v.has_dialogue else "    ")
        if v.tags:
            head += "  <" + ", ".join(v.tags) + ">"
        if not per_sentence or not v.sentences:
            lines.append(f"{head}  {v.text}")
            continue
        lines.append(head)
        for g, term, piece in v.sentences:
            num = f"s{g}" if g >= 0 else "s-"
            lines.append(f"    [{num} {term or '∅'}] {piece}")
    return "\n".join(lines)


def token_counts(paragraphs: list[str]) -> np.ndarray:
    return np.array([len(TOKEN_RE.findall(p)) for p in paragraphs])
