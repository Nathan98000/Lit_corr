# Stage 1B work log

Running findings and decisions, newest phase last. Aggregate-only: no story text, titles, names, slugs, URLs or
story-level rows. Where a finding needed an unmasked excerpt, the log says so but never quotes it.

---

## Phase 0: Baseline (2026-10-04)

**Environment.** Apple M4 (10 cores), 24 GB RAM, macOS; Python 3.12.14, pandas 3.0.6, numpy 2.5.3, pyarrow 25.0.1,
wordfreq 3.1.1 (no scipy). The collector was not running (the PID in `data/.collector.lock` was not alive).
`data/state.sqlite3` had the same SHA-256 and modification time before and after `build-raw`, `analyze` and
`report`.

**Tests and demo.** `pytest`: 97 passed (32 s). `demo`: exit code 0, **but no story text at all** (`with_text: 0`,
0 requests). Cause: `data_demo/` already existed; the mock site listens on a new random port each run, so the
earlier run's state and cache (keyed by URL) never match, nothing is fetched, and `build-raw` finds no pages. The
demo had silently been producing an empty dataset on every rerun. Fixed: the demo now empties its own folder
first (only a folder with the demo marker file, or whose state database contains only local mock-site URLs; any
other non-empty folder is refused). After the fix: 709 mock-site requests, 320 stories with text. Test:
`tests/test_demo_rerun.py`.

**Real-data runtimes** (4,251 stories with text; 7,729 story pages):

| Step | Wall | CPU (user + sys) | Effective cores | Peak memory, whole process tree | Largest single process |
|---|---|---|---|---|---|
| `build-raw` | 104 s | 706 s | 6.8 | 6.2 GB | 1.07 GB |
| `analyze` | 51 s | 353 s | 6.9 | 2.5 GB | 1.05 GB |
| `report` | 1.1 s | 1.1 s | 1.0 | 0.6 GB | 0.6 GB |

Both parallel steps use `min(8, cores − 1)` = 8 worker processes. `[analysis] workers` in `config.toml` is
documented as the worker count but is never read (only the CLI `--workers` flag is). `build-raw` peaks at 6.2 GB
because every worker re-parses whole HTML pages with BeautifulSoup and the parent keeps all parsed paragraphs;
at 9,000 stories this would roughly double.

**Corpus as processed.** 9,000 queued stories: 4,251 done (all with text), 4,749 queued. Story pages: 7,733 `ok`
rows in the pages table, 7,729 parsed (difference to explain in Phase 2). Pages per story: 2,423 one-page
stories; 3 stories exceed the 20-page cap (21, 22, 26 pages). All popularity fields came from the embedded page
data (no DOM fallback, no abbreviated counts). Rating missing for 94 stories (no votes yet).

