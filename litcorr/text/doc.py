"""Tokens, sentences, paragraphs and dialogue spans for one story.

* Words: runs of letters/digits, keeping internal apostrophes ("don't" is one word).
* Paragraphs: as on the page.
* Sentences: split after . ! ? or … when the next word starts with a capital
  letter, a digit or an opening quote (so `"Stop!" she said.` stays one
  sentence); common abbreviations (Mr., Dr., St. ...) and initials do not end
  a sentence; every paragraph break ends a sentence.
* Dialogue: text between double quotation marks (straight or curly). A quote
  left open at the end of a paragraph is closed there, which matches the
  convention for speech running over several paragraphs. If a story uses no
  double quotes but does use curly single quotes, those are used instead.
"""

from __future__ import annotations

import bisect
import re
from dataclasses import dataclass

import numpy as np

from .lexicons import norm_token

TOKEN_RE = re.compile(r"[^\W_]+(?:['’][^\W_]+)*")
_SENT_END = re.compile(r"[.!?…]+(?:[\"'”’)\]]+)?")
_ABBREV = frozenset("mr mrs ms dr st jr sr prof vs etc mt ft vol ch pt fig approx dept inc ltd sgt capt lt col gov rev".split())
_DOUBLE = '"“”'


@dataclass
class Sentence:
    start: int  # first token index
    end: int  # one past the last token index
    para: int
    terminal: str  # "?" | "!" | "." | "…" | ""
    quote_share: float


_SQ_OPEN = re.compile(r"(?:^|(?<=[\s(\[—–-]))['‘](?=[^\W_]|[.…])")
_SQ_CLOSE = re.compile(r"(?<=[^\W_]|[.,!?;:…—-])['’](?=\s|$|[.,!?;:)\]—–-])")


def quote_mode(paragraphs: list[str]) -> str:
    """'double' if the story uses double quotes; 'single' if it uses single quotes for speech instead."""
    text = "\n".join(paragraphs)
    doubles = sum(text.count(c) for c in _DOUBLE)
    opens = sum(len(_SQ_OPEN.findall(p)) for p in paragraphs)
    closes = sum(len(_SQ_CLOSE.findall(p)) for p in paragraphs)
    if opens >= 3 and closes >= 3 and opens + closes > 4 * doubles:
        return "single"
    if doubles >= 2:
        return "double"
    return "none"


def _single_quote_events(p: str) -> list[tuple[int, str]]:
    """Positions of plausible opening/closing single quotes (apostrophes inside words are ignored)."""
    ev = [(m.start(), "open") for m in _SQ_OPEN.finditer(p)]
    ev += [(m.start(), "close") for m in _SQ_CLOSE.finditer(p)]
    return sorted(ev)


def quote_spans(p: str, mode: str) -> tuple[list[tuple[int, int]], bool]:
    """Character spans inside quotation marks, and whether the quotes balanced."""
    spans: list[tuple[int, int]] = []
    if mode == "none":
        return spans, True
    open_at: int | None = None
    balanced = True
    if mode == "double":
        for i, c in enumerate(p):
            if c == '"':
                if open_at is None:
                    open_at = i + 1
                else:
                    spans.append((open_at, i))
                    open_at = None
            elif c == "“":
                if open_at is None:
                    open_at = i + 1
            elif c == "”":
                if open_at is not None:
                    spans.append((open_at, i))
                    open_at = None
    else:  # single quotes; an apostrophe inside a word never opens or closes speech
        for i, kind in _single_quote_events(p):
            if kind == "open" and open_at is None:
                open_at = i + 1
            elif kind == "close" and open_at is not None and i >= open_at:
                spans.append((open_at, i))
                open_at = None
    if open_at is not None:
        spans.append((open_at, len(p)))  # speech continuing into the next paragraph
    if mode == "double":
        # A curly quote may legitimately stay open (speech running on); a stray straight quote may not.
        balanced = p.count('"') % 2 == 0 and p.count("“") - p.count("”") in (0, 1)
    return spans, balanced


def _terminal(punct: str) -> str:
    return "?" if "?" in punct else "!" if "!" in punct else "…" if ("…" in punct or "..." in punct) else "."


def split_sentences(p: str) -> list[tuple[int, int, str]]:
    """(start_char, end_char, terminal) for each sentence in a paragraph.

    A ? or ! that is followed by a dialogue tag (`"Why?" she asked.`) does not end
    the sentence, but it does make it a question/exclamation.
    """
    out: list[tuple[int, int, str]] = []
    start = 0
    spoken = ""  # ? or ! inside the current sentence whose split was suppressed
    for m in _SENT_END.finditer(p):
        end = m.end()
        punct = m.group(0)
        if end < len(p) and not p[end].isspace():
            continue  # "6.2", "10.30", "e.g.x": no space after the mark, not a sentence end
        nxt = p[end:].lstrip()[:1]
        if nxt and not (nxt.isupper() or nxt.isdigit() or nxt in "\"'“‘(["):
            if not spoken and ("?" in punct or "!" in punct):
                spoken = _terminal(punct)
            continue
        if punct.startswith(".") and not punct.startswith("..."):
            before = p[start:m.start()].rsplit(None, 1)
            prev = before[-1].strip("\"'“‘(").lower() if before else ""
            nxt_word = p[end:].lstrip()[:1]
            if prev in _ABBREV or (len(prev) == 1 and prev.isalpha() and prev != "i") or (
                    prev == "no" and nxt_word.isdigit()):
                continue
        out.append((start, end, spoken or _terminal(punct)))
        start, spoken = end, ""
    if p[start:].strip():
        out.append((start, len(p), spoken))
    return out


