# Stage 1B changelog: changes to measure values

Every change that alters the value of a processed column is listed here: the measure, what changed, why, and the
effect on its median, mean and missing rate. Effects are measured on the same stories before and after the
change (`python -m litcorr.dev.measure_profile diff-features OLD NEW`), over the analysed stories of collection
batch 1 (4,251 stories with text as of 2026-10-04) unless stated otherwise.

Text pipeline versions are recorded in `collection_manifest.json` as `text_pipeline_version`.

| Version | Date | Summary |
|---|---|---|
| 1.0 | 2026-10-01 | Stage 1 as delivered (no version constant yet; the baseline). |
| 1.1 | 2026-10-04 | Phase 2: block-aware text extraction, paratext set aside, scene breaks, dashes, QC fixes. |
| 1.2 | 2026-10-04 | Phases 3–4: word-list fixes, POV third-person rule, passive voice, commands in speech, name detection. |

---

## 1.1 — text extraction and paratext (Phase 2)

Effects below are on the 4,245 stories analysed both before and after (`diff-features` of the baseline and the
1.1 processed tables). Nothing was removed or renamed.

### What changed and why

1. **Extraction keeps every block of the story body** (`litcorr/site/parse_story.py`). When a story body
   contained any `<p>`, only text inside `<p>` elements was kept; lists, headings, block quotes, `<center>`
   and loose text between paragraphs were dropped. Two stories had lost 89–96% of their text (both list-based
   how-to/essay pieces). Now 50 of 7,733 pages (34 stories) gain 10,964 words and 929 paragraphs; on every
   page the old paragraphs are an ordered subsequence of the new ones (nothing lost or reordered), and the
   other 7,683 pages are identical.
