# Stage 1B validation report

How far the Stage 1 text measures can be trusted on the real corpus, what was fixed, what was added, and what is
left. This report is aggregate-only: no story text, titles, names, slugs, URLs or story keys. The details behind
every number are in:
* `WORKLOG.md`, phase by phase;
* `CHANGELOG.md`, every change to a value;
* `NEW_MEASURES_PROPOSAL.md`, the evidence for the measures added in 1.3.

## At a glance

* **Data:**
  * Collection batch 1 (4,251 stories with text, 4,248 analysed) is the basis of the checks in §2–§4.
  * By 2026-10-05 the running collector had brought the corpus to 5,001 stories with text, out of 9,000 sampled
    (56%; 4,998 analysed).
  * 680 of the stories collected after batch 1 served as the hold-out for the new measures (the last 70
    arrived after the hand-checks).
  * Text pipeline **1.3**.
* **Extraction:**
  * Two real bugs fixed: text outside `<p>` was dropped, and page-capped stories were excluded as "too short".
  * The demo had silently produced an empty dataset on every re-run (fixed).
  * Author paratext (notes, disclaimers, headings, "to be continued") is set aside before measuring. Hold-out
    accuracy is 93% (95% CI 84–97%), and no story text was ever set aside.
* **Known groups:** of 50 pre-registered category expectations, 47 held on batch 1. The failures are explained,
  and none is a bug.
* **Rule-based classifiers (95% CIs):**
  * quote style, dialogue spans, scene breaks and tense are 100% right on 44–50 items each (lower bounds
    92–93%), and sentence splitting is 98%;
  * the paratext hold-out is 93%;
  * point of view: hold-out 15/15. On 14 public-domain novels it is 94.0% correct, with the new "we" class;
  * passive voice is 92% precise (82–96%);
  * commands are 100% precise (94–100), and about 87% of spoken commands are found;
  * character names are 91% precise (80–96%).
* **New measures (1.3):**
  * 27 new measures and a chat/script format flag, as approved.
  * Each pattern-based detector was hand-checked on stories that played no part in designing it, fixed where it
    failed, and re-checked. Precision is now 88–100%.
  * Detected sex scenes are narrated sexual activity in 3 of 4 cases.
  * 7 redundant columns were retired.
* **Reliability:** of 140 continuous measures, 86 have split-half reliability ≥ 0.8 and 41 are between 0.6 and
  0.8. The 13 below 0.6, mostly rates of rare phrases, carry a caveat.
* **Safe to run alongside the collector:** offline commands read the state database only from an in-memory
  copy; the collector ran throughout the last phase. Re-runs are incremental: a refresh with nothing new takes
  13 s instead of 3.5 min, with exactly the same output.

## 1. What was checked, and how

* **Population:** the analysed stories (`analysis_include`): batch 1 for §2–§4, everything collected so far for
  the final audit of 1.3.
* **Exposure policy:**
  * aggregate statistics and the masked view (letters → x, function words readable);
  * for passive voice, commands, names and the new detectors, random fragments of a few words drawn from the
    whole corpus and shown without story keys (the matched phrase with one word each side);
  * the one-sentence unmasked reveal was never used.
* **Possible minor:** one masked view, of a detected sex scene, could not rule out a minor. Reading stopped there
  and its story key was given to you for review (it is not recorded in these public files). You reviewed it on
  2026-10-05 and confirmed that the character is an adult, so the item was judged and nothing in the data
  changed. No other excerpt suggested sexual content involving a minor.
* **Popularity was never used** to choose, tune or prune a text measure.
* **Tuning:**
  * Everything tuned is listed in the WORKLOG ("Tuned on ..." in Phases 2, 4 and 7).
  * Every accuracy after a fix comes from items not used to design it.
  * The same procedure can be re-run on stories collected later (§7).

## 2. Text extraction and preparation (Phase 2)

