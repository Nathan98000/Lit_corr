"""Every per-story text measure. Plain-English definitions of each output are in
``litcorr/schema.py`` (which generates docs/DATA_DICTIONARY.md) and the methods
are explained in docs/METHODOLOGY.md.

All "per 1,000 words" rates divide by the number of words in the whole story
unless the name says otherwise ("narr" = narration only, i.e. words outside
quotation marks). Measures that need a minimum amount of text return NaN
(missing) below that amount instead of an unreliable number.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

from ..settings import Analysis
from .doc import TOKEN_RE, TextDoc
from .lexicons import Lexicon, load_all, match
from .paratext import is_separator
from .prepare import Prepared, prepare

NAN = float("nan")

try:  # wordfreq ships its own word-frequency data; no network needed
    from wordfreq import zipf_frequency as _zipf
except ImportError:  # pragma: no cover
    _zipf = None

_ZIPF_CACHE: dict[str, float] = {}
_SYL_CACHE: dict[str, int] = {}


def _num(x: Any) -> float | None:
    """A plain float, or None for None / NaN / pandas NA / non-numbers."""
    try:
        if x is None or isinstance(x, bool):
            return None if x is None else float(x)
        f = float(x)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def _text(x: Any) -> str:
    return x if isinstance(x, str) else ""


def per_1k(count: float, denom: float) -> float:
    return count * 1000.0 / denom if denom else NAN


def share(a: float, b: float) -> float:
    return a / b if b else NAN


def balance(pos: float, neg: float) -> float:
    return (pos - neg) / (pos + neg) if (pos + neg) else NAN


def zipf(word: str) -> float:
    v = _ZIPF_CACHE.get(word)
    if v is None:
        v = float(_zipf(word, "en")) if _zipf else NAN
        _ZIPF_CACHE[word] = v
    return v


_SILENT = re.compile(r"(?:[^laeiouy]es|[^laeiouytd]ed|[^laeiouy]e)$")
_VOWELS = re.compile(r"[aeiouy]+")


def syllables(word: str) -> int:
    """Heuristic syllable count (vowel groups, minus silent endings). ~85-90% exact per word."""
    v = _SYL_CACHE.get(word)
    if v is not None:
        return v
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        v = 0
    elif len(w) <= 3:
        v = 1
    else:
        w2 = _SILENT.sub("", w)
        w2 = re.sub(r"^y", "", w2)
        v = max(1, len(_VOWELS.findall(w2)))
    _SYL_CACHE[word] = v
    return v


# --- closed word classes (pronouns, tense markers) ---------------------------
FP_SING = frozenset("i me my mine myself i'm i've i'd i'll".split())
FP_PLUR = frozenset("we us our ours ourselves we're we've we'd we'll let's".split())
SECOND = frozenset("you your yours yourself yourselves you're you've you'd you'll y'all".split())
MASC = frozenset("he him his himself he's he'd he'll".split())
FEM = frozenset("she her hers herself she's she'd she'll".split())
NEUTRAL = frozenset("they them their theirs themselves themself they're they've they'd they'll".split())

_VERB_PAIRS = (
    "be:am/is/are:was/were have:has:had do:does:did say:says:said go:goes:went look:looks:looked "
    "feel:feels:felt see:sees:saw know:knows:knew think:thinks:thought come:comes:came get:gets:got "
    "take:takes:took make:makes:made want:wants:wanted turn:turns:turned walk:walks:walked "
    "smile:smiles:smiled laugh:laughs:laughed move:moves:moved reach:reaches:reached pull:pulls:pulled "
    "push:pushes:pushed kiss:kisses:kissed touch:touches:touched hold:holds:held stand:stands:stood "
    "sit:sits:sat open:opens:opened begin:begins:began tell:tells:told ask:asks:asked give:gives:gave "
    "find:finds:found run:runs:ran watch:watches:watched wait:waits:waited try:tries:tried "
    "start:starts:started stop:stops:stopped keep:keeps:kept seem:seems:seemed become:becomes:became "
    "lean:leans:leaned slide:slides:slid breathe:breathes:breathed whisper:whispers:whispered "
    "moan:moans:moaned nod:nods:nodded shake:shakes:shook grab:grabs:grabbed wrap:wraps:wrapped "
    "press:presses:pressed hear:hears:heard need:needs:needed love:loves:loved like:likes:liked "
    "close:closes:closed reply:replies:replied pause:pauses:paused stare:stares:stared"
)
PRESENT_FORMS: set[str] = set()
PAST_FORMS: set[str] = set()
BASE_FORMS: set[str] = set()
for _item in _VERB_PAIRS.split():
    _base, _pres, _past = _item.split(":")
    PRESENT_FORMS.update(_pres.split("/"))
    PAST_FORMS.update(_past.split("/"))
    if _base != "be":
        BASE_FORMS.add(_base)
_PRESENT_SUBJECTS = frozenset({"i", "we", "you", "they"})

# --- passive voice -------------------------------------------------------------
_BE_AUX = frozenset("am is are was were be been being get gets got gotten getting isn't wasn't aren't weren't".split())
_PASSIVE_SKIP = frozenset("not never just already also then still really so very all completely totally almost".split())
_IRREGULAR_PARTICIPLES = frozenset(
    "taken given seen done made held bound tied kept left told shown known brought bought caught taught found "
    "beaten bitten broken chosen driven eaten fallen forgotten forgiven frozen hidden ridden risen shaken spoken "
    "stolen sworn torn thrown woken worn written laid paid sold sent spent built led fed won drawn grown flown "
    "swung stuck struck hung spun sought fought shot lit slid spread shut born".split()
)
_ED_NOT_PASSIVE = frozenset(
    "need bed red seed shed speed feed weed breed bleed proceed succeed exceed indeed naked sacred wicked hundred "
    "kindred rugged jagged ragged beloved wed fled sled tired excited interested scared worried surprised pleased "
    "bored confused embarrassed married relieved amazed annoyed frustrated disappointed determined satisfied "
    "convinced shocked stunned aroused aged supposed used talented crooked learned".split()
)

# --- misc --------------------------------------------------------------------------
_CHAPTER = re.compile(
    r"\b(?:ch(?:apter)?|pt|part|book|vol(?:ume)?|episode|ep|act)\.?\s*(\d+|[ivxlc]+\b|one|two|three|four|five|six|"
    r"seven|eight|nine|ten)\b",
    re.I,
)
_TRAILING_NUMBER = re.compile(r"\b(\d{1,2})\s*$")  # "Midnight Train 2": a part number only with other series evidence
_NUM_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
              "ten": 10}
_ROMAN = {"i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10}
_AUTHOR_NOTE = re.compile(
    r"\b(?:author'?s note|authors note|a/n\b|note from the author|editor'?s note|thanks? (?:to|you to) my editors?|"
    r"edited by|disclaimer)", re.I)
_FEEDBACK = re.compile(
    r"(?:please (?:do )?(?:vote|rate|comment|leave (?:a )?(?:comment|vote|feedback|rating)|let me know)|"
    r"(?:votes?|comments?|feedback|ratings?) (?:are|is|would be) (?:\w+ )?(?:appreciated|welcome|welcomed|encouraged)|"
    r"leave (?:a |me a )?(?:comment|vote|feedback|rating)|don'?t forget to (?:vote|rate|comment)|"
    r"let me know what you think|hit (?:the|those) stars?|five stars|5 stars)", re.I)
# A dash: em dash or horizontal bar, a run of two or more hyphens, or a hyphen / en dash with a space on each side
# between words ("she paused - then left"). Hyphens inside words and list bullets are not dashes.
_DASH = re.compile(r"[—―]+|-{2,}|(?<=\S)\s[-–]\s(?=\S)")
_ALLCAPS_OK = frozenset("I OK TV US USA UK FBI CIA CEO DNA ID AM PM DVD CD ATM SUV GPS BBQ LOL OMG BDSM MILF DM PS NYC LA II "
                        "III IV VI XL XXL HR IT PR ER ICU NFL NBA MBA BMW".split())
_LY_NOT_ADVERB = frozenset(
    "only family early reply daily holy ugly silly lonely lovely friendly likely unlikely belly bully jelly fly rely "
    "supply apply italy july lily emily molly kelly sally holly ally rally folly jolly oily hilly chilly curly burly "
    "surly elderly costly deadly lively lowly orderly ghostly manly womanly comply assembly anomaly monopoly "
    "butterfly dragonfly firefly homely stately timely hourly weekly monthly yearly smelly scaly wily sly "
    "imply reply bodily".split())
_NAME_SHAPE = re.compile(r"^[A-Z][a-z]+(?:[A-Z][a-z]+)?$")
_FILLERS = frozenset("please now just oh so okay ok well then and baby honey darling sweetheart babe".split())

LEXICON_MEASURES = {  # lexicon file -> used as a measured category
    "sexual_anatomy", "sexual_action", "sexual_general", "emotion_positive", "emotion_negative", "emotion_affection",
    "emotion_anxiety", "emotion_anger", "emotion_sadness", "emotion_arousal", "emotion_shame", "emotion_jealousy",
    "mental_verbs", "perception_verbs", "hedges", "modal_verbs", "uncertainty", "certainty", "distancing",
    "immediacy", "sensory_touch", "sensory_sight", "sensory_sound", "sensory_smell", "sensory_taste", "sensory_body",
    "relationship_romance", "relationship_intimacy", "relationship_terms", "relationship_disclosure",
    "relationship_familiarity", "relationship_closeness", "agency_volition", "agency_control", "agency_dominance",
    "agency_submission", "action_verbs", "descriptive_words", "profanity", "speech_verbs", "subordinators",
}
SUPPORT_LEXICONS = {"stopwords", "not_names", "imperative_verbs"}


class Measurer:
    def __init__(self, lexicons: dict[str, Lexicon] | None = None, analysis: Analysis | None = None):
        self.lex = lexicons if lexicons is not None else load_all()
        missing = (LEXICON_MEASURES | SUPPORT_LEXICONS) - set(self.lex)
        if missing:
            raise FileNotFoundError(f"Missing lexicon files: {sorted(missing)}")
        self.cfg = analysis or Analysis()
        self.stop = self.lex["stopwords"].words
        self.not_names = self.lex["not_names"].words
        self.imperatives = self.lex["imperative_verbs"].words

    # ------------------------------------------------------------------ public
    def measure(self, paragraphs: list[str], meta: dict[str, Any] | None = None) -> dict[str, Any]:
        """Every text measure for one story. ``paragraphs`` is the raw text; paratext (author's notes, headings,
        "to be continued" ...) is set aside first and only the story paragraphs are measured."""
        meta = meta or {}
        prep = prepare(paragraphs, _text(meta.get("title")) or None, _text(meta.get("description")) or None)
        doc = TextDoc(prep.story)
        out: dict[str, Any] = {}
        self._title_series_meta(meta, out)
        if prep.paragraphs:
            out["_words_incl_paratext"] = prep.words_all  # for the site word-count check; dropped by analyze
        if doc.n == 0:
            return out  # no text: every text measure stays missing (not zero)
        self._story_basics(doc, prep, out)
        if doc.n < self.cfg.min_words_for_text_measures:
            out["qc_text_too_short"] = True
            return out
        out["qc_text_too_short"] = False
        hits = {name: match(self.lex[name], doc.vocab, doc.type_ids, doc.para_idx, doc.positions_by_type())
                for name in LEXICON_MEASURES}
        stop_type = np.fromiter((w in self.stop for w in doc.vocab), dtype=bool, count=len(doc.vocab))
        alpha_type = np.fromiter((w.replace("'", "").isalpha() for w in doc.vocab), dtype=bool, count=len(doc.vocab))
        self._narration(doc, out)
        self._dialogue(doc, out)
        self._punctuation(doc, out)
        self._questions(doc, out)
        self._sexual(doc, hits, out)
        self._emotion(doc, hits, out)
        self._psych(doc, hits, out)
        self._hedging(doc, hits, out)
        self._sensory(doc, hits, out)
        self._relationship(doc, hits, out)
        self._agency(doc, hits, out)
        self._gender(doc, out)
        self._lexical(doc, alpha_type, out)
        self._readability(doc, alpha_type, hits, out)
        self._repetition(doc, stop_type, out)
        self._pacing(doc, hits, out)
        self._characters(doc, out)
        self._style(doc, hits, alpha_type, meta, out)
        out["qc_english_function_word_share"] = float(stop_type[doc.type_ids].mean())
        out["qc_quote_style"] = doc.mode
        out["qc_dialogue_quotes_unbalanced"] = bool(
            doc.quoted_paragraphs >= 5 and doc.unbalanced_paragraphs / doc.quoted_paragraphs > 0.5)
        return out

    # --------------------------------------------------------------- families
    def _story_basics(self, doc: TextDoc, prep: Prepared, out: dict[str, Any]) -> None:
        n = doc.n
        out["story_words"] = n
        out["story_chars"] = sum(len(p) for p in doc.paragraphs)
        out["story_paragraphs"] = sum(1 for t in doc.para_tokens if t > 0)
        out["story_sentences"] = len(doc.sentences)
        sl = np.array([s.end - s.start for s in doc.sentences], dtype=float)
        pl = np.array([t for t in doc.para_tokens if t > 0], dtype=float)
        out["story_mean_sentence_words"] = float(sl.mean()) if sl.size else NAN
        out["story_median_sentence_words"] = float(np.median(sl)) if sl.size else NAN
        out["story_mean_paragraph_words"] = float(pl.mean()) if pl.size else NAN
        out["story_median_paragraph_words"] = float(np.median(pl)) if pl.size else NAN
        ps = [s for s, t in zip(doc.para_sentences, doc.para_tokens) if t > 0]
        out["story_one_sentence_paragraph_share"] = share(sum(1 for s in ps if s == 1), len(ps))
        out["story_long_paragraph_share"] = share(float((pl > 150).sum()), pl.size)
        breaks = len(prep.separators())
        out["story_scene_breaks"] = breaks
        out["story_scene_breaks_per_1k"] = per_1k(breaks, n)
        # Notes and requests to readers: in the paratext, or (as before) in the first or last three story
        # paragraphs, where an author sometimes writes them without any label.
        head_tail = [p.replace("’", "'") for p in doc.paragraphs[:3] + doc.paragraphs[-3:]]
        para = [p.replace("’", "'") for p in prep.paratext_paragraphs]
        out["story_has_author_note"] = prep.has_note() or any(_AUTHOR_NOTE.search(p) for p in head_tail)
        out["story_requests_feedback"] = any(_FEEDBACK.search(p) for p in para + head_tail)

    def _title_series_meta(self, meta: dict[str, Any], out: dict[str, Any]) -> None:
        title = _text(meta.get("title"))
        desc = _text(meta.get("description"))
        out["title_chars"] = len(title) if title else NAN
        out["title_words"] = len(TOKEN_RE.findall(title)) if title else NAN
        parsed = meta.get("_parsed", True)
        m = _CHAPTER.search(title) if title else None
        out["title_has_chapter_marker"] = bool(m) if title else NAN
        number = None
        if m:
            g = (m.group(1) or "").lower()
            number = int(g) if g.isdigit() else _NUM_WORDS.get(g) or _ROMAN.get(g)
        out["desc_chars"] = len(desc) if desc else NAN
        out["desc_words"] = len(TOKEN_RE.findall(desc)) if desc else NAN
        tags = meta.get("tags")
        out["meta_tag_count"] = len(tags) if parsed and isinstance(tags, (list, tuple, np.ndarray)) else NAN
        parts_count = _num(meta.get("series_parts_count"))
        part_index = _num(meta.get("series_part_index"))
        series_id = meta.get("series_id")
        has_series_id = isinstance(series_id, (str, int)) and str(series_id).strip() != ""
        other_evidence = has_series_id or (parts_count is not None and parts_count >= 2)
        if number is None and other_evidence and title:
            t = _TRAILING_NUMBER.search(title)
            number = int(t.group(1)) if t else None
        if not parsed:
            for k in ("series_is_part", "series_part_number", "series_parts_count", "series_is_later_part"):
                out[k] = NAN
            return
        in_series = other_evidence or bool(m)
        out["series_is_part"] = in_series
        part = part_index if part_index is not None else number
        out["series_part_number"] = float(part) if (in_series and part) else NAN
        out["series_parts_count"] = parts_count if parts_count is not None else NAN
        out["series_is_later_part"] = (bool(part > 1) if part else NAN) if in_series else False

    def _narration(self, doc: TextDoc, out: dict[str, Any]) -> None:
        narr = ~doc.in_quote
        n, n_narr = doc.n, int(narr.sum())
        codes = np.zeros(len(doc.vocab), dtype=np.int8)
        for i, w in enumerate(doc.vocab):
            codes[i] = (1 if w in FP_SING else 2 if w in FP_PLUR else 3 if w in SECOND else 4 if w in MASC
                        else 5 if w in FEM else 6 if w in NEUTRAL else 0)
        c = codes[doc.type_ids]
        all_counts = np.bincount(c, minlength=7)
        narr_counts = np.bincount(c[narr], minlength=7)
        out["pov_first_singular_per_1k"] = per_1k(all_counts[1], n)
        out["pov_first_plural_per_1k"] = per_1k(all_counts[2], n)
        out["pov_second_per_1k"] = per_1k(all_counts[3], n)
        out["pov_third_per_1k"] = per_1k(all_counts[4:7].sum(), n)
        fp_n, sp_n, tp_n = narr_counts[1], narr_counts[3], narr_counts[4:7].sum()
        out["pov_first_singular_narr_per_1k"] = per_1k(fp_n, n_narr)
        out["pov_second_narr_per_1k"] = per_1k(sp_n, n_narr)
        out["pov_third_narr_per_1k"] = per_1k(tp_n, n_narr)
        out["pov_first_person_share"] = share(fp_n + narr_counts[2], fp_n + narr_counts[2] + tp_n)
        fp_rate, sp_rate = per_1k(fp_n, n_narr), per_1k(sp_n, n_narr)
        if n_narr < 200:
            cls = "unknown"
        elif sp_rate >= 15 and sp_rate > fp_rate:
            cls = "second"
        elif fp_rate >= 15:
            cls = "first"
        elif fp_rate < 5:
            cls = "third"
        else:
            cls = "mixed"
        out["pov_class"] = cls
        out["pov_is_first_person"] = 1.0 if cls == "first" else 0.0 if cls == "third" else NAN

        # Tense of the narration: present vs past forms of common verbs.
        pres = past = 0
        toks = doc.tokens
        for i in np.flatnonzero(narr):
            w = toks[i]
            if w in PRESENT_FORMS:
                pres += 1
            elif w in PAST_FORMS:
                past += 1
            elif w in BASE_FORMS and i > 0 and toks[i - 1] in _PRESENT_SUBJECTS and narr[i - 1]:
                pres += 1
        s = share(pres, pres + past)
        out["narr_present_tense_share"] = s if pres + past >= 20 else NAN
        out["narr_tense_class"] = ("unknown" if pres + past < 20 else "present" if s >= 0.6 else
                                   "past" if s <= 0.4 else "mixed")
        out["narr_is_present_tense"] = (1.0 if out["narr_tense_class"] == "present" else
                                        0.0 if out["narr_tense_class"] == "past" else NAN)

    def _dialogue(self, doc: TextDoc, out: dict[str, Any]) -> None:
        n = doc.n
        segs = doc.segments
        out["dlg_word_share"] = float(doc.in_quote.mean()) if n else NAN
        out["dlg_segments"] = len(segs)
        out["dlg_segments_per_1k"] = per_1k(len(segs), n)
        out["dlg_mean_segment_words"] = float(np.mean(segs)) if segs else NAN
        out["dlg_question_share"] = share(doc.q_in, doc.q_all)
        out["dlg_exclamation_share"] = share(doc.e_in, doc.e_all)
        with_words = [d for d, t in zip(doc.para_has_dialogue, doc.para_tokens) if t > 0]
        out["dlg_paragraph_share"] = share(sum(with_words), len(with_words))
        out["dlg_has_dialogue"] = len(segs) > 0

    def _punctuation(self, doc: TextDoc, out: dict[str, Any]) -> None:
        # Scene-break lines ("-----", "......") are not punctuation in a sentence.
        text = "\n".join(p for p in doc.paragraphs if not is_separator(p))
        n = doc.n
        out["punct_exclamation_per_1k"] = per_1k(text.count("!"), n)
        out["punct_question_per_1k"] = per_1k(text.count("?"), n)
        out["punct_ellipsis_per_1k"] = per_1k(len(re.findall(r"…|\.(?:\s?\.){2,}", text)), n)
        out["punct_dash_per_1k"] = per_1k(len(_DASH.findall(text)), n)
        out["punct_semicolon_per_1k"] = per_1k(text.count(";"), n)
        out["punct_colon_per_1k"] = per_1k(len(re.findall(r":(?!//)", text)), n)
        out["punct_comma_per_1k"] = per_1k(text.count(","), n)
        out["punct_quote_marks_per_1k"] = per_1k(sum(text.count(c) for c in '"“”'), n)
        out["punct_parentheses_per_1k"] = per_1k(text.count("("), n)
        out["punct_repeated_per_1k"] = per_1k(len(re.findall(r"[!?]{2,}", text)), n)

    def _questions(self, doc: TextDoc, out: dict[str, Any]) -> None:
        terms = [s.terminal for s in doc.sentences]
        q, e = terms.count("?"), terms.count("!")
        statements = len(terms) - q - e
        out["qe_question_sentence_share"] = share(q, len(terms))
        out["qe_exclamation_sentence_share"] = share(e, len(terms))
        out["qe_question_sentences_per_1k"] = per_1k(q, doc.n)
        out["qe_exclamation_sentences_per_1k"] = per_1k(e, doc.n)
        out["qe_question_to_statement_ratio"] = share(q, statements)

    def _sexual(self, doc: TextDoc, hits: dict[str, np.ndarray], out: dict[str, Any]) -> None:
        n = doc.n
        anat, act, gen = hits["sexual_anatomy"], hits["sexual_action"], hits["sexual_general"]
        allsex = np.maximum(np.maximum(anat, act), gen)
        total = int(allsex.sum())
        out["sex_terms"] = total
        out["sex_terms_per_1k"] = per_1k(total, n)
        out["sex_anatomy_per_1k"] = per_1k(int(anat.sum()), n)
        out["sex_action_per_1k"] = per_1k(int(act.sum()), n)
        out["sex_other_per_1k"] = per_1k(int(gen.sum()), n)
        pos = np.flatnonzero(allsex)
        sent_with = len(set(doc.sent_idx[pos].tolist())) if pos.size else 0
        out["sex_sentence_share"] = share(sent_with, len(doc.sentences))
        out["sex_first_mention_position"] = float(pos[0] / n) if pos.size else NAN
        out["sex_words_before_first"] = float(pos[0]) if pos.size else NAN
        out["sex_distinct_terms"] = len({doc.tokens[i] for i in pos})
        out["sex_has_explicit_terms"] = total > 0

    def _emotion(self, doc: TextDoc, hits: dict[str, np.ndarray], out: dict[str, Any]) -> None:
        n = doc.n
        names = {"affection": "emotion_affection", "anxiety": "emotion_anxiety", "anger": "emotion_anger",
                 "sadness": "emotion_sadness", "arousal": "emotion_arousal", "shame": "emotion_shame",
                 "jealousy": "emotion_jealousy"}
        positive = np.maximum(hits["emotion_positive"], hits["emotion_affection"])
        negative = hits["emotion_negative"].copy()
        for k in ("emotion_anxiety", "emotion_anger", "emotion_sadness", "emotion_shame", "emotion_jealousy"):
            negative = np.maximum(negative, hits[k])
        overall = np.maximum(np.maximum(positive, negative), hits["emotion_arousal"])
        out["emo_overall_per_1k"] = per_1k(int(overall.sum()), n)
        out["emo_positive_per_1k"] = per_1k(int(positive.sum()), n)
        out["emo_negative_per_1k"] = per_1k(int(negative.sum()), n)
        for short, lex in names.items():
            out[f"emo_{short}_per_1k"] = per_1k(int(hits[lex].sum()), n)
        out["emo_balance"] = balance(int(positive.sum()), int(negative.sum()))

    def _psych(self, doc: TextDoc, hits: dict[str, np.ndarray], out: dict[str, Any]) -> None:
        n = doc.n
        filt = np.maximum(hits["mental_verbs"], hits["perception_verbs"])
        out["psy_mental_verbs_per_1k"] = per_1k(int(hits["mental_verbs"].sum()), n)
        out["psy_perception_verbs_per_1k"] = per_1k(int(hits["perception_verbs"].sum()), n)
        out["psy_filter_words_per_1k"] = per_1k(int(filt.sum()), n)
        out["psy_distancing_per_1k"] = per_1k(int(hits["distancing"].sum()), n)
        out["psy_immediacy_per_1k"] = per_1k(int(hits["immediacy"].sum()), n)

    def _hedging(self, doc: TextDoc, hits: dict[str, np.ndarray], out: dict[str, Any]) -> None:
        n = doc.n
        h = int(hits["hedges"].sum())
        c = int(hits["certainty"].sum())
        will_contractions = sum(1 for t in doc.tokens if t.endswith("'ll"))
        out["hedge_count"] = h
        out["hedge_per_1k"] = per_1k(h, n)
        out["hedge_modal_per_1k"] = per_1k(int(hits["modal_verbs"].sum()) + will_contractions, n)
        out["hedge_uncertainty_per_1k"] = per_1k(int(hits["uncertainty"].sum()), n)
        out["hedge_certainty_per_1k"] = per_1k(c, n)
        out["hedge_certainty_balance"] = balance(c, h)

    def _sensory(self, doc: TextDoc, hits: dict[str, np.ndarray], out: dict[str, Any]) -> None:
        n = doc.n
        union = np.zeros(n, dtype=np.int8)
        for sense in ("touch", "sight", "sound", "smell", "taste", "body"):
            h = hits[f"sensory_{sense}"]
            union = np.maximum(union, h)
            out[f"sense_{sense}_count"] = int(h.sum())
            out[f"sense_{sense}_per_1k"] = per_1k(int(h.sum()), n)
        out["sense_total_per_1k"] = per_1k(int(union.sum()), n)

    def _relationship(self, doc: TextDoc, hits: dict[str, np.ndarray], out: dict[str, Any]) -> None:
        for k in ("romance", "intimacy", "terms", "disclosure", "familiarity", "closeness"):
            out[f"rel_{k}_per_1k"] = per_1k(int(hits[f"relationship_{k}"].sum()), doc.n)

    def _agency(self, doc: TextDoc, hits: dict[str, np.ndarray], out: dict[str, Any]) -> None:
        n, toks = doc.n, doc.tokens
        aux_type = np.fromiter((w in _BE_AUX for w in doc.vocab), dtype=bool, count=len(doc.vocab))
        passive = 0
        passive_sents: set[int] = set()
        for i in np.flatnonzero(aux_type[doc.type_ids]):
            j, skipped = i + 1, 0
            while j < n and skipped < 2 and (toks[j] in _PASSIVE_SKIP or (toks[j].endswith("ly") and len(toks[j]) > 4)):
                j += 1
                skipped += 1
            if j >= n or doc.sent_idx[j] != doc.sent_idx[i]:
                continue
            w = toks[j]
            if w in _IRREGULAR_PARTICIPLES or (w.endswith("ed") and len(w) > 4 and w not in _ED_NOT_PASSIVE):
                passive += 1
                passive_sents.add(int(doc.sent_idx[i]))
        ns = len(doc.sentences)
        out["agency_passive_per_1k"] = per_1k(passive, n)
        out["agency_passive_sentence_share"] = share(len(passive_sents), ns)
        out["agency_active_sentence_share"] = 1.0 - out["agency_passive_sentence_share"] if ns else NAN
        out["agency_volition_per_1k"] = per_1k(int(hits["agency_volition"].sum()), n)
        out["agency_control_per_1k"] = per_1k(int(hits["agency_control"].sum()), n)
        out["agency_dominance_per_1k"] = per_1k(int(hits["agency_dominance"].sum()), n)
        out["agency_submission_per_1k"] = per_1k(int(hits["agency_submission"].sum()), n)
        commands = 0
        for first, count, has_q in doc.segment_info:
            if has_q:
                continue
            j, end = first, first + count
            steps = 0
            # Skip fillers ("please", "now") and a vocative name followed by a comma ("Sarah, come here"),
            # but never ordinary words such as "You", "We", "It" ("You look beautiful" is not a command).
            while j < end and steps < 3 and (toks[j] in _FILLERS or (
                    _NAME_SHAPE.match(doc.orig[j]) and toks[j] not in self.stop and toks[j] not in self.imperatives
                    and doc.comma_after[j] and j + 1 < end)):
                j += 1
                steps += 1
            if j < end and toks[j] in self.imperatives:
                if toks[j] in ("don't", "do") and j + 1 < end and toks[j + 1] in ("you", "i", "we", "they"):
                    continue  # "Do you ...", a question without a question mark
                commands += 1
        out["agency_commands_per_1k"] = per_1k(commands, n)
        out["agency_command_share_of_speech"] = share(commands, len(doc.segment_info))

    def _gender(self, doc: TextDoc, out: dict[str, Any]) -> None:
        n = doc.n
        c = Counter(doc.tokens)
        m = sum(c[w] for w in MASC)
        f = sum(c[w] for w in FEM)
        neu = sum(c[w] for w in NEUTRAL)
        out["gender_masculine_per_1k"] = per_1k(m, n)
        out["gender_feminine_per_1k"] = per_1k(f, n)
        out["gender_neutral_plural_per_1k"] = per_1k(neu, n)
        fs = share(f, m + f)
        out["gender_feminine_share"] = fs
        if per_1k(m + f, n) < 5:
            comp = "few_gendered_pronouns"
        elif fs >= 0.65:
            comp = "mostly_feminine"
        elif fs <= 0.35:
            comp = "mostly_masculine"
        else:
            comp = "mixed"
        out["gender_composition"] = comp

    def _lexical(self, doc: TextDoc, alpha_type: np.ndarray, out: dict[str, Any]) -> None:
        n, ids, w = doc.n, doc.type_ids, self.cfg.window_tokens
        out["lex_unique_words"] = len(doc.vocab)
        out["lex_ttr"] = share(len(doc.vocab), n)
        if n >= w:
            counts = np.zeros(len(doc.vocab), dtype=np.int32)
            distinct = 0
            for t in ids[:w]:
                counts[t] += 1
                if counts[t] == 1:
                    distinct += 1
            total = distinct
            for i in range(w, n):
                o = ids[i - w]
                counts[o] -= 1
                if counts[o] == 0:
                    distinct -= 1
                t = ids[i]
                counts[t] += 1
                if counts[t] == 1:
                    distinct += 1
                total += distinct
            out["lex_mattr"] = total / (n - w + 1) / w
        else:
            out["lex_mattr"] = NAN
        seg = 1000
        if n >= seg:
            ttrs = [len(np.unique(ids[s:s + seg])) / seg for s in range(0, n - seg + 1, seg)]
            out["lex_segment_ttr"] = float(np.mean(ttrs))
        else:
            out["lex_segment_ttr"] = NAN
        alpha_tok = alpha_type[ids]
        counts = doc.type_counts
        words = [wd for wd, a in zip(doc.vocab, alpha_type) if a]
        wcounts = np.array([counts[doc.vocab_index[wd]] for wd in words], dtype=float)
        if wcounts.sum() > 0:
            z = np.array([zipf(wd) for wd in words], dtype=float)
            tot = wcounts.sum()
            out["lex_mean_word_zipf"] = float((z * wcounts).sum() / tot)
            out["lex_rare_word_share"] = float(wcounts[(z > 0) & (z < 3.0)].sum() / tot)
            out["lex_unrecognized_word_share"] = float(wcounts[z == 0].sum() / tot)
            lens = np.array([len(wd.replace("'", "")) for wd in words])
            out["lex_long_word_share"] = float(wcounts[lens >= 7].sum() / tot)
        else:
            for k in ("lex_mean_word_zipf", "lex_rare_word_share", "lex_unrecognized_word_share", "lex_long_word_share"):
                out[k] = NAN
        out["_n_alpha"] = int(alpha_tok.sum())

    def _readability(self, doc: TextDoc, alpha_type: np.ndarray, hits: dict[str, np.ndarray],
                     out: dict[str, Any]) -> None:
        n_alpha = out.pop("_n_alpha")
        ns = len(doc.sentences)
        if n_alpha == 0 or ns == 0:
            for k in ("read_mean_word_chars", "read_mean_syllables_per_word", "read_polysyllable_share",
                      "read_flesch_reading_ease", "read_flesch_kincaid_grade", "read_ari", "read_coleman_liau",
                      "read_gunning_fog", "read_grade_composite"):
                out[k] = NAN
        else:
            counts = doc.type_counts
            letters = syl = poly = 0
            for i, wd in enumerate(doc.vocab):
                if not alpha_type[i]:
                    continue
                c = int(counts[i])
                letters += len(wd.replace("'", "")) * c
                s = syllables(wd)
                syl += s * c
                if s >= 3:
                    poly += c
            wps = n_alpha / ns
            spw = syl / n_alpha
            cpw = letters / n_alpha
            out["read_mean_word_chars"] = cpw
            out["read_mean_syllables_per_word"] = spw
            out["read_polysyllable_share"] = poly / n_alpha
            out["read_flesch_reading_ease"] = 206.835 - 1.015 * wps - 84.6 * spw
            fk = 0.39 * wps + 11.8 * spw - 15.59
            ari = 4.71 * cpw + 0.5 * wps - 21.43
            cli = 0.0588 * (cpw * 100) - 0.296 * (100 / wps) - 15.8
            out["read_flesch_kincaid_grade"] = fk
            out["read_ari"] = ari
            out["read_coleman_liau"] = cli
            out["read_gunning_fog"] = 0.4 * (wps + 100 * poly / n_alpha)
            out["read_grade_composite"] = (fk + ari + cli) / 3
        text = "\n".join(doc.paragraphs)
        out["syn_commas_per_sentence"] = share(text.count(","), ns)
        out["syn_subordinators_per_sentence"] = share(int(hits["subordinators"].sum()), ns)
        sl = np.array([s.end - s.start for s in doc.sentences], dtype=float)
        out["syn_long_sentence_share"] = float((sl > 30).mean()) if sl.size else NAN
        out["syn_short_sentence_share"] = float((sl <= 5).mean()) if sl.size else NAN
        out["syn_sentence_length_sd"] = float(sl.std()) if sl.size > 1 else NAN

    def _repetition(self, doc: TextDoc, stop_type: np.ndarray, out: dict[str, Any]) -> None:
        n, ids, w = doc.n, doc.type_ids, self.cfg.window_tokens
        content_type = ~stop_type & np.fromiter((len(v) >= 3 and v.replace("'", "").isalpha() for v in doc.vocab),
                                                dtype=bool, count=len(doc.vocab))
        sw = stop_type[ids]
        if n >= w:
            tops, bi, tri = [], [], []
            for s in range(0, n - w + 1, w):
                seg = ids[s:s + w]
                cont = seg[content_type[seg]]
                if cont.size:
                    _, cc = np.unique(cont, return_counts=True)
                    tops.append(np.sort(cc)[::-1][:10].sum() / cont.size)
                for k, bucket in ((2, bi), (3, tri)):
                    grams = sliding_window_view(seg, k)
                    keep = ~sliding_window_view(sw[s:s + w], k).all(axis=1)
                    grams = grams[keep]
                    if len(grams):
                        _, inv, cnt = np.unique(grams, axis=0, return_inverse=True, return_counts=True)
                        bucket.append(float((cnt[inv.ravel()] >= 2).mean()))
            out["rep_top10_content_share"] = float(np.mean(tops)) if tops else NAN
            out["rep_bigram_repeat_share"] = float(np.mean(bi)) if bi else NAN
            out["rep_trigram_repeat_share"] = float(np.mean(tri)) if tri else NAN
        else:
            out["rep_top10_content_share"] = out["rep_bigram_repeat_share"] = out["rep_trigram_repeat_share"] = NAN
        # adjacent sentences
        overlaps, same_start = [], 0
        prev_set, prev_first = None, None
        for s in doc.sentences:
            seg = ids[s.start:s.end]
            cset = set(seg[content_type[seg]].tolist())
            if prev_set is not None and cset and prev_set:
                overlaps.append(len(cset & prev_set) / len(cset | prev_set))
            first = ids[s.start]
            if prev_first is not None and first == prev_first:
                same_start += 1
            prev_set, prev_first = cset, first
        out["rep_adjacent_sentence_overlap"] = float(np.mean(overlaps)) if overlaps else NAN
        out["rep_same_start_share"] = share(same_start, len(doc.sentences) - 1) if len(doc.sentences) > 1 else NAN
        same = (ids[1:] == ids[:-1]) & (doc.para_idx[1:] == doc.para_idx[:-1]) if n > 1 else np.zeros(0, bool)
        out["rep_immediate_word_repeats_per_1k"] = per_1k(int(same.sum()), n)
        if n >= 5:
            g5 = sliding_window_view(ids, 5)
            keep = ~sliding_window_view(sw, 5).all(axis=1)
            g5 = g5[keep]
            if len(g5):
                _, cnt = np.unique(g5, axis=0, return_counts=True)
                out["rep_repeated_5gram_per_1k"] = per_1k(int((cnt[cnt >= 2] - 1).sum()), n)
            else:
                out["rep_repeated_5gram_per_1k"] = 0.0
        else:
            out["rep_repeated_5gram_per_1k"] = NAN

    def _pacing(self, doc: TextDoc, hits: dict[str, np.ndarray], out: dict[str, Any]) -> None:
        n, k = doc.n, self.cfg.pacing_segments
        measures = {
            "sex": np.maximum(np.maximum(hits["sexual_anatomy"], hits["sexual_action"]), hits["sexual_general"]),
            "emotion": None,
            "dialogue": doc.in_quote.astype(np.int8),
            "action": hits["action_verbs"],
            "descriptive": hits["descriptive_words"].copy(),
        }
        emo = hits["emotion_positive"].copy()
        for name in ("emotion_negative", "emotion_affection", "emotion_anxiety", "emotion_anger", "emotion_sadness",
                     "emotion_arousal", "emotion_shame", "emotion_jealousy"):
            emo = np.maximum(emo, hits[name])
        measures["emotion"] = emo
        for sense in ("touch", "sight", "sound", "smell", "taste", "body"):
            measures["descriptive"] = np.maximum(measures["descriptive"], hits[f"sensory_{sense}"])
        long_enough = n >= self.cfg.min_words_for_pacing
        bounds = np.array_split(np.arange(n), k) if long_enough else []
        for name, arr in measures.items():
            if not long_enough:
                for suffix in ("early", "late", "shift", "peak_position"):
                    out[f"pace_{name}_{suffix}"] = NAN
                continue
            if name == "dialogue":
                d = np.array([arr[b].mean() for b in bounds])
            else:
                d = np.array([arr[b].sum() * 1000.0 / len(b) for b in bounds])
            out[f"pace_{name}_early"] = float(d[0])
            out[f"pace_{name}_late"] = float(d[-1])
            out[f"pace_{name}_shift"] = float(d[-1] - d[0])
            out[f"pace_{name}_peak_position"] = float((np.argmax(d) + 0.5) / k) if d.max() > 0 else NAN

    def recurring_names(self, doc: TextDoc) -> tuple[list[str], Counter[str]]:
        """The capitalised words counted as recurring names, and how often each occurs anywhere."""
        mid: Counter[str] = Counter()
        anywhere: Counter[str] = Counter()
        lower_counts = Counter(t for t, o in zip(doc.tokens, doc.orig) if o[:1].islower())
        for i, o in enumerate(doc.orig):
            base = o[:-2] if o.endswith(("'s", "’s")) else o
            if not _NAME_SHAPE.match(base):
                continue
            low = base.lower()
            if low in self.not_names or low in self.stop or len(base) < 2:
                continue
            anywhere[base] += 1
            if not doc.sent_initial[i]:
                mid[base] += 1
        names = []
        for name, cnt in mid.items():
            if cnt < 3:
                continue
            lc = lower_counts.get(name.lower(), 0)
            if lc > 0.2 * (anywhere[name] + lc):
                continue  # mostly an ordinary word that is sometimes capitalised
            names.append(name)
        return names, anywhere

    def _characters(self, doc: TextDoc, out: dict[str, Any]) -> None:
        names, anywhere = self.recurring_names(doc)
        mentions = [anywhere[nm] for nm in names]
        out["char_recurring_names"] = len(names)
        out["char_name_mentions_per_1k"] = per_1k(sum(mentions), doc.n)
        out["char_top_name_share"] = share(max(mentions), sum(mentions)) if mentions else NAN

    def _style(self, doc: TextDoc, hits: dict[str, np.ndarray], alpha_type: np.ndarray, meta: dict[str, Any],
               out: dict[str, Any]) -> None:
        n = doc.n
        out["style_profanity_per_1k"] = per_1k(int(hits["profanity"].sum()), n)
        caps = sum(1 for o in doc.orig if len(o) >= 2 and o.isalpha() and o.isupper() and o not in _ALLCAPS_OK)
        out["style_all_caps_words_per_1k"] = per_1k(caps, n)
        # Count -ly words written in lower case (so names such as Kimberly or Billy are not adverbs);
        # a capitalised sentence-initial use counts if the word also appears in lower case elsewhere.
        lower_seen = {t for t, o in zip(doc.tokens, doc.orig) if o[:1].islower()}
        ly = 0
        for t, o, initial in zip(doc.tokens, doc.orig, doc.sent_initial):
            if not (t.endswith("ly") and len(t) >= 5 and t.isalpha() and t not in _LY_NOT_ADVERB):
                continue
            if o[:1].islower() or (initial and t in lower_seen):
                ly += 1
        out["style_ly_adverbs_per_1k"] = per_1k(ly, n)
        speech = int(hits["speech_verbs"].sum())
        said = sum(int(doc.type_counts[doc.vocab_index[w]]) for w in ("said", "says") if w in doc.vocab_index)
        out["style_said_share"] = share(said, speech) if speech >= 5 else NAN
        out["style_action_verbs_per_1k"] = per_1k(int(hits["action_verbs"].sum()), n)
        out["style_descriptive_words_per_1k"] = per_1k(int(hits["descriptive_words"].sum()), n)
        em = _num(meta.get("html_em_count"))
        out["style_italics_per_1k"] = per_1k(em, n) if em is not None else NAN
