# Stage 1B validation report

How far the Stage 1 text measures can be trusted on the real corpus, what was fixed, and what is left. This
report is aggregate-only: no story text, titles, names, slugs, URLs or story keys. The details behind every number
are in `WORKLOG.md` (phase by phase), `CHANGELOG.md` (every change to a value) and `NEW_MEASURES_PROPOSAL.md`.

## At a glance

* **Data:** collection batch 1 is a partial collection: 4,251 of the 9,000 sampled stories collected (47%; 142
  of 300 in every category). 4,248 stories are analysed. Text pipeline **1.2**.
* **Extraction:**
  * two real bugs fixed: text outside `<p>` was dropped, and page-capped stories were excluded as "too short";
  * the demo had silently produced an empty dataset on every re-run (fixed);
  * author paratext (notes, disclaimers, headings, "to be continued") is now set aside before measuring;
    hold-out accuracy is 93% (95% CI 84–97%), with no story text ever set aside.
* **Measures behave as expected on known groups:** 47 of 50 pre-registered category expectations hold. The 3
  failures are explained and none is a bug.
* **Rule-based classifiers, after the Phase 4 fixes (95% CIs):**
  * quote style, dialogue spans, scene breaks and tense are 100% right on 44–50 items each (lower bounds
    92–93%), and sentence splitting 98%;
  * the paratext hold-out is 93% and the POV hold-out 15/15;
  * passive voice is 92% precise (82–96%) and commands 100% (94–100), with about 87% of spoken commands found;
  * character names are 91% (80–96%).
* **Reliability:** 83 of 125 continuous measures have split-half reliability ≥ 0.8 and 34 are between 0.6 and
  0.8. 8 are below 0.6, all rare-word rates, and they now carry a caveat.
* **Safe to run alongside the collector:** offline commands read the state database only from an in-memory
  copy. Re-runs are incremental: a refresh with nothing new takes 13 s instead of 3.5 min, with exactly the
  same output.
* **Next:** 22 new measures are proposed, prototyped and checked for redundancy, and wait for approval.

## 1. What was checked, and how

* **Population:** the analysed stories (`analysis_include`) of batch 1.
* **Exposure policy:**
  * aggregate statistics and the masked view (letters → x, function words readable);
  * for passive voice, commands and names, random fragments of at most five words drawn from the whole corpus,
    shown without story keys;
  * the one-sentence unmasked reveal was never used;
  * no excerpt suggesting sexual content involving a minor was encountered.
* **Popularity was never used** to choose, tune or prune a text measure.
* **Tuning:** everything tuned on batch 1 is listed (WORKLOG "Tuned on batch 1", Phases 2 and 4), and every
  accuracy after a fix comes from a sample not used to design it. The same procedure can be re-run on stories
  collected later only (§7).

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

## 3. Measure audit (Phase 3)

**Degeneracy.**
* No impossible values.
* Two near-constant measures: `sex_has_explicit_terms` (97.6% true) and `story_requests_feedback` (95.5% false).
* The extreme upper tails are format quirks with correct values: run-on prose, chat transcripts, a text posted
  twice by its author.

**Known groups.**
* 50 expectations were written before computing. 44 pass on category medians and 3 more on means, where
  medians tie at 0.
* Failures:
  * essays discuss sex, so they are not low on sexual vocabulary;
  * group-sex stories often leave participants unnamed;
  * how-to commands are not in quotation marks (failure predicted in advance).

**Classifier hand-checks** (current pipeline):

| Classifier | Items | Accuracy (95% CI) | Remaining error types |
|---|---|---|---|
| Quote style | 48 stories | 100% (92.6–100) | — |
| Dialogue spans | 50 paragraphs | 100% (92.9–100) | quoted non-speech counts as speech, by design |
| Sentence splitting | 50 paragraphs | 98% (89.5–99.6) | split after "etc." missed |
| Scene breaks | 50 paragraphs | 100% (92.9–100) | textual transitions are not breaks, by design |
| Author paratext | 58 hold-out items | 93.1% (83.6–97.3) | notes with no marker |
| POV class | 48 stories (balanced) + 15 hold-out | 46/48 in-sample; hold-out 15/15 (79.6–100); about 97% weighted by class frequency | "we" narration labelled mixed; a chat transcript labelled second |
| Tense class | 45 stories | 100% of 44 judged (92.0–100) | — |
| Passive voice (precision) | 60 random matches | 91.5% (81.6–96.3) | "un-" adjectives, idioms |
| Commands (precision) | 60 random counted passages | 100% (94.0–100) | — |
| Commands (misses) | 60 random other passages | 1.7% missed (0.3–8.9); about 87% of commands found | verbs not on the list |
| Character names (precision per story) | 60 random (story, name) pairs | 90.6% (79.7–95.9) | rarer roles and capitalised words |
| Chapter / series numbering | 1,614 stories with both sources | title number = site index for 88.4% | authors number chapters independently; the site index is used when present |

**Word lists.**
* 19 lists edited; the change in hit counts is −40% to +5.5% per list (WORKLOG §3d).
* A new `!phrase` syntax removes one fixed expression ("birth control", "made love", "sounds good").
* Youth references ("childhood", "grew up together") were removed.
* No list contains words about age or youth; this is tested.

**Split-half reliability** (odd vs even paragraphs, 3,914 stories of 1,000+ words, Spearman–Brown):
* 83 measures are ≥ 0.8, including all readability, sentence, POV, gender, dialogue, punctuation and sexual
  measures; most of these are above 0.9.