| Finding | Effect | Status |
|---|---|---|
| When a page had any `<p>`, text outside `<p>` (lists, headings, block quotes, loose text) was dropped | 50 pages (34 stories) gain 10,964 words; two list-based pieces had lost 89–96% | Fixed; nothing lost or reordered on the other 7,683 pages |
| Author paratext was measured as story text (notes, disclaimers, "please vote", headings, tag lines) | 42.7% of stories had some; 0.36% of all words | Set aside before measuring; hold-out 93.1% right (83.6–97.3), 0 false positives |
| `story_has_author_note` found 1 of 12 stories with a note (hold-out) | Recall too low | Now 8 of 12, no false positives |
| Scene breaks: long separator lines and dotted lines were missed; separators counted as dashes or ellipses | ~1,100 lines in 332 stories | Fixed |
| Spaced hyphens used as dashes were not dashes | 11,784 in 23% of stories | Fixed |
| Backtick apostrophes split words; Unicode line separators inside paragraphs | 29 and 6 stories | Fixed in text preparation |
| 3 page-capped stories excluded as `text_too_short` | Wrong exclusion | Fixed (analysed 4,245 → 4,248) |
| Demo re-run produced no text (random port vs cached URLs) | Every demo re-run was empty | Fixed; tested |
| Multi-page joins, paragraphing, site boilerplate | No duplication, splitting or leakage found | No action |

Word counts match the site's own counter closely: 89.5% within ±1% before paratext was set aside. Two stories
differ for site-side reasons.

## 3. Measure audit (Phase 3, updated for 1.3)

**Degeneracy.**
* No impossible values.
* `sex_has_explicit_terms` was true for 97.6% of stories and is retired in 1.3.
* `story_requests_feedback` (95.5% false) is kept, hidden from the explorer.
* The extreme upper tails are format quirks with correct values: run-on prose, chat transcripts, a text posted
  twice by its author, a story written entirely in lower case.

**Known groups.**
* 50 expectations were written before computing.
* On batch 1, 44 pass on category medians and 3 more on means, where medians tie at 0.
* On the larger 1.3 corpus, 45 pass on medians. The one new miss is erotic-novels on series membership: 17
  categories tie at a median of 1, while erotic-novels is first by mean (92% in a series).
* Real failures:
  * essays discuss sex, so they are not low on sexual vocabulary;
  * group-sex stories often leave participants unnamed;
  * how-to commands are not in quotation marks (failure predicted in advance).

**Classifier hand-checks:**

| Classifier | Items | Accuracy (95% CI) | Remaining error types |
|---|---|---|---|
| Quote style | 48 stories | 100% (92.6–100) | — |
| Dialogue spans | 50 paragraphs | 100% (92.9–100) | quoted non-speech counts as speech, by design |
| Sentence splitting | 50 paragraphs | 98% (89.5–99.6) | split after "etc." missed |
| Scene breaks | 50 paragraphs | 100% (92.9–100) | textual transitions are not breaks, by design |
| Author paratext | 58 hold-out items | 93.1% (83.6–97.3) | notes with no marker |
| POV class | 48 stories (balanced) + 15 hold-out; 284 novel passages | 46/48 in-sample (the "we" story now first_plural); hold-out 15/15 (79.6–100); novels 94.0%, 3.2% confidently wrong | a chat transcript labelled second |
| Tense class | 45 stories | 100% of 44 judged (92.0–100) | — |
| Passive voice (precision) | 60 random matches | 91.5% (81.6–96.3) | "un-" adjectives, idioms |
| Commands (precision) | 60 random counted passages | 100% (94.0–100) | — |
| Commands (misses) | 60 random other passages | 1.7% missed (0.3–8.9); about 87% of commands found | verbs not on the list |
| Character names (precision per story) | 60 random (story, name) pairs | 90.6% (79.7–95.9) | rarer roles and capitalised words |
| Chapter / series numbering | 1,614 stories with both sources | title number = site index for 88.4% | authors number chapters independently; the site index is used when present |

**Word lists.**
* Phase 3 edited 19 lists; the change in hit counts is −40% to +5.5% per list (WORKLOG §3d).
* A new `!phrase` syntax removes one fixed expression ("birth control", "made love", "sounds good").
* Youth references ("childhood", "grew up together") were removed.
* 1.3 adds seven lists: consent, time jumps, reader address, humour, and three settings.
* No list contains words about age or youth; this is tested.

