"""Stage 1B phases 3-4 regression tests: word lists and rule-based measures after the measure audit.
All text here is written from scratch for the tests."""

from __future__ import annotations

import math

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


# --------------------------------------------------------------------- text pipeline 1.3: new measures
from litcorr.schema import BY_NAME  # noqa: E402
from litcorr.text.features import mechanics_counts, sex_scenes, speaker_label_share  # noqa: E402


def test_we_narration_has_its_own_point_of_view_class():
    we = ("We walked to the lake and we sat on our blanket while the sun went down over us and our friends, and "
          "she smiled at him.")
    out = M.measure([we] * 30)
    assert out["pov_class"] == "first_plural" and out["pov_is_first_person"] == 1.0
    assert out["pov_first_plural_narr_per_1k"] > 15
    i_story = M.measure(["I walked to the lake and we sat on my blanket while I watched the water."] * 30)
    assert i_story["pov_class"] == "first"


def test_retired_columns_are_gone():
    out = M.measure([THIRD] * 30)
    for col in ("agency_active_sentence_share", "qe_question_to_statement_ratio", "punct_question_per_1k",
                "punct_exclamation_per_1k", "story_chars", "sex_has_explicit_terms", "lex_segment_ttr"):
        assert col not in out and col not in BY_NAME, col
    for col in ("story_requests_feedback", "read_ari", "read_gunning_fog", "read_coleman_liau",
                "read_flesch_kincaid_grade", "pov_third_per_1k", "pov_first_singular_per_1k",
                "sex_first_mention_position"):
        assert BY_NAME[col].explorer is False, col


def test_openings_endings_and_continuation():
    paras = ['"Come in," she said.'] + [THIRD] * 6 + ['He looked back. "See you tomorrow."', "To be continued..."]
    out = M.measure(paras)
    assert out["open_dialogue"] is True and out["end_dialogue"] is True and out["end_to_be_continued"] is True
    out = M.measure([THIRD] * 8)
    assert out["open_dialogue"] is False and out["end_dialogue"] is False and out["end_to_be_continued"] is False


def test_sex_scenes_are_dense_stretches():
    sex = np.zeros(2000, dtype=np.int8)
    sex[100:300:20] = 1  # 10 terms in 200 words: one stretch
    sex[1500:1700:25] = 1  # 8 terms: a second, separate stretch
    sex[900] = 1  # a passing mention: no stretch
    scenes = sex_scenes(sex, 2000)
    assert len(scenes) == 2 and scenes[0][0] <= 100 <= scenes[0][1] and scenes[1][0] >= 1300
    assert sex_scenes(sex[:300], 300) == []  # under 400 words: not measured


def test_writing_mechanics_counts():
    paras = ["i think its a good idea, your welcome to come.Then the the bus left. then it rained.",
             "she smiled. Mr. smith waved. The U.S. team won. Visit www.example.com today."]
    from litcorr.text.doc import TextDoc

    c = mechanics_counts(paras, TextDoc(paras).orig)
    assert c == {"lowercase_i": 1, "lowercase_start": 1, "missing_space": 1, "doubled": 1, "confusions": 2}
    # lowercase starts: only "left. then"; not after "Mr." or "U.S.", and paragraph starts never count


def test_dialogue_craft_measures():
    lines = []
    for k in range(6):
        lines += ['"Where are you going?" she asked softly.', '"Out."', THIRD]
    out = M.measure(lines)
    assert abs(out["dlg_bare_line_share"] - 0.5) < 1e-9  # 6 of 12 dialogue paragraphs have no tag
    assert out["dlg_adverb_tag_share"] == 1.0  # every tag is "asked softly"
    assert out["dlg_alternation_index"] > 0


def test_speaker_label_format():
    chat = ["Anna: hi there", "Ben: hey you", "Anna: how are you", "Ben: good", "Anna: great", "Ben: see you"]
    assert speaker_label_share(chat) == 1.0
    assert speaker_label_share(["Note: this is fiction.", THIRD, THIRD]) == 0.0  # a one-off label does not count
    out = M.measure(chat * 10)
    assert out["fmt_speaker_label_share"] == 1.0 and out["qc_speaker_label_format"] is True