2. **Text preparation** (`litcorr/text/prepare.py`): line/paragraph separator characters (U+2028/2029, 114
   in 6 stories) become spaces; a backtick or acute accent between letters (``don`t``, ~450 in 29 stories)
   becomes an apostrophe, so contractions are one word as elsewhere.
3. **Paratext is set aside before measuring** (`litcorr/text/paratext.py`): opening and closing author's
   notes, disclaimers, dedications, thanks, header lines, title/byline lines, chapter headings, "To be
   continued" / "The End" and the separator lines that frame them; inside the text, headings, short end
   markers and labelled author's notes. 29.7% of stories have opening paratext, 19.2% closing, 10.9% headings
   or labelled notes inside; 42.7% of stories lose at least one word (median 20 words among them, 90th
   percentile 106); 0.36% of all words. Hand-checked on a hold-out sample: 93.1% of openings/endings right
   (95% CI 83.6–97.3%), no story text set aside; see WORKLOG Phase 2. This changes, slightly, every measure
   computed from the text (table below): medians move in the third or fourth significant figure.
4. **`story_has_author_note`** now uses the paratext (opening/closing notes and reader addresses, labelled
   notes inside), plus the old label regex on the first/last three story paragraphs. Share 7.4% → 28.4%.
   In the hold-out sample the old flag found 1 of 12 stories with a note, the new one 8 of 12, neither with a
   false positive.
5. **`story_requests_feedback`** searches the paratext as well as the first/last three story paragraphs:
   4.29% → 4.52%.
6. **Scene breaks** (`story_scene_breaks`, `_per_1k`): any line with no letters or digits up to 150 characters
   (not a quoted "...", not just "?!"), plus "oOo"/"-x-x-" patterns, now counts; before, lines longer than 30
   characters and lines of dots were missed (~1,100 lines in 332 stories). Separator lines that open or close
   the story are framing, not scene breaks. Mean 1.39 → 1.46 per story.
7. **Punctuation**: scene-break lines are no longer counted as punctuation (a "-----" line counted as two
   dashes, a dotted line as an ellipsis). `punct_dash_per_1k` now also counts a hyphen or en dash with a space
   on each side used as a dash (11,784 in 23% of stories), and counts a run of em dashes once: mean 1.237 →
   1.290; correlation with the old values 0.41 (the definition changed, the median is still 0).
8. **Quality flags**: the 3 stories longer than the 20-page cap were excluded as `text_too_short` (their word
   count is blanked before the flags were computed); they are now included (`analysis_include` 4,245 →
   4,248). `text_truncated` is no longer set for a story with no text yet (4 → 3). The site word-count check
   compares the site's count with all collected words, author's notes included (mismatches 3 → 2).

### Effect on every changed measure (same 4,245 stories)

<details><summary>176 measures: share of stories whose value changed; median, mean and % missing before → after</summary>

| Measure | Stories changed | Median | Mean | % missing |
|---|---|---|---|---|
| `agency_active_sentence_share` | 47.4% | 0.953488 → 0.953901 | 0.94416 → 0.944514 | 0.0 → 0.0 |
| `agency_command_share_of_speech` | 3.3% | 0.0711785 → 0.0710173 | 0.0931569 → 0.0933969 | 6.0 → 5.9 |
| `agency_commands_per_1k` | 40.3% | 0.976562 → 0.980072 | 1.27923 → 1.28493 | 0.0 → 0.0 |
| `agency_control_per_1k` | 39.7% | 0.691722 → 0.688231 | 1.0367 → 1.03758 | 0.0 → 0.0 |
| `agency_dominance_per_1k` | 33.7% | 0.321992 → 0.322165 | 0.998709 → 0.998855 | 0.0 → 0.0 |
| `agency_passive_per_1k` | 47.5% | 3.5482 → 3.51325 | 3.97963 → 3.94267 | 0.0 → 0.0 |
| `agency_passive_sentence_share` | 47.4% | 0.0465116 → 0.0460993 | 0.0558399 → 0.0554861 | 0.0 → 0.0 |
| `agency_submission_per_1k` | 36.5% | 0.479157 → 0.47259 | 0.933952 → 0.932048 | 0.0 → 0.0 |
| `agency_volition_per_1k` | 46.7% | 2.24165 → 2.22552 | 2.41394 → 2.40927 | 0.0 → 0.0 |
| `char_name_mentions_per_1k` | 43.4% | 18.8245 → 18.7693 | 22.7368 → 22.765 | 0.0 → 0.0 |
| `char_recurring_names` | 2.3% | 3 → 3 | 5.46902 → 5.44452 | 0.0 → 0.0 |
| `char_top_name_share` | 10.8% | 0.475103 → 0.47619 | 0.522558 → 0.523263 | 15.8 → 15.9 |
| `dlg_exclamation_share` | 6.5% | 0.848155 → 0.861147 | 0.689655 → 0.699975 | 20.2 → 20.5 |
| `dlg_has_dialogue` | 0.1% | 1 → 1 | 0.940165 → 0.940636 | 0.0 → 0.0 |
| `dlg_mean_segment_words` | 3.8% | 10.3875 → 10.386 | 11.9299 → 11.9373 | 6.0 → 5.9 |
| `dlg_paragraph_share` | 46.2% | 0.494253 → 0.5 | 0.460631 → 0.465587 | 0.0 → 0.0 |
| `dlg_question_share` | 2.2% | 0.866667 → 0.866667 | 0.722867 → 0.724032 | 8.1 → 8.1 |
| `dlg_segments` | 3.7% | 43 → 43 | 84.7621 → 84.7314 | 0.0 → 0.0 |
| `dlg_segments_per_1k` | 46.4% | 13.4031 → 13.4888 | 15.1244 → 15.1798 | 0.0 → 0.0 |
| `dlg_word_share` | 46.4% | 0.149711 → 0.150515 | 0.17696 → 0.177698 | 0.0 → 0.0 |
| `emo_affection_per_1k` | 42.0% | 1.11932 → 1.11235 | 1.64946 → 1.64868 | 0.0 → 0.0 |
| `emo_anger_per_1k` | 32.6% | 0.262261 → 0.262329 | 0.477567 → 0.479652 | 0.0 → 0.0 |
| `emo_anxiety_per_1k` | 40.4% | 0.762777 → 0.763942 | 0.963568 → 0.967216 | 0.0 → 0.0 |
| `emo_arousal_per_1k` | 45.0% | 2.55034 → 2.55754 | 3.20263 → 3.21239 | 0.0 → 0.0 |
| `emo_balance` | 14.9% | 0.444444 → 0.44 | 0.407812 → 0.404555 | 0.1 → 0.1 |
| `emo_jealousy_per_1k` | 13.4% | 0 → 0 | 0.0834789 → 0.0838836 | 0.0 → 0.0 |
| `emo_negative_per_1k` | 46.3% | 2.8132 → 2.81426 | 3.25003 → 3.26121 | 0.0 → 0.0 |
| `emo_overall_per_1k` | 47.8% | 13.7689 → 13.7599 | 14.368 → 14.3521 | 0.0 → 0.0 |
| `emo_positive_per_1k` | 47.8% | 7.42907 → 7.38007 | 7.9153 → 7.87847 | 0.0 → 0.0 |
| `emo_sadness_per_1k` | 26.9% | 0 → 0 | 0.341847 → 0.342827 | 0.0 → 0.0 |
| `emo_shame_per_1k` | 34.7% | 0.387597 → 0.38835 | 0.631053 → 0.632311 | 0.0 → 0.0 |
| `gender_feminine_per_1k` | 44.9% | 38.7 → 38.7737 | 39.7515 → 39.9086 | 0.0 → 0.0 |
| `gender_feminine_share` | 5.1% | 0.62604 → 0.62623 | 0.592965 → 0.592991 | 2.9 → 2.9 |
| `gender_masculine_per_1k` | 43.8% | 20.1018 → 20.1529 | 25.6781 → 25.784 | 0.0 → 0.0 |
| `gender_neutral_plural_per_1k` | 47.4% | 5.82391 → 5.83118 | 7.11602 → 7.12206 | 0.0 → 0.0 |
| `hedge_certainty_balance` | 8.7% | -0.142857 → -0.142857 | -0.11961 → -0.120881 | 0.2 → 0.2 |
| `hedge_certainty_per_1k` | 47.3% | 3.28893 → 3.2851 | 3.59785 → 3.59672 | 0.0 → 0.0 |
| `hedge_count` | 4.7% | 14 → 14 | 23.3164 → 23.2756 | 0.0 → 0.0 |
| `hedge_modal_per_1k` | 47.8% | 11.6347 → 11.6288 | 12.2805 → 12.2853 | 0.0 → 0.0 |
| `hedge_per_1k` | 47.5% | 4.32633 → 4.33526 | 4.63686 → 4.64803 | 0.0 → 0.0 |
| `hedge_uncertainty_per_1k` | 40.2% | 0.686813 → 0.693481 | 0.803551 → 0.806116 | 0.0 → 0.0 |
| `lex_long_word_share` | 47.5% | 0.141183 → 0.141013 | 0.143873 → 0.143593 | 0.0 → 0.0 |
| `lex_mattr` | 47.8% | 0.490393 → 0.490284 | 0.489379 → 0.489237 | 0.1 → 0.1 |
| `lex_mean_word_zipf` | 47.5% | 5.79595 → 5.79595 | 5.7806 → 5.78051 | 0.0 → 0.0 |
| `lex_rare_word_share` | 47.5% | 0.0245262 → 0.0245614 | 0.0273138 → 0.0273556 | 0.0 → 0.0 |
| `lex_segment_ttr` | 34.3% | 0.408 → 0.40768 | 0.408302 → 0.407788 | 7.7 → 7.8 |
| `lex_ttr` | 47.8% | 0.281097 → 0.281022 | 0.285251 → 0.285028 | 0.0 → 0.0 |
| `lex_unique_words` | 43.1% | 887 → 882 | 1055.14 → 1050.37 | 0.0 → 0.0 |
| `lex_unrecognized_word_share` | 39.4% | 0.000716949 → 0.00070028 | 0.00227209 → 0.00226013 | 0.0 → 0.0 |
| `narr_is_present_tense` | 0.2% | 0 → 0 | 0.152754 → 0.152547 | 3.8 → 3.8 |
| `narr_present_tense_share` | 24.8% | 0.0387973 → 0.0358974 | 0.184569 → 0.182377 | 0.3 → 0.3 |
| `pace_action_early` | 39.9% | 10.3704 → 10.5485 | 11.3828 → 11.5521 | 7.7 → 7.8 |
| `pace_action_late` | 40.2% | 13.5593 → 13.6646 | 14.4495 → 14.5011 | 7.7 → 7.8 |
| `pace_action_peak_position` | 4.7% | 0.5 → 0.5 | 0.554021 → 0.550089 | 7.7 → 7.8 |
| `pace_action_shift` | 42.7% | 2.81271 → 2.71003 | 3.06664 → 2.94902 | 7.7 → 7.8 |
| `pace_descriptive_early` | 41.1% | 27.3473 → 27.7325 | 28.9124 → 29.2617 | 7.7 → 7.8 |
| `pace_descriptive_late` | 40.9% | 28.7081 → 28.757 | 29.6887 → 29.7539 | 7.7 → 7.8 |
| `pace_descriptive_peak_position` | 4.0% | 0.5 → 0.5 | 0.495152 → 0.49295 | 7.7 → 7.8 |
| `pace_descriptive_shift` | 43.3% | 0.138815 → 0.0719282 | 0.776257 → 0.492159 | 7.7 → 7.8 |
| `pace_dialogue_early` | 36.3% | 0.100829 → 0.104725 | 0.156018 → 0.158773 | 7.7 → 7.8 |
| `pace_dialogue_late` | 38.5% | 0.137349 → 0.136905 | 0.183966 → 0.184798 | 7.7 → 7.8 |
| `pace_dialogue_peak_position` | 2.1% | 0.5 → 0.5 | 0.500799 → 0.49968 | 11.5 → 11.6 |
| `pace_dialogue_shift` | 41.6% | 0.00533333 → 0.00473363 | 0.027948 → 0.0260257 | 7.7 → 7.8 |
| `pace_emotion_early` | 40.6% | 11.9403 → 11.8644 | 12.9283 → 12.8534 | 7.7 → 7.8 |
| `pace_emotion_late` | 40.8% | 14.9533 → 14.9254 | 16.1417 → 16.0986 | 7.7 → 7.8 |
| `pace_emotion_peak_position` | 5.1% | 0.7 → 0.7 | 0.574426 → 0.572764 | 7.7 → 7.8 |
| `pace_emotion_shift` | 43.2% | 2.80453 → 2.7933 | 3.21337 → 3.24519 | 7.7 → 7.8 |
| `pace_sex_early` | 36.3% | 7.26979 → 7.16846 | 11.7286 → 11.7526 | 7.7 → 7.8 |
| `pace_sex_late` | 37.7% | 22.6378 → 22.6415 | 26.0539 → 26.1694 | 7.7 → 7.8 |
| `pace_sex_peak_position` | 2.9% | 0.7 → 0.7 | 0.653446 → 0.654844 | 9.4 → 9.5 |
| `pace_sex_shift` | 41.0% | 10.7664 → 10.8856 | 14.3253 → 14.4168 | 7.7 → 7.8 |
| `pov_first_person_share` | 20.4% | 0.473581 → 0.473581 | 0.363899 → 0.362879 | 0.0 → 0.0 |
| `pov_first_plural_per_1k` | 45.6% | 4.11241 → 4.15307 | 5.96901 → 5.98466 | 0.0 → 0.0 |
| `pov_first_singular_narr_per_1k` | 42.0% | 47.486 → 47.5658 | 47.5982 → 47.6549 | 0.0 → 0.0 |
| `pov_first_singular_per_1k` | 47.6% | 51.1265 → 51.2002 | 52.8756 → 52.9303 | 0.0 → 0.0 |
| `pov_is_first_person` | 0.4% | 1 → 1 | 0.582197 → 0.580554 | 8.4 → 8.2 |
| `pov_second_narr_per_1k` | 38.3% | 0.735727 → 0.609756 | 7.31452 → 7.22029 | 0.0 → 0.0 |
| `pov_second_per_1k` | 47.3% | 12.2609 → 12.2392 | 17.3526 → 17.3356 | 0.0 → 0.0 |
| `pov_third_narr_per_1k` | 47.7% | 78.7484 → 78.9798 | 84.3172 → 84.7569 | 0.0 → 0.0 |
| `pov_third_per_1k` | 47.8% | 66.9209 → 67.1233 | 72.5456 → 72.8147 | 0.0 → 0.0 |
| `psy_distancing_per_1k` | 41.6% | 0.884956 → 0.888024 | 1.06287 → 1.06644 | 0.0 → 0.0 |
| `psy_filter_words_per_1k` | 47.8% | 21.3763 → 21.4127 | 21.6737 → 21.7227 | 0.0 → 0.0 |
| `psy_immediacy_per_1k` | 47.3% | 3.79987 → 3.80228 | 4.05963 → 4.06612 | 0.0 → 0.0 |
| `psy_mental_verbs_per_1k` | 47.7% | 8.1205 → 8.11771 | 8.52934 → 8.53646 | 0.0 → 0.0 |
| `psy_perception_verbs_per_1k` | 47.8% | 12.767 → 12.8205 | 13.1444 → 13.1862 | 0.0 → 0.0 |
| `punct_colon_per_1k` | 31.3% | 0.0728208 → 0 | 1.1524 → 1.09712 | 0.0 → 0.0 |
| `punct_comma_per_1k` | 47.8% | 51.6615 → 51.6385 | 52.042 → 52.0899 | 0.0 → 0.0 |
| `punct_dash_per_1k` | 36.1% | 0 → 0 | 1.23667 → 1.28962 | 0.0 → 0.0 |
| `punct_ellipsis_per_1k` | 38.9% | 1.02489 → 0.997009 | 2.96503 → 2.94657 | 0.0 → 0.0 |
| `punct_exclamation_per_1k` | 41.4% | 1.63458 → 1.60867 | 3.50297 → 3.49031 | 0.0 → 0.0 |
| `punct_parentheses_per_1k` | 21.5% | 0 → 0 | 0.535749 → 0.511206 | 0.0 → 0.0 |
| `punct_question_per_1k` | 45.8% | 4.37604 → 4.38837 | 5.26354 → 5.28887 | 0.0 → 0.0 |
| `punct_quote_marks_per_1k` | 45.8% | 26.0287 → 26.0914 | 29.4343 → 29.5375 | 0.0 → 0.0 |
| `punct_repeated_per_1k` | 13.4% | 0 → 0 | 0.23699 → 0.236543 | 0.0 → 0.0 |
| `punct_semicolon_per_1k` | 27.0% | 0.124922 → 0.115088 | 0.856894 → 0.854769 | 0.0 → 0.0 |
| `qc_english_function_word_share` | 47.8% | 0.538579 → 0.538843 | 0.535105 → 0.535383 | 0.0 → 0.0 |
| `qe_exclamation_sentence_share` | 41.0% | 0.0208955 → 0.0207469 | 0.0407 → 0.0405872 | 0.0 → 0.0 |
| `qe_exclamation_sentences_per_1k` | 41.1% | 1.5015 → 1.48295 | 3.11474 → 3.10417 | 0.0 → 0.0 |
| `qe_question_sentence_share` | 45.7% | 0.0596026 → 0.0600858 | 0.0650967 → 0.0654369 | 0.0 → 0.0 |
| `qe_question_sentences_per_1k` | 45.8% | 4.31034 → 4.32125 | 5.16918 → 5.19484 | 0.0 → 0.0 |
| `qe_question_to_statement_ratio` | 45.4% | 0.0664336 → 0.0668693 | 0.0784147 → 0.0788919 | 0.0 → 0.0 |
| `read_ari` | 47.8% | 5.02291 → 5.03269 | 5.4109 → 5.42327 | 0.0 → 0.0 |
| `read_coleman_liau` | 47.8% | 6.37028 → 6.35949 | 6.39411 → 6.38945 | 0.0 → 0.0 |
| `read_flesch_kincaid_grade` | 47.8% | 5.33427 → 5.33408 | 5.66345 → 5.67068 | 0.0 → 0.0 |
| `read_flesch_reading_ease` | 47.8% | 81.525 → 81.5773 | 80.4077 → 80.424 | 0.0 → 0.0 |
| `read_grade_composite` | 47.8% | 5.60805 → 5.61454 | 5.82282 → 5.8278 | 0.0 → 0.0 |
| `read_gunning_fog` | 47.8% | 7.79707 → 7.79722 | 8.14802 → 8.15442 | 0.0 → 0.0 |
| `read_mean_syllables_per_word` | 47.5% | 1.31192 → 1.31128 | 1.31962 → 1.31897 | 0.0 → 0.0 |
| `read_mean_word_chars` | 47.5% | 4.14212 → 4.14032 | 4.15209 → 4.15065 | 0.0 → 0.0 |
| `read_polysyllable_share` | 47.5% | 0.0543107 → 0.0540508 | 0.0580092 → 0.0577864 | 0.0 → 0.0 |
| `rel_closeness_per_1k` | 42.5% | 0.929368 → 0.926999 | 1.22858 → 1.22994 | 0.0 → 0.0 |
| `rel_disclosure_per_1k` | 38.9% | 0.739098 → 0.739098 | 1.10896 → 1.10888 | 0.0 → 0.0 |
| `rel_familiarity_per_1k` | 40.3% | 0.668673 → 0.658472 | 0.939326 → 0.938281 | 0.0 → 0.0 |
| `rel_intimacy_per_1k` | 41.6% | 1.60565 → 1.61812 | 2.2426 → 2.2509 | 0.0 → 0.0 |
| `rel_romance_per_1k` | 24.5% | 0 → 0 | 0.309737 → 0.309283 | 0.0 → 0.0 |
| `rel_terms_per_1k` | 39.2% | 0.863371 → 0.854884 | 1.84693 → 1.84134 | 0.0 → 0.0 |
| `rep_adjacent_sentence_overlap` | 47.1% | 0.0203575 → 0.0203167 | 0.0229988 → 0.0230321 | 0.0 → 0.0 |
| `rep_bigram_repeat_share` | 39.2% | 0.0965079 → 0.0965961 | 0.103166 → 0.103368 | 0.1 → 0.1 |
| `rep_immediate_word_repeats_per_1k` | 40.5% | 0.647529 → 0.645995 | 0.96454 → 0.964574 | 0.0 → 0.0 |
| `rep_repeated_5gram_per_1k` | 43.4% | 1.92678 → 1.93424 | 3.34574 → 3.3538 | 0.0 → 0.0 |
| `rep_same_start_share` | 47.4% | 0.0729167 → 0.0731343 | 0.0864412 → 0.0867646 | 0.0 → 0.0 |
| `rep_top10_content_share` | 39.4% | 0.17337 → 0.173441 | 0.178001 → 0.178222 | 0.1 → 0.1 |
| `rep_trigram_repeat_share` | 37.3% | 0.0214576 → 0.0213798 | 0.0254089 → 0.0254628 | 0.1 → 0.1 |
| `sense_body_count` | 0.7% | 9 → 9 | 14.8108 → 14.8078 | 0.0 → 0.0 |
| `sense_body_per_1k` | 45.7% | 2.69542 → 2.7137 | 3.38027 → 3.39384 | 0.0 → 0.0 |
| `sense_sight_count` | 4.6% | 34 → 34 | 54.5948 → 54.5541 | 0.0 → 0.0 |
| `sense_sight_per_1k` | 47.8% | 10.6732 → 10.7204 | 11.0406 → 11.0807 | 0.0 → 0.0 |
| `sense_smell_count` | 0.1% | 0 → 0 | 2.049 → 2.05041 | 0.0 → 0.0 |
| `sense_smell_per_1k` | 26.1% | 0 → 0 | 0.461635 → 0.464183 | 0.0 → 0.0 |
| `sense_sound_count` | 1.7% | 13 → 13 | 22.0535 → 22.0391 | 0.0 → 0.0 |
| `sense_sound_per_1k` | 46.9% | 4.02994 → 4.04391 | 4.43742 → 4.45193 | 0.0 → 0.0 |
| `sense_taste_count` | 0.4% | 2 → 2 | 3.59058 → 3.58963 | 0.0 → 0.0 |
| `sense_taste_per_1k` | 35.9% | 0.50537 → 0.505689 | 0.827504 → 0.831066 | 0.0 → 0.0 |
| `sense_total_per_1k` | 47.8% | 23.7772 → 23.8458 | 24.3522 → 24.4414 | 0.0 → 0.0 |
| `sense_touch_count` | 1.2% | 12 → 11 | 17.9793 → 17.972 | 0.0 → 0.0 |
| `sense_touch_per_1k` | 45.5% | 3.45125 → 3.45324 | 4.20477 → 4.21973 | 0.0 → 0.0 |
| `sex_action_per_1k` | 44.7% | 4.93109 → 4.94805 | 6.58426 → 6.61169 | 0.0 → 0.0 |
| `sex_anatomy_per_1k` | 44.5% | 8.34879 → 8.38135 | 10.3262 → 10.3664 | 0.0 → 0.0 |
| `sex_distinct_terms` | 4.5% | 20 → 20 | 21.7995 → 21.7604 | 0.0 → 0.0 |
| `sex_first_mention_position` | 46.6% | 0.0394826 → 0.0418687 | 0.101143 → 0.104695 | 2.4 → 2.4 |
| `sex_has_explicit_terms` | 0.0% | 1 → 1 | 0.976443 → 0.976207 | 0.0 → 0.0 |
| `sex_other_per_1k` | 43.9% | 2.17707 → 2.16779 | 3.08253 → 3.069 | 0.0 → 0.0 |
| `sex_sentence_share` | 46.5% | 0.182482 → 0.183007 | 0.205381 → 0.206255 | 0.0 → 0.0 |
| `sex_terms` | 9.3% | 52 → 52 | 83.8575 → 83.7602 | 0.0 → 0.0 |
| `sex_terms_per_1k` | 46.7% | 17.0999 → 17.1429 | 19.9929 → 20.0471 | 0.0 → 0.0 |
| `sex_words_before_first` | 36.1% | 127 → 137.5 | 320.953 → 338.6 | 2.4 → 2.4 |
| `story_chars` | 48.6% | 16631 → 16549 | 25501.9 → 25407.6 | 0.0 → 0.0 |
| `story_has_author_note` | 21.1% | 0 → 0 | 0.0737338 → 0.283863 | 0.0 → 0.0 |
| `story_long_paragraph_share` | 22.0% | 0 → 0 | 0.0469836 → 0.0478912 | 0.0 → 0.0 |
| `story_mean_paragraph_words` | 47.8% | 43.7586 → 44.1842 | 51.9886 → 52.5517 | 0.0 → 0.0 |
| `story_mean_sentence_words` | 47.8% | 13.6649 → 13.6877 | 14.5978 → 14.6348 | 0.0 → 0.0 |
| `story_median_paragraph_words` | 27.1% | 35 → 36 | 44.9006 → 45.4789 | 0.0 → 0.0 |
| `story_median_sentence_words` | 6.6% | 12 → 12 | 13.2208 → 13.2512 | 0.0 → 0.0 |
| `story_one_sentence_paragraph_share` | 47.0% | 0.222222 → 0.216216 | 0.249438 → 0.243315 | 0.0 → 0.0 |
| `story_paragraphs` | 47.6% | 73 → 73 | 125.59 → 124.601 | 0.0 → 0.0 |
| `story_requests_feedback` | 0.2% | 0 → 0 | 0.042874 → 0.0452297 | 0.0 → 0.0 |
| `story_scene_breaks` | 19.6% | 0 → 0 | 1.39034 → 1.46219 | 0.0 → 0.0 |
| `story_scene_breaks_per_1k` | 28.4% | 0 → 0 | 0.279888 → 0.282989 | 0.0 → 0.0 |
| `story_sentences` | 47.7% | 231 → 230 | 365.259 → 363.555 | 0.0 → 0.0 |
| `story_words` | 47.8% | 3140 → 3122 | 4778.4 → 4761.72 | 0.0 → 0.0 |
| `style_action_verbs_per_1k` | 47.8% | 13.4436 → 13.5056 | 13.8483 → 13.8946 | 0.0 → 0.0 |
| `style_all_caps_words_per_1k` | 32.2% | 0.248385 → 0.203832 | 1.58473 → 1.51965 | 0.0 → 0.0 |
| `style_descriptive_words_per_1k` | 47.6% | 5.55884 → 5.56357 | 6.29049 → 6.30239 | 0.0 → 0.0 |
| `style_italics_per_1k` | 26.5% | 0 → 0 | 0.737265 → 0.721935 | 0.0 → 0.0 |
| `style_ly_adverbs_per_1k` | 47.8% | 12.5571 → 12.5833 | 13.0579 → 13.0719 | 0.0 → 0.0 |
| `style_profanity_per_1k` | 42.1% | 1.98977 → 1.99601 | 3.06441 → 3.07903 | 0.0 → 0.0 |
| `style_said_share` | 6.9% | 0.303266 → 0.304348 | 0.320762 → 0.32143 | 14.6 → 14.6 |
| `syn_commas_per_sentence` | 47.6% | 0.693182 → 0.695652 | 0.764841 → 0.767805 | 0.0 → 0.0 |
| `syn_long_sentence_share` | 44.9% | 0.037931 → 0.037931 | 0.068099 → 0.0684187 | 0.0 → 0.0 |
| `syn_sentence_length_sd` | 47.8% | 8.08777 → 8.07518 | 8.74647 → 8.73382 | 0.0 → 0.0 |
| `syn_short_sentence_share` | 47.4% | 0.166667 → 0.166667 | 0.178388 → 0.17674 | 0.0 → 0.0 |
| `syn_subordinators_per_sentence` | 47.7% | 0.205882 → 0.20598 | 0.233651 → 0.234263 | 0.0 → 0.0 |
| `pov_class` | 0.4% | (categorical) | | |
| `narr_tense_class` | 0.2% | (categorical) | | |
| `gender_composition` | 0.1% | (categorical) | | |
| `qc_quote_style` | 0.1% | (categorical) | | |

</details>

---

## 1.2 — measure audit fixes (Phases 3–4)

Effects below are on the 4,248 stories analysed before and after (`diff-features` of the 1.1 and 1.2 processed
tables). Nothing was removed or renamed. Accuracy figures come from hand-checks on fresh random samples that were
not used to design the change (WORKLOG Phase 4).

### What changed and why

1. **Word lists** (Phase 3d; each change explained on the file's `# notes:` line; hit counts per list in WORKLOG
   §3d). A new `!phrase` line removes one fixed expression from a list ("birth control", "made love", "sounds
   good", "master bedroom"). Largest effects: `rel_disclosure_per_1k` mean 1.109 → 0.653 ("I felt" and "I was
   feeling" were 38% of its hits and mostly report sensations), `rel_familiarity_per_1k` 0.938 → 0.795 ("used
   to"; "childhood" entries removed because they refer to youth), `agency_dominance_per_1k` median 0.322 → 0.239
   ("ordered" alone was mostly ordering food), `emo_anger_per_1k` median 0.263 → 0.178 ("furiously", "raging"),
   `style_action_verbs_per_1k` −4% ("open"). Composite measures built from these lists follow (`sense_total`,
   `emo_overall`, `emo_balance`, `style_descriptive_words`, the `pace_*` series). `style_said_share` is missing
   for 0.7% more stories (their only speech verb was "continued", now removed).
2. **POV class.** A story with 5–15 "I" forms per 1,000 narration words was "mixed"; it is now "third" when the
   "I" forms are fewer than 8% of the I-forms plus he/she/they forms in narration (reported thoughts, a letter or
   a short first-person frame in a third-person story). 72 of the 136 "mixed" stories become "third": mixed
   3.2% → 1.5%, third 38.5% → 40.2%; `pov_is_first_person` is missing for 6.5% instead of 8.2%. Hand-check: all
   15 stories in a hold-out sample of the moved stories are third person.
3. **Passive voice** (`agency_passive_per_1k`, `agency_passive_sentence_share`, `agency_active_sentence_share`).
   49 participles that in this corpus mostly describe a state or a feeling no longer count ("was dressed in",
   "was accustomed to", "was fascinated by", "was exhausted"), nor "turned on", "worked up", "built like", nor
   "done" except before "to" or "by"; "stuck" is no longer treated as a participle. Share of counted matches
   that are passives: 83.1% → 91.5% (95% CI 81.6–96.3). Mean rate 3.94 → 3.33 per 1,000 words.
4. **Commands in speech** (`agency_commands_per_1k`, `agency_command_share_of_speech`). Every sentence of a
   quoted passage is now checked, not only the first ("Exactly. Kiss me." counts), and only question sentences
   are skipped (before, any "?" in the passage excluded all of it); "fuck" counts only before an object (me,
   him, her, them, us, my, his, off), not as an expletive; "Look," "Listen," "See," "Say," before a comma are
   discourse markers. Precision 85.0% → 100% (94.0–100); among passages not counted, missed commands 6.7% →
   1.7% (0.3–8.9), so the share of all commands found rises from about half to about 87% (wide interval:
   roughly 53–97%). Mean rate 1.28 → 1.60 per 1,000 words; share of speech 0.093 → 0.114.
5. **Recurring names** (`char_recurring_names`, `char_name_mentions_per_1k`, `char_top_name_share`). 360
   capitalised words were added to `lexicons/not_names.txt` (titles and ranks, endearments and insults used as
   address, nationalities and peoples, common place words and major places, organisations and brands), and a
   candidate that follows "the" or "in" in at least half of its mentions is not counted ("the Hilton", "in
   Denver"). Share of detected names that are characters, per story: 68.4% → 90.6% (79.7–95.9). Mean names per
   story 5.45 → 4.74; stories with no recurring name 675 → 722, so `char_top_name_share` is missing for 1.1% more.

### Effect on every changed measure (same 4,248 stories)

<details><summary>59 measures: share of stories whose value changed; median, mean and % missing before → after</summary>

| Measure | Stories changed | Median | Mean | % missing |
|---|---|---|---|---|
| `agency_active_sentence_share` | 74.5% | 0.953975 → 0.961853 | 0.944524 → 0.952839 | 0.0 → 0.0 |
| `agency_command_share_of_speech` | 58.6% | 0.070964 → 0.0909091 | 0.0933585 → 0.114164 | 5.9 → 5.9 |
| `agency_commands_per_1k` | 58.6% | 0.981557 → 1.26462 | 1.28498 → 1.60314 | 0.0 → 0.0 |
| `agency_control_per_1k` | 4.3% | 0.687995 → 0.674631 | 1.03729 → 1.02395 | 0.0 → 0.0 |
| `agency_dominance_per_1k` | 20.7% | 0.322321 → 0.239378 | 0.998531 → 0.923029 | 0.0 → 0.0 |
| `agency_passive_per_1k` | 76.0% | 3.51488 → 2.85782 | 3.9427 → 3.33159 | 0.0 → 0.0 |
| `agency_passive_sentence_share` | 74.5% | 0.0460253 → 0.0381471 | 0.0554764 → 0.0471612 | 0.0 → 0.0 |
| `agency_submission_per_1k` | 7.5% | 0.472702 → 0.494621 | 0.931973 → 0.956609 | 0.0 → 0.0 |
| `char_name_mentions_per_1k` | 28.5% | 18.7733 → 17.8122 | 22.7726 → 21.7954 | 0.0 → 0.0 |
| `char_recurring_names` | 28.5% | 3 → 3 | 5.44452 → 4.74441 | 0.1 → 0.1 |
| `char_top_name_share` | 28.5% | 0.475904 → 0.490196 | 0.523091 → 0.536095 | 15.9 → 17.0 |
| `emo_affection_per_1k` | 19.4% | 1.11338 → 1.0507 | 1.64875 → 1.55709 | 0.0 → 0.0 |
| `emo_anger_per_1k` | 15.4% | 0.263331 → 0.177778 | 0.479718 → 0.429098 | 0.0 → 0.0 |
| `emo_anxiety_per_1k` | 17.1% | 0.764562 → 0.713182 | 0.967333 → 0.908091 | 0.0 → 0.0 |
| `emo_arousal_per_1k` | 33.4% | 2.55646 → 2.67718 | 3.21155 → 3.37233 | 0.0 → 0.0 |
| `emo_balance` | 40.3% | 0.44 → 0.451997 | 0.404571 → 0.416581 | 0.1 → 0.1 |
| `emo_negative_per_1k` | 28.5% | 2.81624 → 2.71862 | 3.26199 → 3.15212 | 0.0 → 0.0 |
| `emo_overall_per_1k` | 51.0% | 13.7664 → 13.7269 | 14.3541 → 14.3133 | 0.0 → 0.0 |
| `emo_positive_per_1k` | 19.4% | 7.3884 → 7.29464 | 7.88052 → 7.78886 | 0.0 → 0.0 |
| `pace_action_early` | 28.9% | 10.5485 → 10 | 11.5521 → 11.033 | 7.8 → 7.8 |
| `pace_action_late` | 30.4% | 13.6646 → 13.1004 | 14.5011 → 13.9318 | 7.8 → 7.8 |
| `pace_action_peak_position` | 6.7% | 0.5 → 0.5 | 0.550089 → 0.55303 | 7.9 → 7.9 |
| `pace_action_shift` | 43.8% | 2.71003 → 2.66485 | 2.94902 → 2.89886 | 7.8 → 7.8 |
| `pace_descriptive_early` | 36.9% | 27.7325 → 27.3723 | 29.2617 → 29.0443 | 7.8 → 7.8 |
| `pace_descriptive_late` | 38.1% | 28.757 → 28.7253 | 29.7539 → 29.7867 | 7.8 → 7.8 |
| `pace_descriptive_peak_position` | 6.1% | 0.5 → 0.5 | 0.49295 → 0.49622 | 7.8 → 7.8 |
| `pace_descriptive_shift` | 54.5% | 0.0719282 → 0.129495 | 0.492159 → 0.742333 | 7.8 → 7.8 |
| `pace_emotion_early` | 13.0% | 11.8644 → 11.7994 | 12.8534 → 12.7751 | 7.8 → 7.8 |
| `pace_emotion_late` | 25.6% | 14.9254 → 14.9813 | 16.0986 → 16.0949 | 7.8 → 7.8 |
| `pace_emotion_peak_position` | 5.6% | 0.7 → 0.7 | 0.572764 → 0.574553 | 7.9 → 7.9 |
| `pace_emotion_shift` | 32.5% | 2.7933 → 2.94044 | 3.24519 → 3.31978 | 7.8 → 7.8 |
| `pace_sex_early` | 1.0% | 7.16846 → 7.16846 | 11.7526 → 11.7696 | 7.8 → 7.8 |
| `pace_sex_late` | 2.7% | 22.6415 → 22.673 | 26.1694 → 26.216 | 7.8 → 7.8 |
| `pace_sex_peak_position` | 0.4% | 0.7 → 0.7 | 0.654844 → 0.65474 | 9.6 → 9.6 |
| `pace_sex_shift` | 3.4% | 10.8856 → 10.929 | 14.4168 → 14.4464 | 7.8 → 7.8 |
| `pov_is_first_person` | 1.7% | 1 → 1 | 0.58062 → 0.570098 | 8.2 → 6.5 |
| `rel_disclosure_per_1k` | 38.7% | 0.739736 → 0.391952 | 1.10903 → 0.65281 | 0.0 → 0.0 |
| `rel_familiarity_per_1k` | 34.9% | 0.658545 → 0.508733 | 0.938417 → 0.794888 | 0.0 → 0.0 |
| `sense_body_count` | 33.3% | 9 → 10 | 14.8078 → 15.4511 | 0.1 → 0.1 |
| `sense_body_per_1k` | 33.3% | 2.71223 → 2.84912 | 3.39251 → 3.55563 | 0.0 → 0.0 |
| `sense_sight_count` | 12.7% | 34 → 34 | 54.5541 → 54.7463 | 0.1 → 0.1 |
| `sense_sight_per_1k` | 12.7% | 10.7221 → 10.7521 | 11.0808 → 11.1185 | 0.0 → 0.0 |
| `sense_smell_count` | 6.9% | 0 → 1 | 2.05041 → 2.13875 | 0.1 → 0.1 |
| `sense_smell_per_1k` | 6.9% | 0 → 0.0734627 | 0.463957 → 0.482974 | 0.0 → 0.0 |
| `sense_sound_count` | 37.1% | 13 → 13 | 22.0391 → 22.6561 | 0.1 → 0.1 |
| `sense_sound_per_1k` | 37.2% | 4.04465 → 4.15086 | 4.45222 → 4.58667 | 0.0 → 0.0 |
| `sense_total_per_1k` | 60.8% | 23.8395 → 23.9532 | 24.4386 → 24.6077 | 0.0 → 0.0 |
| `sense_touch_count` | 35.0% | 11 → 11 | 17.972 → 17.0928 | 0.1 → 0.1 |
| `sense_touch_per_1k` | 35.1% | 3.45242 → 3.26959 | 4.21822 → 4.03301 | 0.0 → 0.0 |
| `sex_anatomy_per_1k` | 8.6% | 8.36581 → 8.40631 | 10.3617 → 10.4063 | 0.0 → 0.0 |
| `sex_distinct_terms` | 8.6% | 20 → 20 | 21.7604 → 21.8466 | 0.1 → 0.1 |
| `sex_other_per_1k` | 3.5% | 2.1679 → 2.17156 | 3.06862 → 3.08458 | 0.0 → 0.0 |
| `sex_sentence_share` | 4.4% | 0.182824 → 0.183198 | 0.206172 → 0.206404 | 0.0 → 0.0 |
| `sex_terms` | 8.6% | 52 → 52 | 83.7602 → 83.9296 | 0.1 → 0.1 |
| `sex_terms_per_1k` | 8.6% | 17.1382 → 17.1735 | 20.0398 → 20.0844 | 0.0 → 0.0 |
| `style_action_verbs_per_1k` | 71.1% | 13.499 → 12.9304 | 13.8917 → 13.3109 | 0.0 → 0.0 |
| `style_descriptive_words_per_1k` | 52.1% | 5.5597 → 5.29731 | 6.30084 → 6.02929 | 0.0 → 0.0 |
| `style_said_share` | 50.3% | 0.304348 → 0.322581 | 0.321326 → 0.336199 | 14.6 → 15.3 |
| `pov_class` | 1.7% | (categorical) | | |

</details>
