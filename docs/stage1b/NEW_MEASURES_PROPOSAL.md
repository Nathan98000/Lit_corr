# New measures: proposal (Stage 1B, Phase 5)

**Status: approved on 2026-10-05 and implemented in text pipeline 1.3**, with the retirements and explorer
changes applied and the detectors' precision fixed after hold-out hand-checks (see `CHANGELOG.md` 1.3 and
`WORKLOG.md` Phase 7). The numbers below are the proposal-time prototype numbers; the final ones are in the
CHANGELOG.

Every candidate was prototyped on the real corpus: batch 1, the 4,248 analysed stories, text pipeline 1.2.
To reproduce the numbers, run `python -m litcorr.dev.prototype_measures run`, then `report`. The prototype word
lists were in `litcorr/dev/proposal_lexicons/`; the adopted ones now live, in their final form, in `lexicons/`.
All figures are aggregate.

## How to read the evidence

* **Closest existing measure.** This is the largest Spearman correlation |ρ| with any of the 180 existing text
  measures, and which one it is.
  * Below 0.5, the candidate carries clearly new information.
  * From 0.5 to 0.8, it partly overlaps an existing measure.
  * At 0.8 or above, it is redundant and is not proposed.
* **Split-half reliability.** This uses the same method as Phase 3e: odd versus even story paragraphs, stories
  of 1,000+ words, Spearman–Brown corrected.
  * It is not meaningful for opening and ending flags, which a half-story cannot have, or for title and
    description measures, which have no halves.
  * Low values (< 0.6) mean the measure suits comparisons between groups of stories, not single stories.
* **Length.** This is the Spearman correlation with log story words.
* **Known groups.** The expectations were written in WORKLOG Phase 5 before the prototype ran. Categories are
  ranked by category mean. Overall, 51 of 67 expectations hold. Each failure is explained under its candidate.
* **Cost.** This is the prototype's extra time per story, single-threaded, on top of the tokenised text the
  pipeline already builds. As prototyped, all the recommended candidates together add about 35 ms per story,
  roughly +30% on `analyze`'s measuring step. The two slowest, time jumps and word confusions (13 ms together),
  can be made faster in the real implementation. With the Phase 6 cache, a refresh only pays this for new
  stories.
* **Precision.** Each word list and pattern was checked through its most frequent matches (corpus counts, not
  stories). Three lists were tightened for precision before the final run, never to improve a known-group
  result; one known-group result got worse as a consequence (see 14).

## Summary