class TextDoc:
    def __init__(self, paragraphs: list[str]):
        self.paragraphs = paragraphs
        self.mode = quote_mode(paragraphs)
        tokens: list[str] = []
        orig: list[str] = []
        in_q: list[bool] = []
        para: list[int] = []
        sent: list[int] = []
        sent_initial: list[bool] = []
        comma_after: list[bool] = []
        self.sentences: list[Sentence] = []
        self.segments: list[int] = []  # words per dialogue segment
        self.segment_info: list[tuple[int, int, bool]] = []  # (first token, words, contains "?")
        self.q_in = self.q_all = self.e_in = self.e_all = 0
        self.para_has_dialogue: list[bool] = []
        self.para_tokens: list[int] = []
        self.para_sentences: list[int] = []
        self.unbalanced_paragraphs = 0
        self.quoted_paragraphs = 0

        for pi, p in enumerate(paragraphs):
            spans, balanced = quote_spans(p, self.mode)
            if spans:
                self.quoted_paragraphs += 1
                if not balanced:
                    self.unbalanced_paragraphs += 1
            span_starts = [s for s, _ in spans]
            sents = split_sentences(p)
            sent_starts = [s for s, _, _ in sents]
            seg_counts = [0] * len(spans)
            seg_first: list[int | None] = [None] * len(spans)
            first_sent_tok = len(tokens)
            sent_tok_start = {}
            for m in TOKEN_RE.finditer(p):
                c = m.start()
                k = bisect.bisect_right(span_starts, c) - 1
                inside = k >= 0 and spans[k][0] <= c < spans[k][1]
                if inside:
                    if seg_first[k] is None:
                        seg_first[k] = len(tokens)
                    seg_counts[k] += 1
                si = max(0, bisect.bisect_right(sent_starts, c) - 1)
                global_si = len(self.sentences) + si
                is_initial = global_si not in sent_tok_start
                if is_initial:
                    sent_tok_start[global_si] = len(tokens)
                w = m.group(0)
                tokens.append(norm_token(w))
                orig.append(w)
                in_q.append(inside)
                para.append(pi)
                sent.append(global_si)
                sent_initial.append(is_initial)
                comma_after.append(p[m.end():m.end() + 1] == ",")
            for first_tok in seg_first:  # the first word of speech is capitalised like a sentence start
                if first_tok is not None:
                    sent_initial[first_tok] = True
            for k, (s, e) in enumerate(spans):
                seg = p[s:e]
                self.q_in += seg.count("?")
                self.e_in += seg.count("!")
                if seg_counts[k]:
                    self.segments.append(seg_counts[k])
                    self.segment_info.append((seg_first[k], seg_counts[k], "?" in seg))
            self.q_all += p.count("?")
            self.e_all += p.count("!")
            self.para_has_dialogue.append(any(seg_counts))
            self.para_tokens.append(len(tokens) - first_sent_tok)
            n_sent_here = 0
            for si, (s, e, term) in enumerate(sents):
                gsi = len(self.sentences)
                start_tok = sent_tok_start.get(gsi)
                if start_tok is None:
                    self.sentences.append(Sentence(len(tokens), len(tokens), pi, term, 0.0))
                    continue
                n_sent_here += 1
                self.sentences.append(Sentence(start_tok, start_tok, pi, term, 0.0))
            # fill sentence ends and quote shares
            self.para_sentences.append(n_sent_here)

        self.tokens = tokens
        self.orig = orig
        self.in_quote = np.array(in_q, dtype=bool)
        self.para_idx = np.array(para, dtype=np.int32)
        self.sent_idx = np.array(sent, dtype=np.int32)
        self.sent_initial = np.array(sent_initial, dtype=bool)
        self.comma_after = np.array(comma_after, dtype=bool)
        n = len(tokens)
        if n:
            counts = np.bincount(self.sent_idx, minlength=len(self.sentences))
            q_counts = np.bincount(self.sent_idx, weights=self.in_quote.astype(float), minlength=len(self.sentences))
            for i, s in enumerate(self.sentences):
                s.end = s.start + int(counts[i])
                s.quote_share = float(q_counts[i] / counts[i]) if counts[i] else 0.0
        # Keep only sentences that contain words, and re-point tokens at the kept list.
        keep = [i for i, s in enumerate(self.sentences) if s.end > s.start]
        remap = np.full(max(len(self.sentences), 1), -1, dtype=np.int32)
        remap[keep] = np.arange(len(keep), dtype=np.int32)
        self.sentences = [self.sentences[i] for i in keep]
        if n:
            self.sent_idx = remap[self.sent_idx]

        vocab_index: dict[str, int] = {}
        ids = np.empty(n, dtype=np.int32)
        for i, t in enumerate(tokens):
            j = vocab_index.get(t)
            if j is None:
                j = len(vocab_index)
                vocab_index[t] = j
            ids[i] = j
        self.vocab = list(vocab_index)
        self.vocab_index = vocab_index
        self.type_ids = ids
        self.type_counts = np.bincount(ids, minlength=len(self.vocab)) if n else np.zeros(0, dtype=np.int64)
        self._positions: dict[int, np.ndarray] | None = None

    @property
    def n(self) -> int:
        return len(self.tokens)

    def positions_by_type(self) -> dict[int, np.ndarray]:
        if self._positions is None:
            order = np.argsort(self.type_ids, kind="stable")
            sorted_ids = self.type_ids[order]
            bounds = np.flatnonzero(np.diff(sorted_ids)) + 1
            groups = np.split(order, bounds)
            self._positions = {int(self.type_ids[g[0]]): g for g in groups if len(g)}
        return self._positions
