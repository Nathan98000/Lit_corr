# Stage 2: bring the new data into the site

You are working in the `Literotica_Correlations` project. The Stage 2 website (`site/`) is built from
`data/handoff/litcorr_stage2_handoff_20261008.zip`: 9,004 sampled stories, 300 per genre, 8,996 used in the charts.
Since then the owner raised `max_stories_per_category` to 600 in `config.toml` and kept collecting. This prompt turns
what has been collected into a new handoff, rebuilds the site's aggregates from it, brings the site's text, tests and
READMEs in line with it, and writes up what changed so the owner can review it before merging.

It is written to be run again for a later handoff (when the collection reaches 600 per genre, say): the decisions stay,
only the dates and numbers change.

## Where the collection stands

A read-only look at `data/state.sqlite3` on October 13, 2026. The collector may have run since; higher numbers are fine.

| | |
|---|---|
| Sampled | 17,977 stories: 600 in each of 30 genres, except Chain Stories with 573 (its whole listing) |
| Collected | 12,573 (70%): 417–420 per genre |
| Still waiting in the queue | 5,400 |
| Could not be collected | 4 (the 20261008 handoff also had 4) |
| Last run | October 12, stopped when the site refused connections. That is the collector working as designed and is not part of this task |

## Branch

* `main` is at `6145524` (design review 4 and the owner's follow-ups). Make the branch
  `data-update-<YYYYMMDD of the new handoff>` from the tip of `main`. If `main` has moved past `6145524`, say so in
  the summary.
* Commit as you go, in the repository's style ("Stage 2 data update: …"). Don't push.
* The first commit adds this prompt and the before screenshots.
* Never commit `.claude/`, `Claude outputs/` or anything under `data/`.
* git may delete its lock files. If your environment asks, request deletion permission for the project folder.

## Read first

1. `README.md` sections 4–7 (collect, process, the handoff, `site-data`) and `site/README.md`.
2. `STAGE2_DESIGN_REVIEW_4_PROMPT.md`, "Hard rules" and "Working setup". They still hold, except where this prompt's
   decisions say otherwise (D1, D3, D7).
3. Python: `litcorr/stage2/` (`site_data.py`, `trends.py`, `wording.py`, `stats.py`, `synthetic.py`);
   `litcorr/build/raw_corpus.py` (`build_raw` keeps a row for every sampled story, collected or not);
   `litcorr/build/quality.py` (`qc_flags`, `exclusion_reasons`, the "PARTIAL" table); `litcorr/analyze.py`
   (`add_sampling_weights`, `collection_progress`); `litcorr/export.py`; `tests/test_stage2_site_data.py`.
4. The site: `src/components/Methodology.jsx` (`InShort`, "Where the stories come from", "Missing data and excluded
   stories"), `src/App.jsx` (the kicker), `src/lib/wording.js` (`aboutCount`, `typicalSample`), `src/lib/data.js`,
   `index.html`, `vite.config.js`, `site/vercel.json` and `netlify.toml`.
5. The tests that read the real aggregates: 69 tests and groups marked `skipIf(!real)` in 25 files under
   `site/src/test/`, the two fingerprints (`exploreLayoutGuard.test.js`'s real digest and `__fingerprints__/one-genre/`),
   and the `test_real_*` tests in `tests/test_stage2_site_data.py`.
6. The measuring scripts in `Claude outputs/design-review-2-tools/` and its subfolders (each `README.txt` explains
   them). Run copies; never import from `Claude outputs/` and never commit it.

## The owner's decisions

### D1. Stage 1 may run `process`, once

* You may run `.venv/bin/python -m litcorr status` (any time) and `.venv/bin/python -m litcorr process` (once, in
  Phase 1). Both are offline. This replaces earlier prompts' "never run `process` or `export-handoff`".
* `process` runs `build-raw`, `analyze`, `report`, `docs` and `export-handoff`. The first two are incremental, so it
  should take minutes.
* Nothing else from Stage 1: never `probe` or `collect` (with any flag), no `--full`, no `--recheck`. Never edit, move
  or delete anything under `data/`; `process` writing its own outputs there is the one exception.
* A collector may be running, or may start while you work. Leave it alone. `process` reads an in-memory copy of
  `state.sqlite3`, so it is safe alongside a collector, and the handoff holds whatever had been collected when it ran.
* Don't change Stage 1 code (`litcorr/` outside `litcorr/stage2/`). If `process` fails, stop and report the error.

### D2. The site is built from the new handoff

* Build from the zip `process` writes, `data/handoff/litcorr_stage2_handoff_<today>.zip`. Keep the old zip: Phase 0
  and D3 use it.
* If `data/handoff/` holds a zip newer than yours, stop and ask.

### D3. Stories still waiting in the queue are not part of the data

`build-raw` keeps a row for every sampled story, so the new handoff will have about 5,400 rows for stories still
waiting in the queue (`qc_flags` holds `status_queued`; `exclusion_reasons` is `no_text`). They are already out of the
charts (`analysis_include` is false). But `site-data` counts every row in `meta.counts`, so How it works would say
"Of the 17,977 sampled stories, 12,5xx are used in the charts. 5,4xx were left out: 5,4xx had no story text that could
be collected …", and "In short" would say 599 stories in each genre. Both would be wrong: those stories were not lost,
they have not been read yet.

* **Approved:** in `site_data.py`, drop the rows of stories whose collection had not finished when the data were
  processed (`qc_flags` holding `status_queued` or `status_partial`) as the handoff is loaded, before anything is
  counted or charted, and log how many.
* A story that could not be collected (gone, failed, unavailable) still counts, as now: it was sampled and lost.
* With a finished collection this changes nothing. Check it: `site-data --handoff
  data/handoff/litcorr_stage2_handoff_20261008.zip --out <a folder outside the repository>` must give files identical
  to the committed aggregates apart from `generated_at`, before and after the change.
* Add a Python test: a synthetic handoff with queued and partial rows gives the same aggregates as that handoff
  without them.
* **The site doesn't mention** the 600-story plan, that collection continues, or that the weights are provisional.
  The stories collected so far are the first ones in each genre's shuffled order, so each genre's stories are a random
  sample of it, and the site describes them as one. The write-up (D8) says all this for the owner.

### D4. Methodology doesn't change

* Measures, binning, weights, MIN_N 10 and SMALL_N 30, the pattern rule ("tend to"), the Genres page's rule, and the
  Trends page's rule, windows and periods all stay as they are.
* More stories will move some results:
  * group edges and labels can shift (`make_bins` works from the data);
  * a characteristic's kind can change;
  * genres that were too few to compare can become comparable;
  * more comparisons can pass the 99% and 99.9% levels.
* That is the rules at work: accept it and report it (D8). Never hand-edit an aggregate, and never tune a threshold to
  keep or restore an old result.

### D5. Copy (approved; US English; nothing causal)

Only these change. Anything else visitors read changes only where its numbers already come from the data.

1. **How it works › "Where the stories come from"**, second paragraph:
   * "…which list every story whatever its popularity, and then picked 300 stories at random from them." becomes
     "…which list every story whatever its popularity, put the stories found there in a random order, and collected
     them in that order: about {typicalSample(meta)} stories per genre."
   * "…the next story in that category’s random order took its place, so every genre has its full sample." becomes
     "…the next story in that category’s random order took its place."
2. **How it works › "In short"**, first bullet: "A random sample: about {typicalSample(meta)} stories in each of
   {genres} genres, collected {from} to {to}; {included} are used in the charts." (`typicalSample`, the genres' median
   to the nearest 10, replaces `counts.sampled / genres`.)
3. **The count before `meta.json` arrives.**
   * `App.jsx` puts "about 9,000" in the kicker until `meta.json` arrives, and `index.html`'s description and
     og:description say "about 9,000 stories".
   * Make all three `aboutCount(meta.counts.included)` of the new data ("about 13,000" for 12,500–13,499 stories).
     Otherwise the kicker changes its words when the data arrive.
   * Add a test that reads the real `meta.json` and fails when any of them differs, so the next update can't miss
     them.
4. **Any other number from the old data written as a literal** in `site/src/` (outside the tests), `index.html` or the
   two READMEs:
   * make it come from the data;
   * where it can't (a README's measured sizes), update it;
   * list each one in the write-up.

### D6. Tests: the rules stay, the numbers move

The real-data tests hold four kinds of assertion.

* **Rules.** Nothing overlaps or leaves its chart, files stay under their limits, banned words, no group under 10
  stories, files are whole.
  * Never loosen them.
  * If one fails on the new data, the site has a real problem: fix the code (Phase 3).
* **Snapshots of the old data.** Counts, headings such as "8 of 30 genres clearly differ from all genres", "Too few
  stories to compare: How To (28), Reviews & Essays (20).", `too_few` lists, acceptance numbers.
  * Update them to the new data.
  * Check each new value by a second route before writing it in: a short script over the aggregate file or the
    handoff, not the line the failing test printed.
  * Record every one: test, old value, new value, how it was checked.
* **Fingerprints.** `exploreLayoutGuard.test.js` on the real data, and `__fingerprints__/one-genre/`.
  * Regenerate them in the aggregates commit, with no code change in that commit.
  * Add a line to the comment naming the new handoff.
  * The fixture digests (`7fb18ef1ff7cdf3c` and the synthetic ones) must not change at all. If one does, something
    other than the data changed.
* **Edge cases the new data no longer have.** Some real-data tests pinned a case that the old data happened to contain
  (a row near 0 that reached +149,028%, a genre with 20 stories with a characteristic …).
  * If the new data lose such a case, keep the guard: add the case to a fixture-based test, then update the real one.
  * Never delete a real-data test.

`npx vitest run -u` rewrites every snapshot it touches: check `git status` afterwards.

### D7. One build's aggregates stay together

`site/vercel.json` and `netlify.toml` let browsers keep `/aggregates/*` for an hour. After a deploy, a visitor who came
in the last hour can get the old `meta.json` from their cache with new chart files, or the reverse. Where group edges
moved, a chart would then be labeled from the other build.

* **Approved:** every aggregates request carries the data build's stamp (for example
  `v/story_words/all.json?v=20261013T…`).
  * Take it from `meta.json`'s `generated_at` at build time (a `define` in `vite.config.js`).
  * Add it in `aggregatesUrl()` (`src/lib/data.js`).