**Split-half reliability** (odd vs even paragraphs, 4,619 stories of 1,000+ words, Spearman–Brown):
* 86 measures are ≥ 0.8, including all readability, sentence, POV, gender, dialogue, punctuation and sexual
  measures, and the writing-mechanics total (0.94).
* 41 are 0.6–0.8.
* 13 are below 0.6 and carry a caveat:
  * from Phase 3: jealousy, uncertainty, the hedging/certainty balance, commands among speech, anger, volition,
    distancing and anxiety;
  * new in 1.3: reader address (0.32), consent language (0.35), time jumps (0.46), missing spaces (0.50) and
    dialogue alternation (0.53).

**Redundancy.**
* 52 pairs correlated at |r| ≥ 0.9.
* In 1.3 the exact complements and duplicate definitions were retired: active-voice share, question/statement
  ratio, the two punctuation-mark rates duplicated by sentence rates, character count, explicit-terms flag and
  segment type-token ratio.
* 42 pairs remain, mostly count vs rate of the same thing, the standard readability formulas, and all-words vs
  narration-only pronoun rates.

**Length.**
* Repeated five-word phrases are now counted within 1,000-word stretches, and their correlation with story
  length fell from 0.35 to 0.08.
* Two measures keep a mechanical-length caveat: the position of the first sexual term (use the new first-scene
  position instead) and the name-mention rate.
* Dialogue genuinely increases in longer stories, within every category.

## 4. Fixes (Phase 4, text pipeline 1.2)

| Rule | Before | After (fresh sample) | What changed |
|---|---|---|---|
| POV | 136 stories "mixed", 7 of 12 in the sample really third person | 64 "mixed"; hold-out 15/15 | third person when "I" forms are under 8% of I + he/she/they in narration |
| Passive voice | 83.1% precise | 91.5% | participles of state or feeling ("was dressed in", "was accustomed to") left out |
| Commands | 85.0% precise, about 51% found | 100% precise, about 87% found | every sentence checked; "fuck" as an expletive and "Look," as a filler left out |
| Names | 68.4% precise | 90.6% | titles, places, nationalities, organisations and brands left out; words mostly after "the"/"in" |
| Word lists | see §3 | | |

Every value change is in `CHANGELOG.md` (59 measures in 1.2, with median, mean and missing rate before and
after). Regression tests use synthetic text.

## 5. Incremental re-runs and concurrency (Phase 6)

* **The state database is never written by the offline commands.**
  * A read-only SQLite connection creates `-wal`/`-shm` files on a cleanly closed WAL database and cannot remove
    them.
  * So when no collector is running, the copy reads the main file as immutable, which creates no files.
  * While one runs, the copy uses SQLite's normal read-only path. The collector was running for the whole of the
    last phase.
* **Tested:** the database stays byte-identical, also while a writer holds uncheckpointed changes.
* **Caches:**
  * `build-raw` reuses parsed stories whose saved pages and parser code are unchanged;
  * `analyze` reuses measures keyed on the story's text and metadata, the pipeline version, a fingerprint of
    the measure code, the word lists and the measure settings;
  * `--full` ignores both;
  * a test shows that incremental output equals a full rebuild.
* **`python -m litcorr refresh`** runs build-raw, analyze and report, then compares a profile with the previous
  refresh. It does not export.
* **Partial-collection labels:** the manifest and quality report show progress per category, and the sampling
  weights are marked provisional while stories are queued.

## 6. New measures (text pipeline 1.3)

All 22 proposed candidates were added: 27 columns plus the quality flag `qc_speaker_label_format`. Definitions
and caveats are in the data dictionary, and the distributions in `CHANGELOG.md` 1.3.

Each pattern-based detector was hand-checked on fragments from the stories collected after batch 1, which played
no part in designing the measures. Where a detector failed it was fixed, then re-checked on stories not used for
the fix. For the two detectors fixed most, the final check used batch 1, on which none of those fixes was
designed.

