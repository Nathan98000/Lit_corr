# Stage 2 design, round 3: the owner's follow-up changes

You are working in the `Literotica_Correlations` project. Its Stage 2 website (`site/`, a static React + Vite app)
went through two design reviews; the second one's changes are implemented on branch `design-review-2` (last commit
`76ee10f`, "second round's before and after"). The owner has tried the result and wants the seven changes below.
This prompt specifies them. Where it leaves a detail open, decide, implement it and record it under *Judgment calls*
(see "Finishing"). Stop only for the things listed under "Checkpoints".

## Read first

1. `docs/stage2/DESIGN_REVIEW_2.md`, especially its "Before and after" section (what round 2 built), and
   `STAGE2_DESIGN_IMPLEMENTATION_2_PROMPT.md` (round 2's decisions, which still apply unless this prompt changes them).
2. `site/README.md`, everything in `site/src/` and `site/src/test/`, `litcorr/stage2/wording.py`,
   `litcorr/stage2/site_data.py`, `tests/test_stage2_site_data.py`.
3. The measuring scripts in `Claude outputs/design-review-2-tools/` (see its `README.txt`; `snap.mjs` is new and
   measures change 1). Run them from a copy outside the repository; never import from `Claude outputs/` and never
   commit it.

## The seven changes (the owner's decisions)

### 1. Opening the measure menu or the characteristic picker must not move the page

*Diagnosis (measured on the built site, desktop Chromium).* At 1440 × 900 with the page at the top, opening either
menu scrolls the page down 372 px; at 1280 × 720, 552 px (63 px with views as the measure); at 768 × 1024, 538 px. The
page stays there after closing. The cause: `CharacteristicPicker.jsx` and `MetricMenu.jsx` call
`element.scrollIntoView({ block: "nearest" })` on the active option. `scrollIntoView` scrolls **every** scrollable
ancestor, including the window, so while the popover's list is still partly below the screen the whole page jumps to
show the option. The picker also calls `input.focus()` without `preventScroll` when moving between topics.

*Required.*
- Keep the active option visible by scrolling **only the list's own container** (a small helper that adjusts the
  container's `scrollTop` from the option's and the container's boxes). Remove every `scrollIntoView` from the picker,
  the menu and the overlay.
- Every `focus()` in the picker, the menu and `Overlay.jsx` uses `{ preventScroll: true }`, including the return of
  focus to the sentence's word on closing.
- The desktop popover must fit on the screen without scrolling the page: if there is less than 320 px between the
  trigger and the bottom of the screen and more room above, open it above the trigger; cap its height at the space
  available (`min(620px, available − 16px)`), and let its list scroll inside.
- The phone sheet keeps its scroll lock, and the page's scroll position is exactly the same after closing as before
  opening (check the iOS lock from round 2's F57 restores it).
- Choosing a measure or a characteristic must not scroll the page either (the chart below may change height; the
  scroll position stays).
- *Check.* `snap.mjs`: at 375 × 667, 768 × 1024, 1280 × 720 and 1440 × 900, for the measure menu and the picker,
  starting at the top and at 300 px down, on the default view and with `metric=pop_views`: `window.scrollY` is
  unchanged (0 px difference) after opening, after typing "tense", after opening and leaving a topic, after
  Escape and after picking an option. *Tests:* `Element.prototype.scrollIntoView` is never called when either menu
  opens or the active option moves (spy on it), and the list container's `scrollTop` changes instead.

### 2. Make it clear that story length is measured in words

- The default characteristic's noun becomes **"story length in words"** (`wording.py`, the noun map; run
  `python -m litcorr site-data`). The question then reads "In All genres, how does the average rating vary with story
  length in words?" and the neutral titles "How the average rating varies with story length in words across all
  genres".
- For every characteristic, the line that says what the rows are and in what unit ("Stories grouped by story length
  (words).", today a caption under the chart) moves **above the first row**, so the unit is read before the numbers:
  on wider screens as a heading over the label column next to the measure's axis title; on phones as one line between
  the axis title and the ticks (or merged with the axis-title line, if that reads better). Don't repeat a unit the noun
  already names ("story length in words", not "story length in words (words)"). The small-groups note
  ("* Fewer than 30 stories: worth less trust.") may stay under the chart.
- *Check.* At 375 × 667 the default view shows "words" on the first screen, and the first chart row is still on the
  first screen; no new text overlaps (`labels.mjs` at 320 and 375 px).

### 3. A less cluttered "Stories of similar age"

*Now.* Three full charts side by side (stacked on phones), each repeating every group label, a printed value and an
"n = …" per row, the interquartile bars, its own tick labels and an "All stories shown: …" label: 15 labels, 15 values
and 15 counts for a five-group characteristic, about 330 px per period on a phone.

*Required: one aligned chart, three columns.*
- The group labels appear **once**, in a label column on the left. Each period is a column to the right with its own
  heading: the period ("2000–2009", "2010–2019", "2020 or later"; the full "Published …" in the accessible name),
  its number of stories and the existing verdict words ("↗ tends higher", "↘ tends lower", "no clear pattern", "too few
  stories to judge").
- In each column, one **dot per group** at its median: filled for 30 or more stories, hollow for fewer, a short dash
  for fewer than 10. A thin line joins a column's dots for ordered characteristics (like the genre cards). No
  interquartile bars, no printed values, no per-row counts, no "All stories shown" text; each column keeps its dashed
  line for the median of all its stories, explained once in a one-line legend under the section's caption.
- **One shared value scale** for the three columns (as today), with light gridlines and three or four tick labels
  at the top of each column; ratings keep their zoomed axis and its note.
- Details on demand, as on the main chart: hover or focus shows a card on wider screens, a tap shows the details line
  under the section on phones (median, interquartile range, mean, stories, median age, and the period). Keyboard: one
  tab stop per column, ↑/↓ between groups.
- Sample sizes stay visible: each column's heading has its number of stories, hollow dots and dashes mark the small
  groups, and every group's count is in its details and in a visually hidden table (period × group: median, stories)
  that screen readers get instead of the dots.
- Rows about 32 px tall. On phones the three columns stay side by side when each can be at least 72 px wide next to a
  label column of at least 84 px (labels wrap to two lines if needed); below that, stack the periods.
- Keep the section heading, Close and the caption ("The same chart within three publication periods, so the stories
  compared are of similar age."), the scroll-and-focus behavior from round 2 (F37), the shared address
  (`&check=age`) and the lazy loading.
- *Check.* Measure the section's height at 375 and 1440 px for `#/explore?var=story_words&check=age` with ratings,
  with `metric=pop_views`, and for a yes/no characteristic; screenshot before and after. *Tests:* labels rendered once,
  one dot per group per period, hollow and dash states, verdicts in the headings, the hidden table's contents, keyboard
  movement.

### 4. Assume visitors know the median and the interquartile range

Say "median" and "interquartile range" without explaining them, and stop calling the median "the typical story" and
the interquartile range "the middle half" anywhere a visitor can read (charts, legends, details, tables, accessible
names, the takeaway, age boxes, compare mode, Patterns and How it works). Leave other uses of "typical" alone (for
example "not typical readers"). The new wording is in "Copy" below.

### 5. Delete the privacy sentence from the footer

Delete "This site holds summaries of groups of stories only: no story text, titles, authors or story-by-story
records." The footer becomes: "An independent project, not affiliated with or endorsed by Literotica. How it works"
(the last three words a link). How it works keeps its own section "What this site does not contain".

### 6. Average rating is the default measure, and first in the list

- `DEFAULT_METRIC = "pop_rating"` in `wording.py` and the default in `site/src/lib/urlState.js`; the first-paint
  placeholder sentence in `App.jsx` follows ("In All genres, how does the average rating vary with story length in
  words?"). The Patterns page and How it works' "See the chart" links use the same default.
- The **Rating** group comes first: `METRIC_GROUPS = ["Rating", "Per 1,000 views", "Per month online", "Totals so far"]`.
  The measure menu and the Patterns page's measure select follow `metric_groups`. **Do not reorder `meta.metrics`**:
  the aggregate files index the measures by their position in that list. After `site-data`, `git diff` must show only
  `meta.json` (and the fixtures, if regenerated) changing.
- Singular measures need an article in running text: "how **does the average rating** vary", "How **the average rating**
  varies with …", "Clear patterns in All genres with **the** [average rating]", "Every clear pattern with **the** average
  rating across all genres". Add the article wherever `metric.noun` of a singular measure (`plural: false`) starts a
  noun phrase in a sentence; plural measures are unchanged. Read every generated sentence for ratings (one-genre,
  compare, Patterns, Keep exploring, titles) once.
- Shared addresses with an explicit `metric=` keep their measure; an address without one now opens ratings.
- The default chart is now a zoomed rating axis with "Average rating (the axis starts at 3.5)"; check it at all four
  widths. The first load must stay within budget (the first chart file is the same).

### 7. The Patterns page's count line

"**39** of 181 characteristics have a clear pattern with views per month across all genres. The other 142 show no clear
pattern." (numbers from the data; "the average rating" for ratings). Keep the next line, "6 characteristics have no
order (such as month) and are not summed up as a trend.", which explains why the total is 181 and not 187.

## Copy (approved; US English; nothing causal)

| Where | Text |
|---|---|
| Legend | "Median" · "Interquartile range" · "Fewer than 30 stories" · "Median of all stories shown" |
| Takeaway | "Median: **4.19** for “Under 2,000”, **4.65** for “7,000+”." then today's strength or no-pattern sentence; yes/no: "Median: **0.53** for first-person stories, **0.58** for third-person stories." |
| How to read this chart | "Each row is a group of stories. The dot is the group’s median, printed beside it, and the bar is its interquartile range. The dashed line is the median of all stories shown. Hatched bars with hollow dots hold fewer than {small_n} stories and deserve less trust. Groups without an order, such as months, are shown side by side and not summed up as one trend." |
| A row's accessible name | "Under 2,000: median 0.28, interquartile range 0.10–0.66, mean 0.46, 2,708 stories, median age 12 years" |
| Details line (phones) | "**Under 2,000** median 0.28 · interquartile range 0.10–0.66 · mean 0.46 · 2,708 stories · median age 12 years. Tap again to close." |
| Details card (wider screens) and numbers table | "Median", "Interquartile range", "Mean", "Stories", "Median age" |
| Chart summary (screen readers) | "Median from 0.28 for Under 2,000 to 0.89 for 7,000+; 5 groups; 8,987 stories." |
| Age box | "**Story age.** The groups also differ in age: stories in “Under 2,000” have a median age of 12 years, those in “7,000+” 6.9 years. Age goes with popularity too, so it can shape this chart." |
| Compare caption | "Each small chart is one genre. A dot is a group’s median as a multiple of the genre’s median (the dashed line); the shaded band runs from 0.67× to 1.5×. Hollow dots: fewer than 30 stories; a dash: fewer than 10. Genres are in alphabetical order, not ranked. Select a genre for its full chart." |
| Compare cell details | "Romance, Under 2,000: median 0.31 (24 stories), against 0.45 for all Romance stories shown." |
| Patterns key line | "… the higher its median {measure}; ↘ tends lower: the lower. What weak, moderate and strong mean" |
| How it works, In short | "Each group of stories is summarized by its median and interquartile range; groups of fewer than 10 stories are hidden." |
| How it works, How the charts summarize stories | "For each group the charts show the median, the interquartile range, the number of stories and their median age. The mean (which a few very popular stories can pull up) is in each group’s details and in “Show the numbers”." (the rest of the section unchanged, with "typical story" → "median") |
| How it works, When a title says "tend to" | "…and the medians of the lowest and highest groups must differ by at least 10% (or 0.1 stars for ratings)…"; "Even a clear pattern describes the medians; individual stories vary widely." |
| Similar age, legend line | "Dots: each group’s median within the period. Dashed line: the median of all its stories. Hollow dots: fewer than 30 stories; a dash: fewer than 10." |
| Footer | "An independent project, not affiliated with or endorsed by Literotica. How it works" |
| Patterns count line | as in change 7 |
| Question (default) | "In All genres, how does the average rating vary with story length in words?" |

## Rules that still hold

- **No network access to Literotica.** Never open literotica.com with any tool.
- **Data stays private and aggregated.** Only `meta.json`, `v/<characteristic>/<included>.json` and `patterns.json`;
  no new data fields or files; `data/` is read-only; never run `probe`, `collect`, `process` or `export-handoff`. Run
  `python -m litcorr site-data` (offline) after editing `wording.py`, and check that only `meta.json` changes.
- **Interpretation.** No causal language (the banned-word tests stay); "tend to" only through the pattern rule; no
  reminders that correlation is not causation (round 2's decision 1); genres never ranked, patterns never sorted by a
  result; sample sizes and story age visible where they matter; the independence statement stays.
- **Methodology is not design**: measures, binning, minimum group sizes (10 and 30) and the pattern rule are unchanged.
- **No new dependencies**; static site; first load ≤ 155 KiB of gzip response bodies (`firstload.mjs`); CLS < 0.1;
  no "Loading…" flash after the first chart; reduced motion honored.
- **Addresses keep working**: `#/explore?…` (with `&check=age`), `#/patterns?…`, `#/methodology`,
  `#/methodology/<section>`.
- **Tests and build pass at every commit**: `npm test`, `npm run build` (in `site/`) and
  `.venv/bin/python -m pytest tests/test_stage2_site_data.py`. Add tests for each change; update the tests that pin old
  wording or the old default. Add a scan of all visitor text (source and `meta.json`) for "typical story", "typical
  age" and "middle half" that must find nothing.

## Work plan

Stay on `design-review-2` (`git switch design-review-2` if needed). Commit each change separately in the repository's
style ("Stage 2 design: …"); don't push; never commit `.claude/` or `Claude outputs/`. The owner has approved letting
git delete its lock files (request deletion permission for the project folder if your environment asks).

1. **Change 1** (no page movement): the scroll helper, `preventScroll`, the popover's placement; tests; `snap.mjs`.
2. **Changes 5 and 7** (footer, Patterns count line): small copy commits.
3. **Change 4** (median and interquartile range): all visitor text, accessible names, How it works; the text scan test.
4. **Change 6** (ratings first and default) with the article fix for singular measures; `site-data`; tests.
5. **Change 2** (story length in words; the grouping line above the rows); `site-data`; label checks at 320 and 375 px.
6. **Change 3** (similar-age chart): build it, then check it at 320, 375, 768 and 1440 px and at 200% zoom.

After each step: the three test commands, the build, and a look at 320, 375, 768 and 1440 px (no horizontal scroll,
no overlapping text, everything usable by mouse, touch and keyboard).

## Finishing

1. Re-measure: `snap.mjs` (change 1), `firstload.mjs`, the scroll distance to the first chart row at 375 × 667,
   `labels.mjs` (site font and DejaVu Sans), `axe.mjs` (expect no violations), `task2.mjs` (the similar-age check still
   scrolls into view and takes focus), and the similar-age section's height at 375 and 1440 px.
2. Take after screenshots (small, palette-compressed like round 2's) of the default first screen at 375 and 1440 px,
   the open measure menu and picker at 1440 × 900 and 1280 × 720 showing the page did not move, the similar-age section
   before and after, Patterns, and the footer, as `docs/stage2/design-review-2/r3-….png`.
3. Add a section **"Round 3: the owner's follow-up changes"** to `docs/stage2/DESIGN_REVIEW_2.md`: each change with its
   commit and before/after numbers, the screenshots, *Judgment calls* (one line of reasoning each) and *Still open*.
   Update `site/README.md` where it names the default view, the measures' order, the similar-age charts or the
   footer.
4. Final run of the three test commands and the build; commit; don't push. Summarize for the owner in a few lines.

## Checkpoints: stop and ask before

- anything that touches the rules above (data shipped, interpretation, methodology, dependencies, fonts, external
  requests), or reordering `meta.metrics`;
- wording beyond "Copy" and the article fix in change 6;
- going over the 155 KiB first-load budget.