* Files keep their paths, and the in-memory cache keeps the plain paths as keys.
* `npm run dev`, the tests and `npm run preview` keep working, and the first load stays within budget.
* Add a test. If you find a simpler way that keeps one build's files together, use it and say why in the write-up.

### D8. A record of what changed, and a script to make it again

* `scripts/compare_aggregates.py BEFORE AFTER` uses the standard library only and reads only the two aggregate
  folders' JSON. It prints a Markdown comparison:
  1. **Source and counts.**
     * The handoffs' names, the collection dates and the popularity-snapshot dates.
     * Sampled, with text, included, and excluded by reason.
     * Each genre's stories (old → new) and their range, and each "Only include" option's stories.
  2. **What the site offers.**
     * Measures and their coverage.
     * Characteristics added or removed, and changed kinds.
     * Changed groups (old labels → new labels).
  3. **Popularity (Explore)**, from each `v/<characteristic>/all.json`'s `p` (direction, effect), for every genre and
     measure.
     * Per measure, All genres' "tend to" count, old → new.
     * Every All genres change: reversals first (direction flipped), then new, then gone. Give each its old and new
       effect, so the reader sees which sat near the line.
     * The number of changes per genre.
  4. **The Genres page**, from `genres/<included>.json`.
     * Per option, how many (characteristic, genre) pairs clearly differ, old → new.
     * For All stories, every pair that changed, with its old and new `r`.
  5. **The Trends page**, from `trends/<included>/<genre>.json`.
     * Per option and genre, how many characteristics clearly changed, old → new.
     * Every change for All genres and All stories.
     * `meta.trend.too_few`, old → new.
  6. **The featured questions and the Popular list.** For the five featured questions (`meta.featured`) and the
     Popular list (`meta.popular`, at the default measure), each one's verdict old → new.
  7. **Files.**
     * Their number, total size and gzip size.
     * The largest `genres/` and `trends/` files against their limits.
     * `meta.json` and `patterns.json`, gzipped.
