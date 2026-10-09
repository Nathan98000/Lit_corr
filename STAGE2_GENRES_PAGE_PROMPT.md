# Stage 2: build the Genres page

You are working in the `Literotica_Correlations` project. Its Stage 2 website (`site/`, a static React + Vite app) is
on `main` (last commit `a5118ce`, "section 12 records the sixth follow-up change"). The owner has approved a new page,
**Genres**, that compares story characteristics across genres. The design is in
`docs/stage2/GENRES_PAGE_PROPOSAL.md` (figures in `docs/stage2/genres-page/`). Both are untracked; your first commit
adds them.

This prompt fixes the owner's decisions and the details the proposal left open. Where it still leaves a detail open,
decide, implement it, and record the choice under *Judgment calls* (see "Finishing"). Stop only for the things listed
under "Checkpoints".

## Read first

1. `docs/stage2/GENRES_PAGE_PROPOSAL.md`, all of it. The proposal's figures are mock-ups, and this prompt wins where
   they differ (notably the headings and question wording: see "Copy").
2. `docs/stage2/DESIGN_REVIEW_2.md`, sections 10–12 (what rounds 2 and 3 built and the owner's follow-ups). The owner
   prefers lean pages:
   * no notes about chance;
   * no reminders that correlation is not causation;
   * "median" and "interquartile range" said without explanation.
3. `site/README.md`, everything in `site/src/` and `site/src/test/`, `litcorr/stage2/wording.py`,
   `litcorr/stage2/site_data.py`, `litcorr/stage2/stats.py`, `litcorr/stage2/synthetic.py` and
   `tests/test_stage2_site_data.py`.
4. Reference material in `Claude outputs/`. Read it, run copies outside the repository, never import from it and
   never commit it.
   * `genres-page-mockups/`: the static mock-up (`README.md` explains how to view it).
   * `genre-profiles/gp_rule.py`: the approved rule computed with the project's own helpers. It produced the expected
     numbers under "Acceptance numbers".
   * `design-review-2-tools/`: the measuring scripts (`README.txt`).

## The owner's decisions

| # | Decision |
|---|---|
| D1 | **Approved:** a new aggregate file family, `site/public/aggregates/genres/<included>.json`, one per "Only include" option |
| D2 | **Approved:** the "clearly differs" rule. Rank-biserial \|r\| ≥ 0.20 and clear at the 99.9% level, compared with **all genres** (the genre's own stories included). Named groups: total variation distance ≥ 0.20 plus a chi-square test at 99.9%. |
| D3 | **Add the sort toggle** to View 1: "A–Z / By median" ("By share" for yes/no, "By share above 0" for mostly-zero). A–Z is the default. |
| D4 | **Phones:** "How it works" leaves the masthead and stays in the footer. No Menu button. |
| D5 | **Approved:** publication month and weekday are not on this page. "Published on a weekend" stays. |
| D6 | **Approved:** the split chart for every characteristic with a "None" group (`bins.zero`, 45 today) |
| D7 | **Approved:** Explore's "Compare all 30 genres →" becomes "See this pattern in every genre →" |
| D8 | **Approved:** the default genre of "One genre" is the last genre the reader chose in this visit, else the genre with the largest `size` in `meta.genres` (Erotic Couplings today; never hard-code it) |
| D9 | **Approved:** the nav item is "Genres" |
| D10 | **Approved:** direction words for the 20 characteristics listed under "Copy"; generic words elsewhere |

## Rules that still hold (updated for this page)

- **No network access to Literotica.** Never open literotica.com with any tool.
- **Data stays private and aggregated.**
  * Ship only `meta.json`, `v/<characteristic>/<included>.json`, `patterns.json` and now
    `genres/<included>.json` (D1). Add no other data fields or files beyond this prompt's spec.
  * `data/` is read-only.
  * Never run `probe`, `collect`, `process` or `export-handoff`.
  * `python -m litcorr site-data` is offline and fine to run.
- **Interpretation.**
  * No causal language; the banned-word tests stay and cover the new files.
  * No correlation reminders and no notes about chance on the page; How it works explains the rule.
  * "Clearly differs" is said only through the D2 rule.
  * Sample sizes are visible, and the story-age note appears where the proposal says.
  * The independence statement in the footer stays.
- **Order.**
  * Genres are A–Z by default. The only other order is the D3 toggle on the Genres page.
  * View 2 orders characteristics by the size of their difference within one genre. It never orders genres.
  * Explore, compare mode and Patterns keep their current orders.
- **Methodology.** Measures, binning, MIN_N 10 / SMALL_N 30, the "tend to" pattern rule and the weights are
  unchanged. The new rule is D2 exactly.
- **No new dependencies** (Python or npm).
- **Performance.** Static site. First load ≤ 155 KiB of gzip response bodies (149.8 now; `firstload.mjs`). CLS < 0.1.
  Reduced motion honored.
- **Addresses keep working:** `#/explore?…` (with `&check=age`), `#/patterns?…`, `#/methodology`,
  `#/methodology/<section>`.
- **Tests and build pass at every commit:**
  * `npm test` and `npm run build` in `site/`;
  * `.venv/bin/python -m pytest tests/test_stage2_site_data.py`.

## 1. Data: `genres/<included>.json`

### 1.1 Which characteristics, and their kind

All characteristics in `meta.variables`, minus `pub_month` and `pub_weekday` (D5; a `GENRE_PAGE_EXCLUDED` constant in
`wording.py`). Each gets one kind, decided from `make_bins`:

| Kind | When | Today |
|---|---|---|
| `bin` | `bins.binary` | 13 |
| `grp` | levels, not ordered, not binary (`desc_pov`, `pov_class`, `narr_tense_class`, `gender_composition`) | 4 |
| `band` | levels, ordered (`ORDINAL_LEVELS`: the author's number of stories, the five "peaks" fifths) | 6 |
| `zero` | ranges with `bins.zero` (the "None" group, `ZERO_BIN_SHARE`) | 45 |
| `num` | every other range characteristic | 117 |

The total is 185. Skip the combinations that `subsetConflict` forbids (word count × the Length options; publication
year and years online × the Published options): those characteristics are absent from those files.

### 1.2 Format

The file is compact JSON. Every per-genre array follows `genres`. `null` marks a genre with fewer than MIN_N stories
with the characteristic in this option.

```jsonc
{
  "s": "all",                                    // the "Only include" option
  "rule": {"min_r": 0.2, "z": 3.29, "min_tvd": 0.2, "min_n": 30},
  "genres": ["all", "anal-sex-stories", …],      // meta.genres order
  "n": [8996, 300, …],                           // stories per genre in this option
  "age": [9.3, 11.8, …],                         // median age_years per genre (weighted for "all"), 1 decimal
  "c": {
    "story_words": {
      "k": "num", "fmt": "num",                  // fmt: "num" | "percent" | "year"
      "q": [[8987, 1270, 2050, 3610, 6320, 10900], // all genres: n, p10, p25, median, p75, p90
            [300, 1650, 2580, 4420], …],          // each genre: n, p25, median, p75
      "r": [null, -0.21, …],                     // vs all genres; null for "all" and for n < 30
      "f": [0, -1, …]                            // +1 clearly higher, -1 clearly lower, 0 neither
    },
    "rel_romance_per_1k": {
      "k": "zero", "fmt": "num",
      "q": […as num…],
      "z": [[3811, 0.434, 0.227, 0.422, 0.768], …], // stories above 0, their share, then p25, median, p75 among them
                                                   // (quartiles left out when fewer than 10 stories are above 0)
      "r": […], "f": […] },
    "pov_is_first_person": { "k": "bin", "q": [[8447, 0.571], [283, 0.72], …], "r": […], "f": […] },
    "pov_class": { "k": "grp", "q": [[8983, 0.553, 0.001, 0.022, 0.416, 0.008], …],  // n, then a share per group
                   "r": [null, 0.16, …],                                              // total variation distance
                   "f": [0, 0, …] },                                                  // 1 = a different mix
    "author_stories_count": { "k": "band", "q": [[n, share, …], …], "r": […], "f": […] }  // bands: r and ±1 as num
  }
}
```

**Rounding**
* Quartiles and deciles use `sig(x, 3)`, except `fmt: "year"` (`pub_year`), which is a whole number. `sig(2013, 3)`
  gives 2010, which is wrong.
* Shares: 3 decimals. r and the total variation distance: 2 decimals. Ages: 1 decimal.

**fmt**
* `"percent"` when `make_bins` would use its percent style (kind `share`, or a unit starting with "share" or
  "position").
* `"year"` for `pub_year`.
* `"num"` otherwise.

### 1.3 Statistics

* **Weights.** Genre rows: every story weighs the same. All genres: `sampling_weight`. This is the same as the
  `v/` files. Quartiles come from `weighted_quantiles`.
* **num, zero, band, bin:**
  * r = 2 · `weighted_auc(x_genre, ones, x_all, w_all)` − 1, on the raw values. For bin this equals the difference in
    shares.
  * SE = `rank_biserial_se(n_genre, effective_n(w_all))`, the same null standard error the binary patterns use.
  * f = sign(r) when n_genre ≥ 30, |r| ≥ 0.20 and |r| / SE ≥ 3.29; otherwise 0.
* **grp:**
  * tvd = ½ Σ |p_genre − p_all|.
  * chi² = n_genre · Σ (p_genre − p_all)² / p_all, after pooling the groups whose all-genres share is under 1% into
    one.
  * f = 1 when n_genre ≥ 30, tvd ≥ 0.20 and chi² exceeds the 99.9% critical value for (groups − 1) degrees of freedom.
    Hard-code the table (df 1–6: 10.828, 13.816, 16.266, 18.467, 20.515, 22.458), since there is no scipy.
* **zero:** the `z` cells use the stories with a value above 0 (weighted for all genres, as above).
* Implementation: put the constants next to the pattern constants in `site_data.py` (`GENRE_MIN_R = 0.20`,
  `GENRE_Z = 3.29`, `GENRE_MIN_TVD = 0.20`). Use one task per characteristic in the existing process pool, and write
  one file per option after the `v/` files and `patterns.json`. Update the module docstring's "Output" list.

### 1.4 meta.json additions (nothing else changes in meta)

* `"genre_rule": {"min_r": 0.2, "level": 0.999, "min_tvd": 0.2, "min_n": 30}`.
* `more_word` / `less_word` on the 20 variables in the D10 table ("Copy"), from a new `DIRECTION_WORDS` map in
  `wording.py`.
* Run `python -m litcorr site-data` and regenerate the fixtures
  (`python -m litcorr.stage2.synthetic site/src/test/fixtures/aggregates`).
* `git diff` must show `meta.json`, the new `genres/` files and the fixtures. No `v/` file or `patterns.json` may
  change. If one does, find out why before going on.

### 1.5 Python tests (add to `tests/test_stage2_site_data.py`)

* One `genres/<id>.json` per subset, and only the allowed file families exist under `aggregates/`.
* Arrays have the length of `genres`; non-null cells have n ≥ 10; p25 ≤ median ≤ p75; shares in 0–1 and summing to
  1 (±0.002) for grp and band.
* `f` ≠ 0 only where n ≥ 30 and the thresholds hold, and every such pair has f ≠ 0. Check this against a direct
  recomputation for a few characteristics on the synthetic handoff.
* The All genres quartiles match a direct weighted computation.
* `pub_year` quartiles are whole years and are not rounded to the decade.
* Excluded characteristics and the `subsetConflict` combinations are absent.
* Each file is ≤ 60 KB gzip (the real files should be about 47 KB). The output is deterministic (build twice and
  compare). The builder reads no story-level fields beyond the characteristic, the genre, the weight and the age.

### 1.6 Acceptance numbers (real data, all stories; from `gp_rule.py`)

* 185 characteristics: num 117, zero 45, bin 13, band 6, grp 4.
* 5,547 genre × characteristic pairs with n ≥ 30. **922 clearly differ.** Per genre: min 0, median 22, max 116.
* Romance 28 (18 lower, 10 higher; largest: sexual language, sentences with sexual language, sexual-action terms).
* Fetish 0, How To 116, Reviews & Essays 115, Erotic Couplings 10, Anal 28.
* Story length in words: 8 genres. Lower: Reviews & Essays, How To, Letters & Transcripts, Toys & Masturbation,
  Humor & Satire, Crossdressing, Anal. Higher: Novels and Novellas.
* First-person narration: 9 genres. Narrative perspective: 9. Romance language: only Romance.
* Characteristics with no genre flagged: 25.

The proposal's appendix (930 pairs, median 23) used a different standard error. The numbers above are the ones the
approved rule must reproduce. Report the built numbers in "Finishing"; any difference needs a cause.

## 2. Navigation, routing and the page shell

### 2.1 Masthead (D4, D9)

* **560 px and wider:** Explore · Genres · Patterns · How it works.
* **Below 560 px:** "How it works" leaves the masthead. The footer keeps its "How it works" link, unchanged.
  * Genres and Patterns always show.
  * Explore shows where it fits. Today it is hidden below 400 px (the brand links to Explore).
  * At 400 px, brand + Explore + Genres + Patterns with today's 14 px gaps need about 372 px against 368 px available.
    Move the Explore breakpoint up (or tighten gaps) so that nothing wraps, clips or scrolls at any width from 320 to
    559 px. Measure it; don't trust the estimate.
* Text no smaller than today's 14.5 px. Every link keeps the 52 px tall target.
* The Genres link preloads the page's chunk and prefetches `genres/all.json` on pointer-enter or focus, like Patterns.
  Its address is the last Genres address of this visit, else `#/genres`.

### 2.2 Addresses

```
#/genres                                                        View 1: story length in words, all stories
#/genres?var=sex_terms_per_1k&include=y2020&genre=adult-romance&sort=value   View 1, highlighted genre, sorted
#/genres?view=genre&genre=adult-romance&include=all             View 2
```

`parseHash` / `toHash` / `sanitize` (in `urlState.js`) gain a `genres` page with these rules:
* An unknown `var`, or one not on the page, falls back to `story_words`.
* An invalid or conflicting `include` falls back to `all` (as in Explore).
* `genre` must be a real genre, not `all`. View 1 drops a bad one. View 2 falls back to D8.
* `sort` is kept only when it is `value` and the kind is num, bin or zero.
* `view` is kept only when it is `genre`.

History:
* Control changes use `replaceState`, as in Explore.
* The view switch and the links between the two views use `pushState`, so Back returns.

D8 needs the app to remember the last genre chosen in this visit. That means Explore's genre (when not All genres),
Genres' Highlight and View 2's genre. Keep it in memory only; no storage.

### 2.3 The page shell

* `GenresPage` is lazy (`pages.js`, like Patterns).
* Page title: "Genres · {TITLE}". `data-page="genres"`. The skip link goes to the question sentence.
* The kicker reads "How do the genres’ stories differ? · about 9,000 stories · 30 genres". Use the counts from
  `meta`, as in `Kicker`.
* `loadGenres(include)` and `prefetchGenres(include)` go in `data.js`, using the same cache. The placeholder holds
  the chart's place, so the page doesn't jump. A load error shows `LoadError` with Retry.

## 3. View 1: one characteristic, every genre

From top to bottom, as in the proposal's g01/g02, with the "Copy" wording:

1. **Question sentence**, with the characteristic slot (`CharacteristicPicker`, as in Explore's `Controls`):
   * a popover on wider screens, the `Overlay` sheet on phones;
   * every round-3 no-page-movement rule applies.
   The picker gets:
   * an `exclude` prop (`pub_month`, `pub_weekday`);
   * an optional `onPickMetric` (absent → no measure suggestion);
   * an optional `onPreview` (absent → no `v/` prefetch).
   Explore's behavior must not change.
2. **Controls row**, which wraps on phones:
   * the view switch: a two-option segmented control, a radio group;
   * "Only include" (`InlineSelect`, conflicting options disabled with Explore's wording);
   * "Highlight" (`InlineSelect`: None, then the 30 genres; default None);
   * the D3 sort toggle (segmented, A–Z first), shown for num, bin and zero only.
3. **Heading** with the verdict, then the **takeaway**: the ▲/▼ lists (D10 words), then the All genres line.
4. **Story-age note** when the option is All stories and the genres' median ages (`age`) span 5 years or more:
   * the text, plus the button "Compare stories published 2020 or later";
   * the button is left out when the characteristic conflicts with the Published options.
5. **Legend**, then the **chart**. The chart's forms are below. All genres comes first on its shaded band.
   * A–Z: genres in `meta.genres` order.
   * "By median": descending by median, or by share for bin and by share above 0 for zero; ties A–Z; All genres stays
     first.
   * The highlighted genre gets the accent wash and a semibold label.
6. **Actions:** "Show the numbers" (a table for every form), "Copy link", and "Open in Explore →" (Explore with this
   characteristic, the highlighted genre if any, and this option).

### 3.1 Forms

* **num:** range rows built on `rangeLayout`:
  * capsule from p25 to p75 and a dot at the median;
  * the dashed All genres median line, labeled under the axis ("All genres: 3,610");
  * the median printed in a value column, preceded by ▲ or ▼ when flagged.
  Add to `rangeLayout` an optional per-row `mark` and an option for a side label column on phones: about 116 px,
  labels wrapped to at most two lines. Today's stacked phone mode would make 31 rows of 56 px. Explore's output must
  not change; its tests guard that.
* **bin:** a bar from 0 to the share and a dot at its end; a 0–100% axis; the All genres share as the dashed line.
* **grp:** one 100% bar per genre in the groups' order. Five colors, as in the mock-up: the darkest is the largest
  all-genres group. Percentages are printed inside segments at least 34 px wide. A **dedicated column** for "≠" sits
  between label and bar (the mock-up squeezes it).
* **band:** the same bars with a sequential blue palette in band order, and ▲▼ marks as for num.
* **zero:** the split chart (g07).
  * At 760 px and wider, two plots side by side: "Stories above 0" (a 0–100% bar) and "Among stories above 0"
    (capsule and median dot, with its own scale and ticks). The value column shows the share with ▲▼.
  * Below 760 px, the halves stack: share rows first, then the range rows under a sub-heading. One row per genre
    in each, in the same order.
* **Columns.** Desktop has a "Stories" column in muted ink. On phones, a row's count appears under its label when it
  is below 250. Story counts vary with missing values: first person vs third person is known for only 119 How To
  stories.
* **Small groups.** Groups of fewer than 30 stories (n < 30) are drawn as Explore draws them (hatched bars and hollow
  dots) and are never flagged. Groups of fewer than 10 stories show "Fewer than 10 stories".
* **Row height.** About 30–32 px on desktop. On phones, at least 44 px.

### 3.2 Details and keyboard

Same model as `RangeChart`:
* one tab stop, with ↑/↓, Home and End moving between rows;
* the focused or hovered row shows its details: a card on wider screens, the K1 line under the chart below 560 px;
* a tap keeps the details and a second tap closes them; Escape hides them.

The details hold the numbers, the comparison with all genres and the link "What stands out about stories in {genre}? →".
The link opens View 2 with `pushState`.

Extract the shared interaction from `RangeChart` (for example a `useRowDetails` hook) rather than copying it. Explore
keeps its behavior and tests.

### 3.3 Accessibility

* Each row's accessible name holds all of its numbers and the comparison (see "Copy").
* The marks are text (▲ ▼ ≠), never color alone. Forced colors keep the marks, the bars' outlines and the highlight.
* The heading and takeaway are announced in a polite live region when the characteristic, option or sort changes.

## 4. View 2: one genre, what stands out

As in g03/g04, with the "Copy" wording:

1. **Question:** "What stands out about stories in [genre ▾]?" The genre slot is an `InlineSelect` with the 30 genres.
2. **Controls:** the view switch and "Only include". No highlight and no sort.
3. **Heading** and **takeaway:** the three largest |r|, as "noun (word)".
4. **Story-age note** when the genre's median age and all genres' differ by 3 years or more, with the same button.
5. **Legend**, then the **lists**:
   * "Lower in {genre} than in all genres" and "Higher in {genre} than in all genres". Each is ordered by |r|, shows 7
     rows, then a "Show all {n}" / "Show fewer" button (`aria-expanded`).
   * "A different mix": the flagged grp characteristics, all shown.
   * Empty lists are left out.
6. **"Every characteristic, by topic":** the topics folded, in `meta.topics` order, each summary saying
   "{k} of {n} stand out" or "{n} characteristics".
   * Rows are rendered only when a topic is opened.
   * Inside a topic, rows follow the topic's own order.

**Rows** are links to View 1 for that characteristic with this genre highlighted (`pushState`). Each has a label, a
plot and a values text, so there is one tab stop per row. Each row has its own scale (all-genres p10–p90, widened to
the genre's interquartile range, starting at 0 when near it) and no tick labels.
* num: gray all-genres IQR band with a median tick, plus the genre's IQR capsule and median dot. Values: "7.79 · all
  19.3".
* bin: the all-genres share as a gray bar from 0, and the genre's share as a dot. Values: "24% · all 27%".
* zero: as bin, on the share above 0. Values: "73% above 0 · all 43%".
* band: quartiles taken from the cumulative shares, drawn on an evenly spaced band axis. Values: "6–20 · all 2–5".
* grp: two thin 100% bars (genre over all genres). Values name the group with the largest share difference: "Second
  person (you) 55% · all 2%".

**Layout**
* Desktop: the label in a 250 px column and the values at the right.
* Phones: the label on its own line above the plot, the values at the right, rows about 56 px.

**Edge states**
* No stand-outs (Fetish): the 0 heading and its sub-line. The topics stay.
* Fewer than 10 of the genre's stories in this option: the "too few" text and a "Show all stories" button.
* Genres with fewer than 30 stories in this option: their rows carry the small-group styling, and nothing is flagged.

## 5. Explore and How it works

* **D7.** "Compare all {n} genres →" becomes "See this pattern in every genre →". Update the comments and tests that
  name it.
* **Keep exploring** (`Explorer.jsx`) gets one item after "Every clear pattern …":
  * when a genre other than All genres is selected: "What stands out about stories in {genre}? →" (View 2);
  * otherwise, the View 1 question for the current characteristic: "How do genres differ in {noun}? →", or the yes/no
    form.
  The three example questions follow, unchanged.
* **How it works:**
  * a new section `["genres", "Comparing genres"]` after "When a title says “tend to”", with the text under "Copy";
  * the legend's "how this is decided" links to `#/methodology/genres`;
  * the "In short" list is unchanged.
* **READMEs:**
  * `site/README.md`: pages, files, `loadGenres`;
  * the top `README.md`: `site-data` outputs.

## 6. Copy (approved; US English, so "gray", never "grey"; nothing causal)

Counts and numbers come from the data. Examples use today's data.

| Where | Text |
|---|---|
| Nav | Genres |
| Kicker | How do the genres’ stories differ? · about 9,000 stories · 30 genres |
| View switch | One characteristic · One genre (group label "Compare") |
| Question, View 1 | How do genres differ in **{noun}**? |
| Question, View 1, yes/no | How common are **{yes_subject, first letter lowercase}** in each genre? (e.g. "How common are first-person stories in each genre?") |
| Question, View 2 | What stands out about stories in **{genre}**? |
| Controls | Only include: {option} · Highlight: None / {genre} · A–Z / By median (By share; By share above 0) |
| Heading, View 1 | {k} of 30 genres clearly differ from all genres · 1 of 30 genres clearly differs from all genres · No genre clearly differs from all genres |
| Lists, View 1 | ▲ {More word}: {genres}. ▼ {Less word}: {genres}. (ordered by \|r\|) · grp: ≠ A different mix: {genres}. |
| Default words | num, zero, band: Higher / Lower · yes/no: More common / Less common |
| All genres, num / band | All genres: median **3,610** words, interquartile range 2,050–6,320. Genre medians run from 1,280 to 5,050. (band: the band labels, e.g. "median 2–5") |
| All genres, yes/no | All genres: first-person stories make up **57%** of stories. Genres run from 27% to 99%. |
| All genres, zero | All genres: **43%** of stories are above 0; among those, median 0.422 per 1,000 words, interquartile range 0.227–0.768. |
| All genres, grp | All genres: First person (I) 55%, First person plural (we) 0.1%, Second person (you) 2%, Third person 42%, Mixed 1%. |
| Units | Add the unit after a number when it is a plain unit (words, per 1,000 words, letters, names …): the first half of `unitNote`'s test in `wording.js` (no parentheses; not share, yes/no, "1 =", position or year), **without** its check for a unit the noun already names, so story length still reads "3,610 words". Never for percentages, years or scales. |
| Age note, View 1 | **Story age.** The genres’ stories were published at different times: their median age runs from 4.7 to 19.5 years. [Compare stories published 2020 or later] |
| Age note, View 2 | **Story age.** Stories in Chain Stories have a median age of 19.5 years; stories in all genres, 9.3 years. [Compare stories published 2020 or later] |
| Legend, num | Median · Interquartile range · Median of all genres · ▲▼ Clearly higher or lower than all genres (how this is decided) |
| Legend, yes/no | Share of stories · All genres · ▲▼ Clearly more or less common than in all genres (how this is decided) |
| Legend, zero | Share of stories above 0 · Median and interquartile range among stories above 0 · ▲▼ … (as num) |
| Legend, grp / band | the group swatches · ≠ A clearly different mix (how this is decided); band: ▲▼ as num |
| Zero chart headings | Stories above 0 · Among stories above 0 ({unit}) |
| Row name, View 1 | Romance: median 4,390 words, interquartile range 2,250–8,150, 300 stories, median age 10.7 years, no clear difference from all genres (flagged: "clearly lower than all genres" or the D10 word, e.g. "clearly shorter than all genres") |
| Details line (phones) | **Romance** median 4,390 words · interquartile range 2,250–8,150 · 300 stories · median age 10.7 years. What stands out about stories in Romance? → *Tap again to close.* |
| Details card | Median · Interquartile range · Stories · Median age · Compared with all genres: Clearly shorter / No clear difference · What stands out about stories in Romance? → |
| Table columns | Genre · Stories · Median · Interquartile range · Median age · Compared with all genres (yes/no: Share; zero: Above 0 · Median above 0 · Interquartile range above 0; grp/band: one column per group) |
| Actions | Show the numbers / Hide the numbers · Copy link · Open in Explore → (name: "Open {label} in Explore") |
| Small genre | Fewer than 10 stories |
| Heading, View 2 | 28 characteristics clearly set Romance apart from all genres · 1 characteristic clearly sets {genre} apart from all genres · No characteristic clearly sets Fetish apart from all genres |
| Sub-line, 0 | Its stories are close to those of all genres on each of the 185 characteristics. |
| Takeaway, View 2 | Biggest differences: sexual language (less), the share of sentences with sexual language (lower), sexual-action terms (less). Use the nouns, with the D10 word lowercased when there is one; yes/no: more common / less common; grp: different mix. |
| Lists, View 2 | Lower in Romance than in all genres · Higher in Romance than in all genres · A different mix · counts "18 characteristics" (phones: "18") · Show all 18 / Show fewer |
| Topics, View 2 | Every characteristic, by topic · "9 of 27 stand out" / "13 characteristics" |
| Row values, View 2 | 7.79 · all 19.3 · 24% · all 27% · 73% above 0 · all 43% · 6–20 · all 2–5 · Second person (you) 55% · all 2% |
| Row name, View 2 | Sexual language: Romance median 7.79 per 1,000 words, interquartile range …; all genres median 19.3, interquartile range …; clearly lower. Opens every genre’s numbers. |
| Too few, View 2 | Fewer than 10 stories in {genre} match “{option}”: too few to compare. [Show all stories] |
| Explore button (D7) | See this pattern in every genre → |
| Keep exploring | What stands out about stories in Romance? → · How do genres differ in story length in words? → |
| How it works, "Comparing genres" | See below |

**D10 words (more / less):**

| Characteristic | More | Less |
|---|---|---|
| story_words | Longer | Shorter |
| dlg_word_share | More dialogue | Less dialogue |
| sex_terms_per_1k | More | Less |
| sex_words_before_first | Later | Sooner |
| emo_balance | More positive | Less positive |
| read_flesch_reading_ease | Easier | Harder |
| reader_address_per_1k | More | Less |
| pub_year | Newer | Older |
| age_years | Older | Newer |
| pace_sex_shift | Builds up more | Builds up less |
| pace_sex_late | More | Less |
| sex_anatomy_per_1k | More | Less |
| sex_action_per_1k | More | Less |
| char_recurring_names | More | Fewer |
| sex_first_scene_position | Later | Earlier |
| sex_other_per_1k | More | Less |
| read_mean_word_chars | Longer words | Shorter words |
| sex_scenes_per_10k | More | Fewer |
| rel_romance_per_1k | More | Less |
| style_profanity_per_1k | More | Less |

**How it works, "Comparing genres":**

> The Genres page compares each genre’s stories with the stories of all genres. All genres counts each genre by its
> size on Literotica, as everywhere on this site. Each genre is a random sample of about {300} stories.
>
> A genre clearly differs on a characteristic when, picking one of its stories and one story from all genres at
> random, its story is the higher one at least 60 times in 100, or the lower one at least 60 times in 100 (ties count
> as half; this is a rank-biserial correlation of at least 0.2). For yes/no characteristics this means a gap of at
> least 20 percentage points. For characteristics with named groups, such as narrative perspective, at least 20% of
> the genre’s stories would have to change group to match the mix of all genres. The page makes thousands of such
> comparisons, so a difference must also be clear at the 99.9% level, stricter than the 99% used for “tend to”, and
> the genre needs at least {30} stories with the characteristic.
>
> When most stories score 0 on a characteristic, the page shows how many stories are above 0, and the median and
> interquartile range among them. Publication month and weekday are left out: their twelve and seven groups can’t be
> compared genre by genre in one chart.

"About {300}": the median of the genres' `n`, rounded to the nearest 10. Add no new literal 300 anywhere.

**Grammar.** Many nouns are plural ("anatomical terms", "sex scenes"), which is why the View 1 question and heading
put the genres, not the characteristic, in the subject. Genre names such as "Chain Stories" and "Reviews & Essays" are
why View 2 says "stories in {genre}" rather than "{genre} stories" (the proposal's wording). If a generated
sentence still reads badly for some characteristic, fix it with the data's existing fields (`noun`, `label`, `yes_subject`) and record it as a judgment
call. Don't invent new per-characteristic text beyond D10.

## 7. Work plan

Create the branch `genres-page` from `main`. Commit in the repository's style ("Stage 2 genres page: …"). Don't push.
Never commit `.claude/` or `Claude outputs/`. The owner has approved letting git delete its lock files (request
deletion permission for the project folder if your environment asks).

1. **The proposal:** commit `docs/stage2/GENRES_PAGE_PROPOSAL.md` and `docs/stage2/genres-page/g01–g08.png` as they
   are.
2. **Data** (§1):
   * do the wording constants, the builder, the meta additions and the Python tests;
   * run `site-data` and regenerate the fixtures;
   * check §1.6 and the file sizes.
3. **Shell** (§2):
   * routing and `sanitize`, the masthead (D4) with its measurements at 320–1440 px, the lazy page, the loading and
     error states;
   * front-end tests for addresses, sanitize and the masthead.
4. **View 1, num and bin** (§3):
   * heading, lists, age note, sort (D3), details, the table;
   * `rangeLayout` options with Explore unchanged.
5. **View 1, grp, band and zero** (§3.1).
6. **View 2** (§4).
7. **Explore and How it works** (§5), and the READMEs.

After each step:
* the three test commands and the build;
* a look at 320, 375, 768 and 1440 px: no horizontal scroll, no overlapping text, everything usable by mouse, touch
  and keyboard.

**Front-end tests to add** (vitest, using the fixtures):
* addresses, round trip and sanitize;
* kind → form;
* headings and lists for 0 / 1 / k;
* D10 words and their defaults;
* sort order with All genres first;
* ▲▼≠ rendered and named;
* the age note's conditions;
* details and keyboard;
* the table for every form;
* View 2: ordering, "Show all", the 0 state, the too-few state, links to View 1;
* the D8 default (remembered genre, else largest `size`);
* Keep exploring's new item;
* the D7 wording;
* the How it works section;
* the lazy chunk;
* the banned-word and US-spelling scans covering the new files.

## 8. Finishing

1. **Measure** with copies of the tools (add new scripts to the tools folder, not the repository):
   * `firstload.mjs` (≤ 155 KiB; report the Genres chunk and the `genres/all.json` sizes);
   * `axe.mjs` on at least six Genres addresses covering every form and View 2 (expect none);
   * a `labels`-style overlap check of every form for every characteristic at 320, 375, 768 and 1440 px: no
     overlapping text, nothing outside the chart;
   * the masthead at 320, 360, 375, 390, 400, 414, 430, 480, 559, 560, 768 and 1440 px: no wrap or overflow;
   * `taps.mjs` on the Genres page and the masthead;
   * `snap3.mjs`, extended to the Genres pickers (0 px of page movement);
   * `forced.mjs` (light and dark);
   * the height of View 1 and View 2 at 375 and 1440 px.
2. **Screenshots** (small and palette-compressed, like the review's) as `docs/stage2/genres-page/b01-….png`:
   * View 1 for num, yes/no, grp and zero at 1440 px, and num at 375 px;
   * View 1 sorted;
   * View 2 at 1440 and 375 px;
   * the masthead at 375 and 560 px;
   * Explore's new Keep exploring item.
3. **Write up.** Add **"13. As built"** to `GENRES_PAGE_PROPOSAL.md` with:
   * the commits;
   * the §1.6 numbers as built, and any differences with their causes;
   * the measurements and the screenshots;
   * *Judgment calls* (one line of reasoning each);
   * *Still open*.
4. **Final run** of the three test commands and the build; commit; don't push. Summarize for the owner in a few lines.

## Checkpoints: stop and ask before

- Changing the D2 rule, its thresholds or its reference group, or shipping any field or file beyond §1.
- Built numbers that differ from §1.6 without a cause you can name.
- Going over 155 KiB on first load, or over 60 KB gzip for a genres file.
- Wording beyond "Copy", except grammar fixes made from existing fields (recorded as judgment calls).
- Anything that touches the rules above: data shipped, interpretation, methodology, dependencies, fonts, external
  requests.