* 34 are 0.6–0.8.
* 8 are below 0.6 and carry a caveat: jealousy, uncertainty, the hedging/certainty balance, commands among
  speech (0.47), anger, volition, distancing and anxiety.

**Redundancy.**
* 52 pairs correlate at |r| ≥ 0.9. Exact complements and duplicate definitions are listed for retirement in the
  proposal; nothing is removed.

**Length.**
* Three measures depend on length for a mechanical reason and carry a caveat: repeated five-word phrases, the
  position of the first sexual term, and the name-mention rate.
* Dialogue genuinely increases in longer stories, within every category.

## 4. Fixes (Phase 4, text pipeline 1.2)

| Rule | Before | After (fresh sample) | What changed |
|---|---|---|---|
| POV | 136 stories "mixed", 7 of 12 in the sample really third person | 64 "mixed"; hold-out 15/15 | third person when "I" forms are under 8% of I + he/she/they in narration |
| Passive voice | 83.1% precise | 91.5% | participles of state or feeling ("was dressed in", "was accustomed to") left out |
| Commands | 85.0% precise, about 51% found | 100% precise, about 87% found | every sentence checked; "fuck" as an expletive and "Look," as a filler left out |
| Names | 68.4% precise | 90.6% | titles, places, nationalities, organisations and brands left out; words mostly after "the"/"in" |
| Word lists | see §3 | | |

Every value change is in `CHANGELOG.md` (59 measures, with median, mean and missing rate before and after).
Regression tests use synthetic text.

## 5. Incremental re-runs and concurrency (Phase 6)

* **The state database is never written by the offline commands.** A read-only SQLite connection creates
  `-wal`/`-shm` files on a cleanly closed WAL database and cannot remove them. So when no collector is running,
  the copy reads the main file as immutable (no files created); while one runs, it uses SQLite's normal
  read-only path.
* **Tested:** the database stays byte-identical, also while a writer holds uncheckpointed changes. On the real
  data `state.sqlite3` was unchanged after every run.
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

## 6. New measures (Phase 5, awaiting approval)

34 candidate columns were prototyped. 22 candidates are proposed:
* openings and endings;
* sex-scene count and position;
* five writing-mechanics measures, the most reliable in the project (split-half up to 0.98) and nearly
  independent of everything existing;
* dialogue craft;
* consent and check-in language;
* time jumps;
* address to the reader;
* humour;
* setting types;
* stretched words;
* title and blurb measures;
* a chat/script format flag.

Each comes with its closest existing measure (all below 0.85, most below 0.5), split-half reliability, known
groups (51 of 67 pre-registered expectations hold) and cost. Redundant candidates were dropped (e.g. the share
of the story in sex scenes, ρ = 0.97 with the sexual-term rate). See `NEW_MEASURES_PROPOSAL.md`.

## 7. Re-checking on the stories collected later

Everything tuned on batch 1 is listed in the WORKLOG (Phases 2 and 4). To re-estimate the accuracies on new
stories only:

1. Draw a sample of them with `python -m litcorr.dev.review_sample NAME --only-new-since data/dev/batch1_features.parquet`.
2. Make, judge and score sheets:
   * `python -m litcorr.dev.handcheck make paratext|pov|tense|quote_mode|dialogue_spans|sentences|scene_breaks SHEET --sample NAME`;
   * `python -m litcorr.dev.fragment_check make passive|commands|commands_unflagged|names SHEET --sample NAME`;
   * `python -m litcorr.dev.handcheck score`.
3. `python -m litcorr.dev.measure_audit all` repeats the degeneracy, known-group, split-half, redundancy and
   length checks.
4. `python -m litcorr.dev.lexicon_audit` repeats the word-list audit.

## 8. Known limitations

* The text measures are word and rule counts: they do not understand negation, irony or context.
* Low-reliability measures (8, flagged) suit comparisons between groups of stories, not single stories.
* Dialogue measures need quotation marks; chat and script formats (about 1.6% of stories) are not covered. The
  proposed `fmt_speaker_label_share` would flag them.
* POV: first-person-plural ("we") narration lands in "mixed".
* Passive voice: "un-" adjectives still count. Commands: verbs missing from the list are missed. Names: rarer
  places and roles still count.
* The novel-based POV validation (`scripts/validate_narration.py`, 93.7% in Stage 1) was not re-run: it
  downloads about 9 MB of public-domain texts and needs your approval.
* All accuracies are from batch 1; the stories collected later are the real hold-out.

## 9. Decisions for you

1. **New measures:** approve all, some or none of the 22 candidates in `NEW_MEASURES_PROPOSAL.md`. That includes
   whether to add the consent-language measure (14), with its caveats.
2. **Retirements and merges:** which of those proposed in `NEW_MEASURES_PROPOSAL.md` to apply. Stage 2 depends on
   the column list.
3. **"We" narration:** a separate POV class ("first plural"), or count it as first person.
4. **Narration validation download:** allow `scripts/validate_narration.py` to fetch the 14 public-domain novels
   (about 9 MB) to re-check the POV rule after the Phase 4 change.
5. **Judgement calls in the word lists:**
   * "good girl"/"good boy" in the dominance list (a fixed praise phrase);
   * "small", "tiny", "petite" in the descriptive list (size words);
   * "baby" in `not_names` (an endearment kept out of name detection).
   They are kept for now; say if you'd like any removed.
