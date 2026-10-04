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
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

import numpy as np

from ..text.doc import TOKEN_RE, quote_mode, quote_spans, split_sentences
from ..text.features import FEM, FP_PLUR, FP_SING, MASC, NEUTRAL, SECOND
from ..text.lexicons import Lexicon, load_all, norm_token

AUXILIARIES = frozenset(
    "am is are was were be been being have has had having do does did isn't aren't wasn't weren't hasn't haven't "
    "hadn't doesn't don't didn't ain't get gets got gotten getting".split())
_ENDINGS = ("ing", "ed", "s")
_CONTRACTION = re.compile(r"(['’](?:s|re|ve|d|ll|m|t)|n['’]t)$", re.I)


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


def sentence_spans(paragraphs: list[str]) -> list[list[tuple[int, int, str, int | None]]]:
    """Per paragraph: (start, end, terminal, global sentence number or None if the span has no words), numbered
    exactly as TextDoc numbers its sentences (spans without any word are dropped there)."""
    out, g = [], 0
    for p in paragraphs:
        row = []
        for s, e, term in split_sentences(p):
            if TOKEN_RE.search(p, s, e) is not None:
                row.append((s, e, term, g))
                g += 1
            else:
                row.append((s, e, term, None))
        out.append(row)
    return out


def lexicon_labels(paragraphs: list[str], lexicons: dict[str, Lexicon], names: list[str]) -> list[dict[int, str]]:
    """For each paragraph, token start offset -> '[lexicon]' for every token matched by one of ``names``.
    Single words and the first word of a phrase are labelled (as the pipeline counts them)."""
    from ..text.doc import TextDoc
    from ..text.lexicons import match

    doc = TextDoc(paragraphs)
    hits = {n: match(lexicons[n], doc.vocab, doc.type_ids, doc.para_idx, doc.positions_by_type()) for n in names}
    starts: list[tuple[int, int]] = []  # (paragraph, char offset) for each token, in token order
    for pi, p in enumerate(paragraphs):
        starts.extend((pi, m.start()) for m in TOKEN_RE.finditer(p))
    out: list[dict[int, str]] = [{} for _ in paragraphs]
    for i in range(doc.n):
        hit = [n for n in names if hits[n][i]]
        if hit:
            pi, off = starts[i]
            out[pi][off] = "[" + "|".join(hit) + "]"
    return out


def render(paragraphs: list[str], *, lexicons: dict[str, Lexicon] | None = None, overlay: bool = True,
           lex_names: list[str] | None = None, name_tokens: set[str] | None = None,
           para_tags: dict[int, list[str]] | None = None, paras: tuple[int, int] | None = None,
           endings: bool = True) -> list[ParaView]:
    lexicons = lexicons if lexicons is not None else load_all()
    visible = visible_words(lexicons)
    mode = quote_mode(paragraphs)
    sents = sentence_spans(paragraphs)
    labels = lexicon_labels(paragraphs, lexicons, lex_names) if lex_names else [{} for _ in paragraphs]
    lo, hi = paras if paras else (0, len(paragraphs))
    views = []
    for pi in range(max(0, lo), min(hi, len(paragraphs))):
        p = paragraphs[pi]
        rep = dict(labels[pi])
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
        # Insert quote markers into the raw paragraph by offset, then mask each sentence piece separately.
        marks: dict[int, str] = {}
        for s, e in spans:
            marks[s] = marks.get(s, "") + "⟪"
            marks[e] = "⟫" + marks.get(e, "")
        for s, e, term, g in sents[pi]:
            piece = _with_marks(p, s, e, marks, visible, endings, rep)
            if g is None:
                v.sentences.append((-1, term, piece))
            else:
                v.sentences.append((g, term, piece))
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
