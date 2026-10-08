# Stage 2 design implementation: build everything the design review proposed

You are working in the `Literotica_Correlations` project. Its Stage 2 website (`site/`, a static React + Vite app)
was reviewed in `docs/stage2/DESIGN_REVIEW.md`. **The owner has approved implementing all of it.** This prompt
records their decisions, gives the specifications, and sets the order of work. Where it leaves a detail open,
make the call yourself, implement it, and record it in a *Judgment calls* list (see "Finishing"). Don't stop to
ask about design details. Do stop for the things listed under "Still off-limits".

## Read first

1. `docs/stage2/DESIGN_REVIEW.md`, all of it, including the screenshots in `docs/stage2/design-review/`
   (`b…` = the site before, `m…` = mock-ups of the proposals). Finding IDs (F1–F36), concept names (B, 2A,
   C2, D2, E1, E2) and idea IDs (I1–I5) below refer to it.
2. `STAGE2_DESIGN_REVIEW_PROMPT.md`: the original brief and hard rules. They still apply, except where the
   decisions below explicitly approve something.
3. `site/README.md`, everything in `site/src/` and `site/src/test/`, `litcorr/stage2/wording.py`,
   `litcorr/stage2/site_data.py`, `litcorr/stage2/synthetic.py`, `tests/test_stage2_site_data.py`.
4. The mock-ups in `Claude outputs/design-review-mockups/` (see its `README.txt` for how to open them).
   `kit.js` holds working reference logic for the new chart (`rangeRows`, `domain`), the genre cards
   (`sparkGrid`) and the repaired table (`heatmap`); `lab.js` holds the page concepts, the takeaway line and
   the notes; `kit.css` the proposed tokens. **Use them as references only:** reimplement properly as React
   components with tests. Never import from `Claude outputs/`, and never commit it. The mock-ups were drawn
   with Linux fallback fonts; the real site will look better.

## The owner's decisions (answers to section 7 of the review)

1. **US English** everywhere a visitor can read it (F20). Dates in US style ("October 1, 2026").
2. **Headline:** "What do popular Literotica stories have in common?" (H1, `<title>`, meta description where it
   fits, README). **Masthead name:** "Story Patterns", held in one constant so it is easy to change. Nav:
   "Explore", "Patterns", "How it works".
3. **Dark mode:** not in this round. Keep colours as CSS variables so it can be added later.
4. **Web font: approved.** Source Serif 4, weight 600, Latin subset, self-hosted, headings only (6.6 in the
   review). This is the only new asset of its kind.
5. **Default view:** unchanged (story length × favorites per 1,000 views, all genres, all stories).
6. **The mean** comes off the chart; it stays in the tooltip and the numbers table (F24).
7. **New and changed wording: approved** as specified in "Copy" below (headline, answer lines, takeaway,
   one-group message, compare summary, mode controls, "Only include", example questions). None of it may be
   causal.
