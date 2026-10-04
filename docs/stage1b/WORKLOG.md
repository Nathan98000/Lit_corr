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
