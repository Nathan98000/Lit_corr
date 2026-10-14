"""Build docs/word_lists.html, a page for reading the editable word lists in ``lexicons/``.

The page shows every list with the label, description and notes from its file's header, the measures it feeds and
all its entries: words (``kiss*`` matches any ending), phrases, and the senses that never count (``!birth control``).
Its search box counts a word or a sentence with the pipeline's own matching rules (litcorr/text/lexicons.py), so it
answers "which lists count this?". The page is a single file with no outside requests, so it opens from disk.

    python -m litcorr word-lists [--open]        (``python -m litcorr docs`` rebuilds it as well)
"""

from __future__ import annotations

import base64
import json
import os
import re
from pathlib import Path

from .schema import REG
from .settings import PROJECT_ROOT
from .text.doc import TOKEN_RE
from .text.lexicons import LEXICON_DIR, lexicon_hash, load_lexicon, norm_token

PAGE = PROJECT_ROOT / "docs" / "word_lists.html"
TEMPLATE = Path(__file__).with_name("word_lists_template.html")
FONT = PROJECT_ROOT / "site" / "public" / "fonts" / "source-serif-4-latin-600-normal.woff2"
SITE_META = PROJECT_ROOT / "site" / "public" / "aggregates" / "meta.json"

HELPERS = "Helper lists"
OTHER = "Other lists"
FAMILY_NOTES = {
    HELPERS: "Used inside other measures; not measured themselves.",
    OTHER: "Not used by any measure yet.",
}

# The lists in the order the page shows them, grouped under the site's names for their measures' groups.
FAMILIES: list[tuple[str, list[str]]] = [
    ("Sexual content", ["sexual_anatomy", "sexual_action", "sexual_general"]),
    ("Emotion", ["emotion_positive", "emotion_negative", "emotion_affection", "emotion_arousal", "emotion_anxiety",
                 "emotion_anger", "emotion_sadness", "emotion_shame", "emotion_jealousy", "humor_levity"]),
    ("Intimacy & relationships", ["relationship_romance", "relationship_intimacy", "relationship_closeness",
                                  "relationship_disclosure", "relationship_familiarity", "relationship_terms"]),
    ("Agency & control", ["agency_volition", "agency_control", "agency_dominance", "agency_submission",
                          "consent_checkin"]),
    ("Sensory language", ["sensory_sight", "sensory_sound", "sensory_touch", "sensory_smell", "sensory_taste",
                          "sensory_body"]),
    ("Distancing & immediacy", ["mental_verbs", "perception_verbs", "distancing", "immediacy"]),
    ("Hedging & certainty", ["hedges", "uncertainty", "certainty", "modal_verbs"]),
    ("Pacing & setting", ["time_jumps", "setting_home", "setting_public", "setting_outdoors"]),
    ("Narration & dialogue", ["reader_address", "speech_verbs"]),
    ("Word choice & style", ["action_verbs", "descriptive_words", "profanity", "subordinators"]),
    (HELPERS, ["stopwords", "not_names", "imperative_verbs"]),
]


def _pace(k: str) -> list[str]:
    return [f"pace_{k}_{s}" for s in ("early", "late", "shift", "peak_position")]


_SEX = ["sex_terms_per_1k", "sex_terms", "sex_sentence_share", "sex_words_before_first", "sex_first_mention_position",
        "sex_distinct_terms", "sex_scene_count", "sex_scenes_per_10k", "sex_first_scene_position", *_pace("sex"),
        "title_sexual", "desc_sexual"]
_EMO = ["emo_overall_per_1k", "emo_balance", *_pace("emotion")]
_POSITIVE = ["emo_positive_per_1k", *_EMO]
_NEGATIVE = ["emo_negative_per_1k", *_EMO]
_SENSE = ["sense_total_per_1k", *_pace("descriptive")]
_NAMES = ["char_recurring_names", "char_name_mentions_per_1k", "char_top_name_share"]
_COMMANDS = ["agency_commands_per_1k", "agency_command_share_of_speech"]

