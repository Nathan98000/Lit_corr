"""What the text measures see: the story paragraphs, lightly normalised, without paratext.

The raw text in data/raw/ is exactly what was on the page. Before measuring, each paragraph is normalised
(line/paragraph separator characters become spaces; a backtick or acute accent used as an apostrophe inside a
word becomes an apostrophe, so "don`t" is one word), and the paratext found by ``paratext.detect`` (author's
notes, headings, "to be continued" ...) is set aside. The developer tools use the same function, so their
paragraph and sentence numbering matches the measures.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .doc import TOKEN_RE
from .paratext import Paratext, detect, is_separator

_ODD_SPACE = re.compile(r"[  \u0085]+")
_ODD_APOSTROPHE = re.compile(r"(?<=[^\W\d_])[`´](?=[^\W\d_])")
_MULTI_SPACE = re.compile(r" {2,}")


def normalize_paragraph(p: str) -> str:
    if " " in p or " " in p or "\u0085" in p:
        p = _MULTI_SPACE.sub(" ", _ODD_SPACE.sub(" ", p)).strip()
    if "`" in p or "´" in p:
        p = _ODD_APOSTROPHE.sub("'", p)
    return p


@dataclass
class Prepared:
    paragraphs: list[str]  # all paragraphs, normalised (indices as in the raw text)
    paratext: Paratext
    story_index: list[int] = field(default_factory=list)  # indices of the story paragraphs

    @property
    def story(self) -> list[str]:
        return [self.paragraphs[i] for i in self.story_index]

    @property
    def paratext_paragraphs(self) -> list[str]:
        return [self.paragraphs[i] for i in sorted(self.paratext.labels)]

    @property
    def words_all(self) -> int:
        """Words in the whole collected text, paratext included (comparable with the site's own count)."""
        return sum(len(TOKEN_RE.findall(p)) for p in self.paragraphs)

    def has_note(self) -> bool:
        """An author's / editor's note, disclaimer, dedication or words to readers at the start or end, or a
        paragraph inside the text labelled as an author's note."""
        return any(lab in ("note", "reader") for lab in self.paratext.labels.values())

    def separators(self) -> list[int]:
        """Story-paragraph positions (0-based, in the story list) of scene-break lines."""
        return [k for k, i in enumerate(self.story_index) if is_separator(self.paragraphs[i])]


def prepare(paragraphs: list[str], title: str | None = None, description: str | None = None) -> Prepared:
    norm = [normalize_paragraph(p) for p in paragraphs]
    pt = detect(norm, title, description)
    return Prepared(paragraphs=norm, paratext=pt, story_index=pt.story_indices)