| # | Proposed column(s) | Kind | Stories with a value ≠ 0 | Closest existing (\|ρ\|) | Split-half | Known groups | Cost (ms) |
|---|---|---|---|---|---|---|---|
| 1 | `open_dialogue` | yes/no | 8.3% | `pace_dialogue_early` (0.21) | n/a | 3/3 | < 0.01 |
| 2 | `end_dialogue` | yes/no | 17.5% | `pace_dialogue_late` (0.25) | n/a | 3/3 | < 0.01 |
| 3 | `end_to_be_continued` | yes/no | 7.3% | `title_has_chapter_marker` (0.20) | n/a | 2/3 | 0.07 |
| 4 | `sex_scene_count`, `sex_scenes_per_10k` | count, rate | 81% | `sex_terms` (0.82) / `sex_terms_per_1k` (0.67) | 0.91 / 0.78 | 4/4 | 0.18 |
| 5 | `sex_first_scene_position` | share | 86% of those with a scene | `pace_sex_early` (0.78) | 0.76 | 2/4 | (with 4) |
| 6 | `mech_errors_per_1k` | rate | 38% | `lex_ttr` (0.15) | **0.96** | — (mechanics family 3/7) | 15 |
| 7 | `mech_lowercase_i_per_1k` | rate | 5.2% | `pov_first_singular_narr_per_1k` (0.11) | 0.96 | 1/2 | 0.8 |
| 8 | `mech_lowercase_start_per_1k` | rate | 18% | `story_paragraphs` (0.16) | 0.98 | 0/1 | 2.6 |
| 9 | `mech_missing_space_per_1k` | rate | 5.0% | `story_paragraphs` (0.11) | 0.80 | 0/1 | 1.5 |
| 10 | `mech_confusions_per_1k` | rate | 16% | `lex_ttr` (0.19) | 0.73 | 2/2 | 6.0 |
| 11 | `dlg_bare_line_share` | share | 80% of stories with dialogue | `story_median_paragraph_words` (0.44) | 0.95 | 0/1 | 1.3 |
| 12 | `dlg_adverb_tag_share` | share | 75% of stories with 5+ tags | `style_ly_adverbs_per_1k` (0.46) | 0.65 | — | (with 11) |
| 13 | `dlg_alternation_index` | ratio | stories with 5+ dialogue and 5+ narration paragraphs | `sex_sentence_share` (0.23) | 0.52 | (3/3 as switches) | (with 11) |
| 14 | `rel_consent_per_1k` | rate | 15% | `story_sentences` (0.27) | 0.34 | 2/3 | 1.7 |
| 15 | `time_jump_per_1k` | rate | 38% | `story_words` (0.27) | 0.49 | 3/5 | 7.5 |
| 16 | `reader_address_per_1k` | rate | 9.2% | `pov_is_first_person` (0.23) | 0.34 | 2/2 | 3.1 |
| 17 | `humor_per_1k` | rate | 75% | `dlg_segments` (0.37) | 0.78 | 2/3 | 0.5 |
| 18 | `setting_home_per_1k`, `setting_public_per_1k`, `setting_outdoors_per_1k` | rates | 78% / 69% / 50% | 0.19 / 0.23 / 0.30 | 0.74 / 0.78 / 0.85 | 2/3 | 4.5 |
| 19 | `style_elongated_per_1k` | rate | 44% | `punct_exclamation_per_1k` (0.34) | 0.78 | 4/5 | 1.3 |
| 20 | `title_sexual`, `desc_sexual` | yes/no | 7.2% / 14% | 0.20 / 0.25 | n/a | 6/6 (title) | < 0.1 |
| 21 | `desc_pov` | category | 36% (64% of blurbs have no pronoun) | — | n/a | 2/2 | < 0.1 |
| 22 | `fmt_speaker_label_share` (+ quality flag) | share | 1.6% | `punct_colon_per_1k` (0.22) | 1.00 | — | 0.1 |

## The candidates

### Openings and endings

**1. `open_dialogue`: the story opens with speech.**
- *Definition:* the first word of the story, after the paratext is set aside, is inside quotation marks.
- *Construct:* opening *in medias res* with dialogue, as opposed to scene-setting narration.
- *Known groups:* as expected, erotic-letters (30th of 30), reviews-and-essays (29th) and adult-how-to (28th)
  are lowest. Highest: mind-control, adult-humor, erotic-horror.
- *Evidence:* nothing existing captures it. The closest is `pace_dialogue_early`, the dialogue share of the
  first fifth, at ρ = 0.21. 8.3% of stories open with speech.
- *Caveat:* depends on quotation marks, so chat and script formats are missed (see 22).

**2. `end_dialogue`: the story ends on speech.**
- *Definition:* the last word of the story, before any closing note, is inside quotation marks.
- *Construct:* a closing line of dialogue (a punchline or a last exchange) versus closing narration.
- *Known groups:* the three low expectations all hold (28th–30th). Highest: chain-stories, transgender,
  science-fiction-fantasy. ρ = 0.25 with `pace_dialogue_late`; 17.5% of stories.

**3. `end_to_be_continued`: the story announces a continuation.**
- *Definition:* "to be continued", "TBC", "next chapter", "more to come", "part N coming soon" and similar, in
  the last three story paragraphs or the closing paratext.
- *Construct:* a serial ending or cliffhanger signal, as opposed to series membership.
- *Known groups:* erotic-letters and adult-how-to are lowest, as expected. erotic-novels is only 12th, so the
  expectation failed: chapters of long works are often posted without the marker, because series membership
  already says so.
- *Evidence:* weakly related to `title_has_chapter_marker` (0.20); 7.3% of stories. Add with that caveat. It
  says what the author announced, not whether a sequel exists.

### Sex-scene structure

