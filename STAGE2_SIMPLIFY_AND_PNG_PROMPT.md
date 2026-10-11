# Stage 2: simplify Explore and the Genres page, and download a chart as a PNG

You are working in the `Literotica_Correlations` project, on its Stage 2 website (`site/`, a static React + Vite
app). `main` is at `692939e` (the Genres page review, merged; same as `origin/main`). Make a new branch,
`simplify-png`, from it. Commit as you go and don't push.

The owner wants a simpler site with fewer notes, panels and buttons, plus a way to share a chart as an image. Most of
this round removes things. Delete the code, styles, tests and copy that go with each removed feature, so nothing is
left behind. Then add one new feature, "Download PNG".

Where this prompt leaves a detail open, decide, implement it, and record it under *Judgment calls* (see
"Finishing"). Stop only for the things under "Checkpoints".

## Read first

1. `site/README.md`, all of it: the lazy-parts table, the first-load budget, the file map and the design notes.
2. The code this round touches:
   - Explore: `components/Explorer.jsx`, `ChartNotes.jsx`, `RangeChart.jsx`, `Controls.jsx`, `AgeCheck.jsx`,
     `AgeCheckCharts.jsx`, `NumbersTable.jsx`, `CompareGrid.jsx`, `CompareTable.jsx`, `CopyLink.jsx`;
     `lib/wording.js`, `lib/compare.js`, `lib/ageLayout.js`, `lib/urlState.js`, `lib/data.js`, `lib/format.js`.
   - The Genres page: `components/GenresPage.jsx`, `GenreAnswer.jsx`, `GenreProfile.jsx`, `GenreTable.jsx`,
     `GenreChart.jsx`, `GenreMix.jsx`, `GenreAny.jsx`, `GenreDetails.jsx`, `GenreGlide.jsx`, `useRowDetails.js`;
     `lib/genres.js`, `genres.css`.
   - `App.jsx`, `Methodology.jsx`, `styles.css`, `vite.config.js` (its `LAZY` pattern).
   - `site/src/test/`, and `litcorr/stage2/wording.py` (`FEATURED`).

## The owner's decisions

| # | Change | Decision |
|---|---|---|
| 1 | Explore: the "Story age." box and the "Stories of similar age" charts | **Remove both.** Keep the separate totals box ("Totals grow with time online.", with "Switch to …") |
| 2 | Explore: median age in a group's details | **Remove** |
| 3 | Genres page: the "Story age." note | **Remove** from both views |
| 4 | Genres page: median age in a genre's details | **Remove** |
| 5 | "Show the numbers" and its table | **Remove** on Explore, "One characteristic" and "One genre" |
| 6 | Explore: "See this pattern in every genre" | **Remove**, with the whole compare mode behind it |
| 7 | "Copy link" | **Replace with "Download PNG"** on Explore and "One characteristic". **"One genre" keeps "Copy link"** |
| 8 | Genres page: the "Highlight:" menu | **Remove it, and highlighting itself (idea I9).** Without the menu, a highlight that arrived by link couldn't be cleared |
| 9 | What the PNG holds | **Title, subtitle and key, then the chart**, with the credit line at the bottom right |
| 10 | Git lock files | git may delete its lock files. If your environment asks, request deletion permission for the project folder |

## The changes

### 1. Explore: no story-age box, no similar-age charts

- In `lib/wording.js`, remove `ageNotes`' `kind: "groups"` note. In `ChartNotes.jsx`, remove its box and the
  "Check stories of similar age" button. Remove `endGroups` too if nothing else uses it.
- Delete the panel and its chart: `AgeCheck.jsx`, `AgeCheckCharts.jsx` and `lib/ageLayout.js`, with their styles
  (`.age-check`, `.age-ph` …) and their entries in `vite.config.js`'s `LAZY`. Also delete the focus plumbing in
  `Explorer.jsx`: `ageCheckAsked`, `ageButton`, `focusAgeButton`, `checkAge`, `closeAgeCheck` and `ageCheckOpen`.
- Drop `check` from the address (`PARAMS` and `sanitize`). An old link with `check=age` opens the same chart with no
  panel, and the address it settles on has no `check`.
- **Keep the totals box and its switch** (decision 1).

### 2. Explore: no median age in a group's details

In `RangeChart.jsx`, remove median age from:

- the tooltip card (`Median age`);
- the phone's details line;
- the row's accessible name (`rowDetails`).

Median, interquartile range, mean and stories stay.

### 3. Genres page: no story-age note