def test_marker_lexicons_and_title_description():
    paras = ["The next morning they walked on the beach and laughed. Trust me, it was a good day at home in the "
             "kitchen, then at the hotel.", '"Is this okay?" she asked. "Yes," he said. Ohhh.'] * 10
    out = M.measure(paras, {"title": "A Night of Sex", "description": "We tell you about our holiday."})
    for col in ("time_jump_per_1k", "humor_per_1k", "reader_address_per_1k", "setting_home_per_1k",
                "setting_public_per_1k", "setting_outdoors_per_1k", "rel_consent_per_1k", "style_elongated_per_1k"):
        assert out[col] > 0, col
    assert out["title_sexual"] is True and out["desc_sexual"] is False
    assert out["desc_pov"] == "first"  # "we"/"our" (2) outnumber "you" (1)
    out = M.measure(paras, {})
    assert math.isnan(out["title_sexual"]) and math.isnan(out["desc_pov"])


def test_repeated_phrases_are_counted_within_1000_word_stretches():
    filler = [f"word{k}" for k in range(990)]
    phrase = "the cat sat on the mat".split()
    # the same phrase twice, but more than 1,000 words apart: no repeat within a stretch
    far = M.measure([" ".join(phrase + filler + filler[:400] + phrase)])
    near = M.measure([" ".join(phrase + filler[:200] + phrase + filler)])
    assert far["rep_repeated_5gram_per_1k"] == 0 and near["rep_repeated_5gram_per_1k"] > 0


def test_hold_out_precision_fixes():
    from litcorr.text.doc import TextDoc
    from litcorr.text.features import speaker_label

    # paragraph starts never count (verse-like lines, chat lines, sign-offs); a sentence inside a paragraph does
    paras = ["She moved her hands along my back", "and down my legs.", "the end came soon. then it rained."]
    c = mechanics_counts(paras, TextDoc(paras).orig)
    assert c["lowercase_start"] == 1  # only "soon. then"
    # chat handles and tokens repeated 3+ times are names, not missing spaces
    chat = ["anna.b77: hi", "anna.b77: hey", "Then.he left.", "x.yz said x.yz and x.yz."]
    assert mechanics_counts(chat, TextDoc(chat).orig)["missing_space"] == 1  # only "Then.he"
    # possessives and "the might of" are not confusions
    ok = ["The house had its good days and your very own garden, ahead of its time. We felt the might of the "
          "storm; we would of course see each other then. I knew better then."]
    assert mechanics_counts(ok, TextDoc(ok).orig)["confusions"] == 0
    assert speaker_label("PS: thanks for reading") is None and speaker_label("Anna: hi") == "anna"
    story = ["She would never trust me again, and I didn't believe me either. Trust me, it was a long day.",
             '"I will see you the next day," he said. We stayed for the next week. The next morning we left.',
             '"Is this what you want?" he sneered. "Is this okay?" she asked softly.'] * 10
    out = M.measure(story)
    words = out["story_words"]
    narration = int((~TextDoc(story).in_quote).sum())
    assert round(out["time_jump_per_1k"] * words / 1000) == 10  # "The next morning" (not in quotes, not "for the")
    assert round(out["reader_address_per_1k"] * narration / 1000) == 10  # "Trust me," but not "never trust me"
    assert round(out["rel_consent_per_1k"] * words / 1000) == 10  # "Is this okay", not "Is this what you want"


def test_lowercase_starts_skip_lists_abbreviations_and_untagged_dialogue_tags():
    from litcorr.text.features import lowercase_starts

    speech = LEX["speech_verbs"].word_matches
    paras = ["What did you want? she asked. Then he left. why? i don't know. Is this it? she wondered.",
             "a. a list item", "b) another item", "It ended.", "Doc. said hello."]
    starts = lowercase_starts(paras, speech)
    assert [k for k, _ in starts] == [0, 0]  # "left. why" and "why? i don't"; not the tags, lists or "Doc."