The building block is a **sex-dense stretch**: a 200-word window with at least 6 sexual terms (30 per 1,000
words, about 1.75 times the corpus median rate), slid in 50-word steps, with overlapping windows merged. These
parameters were fixed before the run and not tuned. They are computed only for stories of 400+ words. The share
of the story inside such stretches was *not* kept: ρ = 0.97 with `sex_terms_per_1k`, so it is redundant.

**4. `sex_scene_count` and `sex_scenes_per_10k`: how many distinct sex scenes.**
- *Construct:* sexual content in one block versus several separate scenes.
- *Known groups:* all four hold. group-sex-stories is 3rd and erotic-novels 2nd; non-erotic-stories and
  reviews-and-essays are last.
- *Evidence:* the count is length-dependent like every count (ρ = 0.56 with log words) and overlaps `sex_terms`
  (0.82). The per-10,000-words rate is the new information: ρ = 0.67 with `sex_terms_per_1k`, split-half 0.78.
  Propose both; recommend the rate for comparisons.

**5. `sex_first_scene_position`: where the first sex scene starts (0 = start, 1 = end).**
- *Construct:* the length of the build-up before the first real scene, which a passing early mention does not
  trigger.
- *Evidence:* it overlaps `pace_sex_early` (−0.78) and only partly `sex_first_mention_position` (0.46). Unlike
  the latter it does not depend on story length (ρ = −0.05 versus −0.33; see Phase 3g), so it is a
  length-robust alternative to it.
- *Known groups:* 2 of 4. adult-romance is 2nd and anal-sex-stories last, as expected. erotic-novels (20th) and
  masturbation-stories (23rd) failed: novel chapters are often later parts where the build-up happened earlier,
  and masturbation stories often start with a non-sexual frame.
- *Missing* for stories with no sex-dense stretch.

### Writing mechanics and polish

These count typing and proofreading slips. They are among the most reliable measures found anywhere in Stage
1B (split-half up to 0.98), because they are habits of the writer. They are also nearly independent of
everything existing (|ρ| ≤ 0.19). The expectation that essays are more polished was wrong: reviews-and-essays
is *above* the median for lowercase "i", lowercase starts, missing spaces and doubled words, and below it only
for word confusions. The highest categories are erotic-letters, adult-how-to and bdsm-stories; the lowest are
chain-stories, erotic-novels and taboo-sex-stories. Each detector needs a precision hand-check on fragments
before release (see *Implementation*).

**6. `mech_errors_per_1k`: all mechanics slips per 1,000 words.**
- *Definition:* the sum of 7–10 below plus doubled function words ("the the", "to to").
- *Construct:* overall polish.
- *Evidence:* split-half 0.96; nonzero in 38% of stories; closest existing is `lex_ttr` (−0.15).

**7. `mech_lowercase_i_per_1k`: "i" written as a lowercase pronoun.**
- *Definition:* "i", "i'm", "i've" and similar, per 1,000 words.
- *Evidence:* nonzero in 5.2% of stories, but very consistent within them (split-half 0.96).

**8. `mech_lowercase_start_per_1k`: sentences and paragraphs starting in lowercase.**
- *Definition:* a paragraph whose first letter is lowercase, or a word ending in `.`, `!` or `?` followed by a
  space and a lowercase letter. It does not count after an abbreviation, a single letter or a closing quote
  (`"Why?" she asked` is fine). Per 1,000 words.
- *Evidence:* split-half 0.98.

**9. `mech_missing_space_per_1k`: no space after punctuation.**
- *Definition:* a punctuation mark between two words with no space, as in "word,word" or "word.Next". It does
  not count in URLs, e-mail addresses, file names or single-letter abbreviations. Per 1,000 words.
- *Precision check:* of the 424 matches in the corpus, 54% are a comma before a lowercase letter and 30% a full
  stop before a capital, both typing slips.

**10. `mech_confusions_per_1k`: common word confusions.**
- *Definition:* fixed high-precision patterns, per 1,000 words:
  - "its" for "it's" ("its a", "its not");
  - "your" for "you're" ("your welcome", "your going");
  - "should/could/would of";
  - "alot";
  - "their is/are";
  - "better/more/... then".