* The write-up is `docs/stage2/DATA_UPDATE_<YYYYMMDD>.md` (Phase 5), with the script's output as its appendix. The
  before and after screenshots go in `docs/stage2/data-update-<YYYYMMDD>/`.
* Aggregate numbers only. No story text, titles, slugs, authors or story-level rows in the write-up, the commit
  messages or your messages.

## Rules that still hold

* **No network access to Literotica.** Never open literotica.com with any tool.
* **The data stays private and aggregated.**
  * The site ships only `meta.json`, `v/<characteristic>/<included>.json`, `patterns.json`, `genres/<included>.json`
    and `trends/<included>/<genre>.json`.
  * Groups under 10 stories stay hidden.
  * Work from the handoff (it has no text) and the aggregates. Don't open `data/raw/` or `data/cache/`.
* **Interpretation.**
  * No causal language.
  * "Tend to", "clearly differs" and "clearly changed" appear only through their rules.
  * The tests' word scans cover every new string.
* **No new dependencies** (Python or npm), fonts or external requests. Checking tools run from a temporary directory
  outside the repository, as before.
* **Addresses keep working**, every one listed in `site/README.md`.
* **Tests and build pass at every commit:** `npm test` and `npm run build` in `site/`, and `.venv/bin/python -m pytest`
  at the root.