| Detector (final rule) | Right | 95% CI | First draw |
|---|---|---|---|
| lower-case "i" | 40/40 | 91.2–100 | same rule |
| lower-case sentence starts | 39/40 | 87.1–99.6 | 24/40: lower-case paragraph starts were mostly verse lines, chat lines, sign-offs and lists, so they are no longer counted |
| missing spaces | 19/19 | 83.2–100 | 14/40: one chat log's username |
| word confusions | 35/40 | 73.9–94.5 | 34/39 |
| consent language | 38/39 | 86.8–99.5 | 27/34: taunts and generic requests |
| time jumps | 39/40 | 87.1–99.6 | 31/39: durations ("for the next week") and plans in dialogue |
| address to the reader | 24/25 | 80.5–99.3 | 36/40: "trust me" as an ordinary verb |
| speaker labels (chat / script) | 38/40 | 83.5–98.6 | same check |
| sex scenes (masked view) | 16/21 judged | 54.9–89.4 | same rule; the others are dense talk about sex (an essay, an author's note, world-building) |

* **Known groups:** 41 of the 53 pre-registered expectations for the new measures hold (ranked by category mean).
  Most failures are near misses at ranks 7–12. The clearest wrong expectation: essays are not more polished
  than average.
* **"We" narration:** `pov_class` = `first_plural`, with the rule fixed in advance (≥ 15 we/us/our per 1,000
  narration words, at least as frequent as I and you).
  * 22 batch-1 stories, half of them essays with an authorial "we".
  * They count as first person in `pov_is_first_person`.
  * New column `pov_first_plural_narr_per_1k`.
* **Retired:** 7 columns (§3). Hidden from the explorer: 8 (alternative readability formulas, all-words pronoun
  rates, `story_requests_feedback`, `sex_first_mention_position`).

## 7. Re-checking on the stories collected later

Everything tuned is listed in the WORKLOG (Phases 2, 4 and 7). To re-estimate the accuracies on new stories only:

1. Draw a sample of them with
   `python -m litcorr.dev.review_sample NAME --only-new-since data/dev/batch1_features.parquet`.
   The 680 stories already used as the hold-out for 1.3 are in `data/dev/samples/new1.csv`; to exclude them, add
   `--exclude-sample new1`.
2. Make, judge and score sheets:
   * `python -m litcorr.dev.handcheck make paratext|pov|tense|quote_mode|dialogue_spans|sentences|scene_breaks SHEET --sample NAME`;
   * `python -m litcorr.dev.fragment_check make passive|commands|commands_unflagged|names|low_i|low_start|missing_space|confusions|consent|time_jumps|reader_address|speaker|scenes SHEET --sample NAME`;
   * `python -m litcorr.dev.handcheck score`.
3. `python -m litcorr.dev.measure_audit all` repeats the degeneracy, known-group (both lists), split-half,
   redundancy and length checks.
4. `python -m litcorr.dev.lexicon_audit` repeats the word-list audit.

## 8. Known limitations

* The text measures are word and rule counts: they do not understand negation, irony or context.
* Low-reliability measures (13, flagged) suit comparisons between groups of stories, not single stories.
* Dialogue measures need quotation marks. Chat and script formats (about 1.7% of stories) are now flagged
  (`fmt_speaker_label_share`, `qc_speaker_label_format`), not measured.
* Passive voice: "un-" adjectives still count.
* Commands: verbs missing from the list are missed.
* Names: rarer places and roles still count.
* Word confusions: "your SO" (significant other) and a time "then" before a verb still count.
* A sex scene is dense sexual vocabulary: about 1 in 4 is talk about sex rather than activity.
* Consent language counts what is said, not whether consent is depicted.
* All accuracies are from the stories collected so far. Later stories are the next hold-out.

## 9. Decisions

Taken on 2026-10-05:
* all 22 new measures added;
* every suggested retirement and merge applied;
* "we" narration given its own class;
* the narration validation re-run (download approved);
* the word-list judgement calls kept ("good girl"/"good boy", "small"/"tiny"/"petite", "baby" in `not_names`);
* the story flagged for review: you confirmed that the character is an adult, so nothing changed.

Open:
* **Stage 2 column list:** the next export carries the 1.3 columns, with 7 retired and 28 added. The data
  dictionary in the handoff lists them.