# The measures (columns in litcorr/schema.py) each list feeds, as litcorr/text/features.py computes them:
# (measures that count this list alone, measures that combine it with other lists or use it some other way).
# tests/test_word_lists.py checks that every list file and every column here exists.
MEASURES: dict[str, tuple[list[str], list[str]]] = {
    "sexual_anatomy": (["sex_anatomy_per_1k"], _SEX),
    "sexual_action": (["sex_action_per_1k"], _SEX),
    "sexual_general": (["sex_other_per_1k"], _SEX),
    "emotion_positive": ([], _POSITIVE),
    "emotion_negative": ([], _NEGATIVE),
    "emotion_affection": (["emo_affection_per_1k"], _POSITIVE),
    "emotion_arousal": (["emo_arousal_per_1k"], ["emo_overall_per_1k", *_pace("emotion")]),
    "emotion_anxiety": (["emo_anxiety_per_1k"], _NEGATIVE),
    "emotion_anger": (["emo_anger_per_1k"], _NEGATIVE),
    "emotion_sadness": (["emo_sadness_per_1k"], _NEGATIVE),
    "emotion_shame": (["emo_shame_per_1k"], _NEGATIVE),
    "emotion_jealousy": (["emo_jealousy_per_1k"], _NEGATIVE),
    "humor_levity": (["humor_per_1k"], []),
    **{f"relationship_{k}": ([f"rel_{k}_per_1k"], [])
       for k in ("romance", "intimacy", "closeness", "disclosure", "familiarity", "terms")},
    **{f"agency_{k}": ([f"agency_{k}_per_1k"], []) for k in ("volition", "control", "dominance", "submission")},
    "consent_checkin": (["rel_consent_per_1k"], []),
    **{f"sensory_{k}": ([f"sense_{k}_per_1k", f"sense_{k}_count"], _SENSE)
       for k in ("sight", "sound", "touch", "smell", "taste", "body")},
    "mental_verbs": (["psy_mental_verbs_per_1k"], ["psy_filter_words_per_1k"]),
    "perception_verbs": (["psy_perception_verbs_per_1k"], ["psy_filter_words_per_1k"]),
    "distancing": (["psy_distancing_per_1k"], []),
    "immediacy": (["psy_immediacy_per_1k"], []),
    "hedges": (["hedge_per_1k", "hedge_count"], ["hedge_certainty_balance"]),
    "uncertainty": (["hedge_uncertainty_per_1k"], []),
    "certainty": (["hedge_certainty_per_1k"], ["hedge_certainty_balance"]),
    "modal_verbs": (["hedge_modal_per_1k"], []),
    "time_jumps": (["time_jump_per_1k"], []),
    **{f"setting_{k}": ([f"setting_{k}_per_1k"], []) for k in ("home", "public", "outdoors")},
    "reader_address": (["reader_address_per_1k"], []),
    "speech_verbs": ([], ["style_said_share", "dlg_adverb_tag_share", "mech_lowercase_start_per_1k",
                          "mech_errors_per_1k"]),
    "action_verbs": (["style_action_verbs_per_1k"], _pace("action")),
    "descriptive_words": (["style_descriptive_words_per_1k"], _pace("descriptive")),
    "profanity": (["style_profanity_per_1k"], []),
    "subordinators": (["syn_subordinators_per_sentence"], []),
    "stopwords": ([], ["rep_top10_content_share", "rep_bigram_repeat_share", "rep_trigram_repeat_share",
                       "rep_adjacent_sentence_overlap", "rep_repeated_5gram_per_1k", *_NAMES, *_COMMANDS,
                       "qc_english_function_word_share"]),
    "not_names": ([], _NAMES),
    "imperative_verbs": ([], _COMMANDS),
}

_META = re.compile(r"#\s*(name|label|description|notes)\s*:")


def read_list(path: Path) -> dict:
    """One list file as the page shows it: the header fields, every entry in file order (its kind, its inline comment
    and the comment heading above it) and tidy-up hints. The file is loaded the way the pipeline loads it first, so
    a file the pipeline would reject stops the build with the same message."""
    lex = load_lexicon(path)
    entries: list[dict] = []
    sections: list[str] = []
    seen: set[tuple[str, str]] = set()
    dups: list[str] = []
    covered: list[list[str]] = []
    unmatchable: list[str] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#"):
            if not _META.match(line):
                sections.append(line[1:].strip())  # a comment line: a heading for the entries below it
            continue
        comment = ""
        if "  #" in line:
            line, comment = (s.strip() for s in line.split("  #", 1))
        never = line.startswith("!")
        text = line[1:].strip() if never else line
        parts = norm_token(text).split()
        kind = "n" if never else "p" if len(parts) > 1 else "x" if text.endswith("*") else "w"
        e: dict = {"t": text, "k": kind}
        if comment:
            e["c"] = comment
        if sections:
            e["s"] = len(sections) - 1
        entries.append(e)
        key = (kind, " ".join(parts))
        if key in seen:
            dups.append(text)
        seen.add(key)
        if kind == "w":
            by = next((p for p in lex.prefixes if parts[0].startswith(p)), None)
            if by is not None:
                covered.append([text, by + "*"])
        if any(TOKEN_RE.fullmatch(p.removesuffix("*") if kind == "x" else p) is None for p in parts):
            unmatchable.append(text)  # stories are split into words at hyphens, periods ...: this never matches
    tidy = {k: v for k, v in (("dups", dups), ("covered", covered), ("unmatchable", unmatchable)) if v}
    return {"name": lex.name, "label": lex.label, "description": lex.description, "notes": lex.notes,
            "n": lex.n_entries, "entries": entries, "sections": sections, "tidy": tidy}