## Phase 0: baseline on `main` (no changes)

1. Make the branch. Run `status`, and note sampled, collected, waiting and not collectable.
2. Run the three test commands and the build. Record passed and skipped.
3. Reproduce the committed aggregates.
   * Run `site-data --handoff data/handoff/litcorr_stage2_handoff_20261008.zip --out <outside the repository>`.
   * Compare every file with `site/public/aggregates/`, ignoring `generated_at`.
   * Keep this folder as BEFORE (for example `Claude outputs/data-update/before/`).
   * If any file differs, stop: the committed aggregates don't come from today's code.
4. Take before screenshots (`b01…`) at 375 and 1440 px:
   * Popularity's default chart, and the featured "Do longer Romance stories get more views per month?";
   * the Genres page's default, and "One genre" for Romance;
   * the Trends page's View 1 default, and View 2 for All genres;
   * Patterns;
   * How it works: "In short", "Where the stories come from", "Missing data and excluded stories".
5. Measure:
   * the first-load bytes (`firstbodies.mjs` with `serve.mjs`);
   * a visit that starts on the Genres page, and one on the Trends page;
   * the aggregates' sizes.

## Phase 1: the new handoff

1. Run `.venv/bin/python -m litcorr process`. Note how long it took and the zip's name.
2. Read `data/processed/quality_report.md` and `collection_manifest.json`, and compare them with the ones in the
   20261008 zip. Expect:
   * about 17,977 stories in the table and about 12,573 with text;
   * roughly 12,560 included;
   * the "Collection progress: PARTIAL" table;
   * `sampling_weights_provisional: true`.
3. Run `git status`. `docs` rewrites `docs/METHODOLOGY.md`, `docs/DATA_DICTIONARY.md` and `docs/data_dictionary.json`
   from the code alone, so they should not change. If they did, report it.
4. **Stop and ask** if:
   * there are fewer included stories than 8,996, or any genre has fewer included stories than in the 20261008 zip;
   * a genre, a measure or a characteristic is gone or new (in the data dictionary, or a coverage under 0.9);
   * exclusions other than the queued stories' `no_text`, parse warnings or quality flags run at clearly higher rates
     than in the old report (twice the rate, say);
   * the report counts any bot, challenge or blocked page;
   * anything else in the quality report looks unusual.

## Phase 2: the aggregates, and what changed

1. **D3.** Change `site_data.py` and add its test. The 20261008 rebuild must still match BEFORE. Commit.
2. Run `.venv/bin/python -m litcorr site-data`. Check that:
   * `meta.source.handoff` is the new zip;
   * `meta.counts.sampled` equals the stories collected plus those that could not be collected.