8. **Regrouping into topics** and the 12-item **Popular** list: approved as in 6.2 of the review.
9. **Pattern browser (I4): approved**, including one new aggregate file, under the constraints in "Phase 9".
10. **Concepts:** B (first screen), 2A (picker), C2 (chart), D2 (compare, with D1's table as "Show the
    numbers"), E1 + E2 (notes), plus ideas I1, I2, I3 and I5, and every finding F1–F36.
11. **Git:** work on a new branch `design-review` from `main`; commit each logical change separately; don't
    push. Commit the review (document, screenshots and both Stage 2 prompt files) as the first commit. Never
    commit `.claude/` or `Claude outputs/`.

## Still off-limits (stop and ask, or leave it and note it under "Still open")

- Literotica: never open literotica.com with any tool.
- `data/` is read-only. Never run `probe`, `collect`, `process` or `export-handoff`. You may run
  `python -m litcorr site-data` (offline) after changing `wording.py` or `site_data.py`.
- No story-level data, no data download, no new data fields, and no new aggregate files other than the
  pattern index in Phase 9.
- Don't change the measures, the binning, the minimum group sizes (10 and 30) or the pattern rule
  (thresholds, the 99% level, the 10% gap). How they are presented is fair game.
- No causal language anywhere ("cause", "drive", "make readers", "lead to", "boost", "because of", "effect
  of", "impact", "result in" …). "Tend to" appears only through the existing pattern rule. Genres are never
  ranked or sorted by a result; lists of genres stay alphabetical with All genres first.
- Sample sizes stay visible; story age stays visible where it matters.
- The disclaimer stays word for word: *"The visualizations show descriptive associations in stories on
  Literotica. They do not establish causation, and the stories and users represented on Literotica should not
  be assumed to represent all erotic fiction, readers, or human sexuality."* The statement that the site is
  independent of Literotica stays.
- No new npm dependencies (runtime or dev), CDNs, analytics or external requests. The font is a static file
  served by the site itself. If you want Playwright or similar for checks, run it from a temporary directory
  outside the repository and don't add it to `package.json`.
- Static site, no server; existing shared addresses (`#/explore?mode=…&genre=…&metric=…&var=…&include=…` and
  `#/methodology`) must keep working.

## Quality bar for every phase

- `npm test` and `npm run build` in `site/`, and `python -m pytest tests/test_stage2_site_data.py`, pass at
  every commit. Add tests for every new behaviour; update existing tests to the new UI without losing what
  they checked. If the meta format changes, regenerate the test fixtures with
  `python -m litcorr.stage2.synthetic site/src/test/fixtures/aggregates`.
- After each phase, check the site at **320, 375, 768 and 1440 px** (and 200% zoom on desktop) in a browser:
  no horizontal page scroll, no overlapping text, every control usable by mouse, touch and keyboard. Use the
  views listed in section 2.2 of the review plus whatever the phase adds.
- WCAG 2.1 AA, plus 24 px minimum targets (WCAG 2.2) and 44 px wherever space allows. Every text pair ≥ 4.5:1
  (≥ 3:1 for large text); graphical marks and control boundaries ≥ 3:1.
- Respect `prefers-reduced-motion` everywhere, including in JavaScript.
- Budgets: first load ≤ 155 KB gzipped (it is 126 KB now; the font adds 21.5 KB); JS growth ≤ 25 KB gzipped;
  cumulative layout shift < 0.1; no "Loading…" flash after the first chart.

## Design tokens and type

Start from `kit.css` in the mock-ups. In `site/src/styles.css`:

- Keep `--bg #fbfaf7`, `--paper #fff`, `--ink #1c1c22`, `--ink-2 #45454f`, `--ink-3 #6b6b75`, `--rule #e7e4dd`,
  `--accent #4a89f3` (Literotica's blue), `--accent-ink #2b63c6`, `--warm-ink #a9531d`.
- Add `--control #8f8a80` (borders of selects, buttons, pills: 3.3:1), `--accent-bar #c9dcfb` (middle-half
  bars), `--band #f1efe9` (the 0.67×–1.5× band on genre cards), `--spark-line #9db8e6`, and an age-note set
  (`#fff6ec` background, `#f1d6bd` border, `#5b3a1e` text, `#7a3f12` bold lead).
- Step badges (if any remain) and median dots use `--accent-ink`.
- Compare-table steps: ≥1.5× `#8fb4f4`, ≥1.25× `#bcd3fa`, ≥1.1× `#e1ebfd`, between 0.91× and 1.1× no fill,
  ≤0.91× `#fbe7d7`, ≤0.8× `#f6cfb1`, ≤0.67× `#eea877`. Cells under 30 stories: no fill, 1 px dashed `#b5b0a6`
  border, full-strength text. Check every resulting text pair.
- Type scale: H1 as a kicker (13 px, 600, uppercase, 0.06em tracking); the question sentence
  `clamp(24px, 4.2vw, 40px)` / 1.3, serif, weight 500 (or 600 if 500 isn't available in the subset: use 600 at
  a slightly smaller size rather than shipping a second weight); answer heading `clamp(20px, 2.6vw, 26px)`
  serif 600; body 16 px; notes 15 px; captions 13 px; chart group labels 14 px; `n` 12.5 px; chart values
  13 px/600; ticks 12 px. Text blocks ≤ 66ch. Spacing on a 4/8/12/16/24/32/48 scale.
- **Font:** copy `Claude outputs/design-review-mockups/fonts/source-serif-4-latin-600-normal.woff2` to
  `site/public/fonts/`. Get its licence by running `npm pack @fontsource/source-serif-4@5.3.0` in a temporary
  directory and copying the OFL licence file next to the font (`site/public/fonts/OFL.txt`); don't add the
  package to the project. `@font-face` with `font-display: swap`, `<link rel="preload" … crossorigin>` in
  `index.html`, stack `"Source Serif 4", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`.
  Mention the font and licence in `site/README.md`.

## Copy (approved wording; US English; nothing causal)

- **H1 / `<title>`:** "What do popular Literotica stories have in common?" The How it works page:
  "How it works · What do popular Literotica stories have in common?". Patterns page: "Patterns · …".
- **The question sentence (concept B):**
  - One genre: "In [All genres], how do [favorites per 1,000 views] vary with [story length]?" Use "does …
    vary" for singular measures (`metric.plural === false`), "vary with" for ordered characteristics, "vary
    by" for unordered ones, and for yes/no characteristics "differ between [first-person stories] and
    [third-person stories]" (the bracketed part is one control showing the characteristic; build the text from
    `yes_subject`/`no_subject`). It must read grammatically for all 187 characteristics × 10 measures; generate
    them all in a test and read a sample of each kind yourself.
  - Comparing genres: "Genre by genre, how do [measure] vary with [characteristic]?" with a "Back to one genre"
    button.
- **Answer heading (H2)**, derived only from the existing `direction`/`effect` fields and group counts:
  - clear pattern → today's `chartTitle` ("Longer stories tend to get more favorites per 1,000 views", "In
    Romance, …");
  - fewer than two groups shown → "Too few stories to compare here";
  - ordered or yes/no, `effect` is null → "Too few stories to judge a pattern";
  - ordered or yes/no, no clear pattern → "No clear pattern";
  - unordered (month, weekday, perspective …) → "Each group on its own".
  Keep today's full `chartTitle` (neutral or pattern) as the chart's accessible name, the shared-link text
  and `document.title` on the explore page.
- **Takeaway line** above the chart, for ordered and yes/no characteristics with at least two groups shown:
  "Typical story: **0.28** for “Under 2,000”, **0.89** for “7,000+”." followed by today's pattern note
  (strength sentence or "No clear pattern…"). Use the first and last groups; if an end group is hidden, say so
  ("“Under −10” has too few stories") rather than silently using the next one. Yes/no: "Typical story:
  **0.43** for present-tense stories, **0.56** for past-tense stories." Unordered: show today's note only.
- **One group shown (F17):** heading as above; note "Only “Past tense” has enough stories in this selection
  (102)." with buttons "All genres" and "All stories" (show only the ones that would change something).
- **Mode controls (F18):** under the chart in one-genre mode, a button "Compare all 30 genres →" (count from the
  data). In compare mode, the sentence starts "Genre by genre" and a "Back to one genre" button returns to the
  last genre used.
- **"Only include" (F35)** replaces "Stories included" (same options, same ids). Disable options that conflict
  with the characteristic (a length option while the characteristic is word count; a "Published …" option
  while it is publication year or years online), with an explanation available to all users.
- **Notes (E1/E2):** see Phase 5.
- **Compare summary (D2):** for ordered and yes/no characteristics, "Tends higher in 18 of 30 genres, tends
  lower in none, no clear pattern in 12." Add "too few stories to judge in N" when relevant. Counts only; no
  genre names in it; no ordering by result.
- **Example questions (F19):** each must use the measure it names, and must not be chosen for its result.
  1. "Do readers favorite first-person stories more often?" (first-person narration, favorites per 1,000 views)
  2. "Do longer Romance stories get more views per month?" (word count, views per month, Romance)
  3. "Do stories with more dialogue get more comments per 1,000 views?"
  4. "Is more sexual language linked to more favorites per 1,000 views?"
  5. "Do older stories have more views?" (keep)
  6. "Does present-tense narration look the same in every genre?" (keep, compare mode)
  Put the heading "Try another question" above them; they go **below** the chart.
- **Errors (F32):** "We couldn't load the data. Check your connection and try again." with a "Try again" button.
- **Copy link (F33):** "Link copied" on success; otherwise show the address in a read-only field, selected, with
  "Copy this link:".
- Nav and footer both say "How it works" (the route stays `#/methodology`).

## Work plan

Commit messages in the repository's style ("Stage 2 design: …"). The list of commits per phase is a guide;
split further if it helps review.

### Phase 0: branch and baseline

- `git switch -c design-review` from `main`. Run all three test commands and the build.
- Commit `docs/stage2/DESIGN_REVIEW.md`, `docs/stage2/design-review/*.png`, `STAGE2_DESIGN_REVIEW_PROMPT.md`
  and this prompt ("Stage 2 design: review, mock-up screenshots and prompts").

### Phase 1: wording and data side (`litcorr/stage2/`), then `site-data`

1. **US spelling.** Extend `_SITE_TEXT`/add a `SITE_LABEL` override map so labels and descriptions from the data
   dictionary come out in US English (humor, neighboring, unrecognized, favorite, labeled, signaled,
   recognizable, realize, organizations, "on the weekend" …); fix `MORE`, `NOUN`, `BINARY` and the methodology
   text in `Methodology.jsx` (summarize, humor …). Add a Python test that scans every visitor-facing string in
   `meta.json` for a list of UK spellings, and a JS test that does the same for the site's own text.
2. **Grammar of generated text (F21).** Plural-aware pacing nouns ("Where action verbs peak", "Stories in which
   action verbs peak later"); fix "vary with paragraphs with dialogue" and similar; make the pronoun-count
   characteristics read well aloud (e.g. "use of ‘we / us / our’"). Write every generated title (pattern up,
   pattern down, neutral; one genre and compare) for every characteristic and measure to a scratch file
   outside the repository and read through it; fix what reads badly. Add tests for the fixes and a banned-word
   test (see "Still off-limits") over all generated strings.
3. **Topics and Popular (F3, 6.2 of the review).** Replace the six tabs' grouping with eight topics (Length &
   structure; Narration; Dialogue & characters; Sexual content; Emotion & relationships; Pacing & setting; Word
   choice & style; When published), each with a one-line blurb, mapped from today's `(ui_group, subgroup)`
   pairs; merge sub-groups that appear twice (Story basics, Readability & sentence complexity, Pacing). Add
   `POPULAR` (story_words, pov_is_first_person, narr_is_present_tense, dlg_word_share, sex_terms_per_1k,
   sex_words_before_first, emo_balance, series_is_part, story_has_author_note, read_flesch_reading_ease,
   reader_address_per_1k, pub_year). Add search synonyms per characteristic or topic (POV, point of view,
   person; explicit, sex; length, long, short; dialog; tense; swearing, cursing; typos …) to `meta.json` if
   that is simplest, keeping the file small. Clarify jargon labels in the label or description where needed
   (type–token ratio, Zipf), and avoid the clash between the characteristic "Romance" and the genre Romance
   (e.g. "Romance language").
4. **Example questions** as in "Copy".
5. Run `python -m litcorr site-data`, regenerate the fixtures, update `tests/test_stage2_site_data.py` (topics
   cover every characteristic exactly once; Popular ids exist; no story-level data).

### Phase 2: foundations in the front end

Tokens and contrast (F13); 44 px targets (F14); visible focus everywhere including chart rows (F11);
reduced motion for every scroll and animation (F28); consistent number formats: one number of decimals per
axis and table column, US dates, "0.10–0.66" style ranges (F25); the error and copy-link fallbacks (F32,
F33); the font; a new favicon drawn from the chart's own mark: a horizontal capsule with a dot, legible at
16 px (F29, I5). Commit in two or three steps.

### Phase 3: loading and layout stability (F5, F15, F16)

- Render the page frame, headline, sentence and a chart-sized placeholder before `meta.json` arrives (fill the
  story count when it does); `main` at least one screen tall. Target CLS < 0.1 on a throttled first load.
- When a new file is needed, keep the previous chart, heading and notes on screen, dimmed, with `aria-busy`,
  until it arrives; never compute the heading or notes from missing data. Prefetch the file for a
  characteristic when it is highlighted in the picker or hovered.
- Announce changes once: the `aria-live` region gets the final answer heading only after data has loaded.
- Tests: the old heading stays until the new data resolves; no "too few stories" text while loading.

### Phase 4: the one-genre chart (C2; F1, F9, F12, F23, F24, F26)

Port `rangeRows` from the mock-up into a `RangeChart` component that replaces `GroupChart`:

- **Layout.** One row per group.
  - Phones (< 560 px): if any label is longer than 7 characters, the label (14 px) and its `n` (right-aligned,
    12.5 px) sit on a line above the bar, 56 px per row; otherwise (months, weekdays, short ranges) the label
    sits in a 64 px column on the left with "n = 758" under it, 44 px per row.
  - Wider: a right-aligned label column of `min(220, max(110, 25% of width))` px, `n` under the label, 44 px
    rows.
  - Height follows the rows; no fixed chart height.
- **Scale.** Linear. Counts and rates start at 0; ratings keep today's zoomed domain. Ticks along the top: 4
  on phones, 6 wider, never more than 5 on phones; compact labels on phones for values ≥ 10,000 (60k, 800k);
  the left margin is at least half the first tick label's width. No log scale (see 6.3 of the review).
- **Marks.** Middle half: 12 px bar, fully rounded, `--accent-bar` fill, 1 px `--accent` outline. Median: 7 px
  radius dot, `--accent-ink`, 2 px white ring, with its value printed to the right of the bar (13 px/600).
  Small groups (< 30 stories): hatched bar with a dashed outline, hollow dot, "*" after `n`, explained in the
  legend. Hidden groups (< 10): the row stays, with "Too few stories to show" and "fewer than 10". All stories
  shown: a dashed vertical line with its label under the chart, clamped inside the width. Text gets a
  background-coloured halo so lines never cut through it.
- **Legend:** "Typical story (median)", "Middle half of stories", "Fewer than 30 stories" (only when present),
  "All stories shown". No mean marker anywhere on the chart.
- **Interaction and accessibility.**
  - The SVG is `role="group"`, named by the full `chartTitle` and described by a one-sentence summary
    ("Typical story from 0.28 for Under 2,000 to 0.89 for 7,000+; 5 groups; 8,987 stories").
  - Each row is focusable, with a visible focus ring and a full label (group, median, middle half, mean,
    stories, typical age).
  - Hover, focus or tap shows the tooltip. A tap pins it until the next tap elsewhere or Escape; Escape always
    dismisses.
  - The tooltip keeps today's contents, mean included.
- **Numbers table:** always in the DOM right after the chart (visually hidden until "Show the numbers" is
  pressed); on phones it reflows into one card per group instead of scrolling sideways.
- **Answer heading, takeaway line and one-group message** as in "Copy".
- Tests: layout functions are pure and tested (estimated label boxes never overlap at 320/375 px for every
  characteristic's labels; tick count; margins; compact formats); hidden, small and one-group cases; the
  answer heading for every case; the tooltip on tap and Escape; no mean marker in the SVG.

### Phase 5: the notes, age check and next questions (E1, E2, I1, I2; F8, F34)

- **E1 (below 900 px):**
  - Story-age warnings as visible boxes:
    - The groups differ in age: keep today's sentence up to "…shape this chart." and add a button "Check
      stories of similar age" (I1).
    - The measure is a total: "Totals grow with time online. Older stories have had longer to collect
      [views]." with a button switching to the per-month or per-1,000-views version (views → views per month,
      favorites → favorites per 1,000 views, comments → comments per 1,000 views, ratings → ratings per 1,000
      views).
  - Then three disclosures, 48 px rows:
    - "How to read this chart" (one short paragraph explaining dot, bar, dashed line, printed values,
      hatched rows);
    - "What “[characteristic]” measures" (description, caveat, and a link "How was this measured?" to the
      right methodology section);
    - "What “[measure]” means" (help text).
  - Then today's association note, visible.
  - Then 44 px buttons: Show the numbers, Copy link, Compare all 30 genres.
- **E2 (900 px and wider):** the chart in about two thirds of the width; the same notes (age boxes first, all
  text visible, no disclosures) in a margin column.
- **I1 "Check stories of similar age":**
  - Offered only when the age warning appears and "Only include" is "All stories".
  - Opens a panel with the same chart, compact, for 2000–2009, 2010–2019 and 2020 or later (three columns on
    wide screens, stacked on phones). Each has its own `n` and the existing verdict ("tends higher" / "no
    clear pattern" …).
  - Caption: "The same chart within three publication periods, so the stories compared are of similar age."
  - Loads the three existing files on demand. Its state belongs in the address so it can be shared.
- **I2 next questions:**
  - Up to three links under each chart: the per-month/per-1,000 version when the measure is a total; "Compare
    all 30 genres"; and the next two characteristics in the same topic's order.
  - Never chosen by the strength of their result.

### Phase 6: the picker (2A; F3, F4)

- **The characteristic picker.**
  - One trigger (the characteristic slot in the sentence) opens a bottom sheet on phones (< 700 px: top at
    56 px, focus trapped, scroll locked, close button, swipe-down optional) or a 560 px popover anchored to the
    trigger on wider screens (max height `min(620px, 80vh)`).
  - Follow the WAI-ARIA 1.2 combobox-with-listbox pattern (arrows, Home/End, Enter, Escape returns focus to
    the trigger).
  - With the search box empty: a "Popular" set of 44 px chips (current one marked), then the eight topics with
    their blurbs and counts; a topic opens its list with one-line descriptions (≤ 110 characters) and a back
    link.
  - Typing filters label, noun, description, topic and synonyms, case- and accent-insensitive. Rank label
    prefix > label word > other matches. Show the topic and description; highlight the match with `<mark>`. "No
    matches" offers the topics.
  - Picking closes the picker and changes the chart; browsing topics never changes the chart.
- **The measure menu** replaces the "i" (F4): the measure slot in the sentence opens the same popover/sheet
  component as a simple listbox grouped "Per 1,000 views / Per month online / Totals so far / Rating", each
  option with its one-line help, and a short group note ("Totals keep growing while a story is online;
  per-month and per-1,000-views measures make old and new stories easier to compare.").
- **Genre** stays a native `<select>` (31 options; the phone's own picker is best), styled inline: show the
  chosen genre as text and lay a transparent `<select>` over it, so the sentence doesn't stretch to the longest
  genre name. Same trick for "Only include".
- Tests: keyboard navigation, search ranking and synonyms, Escape/focus return, the menu opening on click and
  on tap.

### Phase 7: the first screen and page shell (B; F2, F10, F18, F22, F31, F35)

- Masthead 52 px: "Story Patterns" (serif 600, never wraps), nav "Explore · Patterns · How it works".
- The H1 headline as a kicker line with the story count ("What do popular Literotica stories have in common? ·
  8,996 stories · 30 genres"; let the count wrap to a second line on phones). The question sentence as a
  `fieldset` with a visually hidden legend "Choose what to compare" and a visually hidden label per slot. Then
  "Only include: [All stories ▾]". Then the answer heading, takeaway, chart.
- Targets: at 375 × 667 the first chart row is visible without scrolling; at 1440 × 900 the whole default chart
  is visible. Measure and report both.
- Example questions below the chart (horizontal scroll with a fade on phones, wrapping on desktop).
- The skip link goes to the question sentence.
- The tablet problem (F31) disappears with the sentence; check 768 px anyway.

### Phase 8: compare genres (D2, with D1 as the numbers; F6, F7)

- Port `sparkGrid`.
  - One card per genre: 2 columns below 420 px, 3 below 700, 4 below 1,000, then 5. "All genres" is a
    full-width card first, with group labels when they fit.
  - Each card shows the genre name (ellipsis, with the full name available) and the verdict in words with the
    arrow ("↗ tends higher" `--accent-ink`, "↘ tends lower" `--warm-ink`, "no clear pattern" `--ink-3`, "too few
    stories to judge").
  - The 56 px mini chart is each group's median relative to the genre's own typical story. It has a log
    scale clamped to 0.5×–2×, the `--band` from 0.67× to 1.5×, and a dashed 1× line. Dots are filled for 30+
    stories, hollow for fewer, a dash for hidden groups. A thin line joins the dots only for ordered
    characteristics.
- The whole card is a button that opens that genre's chart. Its accessible name lists the verdict and each
  group's ratio.
- The compare summary line and a short caption (what a dot is, what hollow means, "alphabetical, not ranked")
  above the grid.
- "Show the numbers" opens D1:
  - the repaired table, with stepped colours, no fill between 0.91× and 1.1×, small cells uncoloured;
  - the verdict column next to a sticky genre column;
  - tap or focus on a cell shows its median, `n` and the genre's typical story.
- Remove the old colour ramp and the hover-only `title` tooltips.
- Tests: verdict words, hollow and hidden dots, alphabetical order, summary counts, keyboard access to cards
  and cells.

### Phase 9: the pattern browser (I4)

- **Data.** Add to `site_data.py` one file, `site/public/aggregates/patterns.json`, for "All stories" only. It
  re-packages the pattern results already shipped in the per-characteristic files: for each genre and measure,
  each characteristic's direction (−1, 0, +1) and strength band (weak / moderate / strong, using the site's
  existing `strengthWord` cut-offs on the existing effect values), or null where the effect wasn't computed.
  Nothing else: no medians, no counts, nothing per story. Keep it compact (target ≤ 40 KB gzipped). Python
  tests check it against the per-characteristic files and its size, and that it holds no other fields.
- **Page** `#/patterns?genre=…&metric=…` (nav "Patterns"; also linked from I2).
  - Genre and measure controls (the same inline style as the sentence).
  - A count line: "[71] of [N] characteristics that can show a trend have a clear pattern with [favorites per
    1,000 views] across all genres. The other [M] don't, which is just as informative." Plus "[K]
    characteristics have no order (such as month) and are not summed up as a trend."
  - Then the characteristics with a clear pattern, grouped by topic in the topics' order and alphabetical
    within each topic, each as its pattern sentence (today's `chartTitle`) with the strength word, linking to
    its chart. A toggle "Show the ones with no clear pattern too".
  - Never sort by strength or by effect; never rank genres.
  - A note linking to "When a title says 'tend to'": "With this many characteristics, some differences
    appear by chance; the rule behind 'tend to' allows for that, but a single pattern is still only a
    description."
- Tests: the counts, the topic and alphabetical order, the links, the toggle.

### Phase 10: How it works (F27, F36)

- Routes `#/methodology` and `#/methodology/<section>` (scroll to the section; keep focus management sane).
- An "In short" box at the top with five bullets built from `meta` numbers: the sample (300 random stories in
  each of 30 genres, collection dates); popularity as one snapshot per story; characteristics as counts and
  simple rules, not AI; groups summarized by median and middle half, groups under 10 hidden; descriptive
  patterns, not causes.
- Keep the disclaimer callout word for word.
- A contents list (sticky on desktop).
- Ids for the sections that charts link to:
  - point of view;
  - explicitness;
  - emotion;
  - how the charts summarize;
  - when a title says "tend to";
  - missing data.
- Charts and notes link to these sections ("How was this measured?", "Why no clear pattern?").
- The glossary uses the eight topics, has a filter box (reuse the picker's search logic), 44 px headings, and
  a "See the chart" link on each entry.

### Phase 11: motion and polish (I3, I5)

- When only the measure or the genre changes (same groups), animate dots, bars and value labels to their new
  positions over 250 ms with an ease-out curve, in JavaScript with `requestAnimationFrame` (`d3-interpolate` is
  already a dependency). Use no motion at all under reduced motion. Characteristic changes cross-fade (150 ms)
  instead of jumping.
- Hovering or focusing a row slightly emphasizes it and dims the others.
- Final pass over spacing, alignment and hierarchy at all four widths: the chart must be the visual focus of
  every view.

### Phase 12: finishing

1. Re-measure everything from section 2.3 of the review on the finished site, with the same widths and
   throttling profiles:
   - scroll distance to the first chart;
   - taps per control;
   - touch targets;
   - text sizes;
   - every colour pair;
   - first-load size;
   - per-view size and time;
   - CLS;
   - label overlaps.
   Also re-run the five task walk-throughs from section 3.
2. Take "after" screenshots of the views in 2.2 at 375 and 1440 px (plus the new Patterns page and the age
   check), small and palette-compressed like the review's, as `docs/stage2/design-review/a01-….png`.
3. Update `site/README.md` (source layout, the font and its licence, `patterns.json`, design notes) and any
   other README that describes the site.
4. In `docs/stage2/DESIGN_REVIEW.md`:
   - change the status line at the top to say the review was approved and implemented on branch
     `design-review`;
   - add a **Before and after** section: a table of every finding F1–F36 and idea I1–I5 with what changed,
     the commit, and before/after numbers where measurable; the after screenshots; **Judgment calls** (every
     decision you made that this prompt didn't specify, with one line of reasoning each); **Still open**
     (anything not done, including dark mode, and why); and anything you decided not to do and why.
5. Final run of all three test commands and the build; commit; don't push. Summarize for the owner in a few
   lines: what changed, the headline numbers before and after, what's still open.

## Judgment guidance

- When a choice is about form (layout, spacing, sizes, component structure, copy that restates existing
  meaning), decide, implement, and record it.
- When a choice would change what a chart, title or note *means*, prefer the reading that claims less; if it
  still changes meaning beyond what "Copy" approves, don't do it: note it under "Still open".
- If a specification here turns out to be wrong in practice (for example a breakpoint that produces a worse
  result on real data), fix it in the spirit of the review and record the change.
- Keep the site calm: one accent colour for data, one warm colour for "lower" and age warnings, generous
  whitespace, no decoration that isn't information.