def _measure_info() -> dict[str, dict]:
    """Every column's label and description, as the site shows them where it does (it renames a few)."""
    site: dict[str, dict] = {}
    try:
        site = {v["id"]: v for v in json.loads(SITE_META.read_text(encoding="utf-8"))["variables"]}
    except (OSError, ValueError, KeyError):
        pass
    out = {}
    for x in REG:
        s = site.get(x.name, {})
        out[x.name] = {"id": x.name, "label": s.get("label") or x.label, "about": s.get("description") or x.description,
                       "site": x.name in site}
    return out


def _measures(cols: list[str], info: dict[str, dict]) -> list[dict]:
    """The measures to name for a list; the four pacing measures of one kind of language count as one item."""
    out: list[dict] = []
    for c in cols:
        m = re.fullmatch(r"pace_(\w+?)_(early|late|shift|peak_position)", c)
        names = _pace(m.group(1)) if m else []
        if not m or not set(names) <= set(cols):
            out.append(info[c])
        elif c == names[0]:
            group = [info[g] for g in names]
            noun = group[0]["label"].removesuffix(" in the first fifth")
            out.append({"id": " ".join(g["id"] for g in group), "label": f"Pacing of {noun[:1].lower()}{noun[1:]}",
                        "about": "; ".join(g["label"] for g in group), "site": any(g["site"] for g in group)})
    return out


def _data_status(directory: Path, config: str | None) -> dict:
    """The lists' fingerprint, and the one the processed data was measured with (when this computer has it)."""
    status = {"hash": lexicon_hash(directory)}
    try:
        from .paths import DataPaths
        from .settings import load_settings

        manifest = json.loads(DataPaths(load_settings(config).data_dir).manifest.read_text(encoding="utf-8"))
        status["data_hash"] = manifest["lexicon_hash"]
        status["data_date"] = str(manifest.get("processed_at", ""))[:10]
    except Exception:  # no processed data here (or no readable config): the page just doesn't compare
        pass
    return status


def page_data(directory: Path = LEXICON_DIR, page: Path = PAGE, config: str | None = None) -> dict:
    info = _measure_info()
    files = {p.stem: p for p in sorted(directory.glob("*.txt"))}
    placed = {name for _, names in FAMILIES for name in names}
    families = FAMILIES + [(OTHER, sorted(set(files) - placed))]
    lists = []
    for family, names in families:
        for name in names:
            if name not in files:
                continue
            d = read_list(files[name])
            own, also = MEASURES.get(name, ([], []))
            d.update(family=family, helper=family == HELPERS,
                     file=files[name].relative_to(PROJECT_ROOT).as_posix() if files[name].is_relative_to(PROJECT_ROOT)
                     else files[name].name,
                     href=Path(os.path.relpath(files[name], page.parent)).as_posix(),
                     measures=_measures(own, info), also=_measures(also, info))
            lists.append(d)
    return {"lists": lists,
            "families": [{"name": f, "note": FAMILY_NOTES.get(f, "")} for f, names in families
                         if any(n in files for n in names)],
            "status": _data_status(directory, config)}


def render(data: dict) -> str:
    font = ""
    if FONT.exists():
        b64 = base64.b64encode(FONT.read_bytes()).decode("ascii")
        font = ('@font-face { font-family: "Source Serif 4"; font-style: normal; font-weight: 600; '
                f'font-display: swap; src: url(data:font/woff2;base64,{b64}) format("woff2"); }}')
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    return TEMPLATE.read_text(encoding="utf-8").replace("/*__FONT_FACE__*/", font).replace("__WORD_LISTS__", payload)


def write_word_lists(page: Path = PAGE, directory: Path = LEXICON_DIR, config: str | None = None) -> Path:
    page.parent.mkdir(parents=True, exist_ok=True)
    page.write_text(render(page_data(directory, page, config)), encoding="utf-8")
    return page
