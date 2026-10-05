import math

import numpy as np
import pytest

from litcorr.settings import Analysis
from litcorr.text.doc import TextDoc, split_sentences
from litcorr.text.features import Measurer, syllables
from litcorr.text.lexicons import LEXICON_DIR, Lexicon, load_all, load_lexicon, match

M = Measurer(analysis=Analysis(min_words_for_pacing=200, window_tokens=100))

FIRST_PAST = ["I walked into the bar and looked around. I saw her by the window, and my heart skipped.",
              "I ordered a drink and waited. I wondered if she remembered me at all.",
              "“Hello,” she said. “It has been a long time.”",
              "I smiled and sat down next to her. I could not believe she was really here."] * 8
THIRD_PAST = ["He walked into the bar and looked around. He saw her by the window, and his heart skipped.",
              "She turned and smiled at him. Her eyes were bright and warm.",
              "“I missed you,” she said. “I really did.”",
              "He sat down next to her. They talked until the bar closed."] * 8
SECOND_PRESENT = ["You walk into the bar and look around. You see her by the window, and your heart skips.",
                  "You order a drink and wait. You wonder if she remembers you.",
                  "She turns and smiles at you. You smile back and sit down."] * 10


def test_pov_and_tense():
    a, b, c = M.measure(FIRST_PAST), M.measure(THIRD_PAST), M.measure(SECOND_PRESENT)
    assert a["pov_class"] == "first" and a["pov_is_first_person"] == 1.0
    assert b["pov_class"] == "third" and b["pov_is_first_person"] == 0.0
    assert c["pov_class"] == "second" and math.isnan(c["pov_is_first_person"])
    assert a["narr_tense_class"] == "past" and c["narr_tense_class"] == "present"
    # Dialogue "I missed you" in a third-person story must not count as first-person narration.
    assert b["pov_first_singular_narr_per_1k"] == 0 and b["pov_first_singular_per_1k"] > 0


def test_dialogue_measures_and_continued_speech():
    paras = ["“Come here,” he said. “Now.”", "She walked over slowly.",
             "“Why? I thought you were angry with me.", "“I was. Not anymore.”"]
    d = TextDoc(paras)
    assert d.mode == "double" and len(d.segments) == 4
    assert d.unbalanced_paragraphs == 0  # an opening quote that runs on to the next paragraph is fine
    out = M.measure(paras * 10)
    assert 0.6 < out["dlg_word_share"] < 0.85
    assert out["dlg_question_share"] == 1.0 and out["dlg_paragraph_share"] == pytest.approx(0.75)
    assert out["agency_commands_per_1k"] > 0


def test_single_quote_dialogue():
    paras = ["'I can't stay,' she said. 'It's too late.'", "He looked at her. 'Then go,' he said.",
             "She didn't move. 'I don't want to.'"] * 10
    d = TextDoc(paras)
    assert d.mode == "single"
    inside = {d.orig[i] for i in range(d.n) if d.in_quote[i]}
    assert {"can't", "late", "go", "want"} <= inside and "looked" not in inside and "didn't" not in inside


def test_sentence_splitting():
    p = 'Mr. Smith arrived at 5 p.m. today. "Stop!" she said. Really? Yes... I think so. J. R. left.'
    sents = [p[s:e].strip() for s, e, _ in split_sentences(p)]
    assert sents[0].startswith("Mr. Smith") and '"Stop!" she said.' in sents
    assert "Really?" in sents and sents[-1] == "J. R. left."


def test_lexicon_matching_rules(tmp_path):
    f = tmp_path / "demo_words.txt"
    f.write_text("# name: demo_words\nhot\nkiss*\nseemed to\nit seemed\ndon't know\n")
    lex = load_lexicon(f)
    d = TextDoc(["The photo was hot. They kissed and kissing. It seemed to rain. I don’t know.", "Hot"])
    hits = match(lex, d.vocab, d.type_ids, d.para_idx, d.positions_by_type())
    matched = [d.orig[i] for i in np.flatnonzero(hits)]
    assert matched == ["hot", "kissed", "kissing", "It", "don’t", "Hot"]  # 'photo' no; phrase counted once


def test_all_lexicons_load_and_are_clean():
    lex = load_all()
    assert len(lex) >= 40
    age_words = {"teen", "teens", "teenage", "teenager", "young", "younger", "youth", "little", "child", "children",
                 "kid", "kids", "minor", "underage", "school", "schoolgirl", "student", "barely"}
    for name, x in lex.items():
        assert x.n_entries > 0, name
        assert not (set(x.words) & age_words), (name, set(x.words) & age_words)
        assert not any(p.startswith(w) or w.startswith(p) for p in x.prefixes for w in age_words), name
        # Inside phrases, "little" is fine ("a little bit"); age words are not.
        phrase_words = {w for phs in x.phrases.values() for ph in phs for w in ph}
        assert not (phrase_words & (age_words - {"little"})), (name, phrase_words & age_words)


def test_explicit_language_and_slow_burn_position():
    paras = ["They talked about books for hours."] * 20 + ["She touched his chest and they kissed. Later they had sex."]
    out = M.measure(paras)
    assert out["sex_terms"] == 1
    assert out["sex_first_mention_position"] > 0.9 and out["sex_words_before_first"] > 100
    assert out["rel_intimacy_per_1k"] > 0


def test_passive_and_hedging_and_balance():
    paras = ["The letter was written by hand. She was taken home. He was tired. Maybe it was fine, perhaps not.",
             "It was definitely the right choice. Of course it was."] * 6
    out = M.measure(paras)
    assert out["agency_passive_per_1k"] > 0
    assert out["hedge_per_1k"] > 0 and out["hedge_certainty_per_1k"] > 0
    assert -1 <= out["hedge_certainty_balance"] <= 1


def test_characters_scene_breaks_notes_and_feedback():
    paras = (["Author's note: thanks to my editor."] +
             ["Sarah met Tom at the cafe. Later, Sarah told Tom about Rose, and Tom laughed at the rose garden."] * 6 +
             ["* * *"] + ["Then Sarah and Tom walked home together."] * 3 +
             ["Please vote and leave a comment if you enjoyed this!"])
    out = M.measure(paras)
    assert out["story_scene_breaks"] == 1
    assert out["story_has_author_note"] is True and out["story_requests_feedback"] is True
    assert out["char_recurring_names"] == 2  # Sarah, Tom ('Rose' is also an ordinary word here)


def test_short_text_gets_missing_measures_not_garbage():
    out = M.measure(["Too short to say anything useful."])
    assert out["qc_text_too_short"] is True and "pov_class" not in out
    assert out["story_words"] == 6


def test_syllables_reasonable():
    for w, n in {"cat": 1, "table": 2, "beautiful": 3, "wanted": 2, "walked": 1, "reading": 2, "university": 5}.items():
        assert syllables(w) == n, w


def test_readability_orders_simple_below_complex():
    simple = ["The cat sat. The dog ran. We had fun. It was hot."] * 20
    complex_ = ["Notwithstanding considerable institutional resistance, the committee's deliberations "
                "ultimately necessitated comprehensive organizational restructuring, which, unsurprisingly, "
                "precipitated widespread dissatisfaction."] * 10
    a, b = M.measure(simple), M.measure(complex_)
    assert a["read_grade_composite"] < b["read_grade_composite"]
    assert a["read_flesch_reading_ease"] > b["read_flesch_reading_ease"]