Remove the "Story age." paragraph from "One characteristic" and "One genre", along with its "Compare stories published
2020 or later" button. That covers `AgeNote`, `RECENT`, `ageSpread`, `ageNoteText`, `genreAgeNote`,
`AGE_CHARACTERISTICS`, their call sites and their styles. Keep the focus-to-heading logic (`switchFromAnswer`) only as
far as "Show all stories" and Try again still need it.

### 4. Genres page: no median age in a genre's details

In `lib/genres.js`, `rowDetails` drops the "Median age" item and "median age …" from `name` and `line`. That covers
the details card, the phone's details line and the rows' accessible names for every form.

### 5. No "Show the numbers" anywhere

Remove the button and its table from:

- Explore (`NumbersTable.jsx`);
- "One characteristic" (`GenreTable.jsx`);
- "One genre" (`ProfileTable` in `GenreProfile.jsx`).

Once nothing uses them, also delete:

- `useScrollBox`;
- the table-only helpers (`profileTableCells`, `formatYears`, `formatAge` …; check each one);
- the `.numbers…` styles that no longer have an element.

The rows' accessible names keep every number they carry today except median age. Screen readers still reach the
numbers through each chart's single tab stop.

### 6. Explore: no comparing genres

Remove "See this pattern in every genre →" and the whole compare mode behind it:

- Delete `CompareGrid.jsx`, `CompareTable.jsx`, `lib/compare.js`, `CompareGridPlaceholder`, `TotalsBox` (compare
  mode's own totals box) and the `.compare-*` styles, and remove their entries from `LAZY`.
- Remove the compare branches from:
  - `describeView`, `sameView`, `genresQuestion` and `KeepExploring`;
  - `Controls.jsx`: "Genre by genre, …", "← Back to one genre" and the question bar's "Genre by genre";
  - the `compare` arguments in `lib/wording.js` (`chartTitle`, `patternNote`, `subtitleParts`, `questionText`).
- `mode` in the address: an old link with `mode=compare` opens the one-genre chart for the genre it carries, or All
  genres if it carries none. Keeping or dropping the `mode` parameter is your call, recorded as a judgment call. Links
  already shared carry `mode=one`, so every old link must still open.
- The example question "Does present-tense narration look the same in every genre?" opens compare mode. Delete it from
  `FEATURED` in `litcorr/stage2/wording.py` and rebuild `meta.json` (see "Data").

### 7. "Download PNG" instead of "Copy link"

On Explore and on "One characteristic", the "Copy link" button becomes **Download PNG**, which saves the chart on
screen as a PNG file (spec below).

- Explore's actions row is just Download PNG.
- "One characteristic"'s actions row is Download PNG, then "Open in Explore →".
- "One genre" keeps "Copy link" (decision 7), so `CopyLink.jsx` stays.

### 8. Genres page: no highlighted genre

- Remove the "Highlight:" menu from `GenresPage.jsx`.
- Remove the repeated row under All genres and its band:
  - `REPEAT` and `withRepeat`;
  - the `highlight` prop of `GenreChart`, `GenreMix` and `GenreAny`;
  - the repeat handling in `useRowDetails` and `GenreGlide`;
  - the `.highlight`, `.repeat` and `.band-highlight` styles.

  All genres' own band stays.
- "One characteristic"'s address loses `genre`: `sanitizeGenres` drops it and `toHash` stops writing it, so an old
  link with `genre=…` opens the plain chart.
- Links into "One characteristic" carry no genre: neither "One genre"'s rows nor the view switch back.
- The view switch to "One genre" opens the remembered genre, or else the default (D8), as it does today when no genre
  is highlighted.
- "Open in Explore →" opens All genres.

## The PNG

**What it holds, top to bottom, on white**

Explore:

1. **Title:** the chart's full title (`d.title`). When the answer heading (`d.answer`) says something else ("No clear
   pattern", "Each group on its own" …), it follows on its own line. This is the same pair screen readers hear
   (`announcement`).
2. **Subtitle:** the line under the heading, as text (`subtitle()`): genre · option · N stories.
3. **The key:** only the entries the chart shows.
4. **The axis lines:** the "Stories grouped by …" line and the measure's axis title.
5. **The chart.**
6. **The small-sample caption:** "* Fewer than 30 stories: worth less trust.", when the chart has it.
7. **The credit.**

"One characteristic":

1. **Title:** the question (`chartQuestionText`), e.g. "How do genres differ in story length?"
2. **Subtitle:** the verdict heading ("8 of 30 genres clearly differ from all genres"), then a line with the option and
   the order line's words: "All stories · Genres in alphabetical order".
3. **The key** (`GenreLegend`), without "(how this is decided)", since a link means nothing in an image.
4. **The chart** for its form, with any line drawn above it (the mostly-zero form's head line, the axis title).
5. **The credit.**

**The credit:** exactly **Chart by Nathan Nguyen, @NathanDNguyen**. It goes at the bottom right, on its own line
below everything else and never over the chart, inside the image's padding, in the small muted sans the site uses for
captions.

**Not in the image:**

- the takeaway, the notes, the buttons and "Keep exploring";
- any hover, focus or tap state: no tooltip, no dimmed rows, no active row;
- a frame mid-glide.

Use the fonts and colors the page itself uses for each element, read from their computed styles. The colors stay
defined in one place, `styles.css`'s variables.

**Size and file**

- Draw the chart as it appears on screen, at its width and in its layout (stacked on phones). Don't lay it out again.
- Always render at 2× pixels, whatever the screen. That keeps the image crisp and under iOS Safari's canvas limit.
  Use about 24 CSS px of padding.
- Build the file name from the view's ids, in lower case:
  - Explore: `explore-<var>-<metric>-<genre>-<include>.png`;
  - "One characteristic": `genres-<var>-<include>.png`.

**The button**

- Visible label "Download PNG". Its accessible name starts with that label: "Download PNG of this chart".
- The same size as Copy link, so there's no layout shift.
- Shown only when a chart is drawn. When there's no chart (too few stories), there's no button.
- It does nothing while the panel is busy (the next file loading).
- Focus stays on the button. If the image can't be made, a polite status beside it says "Couldn’t make the image. Try
  again."
- Its code is a lazy part, fetched when the button is hovered or focused (like the picker), so the first load doesn't
  grow. Add the module to `LAZY` and to the README's lazy-parts table.
- It works in Chrome, Firefox and Safari, on desktop and phone. If iOS Safari opens the image instead of saving it,
  that's acceptable.

**How (recommended, with no new dependency)**

- **Compose on a `<canvas>`.** Draw the text with the 2D API, wrapped to the image width, after
  `document.fonts.ready`.
- **Draw the chart from its live `<svg>`:**
  - clone it;
  - inline each element's computed paint and text styles: fill, stroke, stroke width and dash, opacity, font,
    text-anchor and any CSS transform;
  - strip the state classes (`has-active`, `active`, `gliding`);
  - keep `<defs>` (the hatch pattern);
  - serialize it to a Blob and draw that as an image.

  Don't use `<foreignObject>`: it taints the canvas in Safari.
- **Draw the key's swatches** with canvas primitives, in colors read from the live swatches' computed styles.
- **Save the file:** `canvas.toBlob` → object URL → a temporary `<a download>` → revoke the URL.

If this route can't draw a form faithfully, stop and ask before adding a library (see "Checkpoints").

## Copy (approved)

- The button: "Download PNG". Its accessible name: "Download PNG of this chart". Its failure message: "Couldn’t make
  the image. Try again."
- The credit: "Chart by Nathan Nguyen, @NathanDNguyen"
- How it works, "Story age": the last sentence becomes "That is why the site offers views per month alongside raw
  views, warns when a measure is a total that grows with time online, and lets you look at stories published in the
  same period with “Only include”."
- How it works, "How the charts summarize stories": the last two sentences become "For each group the charts show the
  median, the interquartile range and the number of stories. The mean (which a few very popular stories can pull up)
  is in each group’s details."
- The README's design note "Story age is never hidden: …" becomes "Story age: totals carry a warning with a switch to
  a per-month or per-1,000-views measure, and “Only include” can limit any chart to stories published in one period."
  Delete the README's sentence "A highlighted genre's second row under All genres is for the eye only."

Some sentences on the site or in the README will still mention a removed feature. Grep for "median age", "similar
age", "story-age", "Show the numbers", "Copy link", "every genre", "genre by genre", "side by side" and "highlight".
Fix each one in as few words as possible and list it as a judgment call. Update code comments that describe removed
behavior.

## Rules that still hold

- **No network access to Literotica.** Never open literotica.com with any tool.
- **Wording:**
  - no causal language;
  - no notes about chance, and no reminders that correlation is not causation;
  - the banned-word and US-spelling scans cover every new string.
- **Sample sizes stay visible:** the subtitle's count, the rows' counts, the small-sample hatching, and all three in
  the PNG.
- **Order:** genres are A–Z by default. The order toggle (D3) is the only other order.
- **The story-age rule changes this round (decisions 1–4).** The story-age notes and the similar-age check are gone
  from both pages, and median age is no longer shown anywhere. What remains: the totals box on Explore with its
  switch, and the "Published …" options under "Only include".
- **No external requests.** Nothing leaves the browser to make the PNG.
- **Budget:** the first load stays at or under 155 KiB gzip, with no layout shift of 0.1 or more.
- **Keyboard:** each chart stays one tab stop.

## Data

- No new fields or files, and no format changes. Each cell's median age stays in the files even though the site no
  longer shows it. List that under *Still open*: a later round could drop it to shrink the files.
- `data/` is read-only. Never run `probe`, `collect`, `process` or `export-handoff`.
- After editing `FEATURED`, run `python -m litcorr site-data` (offline) once, then
  `python -m litcorr.stage2.synthetic site/src/test/fixtures/aggregates`. `git diff` must show only `meta.json` (the
  real one and the fixtures'). If anything else changes, find out why before going on. Check
  `tests/test_stage2_site_data.py` for assertions on `FEATURED`.

## Tests (Vitest, with the fixtures)

- Delete the tests of removed features: `ageCheck.test.jsx`, `compare.test.js`, and the parts of other files about
  numbers tables, compare mode, highlighting, and Copy link on Explore and "One characteristic". Update the tests whose
  words or layout changed. Each commit message lists the tests it deleted or changed, and why.
- Add tests for each of the following.
  - **Explore:**
    - a fixture view whose end groups differ in age shows no "Story age." box;
    - a totals measure still shows its box and its switch;
    - there's no "Check stories of similar age";
    - links with `check=age` or `mode=compare` open the plain chart, and the address it settles on has neither;
    - `toHash` never writes `check` or `compare`.
  - **No median age:** none in Explore's tooltip, phone line or row names, and none in the Genres page's card, phone
    line or row names, for each form.
  - **No numbers tables:** no "Show the numbers" or "Hide the numbers" button and no numbers table on Explore, "One
    characteristic" or "One genre".
  - **No compare mode:**
    - no "See this pattern in every genre" and no "Genre by genre" anywhere;
    - no featured question with `mode: "compare"`.
  - **Genres page highlighting:**
    - there's no Highlight menu;
    - `#/genres?var=story_words&genre=adult-romance` draws no repeated row, and its address loses `genre`;
    - "One genre"'s rows link without `genre`;
    - the view switch still opens the remembered genre.
  - **Buttons:** Download PNG appears on Explore and "One characteristic", Copy link appears on "One genre" and nowhere
    else, and Download PNG doesn't appear when no chart is drawn.
  - **The PNG's pure parts:**
    - the title, subtitle, key items and credit the export would draw, for a few fixture views covering every form;
    - the exact credit string;
    - the file names;
    - the button calls the export with the panel's chart (mock the lazy module);
    - the failure message.
- Run `cd site && npm test`, `npm run build` and `python -m pytest`.

## Check in a browser

Use this Mac's cached Chromium, as in earlier rounds. The scripts in `Claude outputs/design-review-2-tools/` are
reference: run copies outside the repository, and never import from that folder or commit it.

1. **Each changed view at 375 and 1440 px:**
   - Explore with numbers, yes/no and named groups, plus a totals measure;
   - "One characteristic" in each form: numbers, yes/no, mostly zero, named groups and bands;
   - "One genre".

   Nothing should be left where removed things were: no empty boxes or gaps, and on wide screens the margin notes
   still line up.
2. **The PNG of each of those charts, at both widths.** Open each file and look at it:
   - all the text is there, in the right fonts;
   - nothing is clipped;
   - the colors and hatching are right;
   - the credit sits at the bottom right;
   - the pixel width is 2× the chart's.
3. **Hover state:** hover over a row, then download. The image has no tooltip and no dimming.
4. **The first load:** measure bytes and requests, and update the README's budget line.
5. **WebKit:** if Playwright's WebKit is available, repeat the PNG check there. If it isn't, add "Safari and iOS
   Safari: try Download PNG" under *Still open* for the owner.

## Finishing

1. **Update `site/README.md`:**
   - the opening paragraphs (Explore and the Genres page);
   - the lazy-parts table;
   - the file map (removed files gone, the export module added);
   - the design notes (see "Copy");
   - the budget line.
2. **Commit** in logical steps, roughly one per numbered change. Add this prompt to the last commit as
   `STAGE2_SIMPLIFY_AND_PNG_PROMPT.md`. Don't push.
3. **Summarize for the owner** in a few lines:
   - what changed;
   - the paths of two sample PNGs, one from Explore and one from "One characteristic";
   - *Judgment calls*, one line of reasoning each;
   - *Still open*.

## Checkpoints: stop and ask before

- Adding any dependency, font or external request, including a library for the PNG.
- Any data change beyond the featured question in `meta.json`.
- Any wording beyond "Copy" above, other than the smallest fixes to sentences that mention a removed feature.
- Going over the 155 KiB first-load budget, or a layout shift of 0.1 or more.
- Any change to the Patterns page, or to How it works beyond the sentences above.