**Oddities in the quality report.**
1. **Bug: the 3 truncated stories (21–26 pages, 70k–95k words by the site's count) are excluded from analysis as
   `text_too_short`.** `analyze` blanks `story_words` for incomplete texts *before* the quality flags are
   computed, and the too-short check reads the blank as 0 words.
2. `text_truncated` is counted 4 times; the 4th is a queued story with no text whose page count is already known
   (6 expected, 0 fetched). Harmless but misleading.
3. Percentages use all 9,000 queued stories as the denominator ("With text 47%", "With views 47%"); nothing says
   collection is incomplete or that sampling weights are provisional (Phase 6).
4. Otherwise few flags: `site_word_count_mismatch` 3, `dialogue_quotes_unbalanced` 5, `possibly_not_english` 2,
   one genuinely short text (20 words by the site's own count), one page parsed with no story text.
5. Collector error log: 12 transient errors over 19 sessions (timeouts, HTTP 502, connection resets), none
   repeated.

**Oddities in the baseline profile** (`data/dev/profiles/baseline/`), to investigate in Phases 2–3:
* `rep_repeated_5gram_per_1k` max 493 (p99 24): possible duplicated text, e.g. a page joined twice.
* `read_ari` max 50, `read_flesch_kincaid_grade` max 41, `story_mean_sentence_words` max 106: texts with little
  sentence punctuation (or one-line-per-paragraph text joined wrongly).
* `rep_same_start_share` max 0.996; `char_recurring_names` max 150; `style_all_caps_words_per_1k` max 180;
  `punct_colon_per_1k` max 200; `dlg_word_share` max 0.997.
* `series_parts_count` min 1 (a "series" of one part); `series_part_number` max 127.
* `story_has_author_note` 7.4% and `story_requests_feedback` 4.3% look low for this site: recall to check.
* `punct_dash_per_1k` is 0 for 68% of stories: only "—", "--" and " – " count; spaced hyphens (" - ") used as
  dashes do not.

Baseline copies kept for later diffs: `data/dev/baseline_processed/` (processed table, report, manifest) and the
profile in `data/dev/profiles/baseline/`.

---

## Phase 1: Inspection tooling (2026-10-04)

All tools are in `litcorr/dev/` (not imported by the pipeline), offline, and write only to `data/dev/`:

| Tool | Purpose |
|---|---|
| `inspect_text STORY_KEY` | Masked view: letters → x/X, digits → 9; punctuation, quotes, spacing kept exactly; function words (stopwords, pronouns, auxiliaries, modals) and inflectional endings readable. Overlays: paragraph numbers and word counts, one line per sentence with its number and terminal, quoted spans ⟪ ⟫, scene breaks, author-note / feedback regex hits (and whether they fall in the head/tail window the pipeline uses), `--lex` lexicon matches as `[lexicon]`, `--names` tokens counted as recurring names. `--reveal-sentence N` prints one sentence, capped at 50 words, refuses sentences containing the title or author name. |
| `char_inventory` | Corpus counts (occurrences and stories) of non-ASCII characters, quote/apostrophe/dash/ellipsis variants and patterns, HTML tags/entities, mojibake, special spaces, structural oddities. |
| `measure_profile save / diff / diff-features` | Diffable profile per measure (N, % missing, % zero, min/p1/median/mean/sd/p99/max) overall and per category, categorical shares, 5 lowest/highest story keys; `diff-features` compares two processed tables on the same stories (the CHANGELOG numbers). |
| `review_sample` | Stratified sample; order = hash(seed, story_key), so samples are stable as the corpus grows; `--exclude-sample` and `--only-new-since` give hold-out samples of later stories. |
| `handcheck make / show / judge / score` | Hand-check sheets per classifier drawn from a review sample, shown through the masked view, scored with Wilson 95% intervals. |

The recurring-name logic was moved into `Measurer.recurring_names()` (no value change) so the overlay shows
exactly the tokens the measure counts.

### Character inventory (4,251 stories)

* **Clean overall.** No HTML entities, tag-like strings in 2 stories (14 in all; written by the
  authors as text, not leftover page markup), mojibake in 3 stories (6 sequences), no zero-width or no-break spaces left (the
  cleaner already removes/collapses them), no line breaks inside paragraphs, no empty paragraphs.
* **Quotes.** Straight `"` in 3,850 stories (698k marks); curly double quotes in ~110 stories; curly apostrophe
  `’` in 144 stories; backtick `` ` `` (426, 20 stories) and acute `´` (25, 9 stories) used as apostrophes split
  words ("don`t" → "don" + "t").
* **Dashes.** Spaced hyphen ` - ` used as a dash: 11,784 times in 991 stories (23%) — not counted by
  `punct_dash_per_1k`. `--` 10,214 (772 stories), em dash 3,250 (288), en dash 2,252 (193; counted only when
  spaced), `---` 1,176 (299).
* **Ellipses.** `...` 54k (2,776 stories); 4+ dots 3,637 (741); two dots `..` 3,477 (581) — not counted as an
  ellipsis, and `.. Next` ends a sentence like a full stop; `. . .` 1,339 (118).
* **Line separator U+2028** inside paragraphs: 114 in 6 stories (an unconverted line break).
* Missing space after sentence punctuation (`end.Next`): 178 in 112 stories (no sentence split there); missing
  space after a comma: 301 in 126 stories.
* Emoji/symbols: rare, mostly in a handful of stories (█ ×76, ⸎ ×55 in one story each, bullets in 13 stories).

---

## Phase 2: Text extraction audit (2026-10-04)

### Site boilerplate: none leaks in
The story container is `div[itemprop=articleBody]`; the parser already drops the "Report" link and widgets.
Searching every paragraph for site furniture found no "Page X of Y", navigation, tag lists, rating widgets or
series links. Paragraphs that recur across many stories (computed over all stories) are scene breaks
(`* * *`, `***`, `---`), common one-line replies ("Yes.", "What?"), and author paratext: "to be continued"
(118+28+25 stories), "the end" (105+26), "chapter N" (58), "author's note:" (31), "epilogue" (28).

### Extraction bug: text outside `<p>` was dropped (fixed)
When a body had any `<p>`, only text inside `<p>` was kept. 48 of 7,733 pages had text elsewhere (list items
6,895 words, italic/div/blockquote/center runs ~4,000 words; 0.05% of all words) — but concentrated: two
list-based pieces kept 4% and 11% of their text. The new block-aware walk keeps every block in document order;
on all 7,733 cached pages it changes 50 pages (34 stories), adds 10,964 words, loses nothing and reorders
nothing. Regression test: `tests/test_stage1b_extraction.py`.

### Author paratext (new detector, `litcorr/text/paratext.py`)
Prevalence (pattern counts over all stories): an "author's note" label in 222 stories, disclaimers about
fiction/ages in ~220, copyright lines in 95, thanks to editors in 125, "to be continued" in ~300, chapter/part
headings in 381. These were all measured as story text: first-person notes in third-person stories, "please
vote" in second person, sexual words in disclaimers moving `sex_words_before_first` to 0, headings counted as
one-sentence paragraphs, "Tags:" lines full of sexual terms.

Design: rules only, applied to contiguous runs at the start and end (plus headings, short end markers and
labelled notes anywhere). Paragraph kinds: heading / note / reader / end / separator / notelike / signoff (see
the module docstring). Caps: 15 paragraphs and 40% (opening) / 30% (closing) of the words.

Hand checks (masked view with `[meta_*]` overlays for story/reader/writer/fiction/thanks words; one item = the
opening or the closing of a story; judged "right" when the detected block is exactly the paratext):

| Sample | Rules | Use | Items judged | Right | 95% CI | Errors |
|---|---|---|---|---|---|---|
| pt1 (30 stories, seed 2) | v1 | development | 58 | 82.8% | 71.1–90.4% | 10 misses, 0 false positives |
| pt2 (60 stories, seed 3) | v2 | evaluation, then development | 118 | 86.4% | 79.1–91.5% | 16 misses/partials, 0 false positives |
| pt3 (30 stories, seed 4, excludes pt1/pt2) | v3 (final) | hold-out | 58 | **93.1%** | 83.6–97.3% | 4 misses, 0 false positives |

Openings are harder than endings (pt3: 90% vs 96%). The remaining misses are notes with no recognisable
wording (a sentence about how the piece came to be written, with no label and no story/reader keyword). Story level on pt3: the old
`story_has_author_note` regex found 1 of 12 stories with a note, the new detector 8 of 12; neither had a false
positive. Error types seen in development (fixed in v2/v3): fan-fiction disclaimers ("... do not belong to
me"), header fields ("Summary:", "Tags:", "Posted:"), "A ... story by X" bylines, "Hello readers:", thanks
phrased variously, hashtag and [bracket] tag lines, sign-off lines after a closing note, a teaser after "To be
continued", notes running past a first separator to a second one.

### Multi-page joins: clean
1,828 multi-page stories, 3,478 page boundaries: no paragraph duplicated across a boundary, no paragraph split
across one (no page ending mid-sentence followed by a lowercase start), no two identical consecutive pages.
30 boundaries where a page repeats 3+ long paragraphs of the previous page: 29 are 2–22% of the page (refrains,
repeated letters/texts, template paragraphs in chain stories); 1 story repeats its whole first page — the
author posted the text twice and the site's own word count includes both copies (this is the
`rep_repeated_5gram_per_1k` = 493 outlier). 1 page has no text (it is empty on the site; the site's word count
matches the other two pages). The 7,733 vs 7,729 page difference: 4 cached pages belong to stories still
queued.

### Paragraphing: clean
No story arrives as one giant paragraph (largest paragraph < 1,500 words; median paragraph ≤ 300 words in all
stories). Hard-wrapped text (≥ 30% of paragraph breaks mid-sentence): 1 story; ≥ 10%: 4. Poem-like layout
(median paragraph ≤ 8 words, most without end punctuation): 8 stories, mostly chat/letter transcripts and
lists. Not worth a rule; listed for re-checking with the full corpus.

### Encoding and characters (from the Phase 1 inventory)
Fixed in text preparation: U+2028/2029 line separators (6 stories) → spaces; backtick/acute apostrophes inside
words (29 stories) → apostrophes. Not fixed (too rare to matter): mojibake in 3 stories, literal tag-like
strings in 2 stories, missing spaces after full stops in 112 stories (those sentences are not split).

### Word counts vs the site's
Baseline (before paratext was set aside): 89.5% of stories within ±1% of `site_words_count`, 99% within
[0.977, 1.023]; median difference +4 words. The low tail was the `<p>`-only extraction (2 stories, fixed); the
high tail is authors' duplicated text (1 story) and a story whose site count is far below its text. The
`site_word_count_mismatch` rate (3 of 4,248 → 2) is low because extraction matches the site's own word counter
closely; the 2 left are site-side (a duplicated text the site under-counts, and a list-based piece whose page
text we now capture in full but which the site counts as 4,563 words). Since 1.1, `story_words` excludes
paratext, so it is systematically a little below the site's count (79.5% within ±1%); the mismatch check uses
all collected words.

### Other findings
* Scene breaks: lines longer than 30 characters and dotted lines were not recognised (1,094 lines in 332
  stories), and a separator line counted as two dashes or as an ellipsis. Fixed (CHANGELOG 1.1).
* `punct_dash_per_1k`: spaced hyphens used as dashes (23% of stories) were not dashes. Fixed.
* QC: page-capped stories excluded as too short; `text_truncated` set for a story with no text. Fixed.
* `<hr>` separators are not represented in the text (15 pages); too rare to matter.
* `style_italics_per_1k` counts italics in the whole page body, notes included (caveat added).

### Tuned on batch 1 (re-check on the stories collected later)
* Paratext caps: first/last 15 paragraphs, 40% / 30% of the words; "short line" ≤ 8 words before a note;
  separator search within the first 8 paragraphs; pre-separator paragraphs ≤ 60 words; teaser ≤ 40 words
  within the last 3 paragraphs; sign-off ≤ 3 words; note-like = 2+ meta words and I/you, ≤ 200 words; title-like
  first line ≤ 15 words.
* Paratext phrase lists (`_NOTE_START`, `_HEADER_FIELD`, `_DISCLAIMER_ANY`, `_READER`, `_SALUTATION`,
  `_TAG_LINE`), developed on samples pt1 and pt2; hold-out accuracy from pt3 only.
* Separator: ≤ 150 characters with no letters/digits.

---

## Phase 3: Measure audit (2026-10-04, text pipeline 1.1)

### 3b. Known-groups expectations (written before any of them was computed)

Test: rank the 30 categories by their median of the measure (analysed stories, batch 1). **HIGH** = top 6 of
30, **LOW** = bottom 6, **ABOVE / BELOW** = above / below the median of the 30 category medians. Each line is
an expectation about what the measure should pick up if it works; a failure is either a measure problem or a
wrong expectation, and is explained either way.

| # | Category | Expectation | Measure |
|---|---|---|---|
| 1 | erotic-letters | HIGH | `pov_second_per_1k` (letters address "you") |
| 2 | adult-how-to | HIGH | `pov_second_per_1k` (instructions address "you") |
| 3 | erotic-letters | HIGH | `pov_first_singular_per_1k` |
| 4 | reviews-and-essays | LOW | `pov_third_per_1k` (essays, not third-person narrative) |
| 5 | lesbian-sex-stories | HIGH | `gender_feminine_share` |
| 6 | gay-sex-stories | LOW | `gender_feminine_share` |
| 7 | gay-sex-stories | HIGH | `gender_masculine_per_1k` |
| 8 | lesbian-sex-stories | LOW | `gender_masculine_per_1k` |
| 9 | erotic-letters | ABOVE | `narr_present_tense_share` |
| 10 | adult-how-to | ABOVE | `narr_present_tense_share` |
| 11 | reviews-and-essays | LOW | `dlg_word_share` |
| 12 | adult-how-to | LOW | `dlg_word_share` |
| 13 | erotic-letters | LOW | `dlg_word_share` |
| 14 | non-erotic-stories | LOW | `sex_terms_per_1k` |
| 15 | reviews-and-essays | LOW | `sex_terms_per_1k` |
| 16 | anal-sex-stories | HIGH | `sex_anatomy_per_1k` |
| 17 | group-sex-stories | HIGH | `sex_terms_per_1k` |
| 18 | adult-romance | ABOVE | `sex_words_before_first` (slower start) |
| 19 | non-erotic-stories | HIGH | `sex_first_mention_position` |
| 20 | masturbation-stories | HIGH | `sex_other_per_1k` (toys) |
| 21 | bdsm-stories | HIGH | `agency_dominance_per_1k` |
| 22 | bdsm-stories | HIGH | `agency_submission_per_1k` |
| 23 | mind-control | HIGH | `agency_control_per_1k` |
| 24 | bdsm-stories | HIGH | `agency_commands_per_1k` |
| 25 | adult-romance | HIGH | `emo_affection_per_1k` |
| 26 | adult-romance | HIGH | `rel_romance_per_1k` |
| 27 | erotic-horror | HIGH | `emo_anxiety_per_1k` |
| 28 | loving-wives | HIGH | `rel_terms_per_1k` (husband, wife) |
| 29 | loving-wives | HIGH | `emo_jealousy_per_1k` |
| 30 | adult-humor | ABOVE | `punct_exclamation_per_1k` |
| 31 | reviews-and-essays | HIGH | `read_grade_composite` |
| 32 | reviews-and-essays | HIGH | `lex_long_word_share` |
| 33 | reviews-and-essays | HIGH | `story_mean_sentence_words` |
| 34 | reviews-and-essays | HIGH | `hedge_modal_per_1k` |
| 35 | reviews-and-essays | HIGH | `psy_mental_verbs_per_1k` |
| 36 | erotic-novels | HIGH | `series_is_part` |
| 37 | erotic-novels | HIGH | `site_words_count` |
| 38 | science-fiction-fantasy | HIGH | `lex_unrecognized_word_share` (invented names and terms) |
| 39 | group-sex-stories | HIGH | `char_recurring_names` |
| 40 | erotic-letters | LOW | `char_recurring_names` |
| 41 | exhibitionist-voyeur | HIGH | `sense_sight_per_1k` |
| 42 | first-time-sex-stories | ABOVE | `emo_anxiety_per_1k` (nerves) |
| 43 | non-erotic-stories | LOW | `emo_arousal_per_1k` |
| 44 | non-consent-stories | HIGH | `agency_control_per_1k` (force, restraint) |
| 45 | lesbian-sex-stories | HIGH | `gender_feminine_per_1k` |
| 46 | chain-stories | ABOVE | `story_has_author_note` (chain rules, notes between authors) |
| 47 | adult-how-to | HIGH | `agency_commands_per_1k` (expected to FAIL: commands are only counted inside quotation marks, and how-to imperatives are narration) |
| 48 | fetish-stories | ABOVE | `sense_smell_per_1k` |
| 49 | non-erotic-stories | BELOW | `style_profanity_per_1k` |
| 50 | erotic-horror | ABOVE | `emo_negative_per_1k` |

### 3a. Degeneracy (180 text measures, 4,248 analysed stories)

* No impossible values: every share is within 0–1, every rate is ≥ 0, every position is within 0–1 and every
  balance is within −1 to +1.
* Near-constant: `sex_has_explicit_terms` (97.6% true) and `story_requests_feedback` (95.5% false). They carry
  little information; retirement or merging is proposed in Phase 5 (nothing removed now).
* Extreme upper tails (max far above the 99th percentile) in 90 measures. Checked on the outlying stories with
  the masked view: they are format quirks with correct values, not bugs: run-on prose with almost no sentence
  punctuation (mean sentence length up to 106 words), chat or script transcripts, very long stories (up to 68.6k
  words), and short texts where one hit makes a large rate.
* `pace_*_shift` is flagged as "outside 0–1000" only because a shift (late minus early) can be negative.

### 3b. Known groups: results

44 of 50 expectations pass on the category median. Three more pass on the category mean (rank 2 of 30): the
measure is zero in most stories of most categories, so medians tie at 0 and cannot rank:

| # | Expectation | Median rank | Mean rank | Verdict |
|---|---|---|---|---|
| 29 | loving-wives HIGH `emo_jealousy_per_1k` | tied at 0 | 2 / 30 | measure works; zero-inflated |
| 46 | chain-stories ABOVE `story_has_author_note` | tied at 0 | 2 / 30 | measure works; zero-inflated |
| 48 | fetish-stories ABOVE `sense_smell_per_1k` | tied at 0 | 2 / 30 | measure works; zero-inflated |
| 15 | reviews-and-essays LOW `sex_terms_per_1k` | 24 / 30 (7th lowest) | 9th lowest | wrong expectation: essays in this category often discuss sex directly |
| 39 | group-sex-stories HIGH `char_recurring_names` | 9 / 30 | 10 / 30 | measure limitation: it counts *named* characters with 3+ mentions, and group scenes often use unnamed participants; non-person names also add noise (see 3c) |
| 47 | adult-how-to HIGH `agency_commands_per_1k` | 30 / 30 | 29 / 30 | expected failure, written down in advance: commands are only counted inside quotation marks |

So 47 of 50 behave as expected; the three failures are explained and none is a bug.

### 3c. Hand-checks of the rule-based classifiers

Masked view throughout, except passive voice, commands and names (see the note under the table). Samples are
saved under `data/dev/samples/` and sheets under `data/dev/handchecks/`; `python -m litcorr.dev.handcheck score`
reproduces the numbers.

| Classifier | Items | Correct | Accuracy (95% CI) | Main error types |
|---|---|---|---|---|
| Quote style (double / single / none) | 48 stories, 16 per style | 48 | 100% (92.6–100) | none |
| Dialogue spans | 50 paragraphs with quote marks | 50 | 100% (92.9–100) | none; 5 spans were quoted non-speech (signs, titles, thoughts), which the dialogue measures count as speech by design |
| Sentence splitting | 50 paragraphs with a candidate boundary | 49 | 98% (89.5–99.6) | one missed split after "etc." |
| Scene breaks | 50 paragraphs (detections and short/symbol-only lines) | 50 | 100% (92.9–100) | none; a textual transition ("Later that night") is not a scene break by design |
| Author paratext (Phase 2) | 58 + 118 development items; 58 hold-out | 48 / 102; 54 | dev 82.8% / 86.4%; **hold-out 93.1% (83.6–97.3)** | misses only (no false positives): notes without any marker, subtitles |
| POV class | 48 stories stratified by class | 39 | 81.2% (68.1–89.8) | third person labelled mixed 7, first-person plural labelled mixed 1, a chat transcript labelled second 1 |
| Tense class | 45 stories stratified by class | 44 (1 skipped) | 100% (92.0–100) | none; "unknown" below 20 listed verbs is by design (2 items) |
| Passive voice | 60 matches drawn at random from all 79,866 | 49 (1 skipped) | 83.1% (71.5–90.5) | participial adjectives of state 4 ("was accustomed to", "turned on"), of feeling 4 ("was fascinated by"), idioms 2 ("built like", "be damned") |
| Commands: counted | 60 of the 27,772 counted quoted passages | 51 | 85.0% (73.9–91.9) | expletive "fuck" 6, discourse marker "Look, ..." 2, question without a question mark 1 |
| Commands: not counted | 60 of the 338,343 other quoted passages | 56 | 6.7% are missed commands (2.6–15.9) | imperative after an interjection or in a later sentence 3, "you" + imperative 1 |
| Character names | 60 (story, name) pairs drawn at random from 23,240 | 39 (3 skipped) | 68.4% (55.5–79.1) | places 6, organisations 3, titles 3, nationalities 2, an endearment 1, other capitalised words 3 |
| Chapter / series numbering | 1,614 stories with both a title number and the site's series index | 1,427 agree | 88.4% | disagreements both ways (98 higher, 89 lower): authors number chapters independently of the site's series order |

* **POV**: the classes in the sample were balanced on purpose; weighted by how common each class is in the
  corpus, POV accuracy is about 97%. The errors concentrate in "mixed": most third-person stories labelled mixed
  have many "I" in narration only from reported thoughts or letters. A fix is planned (Phase 4); a hold-out
  check on 15 other stories the new rule moves from mixed to third found all 15 really third person.
* **Commands**: precision 85%, but about 1 in 15 of the passages not counted is a command. Combining the two
  rates, the rule finds roughly half of all commands in speech (about 51%; roughly 28–74% given both
  intervals). The measure is a consistent undercount, so it still ranks stories, but its level is low.
* **Names**: the 94% figure from the type-level check (Phase 3 start) counted the most frequent name types;
  per story, about one in three detected "names" is a place, title, group or organisation.
* **Chapter / series**: `series_part_number` uses the site's series index whenever there is one (1,997
  stories) and the title number only otherwise (234 stories), so the disagreements matter little. Titles with
  "Ch. N" or "Pt. N" are always detected as chapter markers; "Name: Subtitle" titles are often in a series
  without a marker, which the site's series id covers.
* **Passive voice, commands and names** cannot be judged in the masked view: it hides exactly the participle,
  the verb or the name. `litcorr/dev/fragment_check.py` therefore draws matches uniformly at random from the
  whole corpus and shows only a fragment of at most five words (auxiliary + participle + next word; the first
  four words of a quoted passage; the name alone), in random order, without story keys, like entries of a
  corpus n-gram list. The sheets store word positions, never the words.

### 3d. Lexicons

Top ~40 entries and their shares of hits, false-positive senses and likely omissions (words frequent within
three words of a hit but not in the list) are in `data/dev/audit/lexicon_audit_v11.txt` (before) and
`lexicon_audit_v12.txt` (after). Changes, each explained on the file's `# notes:` line:

| Lexicon | Entries | Hits before → after | Change | What changed |
|---|---|---|---|---|
| relationship_disclosure | 42 → 40 | 21,998 → 13,291 | −39.6% | "I felt", "I was feeling" removed (38% of hits; in first-person narration they report sensations) |
| relationship_familiarity | 29 → 25 | 19,125 → 16,147 | −15.6% | "used to" removed (habit, "get used to"); "childhood", "childhood friend", "grew up together" removed (they refer to youth) |
| emotion_anger | 32 → 30 | 10,463 → 9,565 | −8.6% | "furiously", "raging" removed (intensity: "blushed furiously", "raging erection") |
| agency_dominance | 33 → 39 | 19,534 → 17,869 | −8.5% | "ordered" alone → "ordered him/her/me/them/us/you/to"; "master bedroom/suite", "master's degree" excluded |
| emotion_affection | 29 → 29 | 32,568 → 30,632 | −5.9% | "make/made/making love", "love making" excluded (a sexual act, not affection) |
| emotion_anxiety | 48 → 46 | 21,071 → 19,904 | −5.5% | "tense", "tensed" removed (muscles) |
| sensory_touch | 64 → 64 | 76,779 → 73,026 | −4.9% | "softly" removed (speech: "she said softly"); "supple" added |
| descriptive_words | 90 → 93 | 123,472 → 117,741 | −4.6% | "pretty" removed (adverb: "pretty sure"); wavy, curly, busty, lithe added |
| action_verbs | 117 → 116 | 279,643 → 268,343 | −4.0% | "open" removed (mostly the adjective) |
| speech_verbs | 44 → 43 | 200,679 → 192,741 | −4.0% | "continued" removed (mostly "continued to ...") |
| agency_control | 50 → 50 | 20,110 → 19,842 | −1.3% | "birth control", "remote control", "air/police/task/labo(u)r force" excluded |
| sexual_anatomy | 55 → 56 | 185,999 → 186,718 | +0.4% | "precum" added |
| sexual_general | 30 → 33 | 52,771 → 52,997 | +0.4% | "intercourse", "sex toy(s)" added |
| sensory_sight | 68 → 72 | 234,062 → 234,891 | +0.4% | glint, twinkle, shimmer, glimmer added |
| agency_submission | 44 → 45 | 17,974 → 18,436 | +2.6% | "mercy" added |
| sensory_sound | 83 → 94 | 94,618 → 97,255 | +2.8% | husky, hoarse, raspy, throaty, hushed, muffled, audible, footsteps, rustle, squelch, slurp added; "sounds good/great/...", "sound asleep", "safe and sound" excluded |
| sensory_body | 65 → 69 | 63,200 → 65,940 | +4.3% | sopping, drenched, dripping, searing added |
| sensory_smell | 36 → 38 | 8,738 → 9,118 | +4.3% | "pungent", "nostril(s)" added |
| emotion_arousal | 54 → 56 | 60,089 → 63,398 | +5.5% | grunt, writhe added |

* New format feature: a `!phrase` line is an excluded sense (documented in `lexicons/README.md`, tested). It
  lets a list keep a useful word ("control", "love", "master", "sound") while dropping one fixed expression.
* Kept on purpose, with the reason: "gentle/gently" (mostly touch), "hurt" (pain and emotional hurt both fit
  the negative-emotion list), "tears" (crying in this corpus, not ripping), "see"/"look" (core sight verbs; the
  rate is high but the meaning is right).
* Checked for youth references: besides the three familiarity entries removed above, the lists contain no word
  about age or youth. Judgement calls left as they are (listed for the user): "good girl"/"good boy" (a fixed
  praise phrase in dominance language), "small", "tiny", "petite" (size words in the descriptive list), and
  "baby" in `not_names` (an endearment kept out of name detection, not a measure).
* Slang with everyday senses: "hard", "come", "head", "member", "wood" and "box" are in none of the sexual
  lists (only the "cum" spellings are). "balls" is (3.2% of anatomy hits); about two-thirds of its uses follow
  his/my/your/her/their, so the anatomical sense dominates, and it stays.

### 3e. Split-half reliability (3,914 stories of 1,000+ words)

Each story's story paragraphs split into odd and even halves, every measure computed on each half, correlated
across stories, Spearman–Brown corrected to full length (`data/dev/audit/split-half.tsv`). Counts are left out
(length-driven), as are the pace measures and first-mention positions (they need the whole story) and
`style_italics_per_1k` (it comes from the page, not the text).

* **Low (< 0.6)**, caveat added in `schema.py` ("compare groups of stories, not single stories"):
  `emo_jealousy_per_1k` 0.40, `hedge_uncertainty_per_1k` 0.40, `hedge_certainty_balance` 0.43,
  `agency_command_share_of_speech` 0.44, `emo_anger_per_1k` 0.55, `agency_volition_per_1k` 0.56,
  `psy_distancing_per_1k` 0.58, `emo_anxiety_per_1k` 0.58. All are rare-word rates: a story has only a
  handful of hits, so the halves disagree.
* **Moderate (0.6–0.8)**: 34 measures, mostly other emotion, relationship and sense rates, hedging, passive
  voice and commands. Fine for comparing groups; noisy for single stories.
* **High (≥ 0.8)**: 83 measures, including every readability, sentence-length, POV, gender, dialogue,
  punctuation and sexual-content measure (most above 0.9).

### 3f. Redundancy (|r| ≥ 0.9, Pearson or Spearman, 52 pairs)

Recommendations go to the Phase 5 proposal; nothing is removed or renamed now.

* Exact complements or monotone transforms (keep one): `agency_passive_sentence_share` vs
  `agency_active_sentence_share` (r = −1); `qe_question_sentence_share` vs `qe_question_to_statement_ratio`
  (Spearman 0.996, a transform of the same count); `story_words` vs `story_chars` (0.999).
* Near duplicates from two families: `punct_question_per_1k` vs `qe_question_sentences_per_1k` (0.996),
  `punct_exclamation_per_1k` vs `qe_exclamation_sentences_per_1k` (0.99).
* The readability indices (Flesch–Kincaid, Gunning fog, ARI, Coleman–Liau, Flesch reading ease, composite)
  correlate 0.90–0.99 with each other: keep `read_grade_composite` as the headline and the others as the
  standard formulas people know.
* Expected and kept: count vs rate of the same thing (`story_scene_breaks` vs `_per_1k`, Spearman 0.985 because
  most values are 0), mean vs median sentence and paragraph length, all-words vs narration-only POV rates,
  `lex_mattr` vs `lex_segment_ttr` (two lexical-diversity windows, 0.96), `sex_terms_per_1k` vs
  `sex_sentence_share` and `sex_anatomy_per_1k`, and length counts with each other.

### 3g. Length dependence (Spearman with log story words)

27 measures are length-dependent by construction (counts, plain type-token ratio −0.91). Of the rest, 11 have
|ρ| ≥ 0.3; they stay at 0.2–0.4 within categories, so category mix is not the cause:

* Real differences, kept: longer stories have more dialogue (`dlg_word_share` 0.42, `dlg_paragraph_share`,
  `dlg_segments_per_1k`, `punct_quote_marks_per_1k`, `pace_dialogue_early/late` 0.33–0.40), more characters
  (`char_top_name_share` −0.40) and more jealousy plots (`emo_jealousy_per_1k` 0.30, partly mechanical because
  the word list is rare).
* Mechanical, caveat added in `schema.py`: `rep_repeated_5gram_per_1k` 0.35 (a longer text has more chances to
  repeat a phrase), `sex_first_mention_position` −0.33 (a longer text has more chances of an early passing
  mention) and `char_name_mentions_per_1k` 0.36 (a name needs 3 mentions to count, which short stories reach less
  often). Length-robust versions are candidates for the Phase 5 proposal.

### Fixes planned for Phase 4 (from 3c)

POV ("mixed" third-person stories), passive voice (participial adjectives), commands (expletive "fuck",
"Look," / "Listen," fillers, and imperatives after the first sentence of a passage), names (titles, places,
groups, organisations). Each fix is re-checked on a fresh random sample, never on the items used to design it.

---

## Phase 4: Fixes (2026-10-04, text pipeline 1.2)

Every value change is in `CHANGELOG.md` (1.2) with its effect on median, mean and missing rate; regression
tests with synthetic text are in `tests/test_stage1b_measures.py`. `analyze` on the real corpus: 72.9 s for
4,251 texts (8 workers); `state.sqlite3` unchanged (checksum before and after every run).

### Fresh-sample checks (the design samples are the seed-1 sheets; seed 2 was drawn after the change)

| Rule | Before (seed 1) | After (seed 2, fresh) | Errors left |
|---|---|---|---|
| Passive voice, share of counted matches that are passives | 49/59 = 83.1% (71.5–90.5) | 54/59 = 91.5% (81.6–96.3) | "un-" adjectives 2 ("was unrequited"), idiom 1 ("getting started"), state 1, feeling 1 |
| Commands, share of counted passages that are commands | 51/60 = 85.0% (73.9–91.9) | 60/60 = 100% (94.0–100) | none |
| Commands, missed among passages not counted | 4/60 = 6.7% (2.6–15.9) | 1/60 = 1.7% (0.3–8.9) | a command verb not on the list |
| Commands, estimated share of all commands found | ≈ 51% (≈ 28–74%) | ≈ 87% (≈ 53–97%) | |
| Names, share of detected names that are characters | 39/57 = 68.4% (55.5–79.1) | 48/53 = 90.6% (79.7–95.9); 7 invented or ambiguous names skipped | titles and roles 3, other capitalised words 2 |
| POV, balanced sample of 48 | 39/48 = 81.2% | 46/48 in-sample (the rule was designed here) | a "we" narrator labelled mixed, a chat transcript labelled second |
| POV, hold-out of 15 stories the new rule moves to "third" | 0/15 | 15/15 = 100% (79.6–100) | |

Split-half reliability after the fixes (3,914 stories): `agency_command_share_of_speech` 0.44 → 0.47 (still
low; caveat value updated), `agency_commands_per_1k` 0.67 → 0.71, `agency_passive_per_1k` 0.71 → 0.73; no other
measure moved by more than 0.005.

For commands, the fragment shown for a counted passage is now the sentence that made it a command (it may be
the passage's second or third sentence), and for a passage not counted, the start of the passage and of up to
two later sentences, each at most four words.

### Tuned on batch 1 (re-check on the stories collected later)

* POV: "third" when I-forms are under **8%** of I-forms plus he/she/they forms in narration (designed on pov1;
  hold-out povflip). The existing 5 / 15 per 1,000 thresholds are unchanged from Stage 1.
* Passive voice: the **49 excluded participles**, "turned on" / "worked up" / "built like", "done" only before
  "to"/"by", "stuck" removed (from the type-level list of the most frequent matches and the seed-1 sheet).
* Commands: the object words after "fuck" (me, him, her, them, us, my, his, off) and the discourse markers
  (look, listen, see, say + comma).
* Names: the **360 `not_names` additions** (from the type list of names detected in the most stories and the
  seed-1 sheet) and the **≥ 50%** "the"/"in" share (a plain majority, not searched over).
* Lexicons: every Phase 3d edit (from the batch-1 lexicon audit).

To re-estimate on new stories only: draw a sample from the stories collected after this batch,
`python -m litcorr.dev.review_sample NEW --only-new-since data/dev/batch1_features.parquet ...`, then make sheets from it,
`python -m litcorr.dev.fragment_check make passive|commands|commands_unflagged|names SHEET --sample NEW --seed 3`
and `python -m litcorr.dev.handcheck make pov|tense|paratext ... --sample NEW`, judge them, and score them
with `python -m litcorr.dev.handcheck score`.

### Not changed (known limitations, documented in the schema)

* Passive voice: "un-" adjectives ("was unexpected", "was unrequited") and other rare participial adjectives.
* Commands: verbs missing from `lexicons/imperative_verbs.txt`; "you" + imperative ("You two, go"); imperatives
  after a comma inside a sentence ("Good, good, now kneel").
* Names: rarer places, titles and roles ("the Mage" when not after "the"); invented names in fantasy stories
  cannot be judged from the name alone.
* POV: first-person-plural narration ("we") still lands in "mixed" (a decision for the user: a "first plural"
  class, or counting "we" as first person).
* Sentence splitting after "etc." (1 error in 50).

---

## Phase 6: Incremental re-runs and safe concurrency (2026-10-04)

### Read-only state database

`build-raw`, `analyze`, `report`, `status` and `categories` now read `state.sqlite3` through `State.snapshot()`,
an in-memory copy; the collector's own `State()` (and its write path) is unchanged. Tested on this machine
(SQLite 3.53): a plain `mode=ro` connection to a WAL database that has no `-wal`/`-shm` files *creates* both and
cannot remove them, and a read-only connection cannot run the old `PRAGMA journal_mode=WAL` / `CREATE TABLE IF NOT
EXISTS` set-up at all. So:

* no `-wal` file (no collector has the database open): the main file is read with `immutable=1`, which creates
  no files; if a `-wal` appears during the copy (a collector started), the copy is taken again the normal way;
* `-wal` present (collector running): `mode=ro`, which sees everything the collector committed, including
  changes still in the WAL, and never writes the database or the WAL (it shares the `-shm` index like any
  reader);
* the copy is a single SQLite backup (well under a second for the 77 MB database), so no read transaction is
  held open against the collector's checkpoints; `PRAGMA query_only` guards the copy against writes.

Tests (`tests/test_stage1b_incremental.py`): with the collector closed, build-raw + analyze + report + status
leave the database byte-identical and create no `-wal`/`-shm` files; with a writer holding uncheckpointed changes,
the snapshot sees them and the main file and WAL stay byte-identical. On the real data, `state.sqlite3` was
unchanged after every run and no side files were left.

### Incremental build-raw and analyze

* `build-raw`: a parse cache (`data/raw/parse_cache.parquet`, kept in `raw/` because it holds story text) keyed
  on each story's saved pages (URLs, content hashes, fetch times, cache files) and a fingerprint of the parser
  code; only new or changed stories are parsed.
* `analyze`: a per-story measure cache (`data/derived/text_measures.parquet`, no text) keyed on `story_key`, a
  hash of the text and the story metadata the measures use, and a context hash of `TEXT_PIPELINE_VERSION`, the
  text-code fingerprint, the lexicon hash and the four `[analysis]` settings the measures read. The code
  fingerprint means an edit that forgets to bump the version still invalidates the cache. Every run, full or
  incremental, passes the measures through the same Parquet round trip, so the outputs are identical.
* `--full` on `build-raw`, `analyze` and `refresh` ignores the caches. Test: a partial collection, then the rest,
  incremental build-raw + analyze, then `--full`: raw and processed tables are equal (`assert_frame_equal`); a
  re-run with nothing new parses and measures nothing; changing a measure setting re-measures everything.
* `[analysis] workers` from `config.toml` is now used by `analyze` when `--workers` is not given (it was ignored).

Real data (9,000 sampled stories, 4,251 with text): first `refresh` 218 s (both caches filled); second `refresh`
with nothing new 12.6 s (0 parsed, 0 measured); the processed values are identical to the Phase 4 run.

### Partial-collection labels

The collection is partial: 4,251 of 9,000 sampled stories collected (47%), 4,749 still queued, every category at
142 of 300. `collection_manifest.json` now has `collection_progress` (overall and per sampled category: sampled,
collected, still queued, not collectable, with text, included, listing read) and `sampling_weights_provisional`;
the quality report opens with a "Collection progress: PARTIAL" table; the `sampling_weight` caveat says the
weights are provisional while collection runs.

### `refresh`

`python -m litcorr refresh` = incremental build-raw + analyze + report, then a profile of every measure saved to
`data/derived/profiles/<processed_at>/` (aggregate statistics only, no story keys; tested) and compared with
the previous refresh (`latest_diff.md`). No export. Documented in README §5.

---

## Phase 5: New-measure candidates (2026-10-04)

### Expectations, written before any candidate was computed

Ranking by category **mean** (most candidates are zero in many stories, so medians tie). HIGH / LOW = top /
bottom 6 of 30; ABOVE / BELOW = above / below the median of the 30 category means. "—" = no confident category
expectation; such candidates are judged on precision, reliability and non-redundancy instead.

| Candidate | Expectations |
|---|---|
| `open_dialogue` (story opens with speech) | LOW erotic-letters, reviews-and-essays, adult-how-to |
| `open_sex_per_1k` (sexual terms in the first 500 words) | HIGH masturbation-stories, anal-sex-stories; LOW non-erotic-stories, reviews-and-essays, adult-romance |
| `end_dialogue` (story ends on speech) | LOW erotic-letters, reviews-and-essays, adult-how-to |
| `end_to_be_continued` | HIGH erotic-novels; LOW erotic-letters, adult-how-to |
| `sex_scene_count` | HIGH group-sex-stories, erotic-novels; LOW non-erotic-stories, reviews-and-essays |
| `sex_scene_share` | HIGH masturbation-stories, anal-sex-stories; LOW non-erotic-stories, adult-romance, reviews-and-essays |
| `sex_first_scene_position` | HIGH adult-romance, erotic-novels; LOW masturbation-stories, anal-sex-stories |
| `mech_lowercase_i_per_1k` | BELOW reviews-and-essays, erotic-novels |
| `mech_lowercase_start_share` | BELOW reviews-and-essays |
| `mech_missing_space_per_1k` | BELOW reviews-and-essays |
| `mech_doubled_word_per_1k` (doubled function words) | BELOW reviews-and-essays |
| `mech_confusions_per_1k` (its/it's, your/you're, "should of", "alot") | BELOW reviews-and-essays, erotic-novels |
| `dlg_tag_variety` | —; expected correlation with `style_said_share` about −0.5 to −0.8 |
| `dlg_adverb_tag_share` ("said softly") | —; expected positive correlation with `style_ly_adverbs_per_1k` |
| `dlg_unattributed_share` (speech paragraphs with no tag) | HIGH adult-humor |
| `dlg_switches_per_1k` (dialogue ↔ narration paragraph switches) | LOW erotic-letters, reviews-and-essays, adult-how-to |
| `rel_consent_per_1k` (asking, checking in, safewords) | HIGH bdsm-stories, first-time-sex-stories; LOW non-erotic-stories |
| `time_jump_per_1k` ("the next morning", "weeks later") | HIGH erotic-novels, adult-romance, loving-wives; LOW masturbation-stories, adult-how-to |
| `reader_address_per_1k` ("dear reader", "let me tell you") | HIGH reviews-and-essays, adult-how-to |
| `humor_per_1k` (laughing, joking) | HIGH adult-humor; LOW erotic-horror, non-consent-stories |
| `setting_home_per_1k` | HIGH loving-wives |
| `setting_public_per_1k` (bars, shops, hotels, offices) | HIGH exhibitionist-voyeur |
| `setting_outdoors_per_1k` | HIGH exhibitionist-voyeur |
| `title_sexual` (title contains a sexual term) | HIGH anal-sex-stories, group-sex-stories, masturbation-stories; LOW adult-romance, non-erotic-stories, science-fiction-fantasy |
| `desc_pov` (blurb in first / second / third person) | erotic-letters HIGH first person; adult-how-to HIGH second person |
| `style_elongated_per_1k` ("ohhh", "yesss", "mmmm") | HIGH masturbation-stories, group-sex-stories; LOW reviews-and-essays, non-erotic-stories, adult-how-to |
| `style_intensifiers_per_1k` ("very", "really", "totally") | — |

### Results (details and evidence in `NEW_MEASURES_PROPOSAL.md`)

* 34 candidate columns prototyped on the 4,248 analysed stories
  (`python -m litcorr.dev.prototype_measures run` / `report`; aggregate tables in `data/dev/proposal/`).
* 51 of the 67 expectations above hold (desc_pov 2/2 included).
* The failures are explained in the proposal; the main surprise is that reviews-and-essays is *less* polished
  than average on lowercase "i", lowercase starts, missing spaces and doubled words.
* Not proposed because redundant (|ρ| ≥ 0.85 with an existing measure): sexual terms in the first 500 words
  (0.86 with `pace_sex_early`), scene share (0.97), scene concentration (0.86).
* Prototype word lists were tightened for precision from their most frequent matches, never from the
  known-group results:
  * consent: generic questions were 48% of hits, hotel "check in"s were ~20% after that;
  * settings: "outside", "park", "field", "bar", "train", "club" alone were removed.
* One known-group result got worse as a consequence (first-time-sex-stories on consent language: 3rd → 7th).
* 22 candidates proposed; **stopped here for approval** (nothing implemented).

---

## Phase 7: The approved proposal (2026-10-05, text pipeline 1.3)

**Decisions (user, 2026-10-05).** Add all 22 candidates; apply every suggested retirement/merge; give "we"
narration its own POV class; run `scripts/validate_narration.py` (download approved); keep the word-list judgement
calls ("good girl"/"good boy", "small"/"tiny"/"petite", "baby" in `not_names`).

**The collector was running** during this phase (started 09:17, pid in `data/.collector.lock` alive), so the corpus
grew from 4,251 to 5,001 stories with text. All offline runs read the state database through `State.snapshot()`
(the `-wal` path); the run wrapper's before/after checksum of `state.sqlite3` is meaningless while the collector
writes, and was not used. Demo runs now use a scratch `LITCORR_LOCK_DIR`, so they no longer add mock-site lock files
to `~/.litcorr/` (nine such files from the Phase 0–6 demo runs remain there; lock files are left untouched).

### Narration validation (14 public-domain novels, 284 passages of ~5,000 words)

| Rules | Correct | Confidently wrong |
|---|---|---|
| Stage 1 (methodology) | 93.7% | 2.8% |
| 1.2 without the 8% rule (re-run) | 266/284 = 93.7% | 8 = 2.8% |
| 1.2 with the 8% rule | 266/284 = 93.7% | 9 = 3.2% |
| 1.3 (with first_plural, counted as first person) | 267/284 = 94.0% | 9 = 3.2% |

The 8% rule changes one passage (a Sherlock Holmes passage in which a client tells a long third-person story:
mixed → third). `first_plural` labels three passages of first-person novels in which the narrator mostly says
"we" (two in Huckleberry Finn, one in Treasure Island). `scripts/validate_narration.py` now counts `first_plural`
as first person.

### "We" narration

Rule (no tuning; same 15-per-1,000 threshold as "first" and "second"): first_plural when we/us/our forms in
narration are ≥ 15 per 1,000 narration words and at least as frequent as I/me/my and as you/your. Batch 1: 22
stories (12 reviews-and-essays, 4 adult-how-to, 4 adult-humor, ...), previously first 11, third 7, mixed 2,
second 2. The one "we" story in the pov1 hand-check sample is now first_plural.

### Hand-checks of the new detectors (fragments; hold-out = the 680 stories collected after batch 1)

Each detector: 40 matches drawn at random from the hold-out (sheet `new_*`); where it failed, the rule was fixed
and checked again on matches from hold-out stories not used before (`new_*_b`, `_c`, `_d`), and finally, for the
two detectors fixed most, on 40 matches from batch 1, on which none of these fixes was designed (`b1_*`).

| Detector | Draw | Right | Errors (types) |
|---|---|---|---|
| lower-case "i" | hold-out | 40/40 | — |
| lower-case starts | hold-out, first rule | 24/40 | verse-like lines 9, sentence continued across a paragraph 5, list item 1, abbreviation 1 |
| | after fix 1 (paragraph start only after a finished sentence) | 30/39 | dialogue tag without quotation marks 5, list item 3, abbreviation 1 |
| | after fix 2 (tags, list markers, "Doc.") | 29/39 | sign-off 2, verse 2, chat handle, byline, list marker, thought tag, tag with adverb, abbreviation |
| | after fix 3 (paragraph starts dropped altogether) | 30/32 | a "xxx" sign-off and a verb-first tag ("...ready? asked her friend"), both now excluded |
| | batch 1, final rule | **39/40** | an options list |
| missing spaces | hold-out | 14/40 | one chat log's dotted username 26 |
| | after fix (digits, ":" handles, tokens repeated 3+ times) | **19/19** | — (every match left in the pool) |
| word confusions | hold-out | 34/39 | possessive + adjective 4, "the might of" |
| | after fix 1 | 36/38 | possessive "your being" 2 |
| | after fix 2 | 29/38 | time "then" 4, "your very own" 3, "would of course", "ahead of its time" |
| | after fix 3 | 3/3 | (pool exhausted) |
| | batch 1, final rule | **35/40** | "your SO" (significant other) 2, time "then" before a verb 2, "your so-called" (now excluded) |
| consent language | hold-out | 27/34 | taunts 3, generic requests 3, an idiom |
| | after fix | **38/39** | a generic "okay with this" |
| time jumps | hold-out | 31/39 | duration/reference after a preposition 4, future plans 4 (2 in dialogue) |
| | after fix (narration only; not after for/in/or/until/...) | **39/40** | a reference ("a dinner later that day") |
| address to the reader | hold-out | 36/40 | "trust me" as a verb 2, a named addressee, a deliberation |
| | after fix | **24/25** | "trust me to" (now excluded) |
| speaker labels | hold-out | **38/40** | recurring headings ("PS:", a contest heading), now excluded |
| sex scenes (masked view) | hold-out scene starts | **16/21 judged** (9 unclear) | sex discussed or reflected on, an essay, an author's note, world-building, anticipation |

One scene item was at first not judged: its masked text showed a character who does not know what a sexual act
is, addressed with an honorific, and a minor could not be ruled out from the masked view. Reading stopped there
and the story key was given to the user for review (not recorded in this public log). The user reviewed it on
2026-10-05: the character is an adult. The item was then judged from the masked view already seen (sexual
activity: 16/21); nothing in the data changed.

### Tuned on these samples (re-check on later stories)

The detector fixes above (all designed on the `new_*` sheets of the hold-out; final precision from fresh draws or
batch 1): lower-case-start exclusions (`_MECH_ABBREV`, `_TAG_PRONOUNS`, `_THOUGHT_VERBS`, no paragraph starts),
missing-space exclusions (digits, ":" handles, ≥ 3 repeats), the confusion patterns, the consent and
reader-address lists and exclusions, the time-jump preposition set, the speaker-label stoplist. The scene window
(200 words, ≥ 6 terms, 50-word steps) and the first_plural thresholds were set in advance and not tuned.

### Final audit (4,998 analysed stories; split-half on 4,619 stories of 1,000+ words)

* Split-half: 13 measures below 0.6 (caveat added): the 8 from Phase 3 plus reader address 0.32, consent 0.35,
  time jumps 0.46, missing spaces 0.50 (it was 0.97 before the fix only because of one repeated chat handle) and
  dialogue alternation 0.53. The mechanics total is 0.94.
* Length: no new measure has |ρ| ≥ 0.3 with log length except `sex_scene_count` (0.55, a count by design).
  Repeated five-word phrases, now counted per 1,000-word stretch: 0.35 → 0.08.
* Redundancy: the only new |r| ≥ 0.9 pairs are `pov_first_plural_per_1k` with its narration-only version (Pearson
  0.92, like the singular pair) and `mech_errors_per_1k` with `mech_lowercase_i_per_1k` (Pearson 0.91 from a few
  extreme stories; Spearman 0.39).
* Known groups: the Phase 3 list 45/50 on medians; the Phase 5 list 41/53 on means (`measure_audit known-groups`
  now runs both). Failures, mostly near misses (rank 7–12): erotic-novels on "to be continued", scene position and
  time jumps; reviews-and-essays on three mechanics measures (essays are not more polished); adult-humor on untagged
  lines; first-time-sex-stories on consent; non-consent-stories on humour; loving-wives on home settings;
  exhibitionist-voyeur on outdoor settings; masturbation-stories on stretched words.
