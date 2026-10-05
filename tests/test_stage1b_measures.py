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


# --------------------------------------------------------------------- phase 4 rule fixes
from litcorr.settings import Analysis  # noqa: E402
from litcorr.text.features import Measurer, passive_matches  # noqa: E402

M = Measurer(analysis=Analysis(min_words_for_pacing=200, window_tokens=100))
THIRD = ("She walked along the road while he waited for her by the gate, and she smiled at him as they talked "
         "about their day and his work.")


def test_pov_third_person_with_a_few_reported_first_person_thoughts():
    # About 10 "I" per 1,000 narration words, but a small minority next to he/she/they: third person.
    paras = [THIRD] * 30 + ["I should go home, she thought, and I will."] * 3
    out = M.measure(paras)
    assert 5 <= out["pov_first_singular_narr_per_1k"] < 15
    assert out["pov_class"] == "third"


def test_pov_mixed_when_first_person_is_not_a_small_minority():
    plain = "The road was long and the gate was old and the rain kept falling on the fields all afternoon long."
    paras = [plain] * 30 + ["I waited there for a while, and she came."] * 4
    out = M.measure(paras)
    assert 5 <= out["pov_first_singular_narr_per_1k"] < 15
    assert out["pov_class"] == "mixed"


def test_passive_voice_leaves_out_participial_adjectives():
    from litcorr.text.doc import TextDoc

    d = TextDoc(["She was dressed in red and was accustomed to the cold. He was turned on and got worked up. "
                 "He was built like a wall. The house was built in 1900. The work was done by hand. "
                 "She was fascinated by it, and the door was stuck. He was taken away and was turned around."])
    got = [" ".join(d.orig[i:j + 1]) for i, j in passive_matches(d)]
    assert got == ["was built", "was done", "was taken", "was turned"]


@pytest.mark.parametrize("text,is_command", [
    ('"Come here," she said.', True),
    ('"Fuck me," she said.', True),
    ('"Fuck!" he said.', False),
    ('"Fuck you," he said.', False),
    ('"Fuck yes."', False),
    ('"Look, I did not mean it."', False),
    ('"Listen, sit down."', True),
    ('"Look at me."', True),
    ('"Exactly. Kiss me hard."', True),  # an imperative in a later sentence of the passage
    ('"Come here. Why are you late?"', True),  # only the question sentence is skipped
    ('"Do you want it?"', False),
    ('"Do it now?"', False),
    ('"You look beautiful."', False),
])
def test_commands_in_speech(text, is_command):
    from litcorr.text.doc import TextDoc

    assert (M.command_segments(TextDoc([text])) == [0]) is is_command


def test_names_leave_out_titles_places_and_organisations():
    from litcorr.text.doc import TextDoc

    paras = ["Later Sarah walked to the Hilton with Mark, and the Queen waved from her car.",
             "Then Sarah told Mark that the Hilton was full, so Queen Anne smiled at Sarah in Denver.",
             "Mark liked the Hilton and the Queen, and Sarah liked Mark. They stayed in Denver with Mark.",
             "In the end Sarah and Mark flew home from Denver, far from the Hilton and the Queen."]
    names = M.recurring_names(TextDoc(paras))[0]
    assert sorted(names) == ["Mark", "Sarah"]  # Queen: a title; Hilton: "the Hilton"; Denver: a place