- *Known groups:* erotic-novels and reviews-and-essays are lowest, as expected.

The doubled-word check is *not* proposed on its own: it is too rare to be reliable (split-half 0.18). It stays
inside the sum (6).

### Dialogue craft

**11. `dlg_bare_line_share`: speech with no tag at all.**
- *Definition:* the share of dialogue paragraphs made only of quoted speech, with no narration and no
  "she said". Missing below 5 dialogue paragraphs.
- *Construct:* rapid, unattributed exchanges.
- *Evidence:* split-half 0.95. Its closest existing measure is median paragraph length (−0.44).
- *Known groups:* the one expectation failed narrowly (adult-humor 8th, not top 6). Highest: non-erotic-stories,
  adult-romance, erotic-novels.

**12. `dlg_adverb_tag_share`: adverbial speech tags.**
- *Definition:* the share of speech tags with an -ly adverb next to the verb ("she said softly", "he whispered
  hoarsely"). Missing below 5 tags.
- *Construct:* adverb-laden dialogue attribution, which style guides discourage.
- *Evidence:* related to the overall -ly adverb rate (0.46), as expected, but not the same thing; split-half
  0.65.

**13. `dlg_alternation_index`: do dialogue and narration alternate, or come in blocks?**
- *Definition:* switches between dialogue and narration paragraphs, divided by the number expected if the same
  paragraphs were in random order. 1 = like random; below 1 = dialogue clustered in scenes; above 1 = strict
  alternation. Missing unless there are 5+ dialogue and 5+ narration paragraphs.
- *Evidence:* a plain switches-per-1,000-words rate was prototyped too, and behaved as expected (lowest in
  erotic-letters, reviews-and-essays and adult-how-to). But it mostly reflects paragraph length (ρ = −0.69), so
  the index is proposed instead (closest |ρ| = 0.23).
- *Reliability:* split-half 0.52, so low; it carries the reliability caveat.

### Content markers

**14. `rel_consent_per_1k`: consent and check-in language.**
- *Definition:* a new word list: "consent", "consensual", "safe word", "is this okay", "is that okay", "okay with
  this", "do you want me to stop", "we can stop", "ask permission" and similar. Per 1,000 words.
- *Precision:* the first prototype's generic questions ("do you want to", "are you sure") made up 48% of hits
  and were removed; so were hotel "check in"s.
- *Known groups:* bdsm-stories is 2nd (safewords) and non-erotic-stories 27th, as expected. first-time-sex-stories
  is 7th, missing the top 6 by one rank; it was 3rd before the precision fix.
- *Evidence:* nothing existing captures it (closest 0.27).
- *Caveats, which must be shown with it:*
  - it counts **language**, not depicted consent: a check-in can be ignored in the story, and refusals ("stop",
    "no") are not counted;
  - essays that discuss consent score high (reviews-and-essays is 1st);
  - the phrases are rare, so split-half is 0.34: use it for groups only;
  - like the existing agency measures, it describes the text, not real people.

**15. `time_jump_per_1k`: skips in story time.**
- *Definition:* "the next morning", "the next day", "hours later", "weeks later", "later that night" and similar,
  per 1,000 words.
- *Construct:* narrative time compression; stories that span days or years versus a single scene.
- *Known groups:* loving-wives 1st, adult-romance 5th, adult-how-to last, all as expected. erotic-novels was
  8th and masturbation-stories 24th (7th lowest), both narrow misses.
- *Evidence:* closest existing is `story_words` (0.27); split-half 0.49, so low (rare phrases). The slowest
  candidate (7.5 ms per story); an implementation that indexes on the second word would be faster.

**16. `reader_address_per_1k`: the narrator talks to the reader.**
- *Definition:* in narration only: "trust me", "believe me", "let me tell you", "dear reader", "as you can
  imagine", "I have to admit" and similar. Per 1,000 narration words.
- *Known groups:* adult-how-to is 1st and reviews-and-essays 3rd, as expected.
- *Evidence:* ρ = 0.23 with first-person narration; split-half 0.34, so low.

**17. `humor_per_1k`: laughter and joking.**
- *Definition:* laugh, giggle, chuckle, joke, funny, hilarious, "lol", "haha" and similar, per 1,000 words.
  Smiles are already in the positive-emotion list; "teasing" is left out because it is mostly sexual here.
- *Construct:* levity and playful tone.
- *Known groups:* adult-humor is 6th and erotic-horror 26th, as expected. non-consent-stories is 20th; I
  expected it in the bottom 6, so that failed.
- *Evidence:* closest existing is the dialogue rate (0.37); split-half 0.78.

**18. `setting_home_per_1k`, `setting_public_per_1k`, `setting_outdoors_per_1k`: where the story happens.**
- *Definition:* three word lists:
  - home: bedroom, kitchen, couch, shower, apartment;
  - public and commercial: office, hotel, store, restaurant, gym, "at the bar", "the club", "in public";
  - outdoors: beach, trail, forest, lake, tent, "in the park".
- *Precision:* ambiguous words were removed: "outside" (outside the door), "park" (to park), "field" (field of
  study), "bar" (metal bar), "train" (to train).
- *Excluded on purpose:* places of education.
- *Known groups:* exhibitionist-voyeur is 1st on public and 5th on outdoors, as expected. loving-wives is 8th on
  home, a narrow fail.
- *Evidence:* all |ρ| ≤ 0.31; split-half 0.74–0.85.

**19. `style_elongated_per_1k`: stretched words.**
- *Definition:* words with a letter repeated three or more times ("ohhh", "yesss", "mmmm"), per 1,000 words.
- *Construct:* typographic rendering of vocal arousal and emphasis.
- *Known groups:* 4 of 5. group-sex-stories is 3rd; reviews-and-essays, non-erotic-stories and adult-how-to are
  the three lowest. masturbation-stories was 8th, a narrow fail.
- *Evidence:* related to exclamation marks (0.34); split-half 0.78.

### Title and description

These are computed on the title and description text. The values are aggregate-safe; the text itself is never
exported.

**20. `title_sexual`, `desc_sexual`: the title or blurb uses explicit vocabulary.**
- *Definition:* the same sexual word lists as the body.
- *Known groups:* all six title expectations hold. anal-sex-stories is 1st; group-sex-stories and
  masturbation-stories are in the top 6; adult-romance, non-erotic-stories and science-fiction-fantasy are in the
  bottom 4.
- *Evidence:* 7.2% of titles and 14% of blurbs; nearly unrelated to the body's sexual rate (0.20 and 0.25). The
  packaging is a different decision from the content.

**21. `desc_pov`: the blurb's grammatical person.**
- *Definition:* first (I, my, we), second (you), third (he, she, they) or none, by majority.
- *Known groups:* erotic-letters ranks 3rd for first-person blurbs and adult-how-to 1st for second-person blurbs,
  as expected.
- *Evidence:* 64% of blurbs have no personal pronoun, so it describes a minority well.

### Format

**22. `fmt_speaker_label_share` and a quality flag `qc_speaker_label_format`: chat, script or Q&A format.**
- *Definition:* the share of story paragraphs that start with a speaker label ("Anna: ...", "MR SMITH (softly):
  ..."), where the same label appears at least 3 times, so one-off "Note:" lines don't count. The flag is set
  when the share is ≥ 0.2.
- *Why it matters:* every dialogue measure depends on quotation marks, and these stories have dialogue without
  any. The Phase 3a outliers included such transcripts.
- *Evidence:* 1.6% of stories; top in erotic-letters, adult-how-to and reviews-and-essays; nearly perfectly
  reliable (split-half 1.00); closest existing 0.22.

## Considered and not recommended

| Candidate | Why not |
|---|---|
| Sexual terms in the first 500 words | Redundant: ρ = 0.86 with `pace_sex_early`. Its known-group results were good (4 of 5), but it adds little. |
| Share of the story inside sex scenes | Redundant: ρ = 0.97 with `sex_terms_per_1k` |
| Concentration (share of sexual terms inside scenes) | Redundant: ρ = 0.86 with `sex_terms_per_1k` |
| Speech-tag variety (distinct verbs among the first 20 tags) | Overlaps `style_said_share` (ρ = −0.71) and exists for only 1,583 stories |
| Dialogue/narration switches per 1,000 words | Mostly paragraph length (ρ = −0.69); replaced by the alternation index (13) |
| Doubled function words, on their own | Too rare to be reliable (split-half 0.18); kept inside `mech_errors_per_1k` |
| Intensifiers ("very", "really", "totally") | No clear construct or expectation; overlaps certainty words (0.35) |
| Question-form titles | Only 1.1% of titles |
| An epilogue | Too rare to measure; already set aside as a heading by the paratext detector |

## Existing measures to retire or merge (proposal only: nothing changes until Stage 2 agrees)

Stage 2 depends on the column list, so these are suggestions. Each could be retired or hidden from the
explorer (`explorer=False`) while staying in the data.

| Measure | Evidence | Proposal |
|---|---|---|
| `agency_active_sentence_share` | Exactly 1 − `agency_passive_sentence_share` (r = −1) | Retire |
| `qe_question_to_statement_ratio` | A monotone transform of `qe_question_sentence_share` (Spearman 0.996) | Retire |
| `punct_question_per_1k` / `qe_question_sentences_per_1k` | ρ = 0.996 | Keep one (the sentence-based one) |
| `punct_exclamation_per_1k` / `qe_exclamation_sentences_per_1k` | ρ = 0.99 | Keep one |
| `story_chars` | ρ = 0.999 with `story_words` | Retire, or keep for QC only |
| `sex_has_explicit_terms` | True for 97.6% of stories | Retire, or redefine with a threshold (e.g. ≥ 5 terms per 1,000 words) |
| `story_requests_feedback` | False for 95.5%; low information but a real signal | Keep; `explorer=False` |
| Readability indices (`read_flesch_kincaid_grade`, `read_gunning_fog`, `read_ari`, `read_coleman_liau`) | ρ = 0.90–0.99 with each other | Keep `read_grade_composite` and `read_flesch_reading_ease` in the explorer; the others data-only |
| `lex_segment_ttr` | ρ = 0.96 with `lex_mattr` | Retire in favour of `lex_mattr` |
| `pov_third_per_1k`, `pov_first_singular_per_1k` (all words) | ρ = 0.96 and 0.92 with the narration-only versions | Explorer shows the narration versions |
| `sex_first_mention_position` | Mechanically length-dependent (Phase 3g) | Keep with its caveat; recommend `sex_first_scene_position` (5) as the main build-up measure |
| `rep_repeated_5gram_per_1k` | Mechanically length-dependent | A later version could count repeats within fixed 1,000-word windows |

## If approved: how each measure will be added

* **Lists and code:**
  * a `schema.py` entry with label, description, caveat, `ui_group`, `kind` and `explorer`;
  * the word lists moved to `lexicons/` with `# notes:` lines, and no words about age or youth (checked by the
    existing test);
  * code in `litcorr/text/features.py`.
* **Tests and docs:**
  * regression tests on synthetic text;
  * a CHANGELOG 1.3 entry with the effect table;
  * `TEXT_PIPELINE_VERSION` "1.3" (the Phase 6 cache then re-measures every story by itself);
  * docs regenerated from `docs/methodology_template.md`.
* **Precision hand-checks:**
  * for each pattern-based detector (mechanics 7–10, consent 14, time jumps 15, reader address 16, speaker
    labels 22): 40–60 matches drawn at random with `fragment_check` before release;
  * for the scene measures (4–5): a masked-view check of scene boundaries;
  * accuracy reported with 95% CIs, as in Phase 3c.
* **Caveats:** low-reliability ones (13–16) get the standard caveat automatically through `LOW_RELIABILITY`.

## Decisions for you

1. Which of candidates 1–22 to add. I recommend all, with the caveats above. If fewer, the strongest are:
   - mechanics 6–10;
   - bare dialogue lines 11;
   - scenes 4–5;
   - settings 18;
   - title/description 20–21;
   - speaker-label format 22.
2. Whether the consent measure (14) should be added at all, given its caveats. My view: yes, labelled
   "consent and check-in language" and grouped with the other agency language measures, never presented as a
   measure of consent.
3. Which retirements or merges to apply, and whether retired columns should leave the handoff or just the
   explorer.
