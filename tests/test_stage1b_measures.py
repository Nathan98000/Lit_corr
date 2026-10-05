"""Stage 1B phases 3-4 regression tests: word lists and rule-based measures after the measure audit.
All text here is written from scratch for the tests."""

from __future__ import annotations

import numpy as np
import pytest

from litcorr.text.doc import TextDoc
from litcorr.text.lexicons import load_all, load_lexicon, match

LEX = load_all()


def _hits(lex, paragraphs: list[str]) -> list[str]:
    d = TextDoc(paragraphs)
    h = match(lex, d.vocab, d.type_ids, d.para_idx, d.positions_by_type())
    return [d.orig[i] for i in np.flatnonzero(h)]


# --------------------------------------------------------------------- lexicon format: excluded senses
def test_exclusion_phrases_remove_one_sense_of_a_word(tmp_path):
    f = tmp_path / "demo_control.txt"
    f.write_text("# name: demo_control\ncontrol\nin control\n!birth control\n!remote control\n")
    lex = load_lexicon(f)
    assert lex.n_entries == 2 and set(lex.exclusions) == {"birth", "remote"}
    text = ["She was in control of the remote control and birth control, and control mattered.",
            "Remote", "control"]  # an exclusion phrase never spans two paragraphs
    assert _hits(lex, text) == ["in", "control", "control"]


@pytest.mark.parametrize("entry", ["!control", "!birth contr*"])
def test_exclusions_must_be_plain_phrases(tmp_path, entry):
    f = tmp_path / "demo_bad.txt"
    f.write_text(f"# name: demo_bad\ncontrol\n{entry}\n")
    with pytest.raises(ValueError):
        load_lexicon(f)


def test_exclusions_contain_no_age_words():
    age_words = {"teen", "teens", "teenage", "teenager", "young", "younger", "youth", "little", "child", "children",
                 "kid", "kids", "minor", "underage", "school", "schoolgirl", "student", "barely"}
    for name, x in LEX.items():
        words = {w for phs in x.exclusions.values() for ph in phs for w in ph}
        assert not (words & age_words), (name, words & age_words)


# --------------------------------------------------------------------- the shipped word lists (phase 3 audit)
@pytest.mark.parametrize("lexicon,text,expected", [
    ("agency_dominance", "We ordered pizza and wine.", []),
    ("agency_dominance", "He ordered her to wait by the door.", ["ordered"]),
    ("agency_dominance", "The master bedroom was upstairs; she had a master's degree.", []),
    ("agency_dominance", "Yes, master.", ["master"]),
    ("agency_control", "She stopped taking birth control and lost the remote control.", []),
    ("agency_control", "He liked being in control.", ["in"]),  # a phrase hit is reported at its first word
    ("emotion_affection", "They made love all night.", []),
    ("emotion_affection", "I love you, she whispered.", ["love"]),
    ("sensory_sound", "That sounds good. He was sound asleep, safe and sound.", []),
    ("sensory_sound", "Her reply was husky, and muffled footsteps followed.", ["husky", "muffled", "footsteps"]),
    ("relationship_disclosure", "I felt his hand on my back.", []),
    ("relationship_familiarity", "I used to walk there.", []),
    ("emotion_anger", "She blushed furiously.", []),
    ("speech_verbs", "He continued to walk.", []),
    ("descriptive_words", "I was pretty sure.", []),
])
def test_audited_lexicon_senses(lexicon, text, expected):
    assert [w.lower() for w in _hits(LEX[lexicon], [text])] == expected
