"""Paratext: the parts of a story page that are not the story itself.

Authors often open or close a story with notes to the reader, and put headings inside the text. These are
detected with plain rules and kept out of the text measures (they are still counted for the author's-note and
feedback-request measures). The raw text is never changed.

Paragraph kinds
  heading     chapter / part / prologue / epilogue headings ("Chapter 3", "Part Two: Home", "Epilogue", a bare
              "2." or "IV"), a short line set off by symbols ("- The Return -"), a title-like first line (no
              closing punctuation, words capitalised), the story's title repeated as a paragraph (anywhere if it has three or more words,
              otherwise only among the first three paragraphs), the description repeated as one of the first three
              paragraphs, and a byline ("by ...") among the first three paragraphs
  note        an author's or editor's note, disclaimer, dedication, copyright line, thanks, a header line
              ("Summary: ...", "Tags: ...", "Posted: ..."), a line of hashtags or [bracketed tags] near the top or a sentence about the story itself ("This story is
              a sequel to ...", "All characters are ...", "... do not belong to me")
  reader      words addressed to readers: "Hello readers", "I hope you enjoy", "Thanks for reading", "Please vote",
              "read the previous chapters first", "Comments are welcome"
  end         "To be continued", "The End", "End of part 2"
  separator   a line of symbols ("* * *", "-----", "....") with no letters or digits; a scene break unless it is
              part of the opening or closing paratext
  signoff     a line of at most three words (no quotes, not a question) at the very end: "Cheers", a name;
              paratext only after a note, reader address or end marker
  notelike    a paragraph of at most 200 words that uses at least two words about stories, reading or writing
              (story, chapter, series, readers, vote, editor ...) together with I/my/you: only counted as
              paratext when it continues a note

Where paratext is recognised
  * Opening block: from the first paragraph, as long as paragraphs are headings, notes, reader addresses,
    separators or "to be continued" lines (a note may continue over note-like paragraphs, and the paragraph
    right after a bare "Author's note:" line always belongs to the note). If one of the first seven paragraphs
    is a separator and everything before it is a note, reader address or a short personal / story-related
    paragraph (at most 60 words), the whole run up to the separator is the note. At most the first 15
    paragraphs and at most 40% of the words.
  * Closing block: backwards from the last paragraph, the run of notes, reader addresses, end markers,
    separators and note-like paragraphs; it starts at the earliest note, reader address, end marker or separator
    in that run, so note-like paragraphs count only after one of those (at most 15 paragraphs and 30% of the
    words).
  * Anywhere: headings, short end markers (8 words or fewer) and paragraphs that start with an explicit
    "Author's note" / "A/N" / "Editor's note" label.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .doc import TOKEN_RE

MAX_LEADING_PARAS, MAX_TRAILING_PARAS = 15, 15
MAX_LEADING_SHARE, MAX_TRAILING_SHARE = 0.40, 0.30

_NUM = (r"(?:\d{1,3}[a-z]?|[ivxlc]{1,7}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|"
        r"fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty(?:[- ](?:one|two|three|four|five|six|seven|"
        r"eight|nine))?|thirty|forty|fifty|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|"
        r"final|last)")
_HEADING_UNIT = (r"(?:chapter|chap|ch|part|pt|book|volume|vol|episode|ep|act|section|installment|instalment|"
                 r"scene|day|night|session|lesson|entry|letter|interlude)")
_HEADING_NUM = re.compile(rf"^{_HEADING_UNIT}\.?\s*{_NUM}\b(?P<rest>.*)$")
_HEADING_WORD = re.compile(r"^(?:prologue|epilogue|interlude|introduction|intro|afterword|afterward|preface|foreword|"
                           r"postscript|coda|finale|conclusion|the beginning|the ending)\b(?P<rest>.*)$")
_END = re.compile(
    r"^(?:the end|end|fin|finis|tbc|t\.b\.c|to be continu\w*|to be concluded|continued|"
    r"(?:the )?end of (?:part|chapter|story|book|episode|act|volume|section|installment|instalment|"
    r"series|the story|this (?:story|chapter|part))\b.*|"
    r"continued in .*|to be continued in .*|(?:part|chapter|episode|book) \S+ (?:coming soon|to follow|follows|"
    r"will follow|is coming)\b.*|more to come|more coming|coming soon|stay tuned\b.*)[\s.!?…]*$")
_NOTE_LABEL = re.compile(
    r"^(?:author'?s?'? ?notes?|authors? notes?|a/n\b|a\.n\.|an:|note from the author|editor'?s?'? ?notes?|"
    r"translator'?s? notes?|writer'?s? notes?)")
_NOTE_START = re.compile(
    r"^(?:story notes?|notes?\s*[:\-–—]|n\.b\.?\s|nb:|disclaimer|warnings?\s*[:\-–—]|content (?:warning|note)s?|"
    r"trigger warnings?|tw\s*:|cw\s*:|foreword|preface|afterword|acknowledg(?:e)?ments?|dedicat(?:ed|ion)|copyright|"
    r"©|\(c\)\s*\d|all rights reserved|(?:(?:a|my|many|special|big|huge|great|massive|sincere|heartfelt|deal|of|"
    r"lot|whole|bunch|tons?) ){0,5}thanks?(?: you)?(?:,| to\b| go(?:es)?\b| out to\b| for\b| \S+ for\b)|"
    r"update\s*[:\-–—]|"
    r"edit(?:ed)?\s*[:\-–—]|edited by|proofread|beta[- ]read|submitted (?:for|to)\b|written for\b|"
    r"this (?:story|tale|piece|chapter|work|submission|entry|series) (?:is|was|contains|includes|has|takes|picks|"
    r"continues|follows|features|would|will|may|might|deals|explores|started|began|came|was written)\b|"
    r"this is (?:a|an|the|my|our) (?:\S+ ){0,3}(?:story|tale|piece|chapter|work|submission|entry|sequel|"
    r"continuation|installment|instalment|part|follow[- ]up|prequel|fantasy|fiction|series)\b|"
    r"the following (?:story|tale|is|contains|takes)\b|"
    r"all (?:characters|persons|people|participants|individuals|parties)\b|(?:any|all) (?:resemblance|similarity)\b|"
    r"everyone (?:in this story|involved|depicted)\b|no (?:one|characters?) (?:in this story )?(?:is|are) under\b|"
    r"(?:please )?note that\b|as always,? (?:thanks|thank|a big|many|special|my)\b)")
_HEADER_FIELD = re.compile(  # fan-fiction style header lines: "Summary: ...", "Tags: ...", "Posted: ..."
    r"^(?:summary|synopsis|blurb|description|tags?|keywords|categor(?:y|ies)|rating|rated|word count|words|"
    r"length|pairings?|fandom|genre|setting|characters?|cast|spoilers?|timeline|status|kinks?|contains|"
    r"themes?|written|posted|published|submitted|first posted|last updated|updated|originally posted|"
    r"author|title|series|sequel to|prequel to|previous(?: part| chapter)?|next(?: part| chapter)?|"
    r"part \S+ of|beta(?:ed)?(?: by)?|feedback)\s*:")
_DISCLAIMER_ANY = re.compile(
    r"(?:\b(?:do not|don't|does not|doesn't) (?:belong to me|own (?:any|the|these|them|this))|\bi (?:do not|don't) own\b|"
    r"belong to (?:their|its|the) (?:respective )?(?:owners?|creators?|authors?)|no copyright infringement|"
    r"\bnot (?:making|earning) (?:any )?money\b|product of (?:my|the author's) imagination|purely (?:coincidental|"
    r"fictional|fiction)|(?:any )?(?:resemblance|similarity) to (?:any )?(?:real|actual) (?:persons?|people|events)|"
    r"\b(?:are|is) (?:all )?(?:over|at least|older than) (?:the age of )?(?:18|eighteen)\b|"
    r"\b(?:18|eighteen) (?:years? (?:of age )?)?or older\b|"
    r"\b(?:errors|mistakes|typos)\b[^.!?]{0,40}\b(?:are|is) (?:all )?(?:mine|my own)\b)")
_TAG_LINE = re.compile(r"^(?:\s*#[\w'-]+){2,}\s*$|^(?:\s*\[[^\]]{1,40}\]){3,}")
_SALUTATION = re.compile(r"^(?:hello|hi|hey|dear|greetings|howdy|welcome)\b[^.!?]{0,25}\b(?:readers?|all|everyone|"
                         r"everybody|folks|friends|fans|guys|y'all)\b")
_BYLINE = re.compile(r"^(?:(?:an? |the )?(?:\S+ ){0,3}(?:story|tale|novel|novella|work|piece|poem|fiction|"
                     r"fantasy|romance|adventure) )?(?:written )?by\s+\S+")
_READER = re.compile(
    r"(?:\bi (?:really |sincerely |truly )?hope (?:you|y'all|everyone|all of you|that you|my readers)\b|"
    r"\bhope you(?:'ll| will| all)? (?:enjoy|like|liked)|\benjoy(?:ed)? (?:this|the|my) (?:story|chapter|part|tale)|"
    r"^enjoy[.!]*$|\bthanks? (?:you )?(?:all )?(?:so much |very much )?for (?:reading|all (?:the|your)|your|the (?:votes|comments|"
    r"feedback|support|kind)|taking the time|sticking)|\bplease (?:do )?(?:vote|rate|comment|leave|let me know|"
    r"enjoy|read|remember to vote|consider)|\b(?:comments?|votes?|feedback|ratings?|emails?|criticism)\b[^.!?]{0,30}"
    r"\b(?:appreciated|welcome|welcomed|encouraged)\b|\blet me know (?:what you think|if you|how you)|"
    r"\bif you (?:enjoyed|liked|loved|haven't read|have not read|are new to|want more)|"
    r"\byou (?:should|might|may|will) (?:want to |need to )?read\b|"
    r"\b(?:read|reading) (?:the )?(?:previous|earlier|first|prior|other) (?:chapters?|parts?|stories|installments?|"
    r"episodes?)|\bin (?:the )?(?:last|previous|prior) (?:chapter|part|installment|episode)\b|^previously(?: on)?\b|"
    r"\bdear readers?\b|\bmy (?:readers|fans|followers)\b|\bstay tuned\b|\buntil next time\b|"
    r"\bplease (?:send|share|post|drop)\b[^.!?]{0,30}\b(?:comments?|feedback|thoughts|reviews?)\b|"
    r"\b(?:appreciate|welcome|love|value) (?:your|any|all) (?:feedback|comments?|votes?|thoughts|reviews?|emails?)\b|"
    r"\bhow (?:do|did) you (?:like|enjoy) (?:this|the|my) (?:story|chapter|part|tale)\b|"
    r"\bthe next (?:chapter|part|installment|instalment|episode) (?:will|should|is)\b|\bmore (?:soon|to come)\b|"
    r"\bmy (?:first|second|third|last|latest|next|previous|other) (?:story|stories|submission|attempt|series)\b)")
_META = frozenset(
    "story stories chapter chapters series part parts installment instalment sequel prequel reader readers read "
    "reading vote votes voting comment comments feedback editor editors edited editing author authors writer "
    "writing written characters fiction fictional literotica contest submission submitted enjoy enjoyed thanks "
    "thank apologies apologize apologise previous publish published posting posted post tags category plot "
    "tale episode".split())
_PERSON = frozenset("i i'm i've i'd i'll my me we our you your you're".split())
_SEPARATOR_OK_LETTERS = re.compile(r"^[\s.*~\-=_]*(?:[oOxX0][\s.*~\-=_]*){3,12}$")  # "oOo", "xXx", "-x-x-x-"
_QUOTES = "\"“”'‘’«»"
_BARE_NUMBER = re.compile(r"^(?:\d{1,3}|[ivxlc]{1,7})[.:)]?$")
_TITLE_MARKER = re.compile(r"\s*\b(?:ch|chap|chapter|pt|part|book|vol|volume|episode|ep)\.?\s*\S+\s*$", re.I)
_TITLE_PLUS = re.compile(r"^ (?:(?:ch|chap|chapter|pt|part|book|vol|volume|episode|ep) \S+|by \S+(?: \S+){0,3}|\d{1,3}|"
                         r"[ivxlc]{1,7})(?: .{0,40})?$")
_LEAD_DECOR = re.compile(r"^[\s*_~#=+\-–—•·.:()\[\]<>{}|/\\]+")
_TRAIL_DECOR = re.compile(r"[\s*_~#=+\-–—•·:()\[\]<>{}|/\\]+$")


def _norm(p: str) -> str:
    q = p.strip().replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    q = _TRAIL_DECOR.sub("", _LEAD_DECOR.sub("", q))
    return re.sub(r"\s+", " ", q).lower()


def _key(s: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip() if isinstance(s, str) else ""


def is_separator(p: str) -> bool:
    """A line of symbols: no letters or digits (or an 'oOo' pattern), not speech ('"..."'), not just ?/!."""
    q = p.strip()
    if not q or len(q) > 150:
        return False
    if _SEPARATOR_OK_LETTERS.match(q):
        return True
    if any(c.isalnum() for c in q) or any(c in _QUOTES for c in q):
        return False
    return not set(q) <= set("?! ")


def _heading_rest_ok(rest: str, original: str) -> bool:
    """What follows 'Chapter 3' must look like a heading: nothing, a label after ':' '.' '-' ')', or a short
    Title-Case / ALL-CAPS phrase ("Chapter 3 The Return"), never ordinary prose ("Day one was hard.")."""
    rest = rest.strip()
    if not rest:
        return True
    if rest[0] in ":.-–—)]|/,":
        return len(rest.split()) <= 12
    words = [w for w in TOKEN_RE.findall(original)][2:]
    if not words or len(words) > 6:
        return False
    return all(w[:1].isupper() or w[:1].isdigit() or w.lower() in ("of", "the", "a", "an", "and", "in", "on", "to",
                                                                    "for", "at", "with", "by") for w in words)


def classify(p: str, title_key: str = "", desc_key: str = "", title_core: str = "", position: int = 99) -> str | None:
    """The kind of one paragraph (see the module docstring), or None for ordinary story text."""
    if is_separator(p):
        return "separator"
    words = TOKEN_RE.findall(p)
    n = len(words)
    if n == 0:
        return None
    q = _norm(p)
    k = _key(p)
    title_ok = position < 3 or len(title_key.split()) >= 3  # a one- or two-word title can be an ordinary line
    if title_ok and n <= 25 and k and (k in (title_key, title_core) or (
            title_core and k.startswith(title_core + " ") and _TITLE_PLUS.match(k[len(title_core):]))):
        return "heading"
    if desc_key and position < 3 and k == desc_key:
        return "heading"
    if position < 3 and n <= 12 and _BYLINE.match(q):
        after = q.split(" by ", 1)[1] if " by " in f" {q}" and not q.startswith("by ") else q[3:]
        by_words = TOKEN_RE.findall(p)[-len(TOKEN_RE.findall(after)):] if after else []
        if by_words and all(w[:1].isupper() or w[:1].isdigit() or not w.isalpha() for w in by_words):
            return "heading"
    if n <= 2 and _BARE_NUMBER.match(q):
        return "heading"
    if position < 3 and _TAG_LINE.match(p.strip()):
        return "note"
    if n <= 15:
        m = _HEADING_NUM.match(q) or _HEADING_WORD.match(q)
        if m and _heading_rest_ok(m.group("rest"), p):
            return "heading"
        if _END.match(q):
            return "end"
        if (position < 2 and _title_like(p)) or _DECORATED.match(p.strip()):
            return "heading"
    if _NOTE_LABEL.match(q) or _NOTE_START.match(q) or (n <= 60 and _HEADER_FIELD.match(q)) or (
            n <= 150 and _DISCLAIMER_ANY.search(q)):
        return "note"
    if _READER.search(q) or (n <= 12 and _SALUTATION.match(q)):
        return "reader"
    if n <= 200:
        low = [w.lower().replace("’", "'") for w in words]
        if sum(1 for w in low if w in _META) >= 2 and any(w in _PERSON for w in low):
            return "notelike"
    if n <= 3 and not any(c in _QUOTES for c in p) and not p.rstrip().endswith("?"):
        return "signoff"
    return None


@dataclass
class Paratext:
    kinds: list[str | None]
    labels: dict[int, str] = field(default_factory=dict)  # paragraph index -> label, for paratext paragraphs only
    lead_end: int = -1  # last index of the opening block (-1: none)
    tail_start: int = 0  # first index of the closing block (== len(paragraphs): none)

    @property
    def story_indices(self) -> list[int]:
        return [i for i in range(len(self.kinds)) if i not in self.labels]

    def block_kinds(self) -> set[str]:
        return {self.labels[i] for i in self.labels if i <= self.lead_end or i >= self.tail_start}


_DECORATED = re.compile(r"^([-~*=+#_•·])\s*[^\W\d_][^\n]{0,80}?[^\W_]\W{0,3}\s*\1$")


def _title_like(p: str) -> bool:
    """A title line: no sentence punctuation at the end, no quotes, and most words capitalised."""
    q = p.strip()
    if not q or q[-1] in ".!?…,:;\"”'’" or any(c in _QUOTES for c in q):
        return False
    words = [w for w in TOKEN_RE.findall(q) if w[:1].isalpha()]
    small = {"a", "an", "the", "and", "or", "of", "in", "on", "to", "for", "at", "with", "by", "from", "my", "her",
             "his", "your", "our", "their", "is", "it"}
    caps = sum(1 for w in words if w[:1].isupper())
    return bool(words) and caps >= max(1, 0.5 * len(words)) and all(w[:1].isupper() or w.lower() in small
                                                                      for w in words)


def _personal_or_meta(p: str) -> bool:
    low = [w.lower().replace("’", "'") for w in TOKEN_RE.findall(p)]
    return any(w in _PERSON or w in _META for w in low)


def _bare_note_label(p: str) -> bool:
    q = _norm(p)
    return bool(_NOTE_LABEL.match(q) or re.match(r"^(?:notes?|disclaimer|warning|foreword|preface)\W*$", q)) \
        and len(TOKEN_RE.findall(p)) <= 4


def detect(paragraphs: list[str], title: str | None = None, description: str | None = None) -> Paratext:
    n = len(paragraphs)
    tk, dk = _key(title), _key(description)
    core = _key(_TITLE_MARKER.sub("", title)) if isinstance(title, str) else ""
    kinds = [classify(p, tk, dk, core if core != tk else "", i) for i, p in enumerate(paragraphs)]
    words = [len(TOKEN_RE.findall(p)) for p in paragraphs]
    total = sum(words) or 1
    labels: dict[int, str] = {}

    # opening block: notes may continue over note-like paragraphs; a bare "Author's note:" line (or a reader
    # address that ends with a colon, introducing a list) takes the next paragraph; up to two short lines may
    # precede a heading, note or separator
    end, in_note, take_next = -1, False, False
    i = 0
    while i < min(n, MAX_LEADING_PARAS):
        k = kinds[i]
        if take_next and k not in ("separator", "heading"):
            end, in_note, take_next = i, True, False
            i += 1
            continue
        take_next = False
        if k in ("separator", "heading", "end"):
            end, in_note = i, False
        elif k in ("note", "reader"):
            end, in_note = i, True
            take_next = _bare_note_label(paragraphs[i]) or (k == "reader" and paragraphs[i].rstrip().endswith(":"))
        elif k == "notelike" and in_note:
            end = i
        elif end == i - 1 and i < 3 and words[i] <= 8 and not any(c in _QUOTES for c in paragraphs[i]) and any(
                kinds[j] in ("separator", "heading", "note", "reader") for j in range(i + 1, min(n, i + 3))):
            end = i  # a short subtitle / byline-like line right before a heading, note or separator
        else:
            break
        i += 1
    # A note closed by a separator: everything before the first separator among the first 7 paragraphs is
    # paratext when it contains an explicit note or reader address and its other paragraphs are short and
    # personal (I/you) or about the story.
    sep = next((i for i in range(end + 1, min(n, 8)) if kinds[i] == "separator"), None)
    if sep is not None:
        pre = range(end + 1, sep)
        explicit = any(kinds[i] in ("note", "reader") for i in range(sep))
        others_ok = all(kinds[i] in ("note", "reader", "heading", "separator", "end", "notelike", "signoff") or (
            words[i] <= 60 and _personal_or_meta(paragraphs[i])) for i in pre)
        if explicit and others_ok:
            end = sep
            while end + 1 < min(n, MAX_LEADING_PARAS) and kinds[end + 1] in ("separator", "heading", "note", "reader"):
                end += 1
    if end >= 0 and sum(words[: end + 1]) > MAX_LEADING_SHARE * total:
        end = -1
    for i in range(end + 1):
        labels[i] = "note" if kinds[i] in (None, "signoff") else kinds[i]

    # closing block: the trailing run of paratext-like paragraphs, from its earliest anchor on
    run_start = n
    for i in range(n - 1, max(end + 1, n - MAX_TRAILING_PARAS) - 1, -1):
        if kinds[i] in ("separator", "end", "note", "reader", "notelike", "signoff"):
            run_start = i
        else:
            break
    anchors = [i for i in range(run_start, n) if kinds[i] in ("separator", "end", "note", "reader")]
    start = min(anchors) if anchors else n
    if start == n:  # "To be continued" followed by a one- or two-paragraph teaser of the next part
        ends = [i for i in range(max(end + 1, n - 3), n) if kinds[i] == "end"]
        if ends and all(words[j] <= 40 and not any(c in _QUOTES for c in paragraphs[j]) for j in range(ends[0] + 1, n)):
            start = ends[0]
    # a short sign-off line ("Cheers", a name) is paratext only after an explicit note, reader address or end
    # marker; after a bare separator it is the last line of the story (and so is everything before it)
    explicit_before = False
    for i in range(start, n):
        if kinds[i] in ("note", "reader", "end"):
            explicit_before = True
        elif kinds[i] == "signoff" and not explicit_before and not paragraphs[i].rstrip().endswith((",", ":")):
            start = n  # a short line before any note: the story's own last line (a salutation is fine)
            break
    if start < n and sum(words[start:]) > MAX_TRAILING_SHARE * total:
        start = n
    for i in range(start, n):
        labels[i] = "note" if kinds[i] in (None, "signoff") else kinds[i]

    # anywhere: headings, short end markers, explicitly labelled author's notes
    for i in range(end + 1, start):
        k = kinds[i]
        if k == "heading" or (k == "end" and words[i] <= 8) or (k == "note" and _NOTE_LABEL.match(_norm(paragraphs[i]))):
            labels[i] = k
    return Paratext(kinds=kinds, labels=labels, lead_end=end, tail_start=start)


def classify_paragraphs(paragraphs: list[str], title: str | None = None,
                        description: str | None = None) -> dict[int, str]:
    """index -> paratext label, for the overlay of the developer tools."""
    pt = detect(paragraphs, title, description)
    out = {}
    for i, lab in pt.labels.items():
        where = "open" if i <= pt.lead_end else "close" if i >= pt.tail_start else "inside"
        out[i] = f"{lab}/{where}"
    return out