3. **Spot-check by a second route.**
   * Take three characteristics: a number, a yes/no and a named group.
   * For All genres and All stories, compute the weighted median or shares straight from the handoff's
     `stories_features.parquet` (with `sampling_weight`). Compare them with the files.
   * Check each genre's stories in `meta.genres` against the handoff.
4. Write `scripts/compare_aggregates.py` (D8), and run it on BEFORE and the new aggregates.
5. **Budgets:**
   * each `genres/` file at most 60 KB gzipped;
   * each `trends/` file at most 16 KB gzipped;
   * `patterns.json` at most 40 KB gzipped;
   * `meta.json` at most 2 KB gzipped bigger than before.

## Phase 3: tests, copy and the cache

1. Run the three test commands on the new aggregates, with no code change. List every failure: file, test, kind
   (snapshot, fingerprint, lost edge case, rule), old value, new value.
2. **If a rule fails,** fix the code first, in its own commit. The old data's tests must still pass with the fix.
3. **The aggregates commit** ("Stage 2 data update: aggregates from litcorr_stage2_handoff_<date>.zip"):
   * the new aggregates, and the snapshot and fingerprint updates from D6, nothing else;
   * everything passes at this commit.
4. **D5,** with its tests. Commit.
5. **D7,** with its test. Commit.

## Phase 4: check the site

1. Build, and serve `site/dist` with gzip.
2. Take after screenshots (`a01…`) of the same views as Phase 0. Make side-by-side before/after composites,
   palette-compressed like earlier rounds' (`compose4.py` in `trends-review/tools/`).
3. **Glyph boxes** on every page at 320, 375 and 1440 px, and with the wide font: no overlaps. Look hardest where the
   new data put longer text:
   * five-digit story counts on phones;
   * groups with new labels;
   * genres the Trends page can now compare.
4. **Performance:**
   * the first load at most 155 KiB (150.7 before);
   * layout shift under 0.1 on slow 4G, and no "Loading…" flash after the first chart;
   * the visits that start on the Genres and Trends pages, before and after.
5. Open every address in `site/README.md` and every How it works section, and the Trends page for a genre that was too
   few to compare before and isn't now.

## Phase 5: finishing

1. Update `site/README.md`: the numbers that describe the data (the first load, file sizes and counts, the aggregates'
   megabytes, the "about 9,000" examples). Change the root `README.md` only where something there is now wrong.
2. Write `docs/stage2/DATA_UPDATE_<YYYYMMDD>.md`:
   1. **The data.**
      * The handoff and its dates.
      * The collection's progress: sampled, collected, waiting and lost, and the range per genre.
      * That it is partial, and what that means.
      * Anything in the quality report the owner should know.
   2. **What visitors will see differently**, biggest first, in plain words.
      * Reversals; results that appeared or went; the Genres and Trends pages; the featured questions and the Popular
        list; groups relabeled.
      * Say plainly where a change comes from more stories passing a rule's significance part, rather than from a
        bigger difference.
   3. **Tests changed:** the table from D6.
   4. **Code and copy changes,** each with its commit.
   5. **Checks and budgets,** before and after.
   6. **Screenshots,** before and after.
   7. **Judgment calls,** and what is still open.
   8. **Doing this again:** the commands, in order, for the next handoff.
   9. **Appendix:** the comparison script's output.
3. Commit the write-up, the screenshots and the READMEs.
4. In your final message, give:
   * the handoff and its counts;
   * the three biggest changes visitors will see;
   * how many tests changed, and why;
   * anything that needs the owner's decision;
   * the branch's commits.

   Don't merge or push.

## Checkpoints: stop and ask before

* going on after any Phase 1 finding, or when the 20261008 rebuild doesn't match the committed aggregates;
* changing methodology, thresholds, binning or weights, or what the site ships (fields or files), beyond D3 and D7;
* changing visitor text beyond D5 and the numbers that already come from the data, or making any change that alters
  how a chart, title or note reads;
* loosening a rule test, or deleting a real-data test;
* going over a budget;
* changing Stage 1 code, or running any Stage 1 command other than `status` and `process`.

Report, but don't stop for, reversals, including those of a featured question or a Popular characteristic. The
featured questions were never chosen for their results, and they stay.

**Start with Phase 0.**
