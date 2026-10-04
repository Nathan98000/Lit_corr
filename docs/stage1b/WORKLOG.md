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
