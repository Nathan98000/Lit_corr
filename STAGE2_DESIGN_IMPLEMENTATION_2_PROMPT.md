# Stage 2 design implementation, round 2: build what the second review recommended

You are working in the `Literotica_Correlations` project. Its Stage 2 website (`site/`, a static React + Vite app)
had a second design review, `docs/stage2/DESIGN_REVIEW_2.md`. **The owner has approved implementing it, with the
decisions below.** This prompt records those decisions, gives the specifications and sets the order of work. Where it
leaves a detail open, make the call yourself, implement it and record it under *Judgment calls* (see "Finishing").
Don't stop to ask about design details. Do stop for the things listed under "Checkpoints".

## Read first

1. `docs/stage2/DESIGN_REVIEW_2.md`, all of it, with its screenshots in `docs/stage2/design-review-2/` (`b…` = the
   site now, `m…` = mock-ups). Finding IDs (F37–F59), concepts (G2, H3, J2, K1, N1) and ideas (I6–I8) below refer
   to it. Where this prompt and the review disagree, **this prompt wins** (in particular on the disclaimer, the
   footer and the association note: decision 1).
2. `docs/stage2/DESIGN_REVIEW.md` sections 1 and 8 (round 1 and what it built) and
   `STAGE2_DESIGN_IMPLEMENTATION_PROMPT.md` (round 1's specification).
3. `site/README.md`, everything in `site/src/` and `site/src/test/`, `litcorr/stage2/wording.py`,
   `litcorr/stage2/site_data.py`, `tests/test_stage2_site_data.py`.
4. The mock-ups in `Claude outputs/design-review-2-mockups/` (scripts injected into the running site; see its
   `README.txt`) and the measuring scripts in `Claude outputs/design-review-2-tools/` (see its `README.txt`). Use
   them as references and for measuring only. Never import anything from `Claude outputs/` into `site/`, and never
   commit it.

## The owner's decisions

1. **No reminders that correlation is not causation, anywhere on the site.** Remove:
   - the disclaimer, entirely, from the footer and from How it works ("The visualizations show descriptive
     associations… human sexuality."); this replaces the old hard rule that kept it word for word;
   - the association note under every chart and in compare mode (`ASSOCIATION_NOTE` in `wording.js`, used in
     `ChartNotes.jsx` and `Explorer.jsx`), with its CSS if nothing else uses it;
   - How it works' fifth "In short" bullet ("The patterns are descriptive: they show what goes together, not why.");
   - How it works' Limitations bullet "Descriptive only. A pattern can come from something else: …";
   - "Descriptive patterns only." from the meta description in `index.html`;
   - the end of the Patterns page's note: it becomes "With this many characteristics, some differences appear by
     chance; the rule behind “tend to” allows for that." followed by the existing link.
   Keep everything else, in particular: **no causal language anywhere** (the banned-word tests stay; not reminding
   people is not the same as claiming causes), "tend to" only through the pattern rule, the story-age boxes ("Age goes
   with popularity too, so it can shape this chart." stays: it is the age warning, not a causation reminder), the
   Limitations bullet "Not representative", "alphabetical, not ranked", and the statement that the site is
   independent of Literotica.
2. **Code splitting: approved** (F49).
3. **Desktop notes: concept N1** (F41).
4. **Patterns page: concept G2** (F42).
5. **How it works on narrow screens: concept H3**, the sticky section bar (F46), not H1.
6. **After the chart: concept J2**, one "Keep exploring" list (F50).
7. **A row's details on phones: concept K1**, the details line under the chart (F43), not K2.
8. **Ideas:** no hint (I6: no), no "Surprise me" (I7: no), **the question bar on phones (I8): yes**.
9. **Everything else the review recommends: implement it, using your judgment** where it offered options. The
   owner's choices on the review's open questions, made here:
   - all quick wins (section 6 of the review) and findings F37–F59, as specified below;
   - the new and changed wording in "Copy" below is approved;
   - the search synonyms for "kiss", "kissing", "orgasm" and "climax" (F45) are approved; "oral" is not in any
     word list, so leave it out;
   - Open Graph and Twitter tags: yes; a share image: **no** (note it under "Still open");
   - dark mode: not in this round; a second font weight: no.
10. **Git: approved to delete git's lock files.** If your environment blocks deletion in the project folder (the
    Cowork device bridge does by default), request deletion permission for the project folder once; the owner has
    approved it.

## Hard rules (updated for this round)

1. **No network access to Literotica.** Never open literotica.com with any tool.
2. **The data stays private and aggregated.** The site ships only `meta.json`, `v/<characteristic>/<included>.json`
   and `patterns.json`. No story-level data, no data download, no new data fields, no new aggregate files and no
   restructuring of existing ones. `data/` is read-only; never run `probe`, `collect`, `process` or `export-handoff`.
   Run `python -m litcorr site-data` (offline) after changing `wording.py` (needed for F45's synonyms).
3. **Honest interpretation.** No causal language ("cause", "drive", "make readers", "lead to", "boost", "because",
   "effect of", "impact", "result in" …). "Tend to" only through the existing pattern rule. Genres never ranked or
   sorted by a result; patterns never sorted by strength, effect or direction. Sample sizes visible; story age visible
   where it matters. No discovery feature that encourages cherry-picking. The independence statement stays. (The
   disclaimer and the causation reminders go: decision 1.)
4. **Methodology is not design.** Don't change the measures, the binning, the minimum group sizes (10 and 30) or the
   pattern rule (its thresholds, the 99% level, the 10% gap). How they are presented is fair game.
5. **No new dependencies.** No npm packages (runtime or dev), fonts or weights, CDNs, analytics or external requests.
   Static site, no server. Checking tools (Playwright, axe-core) run from a temporary directory outside the
   repository and never go into `package.json`.
6. **Existing addresses keep working:** `#/explore?mode=…&genre=…&metric=…&var=…&include=…` (and `&check=age`),
   `#/patterns?genre=…&metric=…`, `#/methodology` and `#/methodology/<section>`.
7. **Tests and build pass at every commit:** `npm test` and `npm run build` in `site/`, and
   `.venv/bin/python -m pytest tests/test_stage2_site_data.py`. Add tests for every new behavior; update existing
   tests without losing what they checked (the disclaimer tests become tests that the reminders are gone and the
   independence statement is present).
8. **Git.** Work on the existing branch `design-review-2` (created from `design-review` at `8ad75e1`; it is not
   checked out yet: `git switch design-review-2`). Commit each logical change separately, in the repository's style
   ("Stage 2 design: …"). Don't push. Never commit `.claude/` or `Claude outputs/`.

## Budgets and quality bar

- **First load ≤ 155 KiB of gzip response bodies** (HTML, JS, CSS, font, `meta.json`, the first chart file), measured
  with `firstload.mjs` from the tools folder against the built site served by `serve.mjs`. This definition replaces
  round 1's ambiguous "KB". Aim for ≤ 150 KiB after code splitting. Report the number after every phase that touches
  the bundle.
- Cumulative layout shift < 0.1 on a throttled first load; no "Loading…" flash after the first chart; lazy chunks
  never cause a layout jump (placeholders the size of what they replace).
- After each phase, check 320 × 568, 375 × 667, 768 × 1024, 1440 × 900 and 200% zoom: no horizontal scroll, no
  overlapping text, everything usable by mouse, touch and keyboard.
- WCAG 2.2 AA, including focus not obscured (2.4.11) under the new sticky bars, and `prefers-reduced-motion` honored
  in CSS and JavaScript.
- US English for everything a visitor reads; the tests scan for UK spellings and causal words.

## Copy (approved; US English; nothing causal)

| Where | Text |
|---|---|
| Takeaway, clear pattern (F40) | "Typical story: **0.28** for “Under 2,000”, **0.89** for “7,000+”." then "A {weak/moderate/strong} pattern; individual stories vary a lot within every group." The strength word links to `#/methodology/tend-to`. |
| Takeaway, no clear pattern (F40) | medians line, then "The groups differ only a little, or not consistently." and the existing "Why no clear pattern?" link |
| Takeaway, too few to judge (F40) | medians line, then "A pattern is judged only when the groups at both ends have at least {small_n} stories." (replaces the sentence that repeated the heading) |
| Groups without an order (F40) | no note under "Each group on its own"; "How to read this chart" gains: "Groups without an order, such as months, are shown side by side and not summed up as one trend." |
| Strength definition, How it works › When a title says "tend to" (F44) | "Weak, moderate and strong describe how consistently popularity rises or falls across the groups, on a rank correlation from 0 (no consistent order) to 1 (a perfectly consistent one): weak below 0.2, moderate from 0.2 to 0.4, strong 0.4 or more. Even a strong pattern leaves individual stories varying widely." |
| Kicker (F55) | "What do popular Literotica stories have in common? · about 9,000 stories · 30 genres" (the count rounded to the nearest thousand, from `meta`; the placeholder before `meta` arrives says the same) |
| Chart subtitle (F55) | unchanged text; the story count ("8,987 stories") becomes a link to `#/methodology/missing-data` |
| Rating axis title (F56) | "Average rating (the axis starts at 3.5)", built from the chart's lower domain bound whenever it is above 0 |
| Footer (F58 + decision 1) | one paragraph, 14 px: "An independent project, not affiliated with or endorsed by Literotica. This site holds summaries of groups of stories only: no story text, titles, authors or story-by-story records. How it works" (the last two words a link) |
| Patterns count line (F59) | "**71** of 181 characteristics that can show a trend have a clear pattern with favorites per 1,000 views across all genres. The other 110 show no clear pattern; that is a finding too." |
| Patterns chance note (decision 1) | "With this many characteristics, some differences appear by chance; the rule behind “tend to” allows for that." + the existing link |
| Patterns key line (G2) | "↗ tends higher: the more of the characteristic a group of stories has (or, for yes/no ones, the group that has it), the higher its typical {metric noun}; ↘ tends lower: the lower. What weak, moderate and strong mean" (the last six words a link to `#/methodology/tend-to`) |
| Patterns topic summary (G2) | "{Topic} · {n} of {m} clear" |
| After the chart (J2) | heading "Keep exploring" |
| Details line on phones (K1) | "**Under 2,000** typical story 0.28 · middle half 0.10–0.66 · mean 0.46 · 2,708 stories · typical age 12 years. Tap again to close." Hidden group: "**3–7** fewer than 10 stories, so this group is not shown." |
| Question bar on phones (I8) | visible text "{characteristic label} · {measure label} · {genre name or “Genre by genre”}" (+ " · {Only include label}" when not All stories); accessible name "Back to the question: {the whole question sentence}" |
| How it works section bar (H3) | "How it works › {current section}" (before the first section: "How it works › Contents") and a button "Contents" |
| Search, a measure typed (F45) | "“Average rating” is a popularity measure, not a story characteristic." with a button "Show average rating" that switches the measure and closes the picker |
| Live region (F47) | the full chart title, then the answer when it differs from the title: "How views vary with story length across all genres. No clear pattern." |
| Meta description and link previews (decision 1, F59) | "What do popular Literotica stories have in common? Explore how the popularity of about 9,000 stories varies with their characteristics, overall and within each genre." |

## Work plan

Commit at least once per phase; split further if it helps review. After each phase: the three test commands, the
build, and a look at the four widths.

### Phase 0: branch and first commit

- `git switch design-review-2`. Run the three test commands and the build (expect 64 Vitest and 18 pytest tests,
  the bundle `index-Cx2VYF7Z.js` before any change).
- First commit ("Stage 2 design: second review, screenshots and prompts"): `docs/stage2/DESIGN_REVIEW_2.md`,
  `docs/stage2/design-review-2/*.png`, `STAGE2_DESIGN_REVIEW_2_PROMPT.md` and this prompt
  (`STAGE2_DESIGN_IMPLEMENTATION_2_PROMPT.md`).
- Copy `Claude outputs/design-review-2-tools/` to a temporary directory outside the repository, install
  `playwright-core@1.56.0 axe-core@4.10.3` there, set `CHROME` to your cached Chromium (see the tools README) and fix
  the absolute paths written for the review's Linux container. Re-run `firstload.mjs`, `taps.mjs` and
  `task2.mjs` once to confirm you reproduce the review's numbers on your machine (fonts differ: San Francisco is a
  little narrower than the review's Inter).

### Phase 1: no causation reminders (decision 1)

- Remove the items listed in decision 1 (`App.jsx` footer paragraph, `Methodology.jsx` callout, "In short" bullet and
  Limitations bullet, `ASSOCIATION_NOTE` and its two uses, the meta description sentence, the Patterns note's end).
  Removing the How it works callout also clears axe's `landmark-complementary-is-top-level`.
- Footer as in "Copy" (this also delivers F58).
- Tests: replace the "do not establish causation" assertions with a test that no page (explorer in one-genre and
  compare mode, Patterns, How it works) contains "do not establish causation", "do not show that a characteristic
  changes", "not why" or "Descriptive only", and that every page shows the independence statement. Keep the
  causal-word and UK-spelling scans.
- Update `site/README.md` and the root `README.md` where they describe the disclaimer or the association note.

### Phase 2: quick wins (review section 6)

1. **F37, similar-age check.** When "Check stories of similar age" opens the panel, scroll its heading to the top of
   the screen (smooth only without reduced motion; leave room for the question bar, see Phase 8) and move focus to it
   (`tabIndex={-1}`). "Close" returns focus to the age box's button. When the page is opened from an address that
   already has `&check=age`, don't scroll. Test: after the click, focus is on the panel heading and
   `scrollIntoView` was called; after Close, focus is on the button.
2. **F38, the sentence's tap areas.** Below 560 px: `.sentence { line-height: 1.45 }`. Remove the
   `.slot-button::after` tap boxes everywhere. The sentence's genre select: `inset: 0; height: 100%` (keep the larger
   area for "Only include", which has no line above or below it). Same rules for the Patterns page's sentence.
   Measure with `taps.mjs` at 320 and 375 px for the default view, `var=title_has_chapter_marker`,
   `var=pace_descriptive_early`, compare mode and a long genre: every word must own at least 90% of its own box, and
   the tap height at its center must be at least 32 px.
3. **F39, compare mode.** The "Totals grow with time online" box (same words, same "Switch to …" action) goes between
   the subtitle and the caption, above the cards. Test the DOM order.
4. **F47, live region.** Announce the full chart title, then the answer when different (see "Copy"). Test that
   switching the measure between two charts with "No clear pattern" changes the announced text.
5. **F48, forced colors.** A `@media (forced-colors: active)` block in `styles.css` that draws the one-genre chart,
   the compact age-check charts, the genre cards and the legend keys with system colors (text `CanvasText` with a
   `Canvas` halo on the same selectors that set the halo today, dots `Highlight`, bars `Canvas` with a `CanvasText`
   outline, small groups hollow with a dashed outline, grid `GrayText`, reference line `CanvasText`, card band `Canvas`
   with a `GrayText` outline). The mock-ups folder's `forced-colors.css` is a working reference. Check with
   Chromium's emulation in both the light and the dark forced palette (`forced.mjs`, `forced2.mjs`).
6. **F51, the glide.** A measure change no longer glides: it uses the 150 ms cross-fade. A genre change (same measure,
   same groups) glides, and every frame must be a consistent chart: marks, reference line, grid and ticks are all drawn
   from the same interpolated scale (interpolate the domain as well as the values; let tick labels belong to each
   frame's axis or cross-fade between the old and new tick sets), and the printed values fade in at their final places
   at the end instead of sitting beside moving dots. Nothing moves under reduced motion. Test with fake timers: no
   glide on a measure change; on a genre change, a mid-glide frame's reference line and dots use the same scale.
7. **F52.** The empty state ("No group has enough stories…") offers the same "All genres" and "All stories" buttons
   as the one-group state (only the ones that would change something). When the whole app fails to load, keep the
   kicker `h1` above the error so the page has a level-one heading.
8. **F53.** The compare table's cell detail line is `position: sticky; bottom: 0` (paper background, a top rule,
   padding) while the table is on screen, so a tapped cell's numbers are always visible.
9. **F54, keyboard in the chart.** One tab stop per chart (roving `tabindex`): ↑/↓ move between rows, Home/End to
   the first/last, focus shows the details (the card on wider screens, the details line on phones, Phase 6), Escape
   hides them. Enter and Space no longer "pin". Rows keep `role="img"` and their full names. Apply the same to the
   compact age-check charts. Tests for the keys and for a single tab stop.
10. **F59, polish.**
    - Keep each slot's last word and its caret together (`white-space: nowrap` on a wrapper), so the caret and "?"
      never wrap onto a line of their own; `caret.mjs` must report 0 at every width.
    - Genre names on the cards wrap to two lines (`-webkit-line-clamp: 2`) instead of an ellipsis.
    - Disclosure summaries: `content: "+" / ""` (and "–"), so the symbol is not part of the name.
    - Picker options: named by the characteristic's label only (`aria-labelledby`), with topic and description as
      `aria-describedby`.
    - Patterns: underline the links of the "no clear pattern" rows (axe `link-in-text-block`).
    - Move the skip link inside the `header` landmark (axe `region`).
    - `index.html`: the meta description from "Copy", plus `og:title`, `og:description`, `og:type` ("website") and
      `twitter:card` ("summary") with the same title and description. No image.

### Phase 3: code splitting (F49)

- Load lazily (`React.lazy` / `import()`): How it works, the Patterns page, the characteristic picker, the measure
  menu, the similar-age check, and the compare grid and table. The review measured −8.2 KiB on a scratch copy
  (155.6 → 147.4 KiB counted with headers).
- Keep code that the first chart needs in the main chunk (configure `build.rollupOptions.output.manualChunks` if Vite
  splits small shared modules such as the JSX runtime into extra first-load requests).
- After the first chart has rendered, prefetch the picker and the measure menu when the browser is idle
  (`requestIdleCallback`, with a `setTimeout` fallback); prefetch the Patterns and How it works chunks when their nav
  links are hovered or focused.
- The sentence's words must react instantly even on a cold cache: the sheet or popover shell (with its title and
  Close) opens at once and its body fills in when the chunk arrives, with no layout jump. Direct visits to
  `#/methodology…` and `#/patterns…` show a placeholder at least one screen tall until their chunk arrives.
- Tests (Testing Library supports lazy components with `findBy…`): every lazy part still opens and works; the
  existing tests keep passing.
- Measure with `firstload.mjs`: report requests and KiB.

### Phase 4: words and search (F40, F44, F45, F55, F56)

- **F40** in `wording.js` (`patternNote`) and `Explorer.jsx` (`Takeaway`), as in "Copy". The answer headings are
  unchanged. Update the tests that pin the old sentences.
- **F44**: the paragraph in How it works and the strength links (takeaway, Patterns).
- **F55**: kicker and subtitle link.
- **F56**: the rating axis title.
- **F45, search** (`search.js`, `wording.py`):
  - rank the characteristic's noun like its label ("length" puts Word count, noun "story length", among the label
    matches; "age" puts Years online, noun "story age", there too);
  - for the weakest rank, match the beginnings of words, not any substring ("age" must no longer match "page",
    "language" or "average");
  - synonyms: "humour" (Humor and laughter), "1st person" and "first person" (the narration and perspective
    characteristics), "kiss kissing" (Intimacy; Affection & love), "orgasm climax" (Sexual-action terms);
  - a query that names a measure (its label or noun: "rating", "views", "favorites", "comments", "reading list")
    shows the message and button from "Copy" above any results;
  - synonyms are search-only text: exempt them from `us_english()` and from the UK-spelling checks (Python and JS),
    so "humour" survives;
  - run `python -m litcorr site-data`, check the diff touches only the synonyms, update the Python tests.
  - Tests: the review's table of queries (section 2.3) as cases: "length" and "age" find Word count and Years online in
    the top three; "rating" shows the measure message; "humour", "kissing", "orgasm", "1st person" find results;
    "tense", "pov", "dialog", "swearing", "typos" still work.

### Phase 5: desktop notes, concept N1 (F41)

- At 900 px and wider, the margin column keeps the story-age boxes open and shows "How to read this chart",
  "What “…” measures" and "What “…” means" as the same 44 px disclosures phones use (14 px summaries, rules above and
  below). There is no association note any more (decision 1).
- Measure at 1440 × 900 for the default view and for `metric=pop_views` (two age boxes): the margin column must end
  no lower than the action buttons (the review measured 444 and 577 px with the note; expect less without it), so
  there is no empty hole in the left column.

### Phase 6: a row's details on phones, concept K1 (F43)

- Below 560 px (the chart's phone layout), tapping a row shows a details line under the chart, inside the chart
  frame, above the caption (text in "Copy"; 14 px, a 1 px `--accent` border, 6 px radius, paper background). Tapping
  the same row again, tapping outside the chart or pressing Escape closes it; tapping another row switches to it. The
  tapped row keeps today's emphasis (others dimmed). Nothing covers the chart; the floating card is not used on
  phones. The line is `aria-live="polite"`.
- 560 px and wider: the floating card on hover and focus stays as it is.
- The compact charts in the similar-age check get their own details line each.
- Tests: tap, tap again, another row, Escape, outside tap; no floating card below 560 px.

### Phase 7: after the chart, concept J2 (F50)

- Remove "Next questions" (`nextQuestions` in `Explorer.jsx`) and "Try another question" (`TryAnother` in `App.jsx`),
  with their CSS and tests.
- Add one section under the chart's actions, in one-genre and compare mode and in the empty and one-group states:
  heading "Keep exploring" (styled like today's small uppercase section headings), then a vertical list of at most
  four links, each at least 44 px tall (with vertical padding so two-line items keep their spacing):
  1. "Every clear pattern with {metric noun} {across all genres | in {genre}} →" (to the Patterns page);
  2–4. the first three of the six example questions (in their fixed order from `meta.featured`) whose view differs
     from the one shown. Never chosen or ordered by a result.
- Tests: at most four items; none opens the view already shown; the order follows `meta.featured`; no item repeats
  the age box's "Switch to …" action.

### Phase 8: the question bar on phones (I8)

- Below 700 px on the explore page, when the question sentence (`#question`) has scrolled fully above the screen
  (an `IntersectionObserver`), show a 44 px bar fixed to the top of the screen: paper background, a bottom rule,
  one line of 14 px text ("Copy"; cut with an ellipsis), an "↑" at the right. It is one button: tapping it scrolls the
  sentence into view (smooth only without reduced motion) and focuses it. It hides when the sentence is visible
  again, while a sheet is open and on other pages. Appear and disappear with a 150 ms fade, none under reduced motion.
- It is fixed, so it causes no layout shift. Give the page `scroll-padding-top` (and the chart's focusable rows and
  headings `scroll-margin-top`) of at least 52 px below 700 px, so nothing focused ends up under it (WCAG 2.4.11).
  Check that the age-check scroll (Phase 2) lands below the bar.
- Tests (mock `IntersectionObserver`): the bar appears when the sentence leaves the screen, carries the right text and
  name, and moves focus to the sentence when pressed; it never renders at 700 px and wider.

### Phase 9: the Patterns page, concept G2 (F42)

- Keep the page's sentence, the count lines (new wording, "Copy"), the chance note (decision 1) and the "Show the ones
  with no clear pattern too" toggle. Add the key line under them.
- Then the eight topics in the topics' order, each a `<details>` whose `<summary>` holds the topic as an `h2` and
  "{n} of {m} clear" (topics with no clear pattern still appear: "0 of 11 clear"). All closed by default; add an
  "Open all topics" / "Close all topics" button beside the toggle.
- Inside a topic, one row per characteristic with a clear pattern, alphabetical: the characteristic's label as a link
  to its chart (the full pattern sentence as the link's accessible description, e.g. a visually hidden span referenced
  by `aria-describedby`), "↗ tends higher" (`--accent-ink`) or "↘ tends lower" (`--warm-ink`), and the strength word
  (13 px, `--ink-3`). Desktop: three columns in a 760 px measure; below 560 px the label on its own line and direction
  and strength under it (see `m04`/`m05` in the review). With the toggle on, the other characteristics follow in the
  same topic, alphabetical, muted, with "no clear pattern" or "too few stories to judge".
- Never sort by strength, effect or direction; never rank genres.
- Measure the page height at 375 and 1440 px with all topics closed and with one open (the review's mock: 1,596 px at
  375 with one open, against 8,183 px now).
- Tests: topic order, alphabetical rows, the counts, the toggle, the key line, open/close all, links.

### Phase 10: How it works on narrow screens, concept H3 (F46)

- Below 1,000 px there is no contents list at the top of the page. Instead, a 44 px section bar sits in the page
  flow right under the masthead and sticks to the top of the screen when you scroll (`position: sticky; top: 0`, so
  it causes no layout shift): "How it works › {current section}" on the left, a "Contents" button
  (`aria-expanded`, `aria-controls`) on the right.
- The current section is the last section heading that has crossed a line about 60 px from the top
  (`IntersectionObserver` on the `h2`s; no dependency). Before the first section the bar says "How it works ›
  Contents".
- "Contents" opens a panel under the bar with the 13 sections as 44 px links (sub-sections indented), the current one
  marked `aria-current="location"`. Choosing one goes to `#/methodology/<section>`, closes the panel and focuses the
  heading; Escape, the button again or a tap outside close it and return focus to the button. There is only one
  "Contents" navigation landmark at any width.
- Every section heading gets `scroll-margin-top` of at least 56 px so the bar never covers a heading you jumped to.
- 1,000 px and wider: keep the sticky sidebar; mark the current section there too (same observer); fix the uneven
  spacing (6 px of padding above and below each link instead of relying on a 40 px minimum height, so wrapped items
  don't touch the next one).
- Tests: the bar's text follows the observed section; the panel opens and closes with focus management; a section
  address scrolls to and focuses its heading below the bar.

### Phase 11: finishing

1. Re-measure, with the round-2 tools and the review's settings, and report each number next to the review's:
   scroll distance to the plot at the four widths and whether the first chart row is on a 375 × 667 screen;
   first-load KiB and requests; first chart and largest paint at the four network profiles (and which element is the
   largest paint); CLS; real tap areas of the sentence (`taps.mjs`); real label boxes (`labels.mjs` with the site's
   font and with DejaVu Sans); caret orphans (`caret.mjs`); axe on every page and state (`axe.mjs`; expect no
   violations); tab stops before and within the chart (`tabs.mjs`); forced colors light and dark; 400% zoom; frame
   times (`perf2.mjs`); the similar-age tap (`task2.mjs`); compare mode's age box position (`task3.mjs`); page
   heights of the explore page, Patterns and How it works.
2. Take "after" screenshots like the review's `b…` set (at least the first screens, the default chart, a total with
   both age boxes, the similar-age check after the tap, compare views, Patterns closed and with one topic open, How it
   works with the section bar and its open panel, the phone's details line, the question bar, forced colors dark),
   small and palette-compressed, as `docs/stage2/design-review-2/a01-….png`.
3. Update `site/README.md` (source layout, lazy chunks, the budget's definition, the new components) and any other
   README that describes the site.
4. In `docs/stage2/DESIGN_REVIEW_2.md`: change the status line to say the review was approved and implemented on
   `design-review-2`, with the owner's decisions; add a **Before and after** section shaped like section 8 of
   `DESIGN_REVIEW.md`: a table of every finding F37–F59, concept and idea with what changed, the commit and before/after
   numbers; the after screenshots; **Judgment calls** (every decision this prompt left open, one line of reasoning
   each); **Still open** (at least: dark mode, a share image, real devices and screen readers, anything not done); and
   anything you decided not to do, and why.
5. Final run of the three test commands and the build; commit; don't push. Summarize for the owner in a few lines:
   what changed, the headline numbers before and after, what is still open.

## Checkpoints: stop and ask before

- anything in the hard rules' territory beyond decision 1: data shipped, interpretation, methodology, dependencies,
  fonts or external requests;
- a feature or a wording change that is not in this prompt;
- a change that alters what a chart, title or note means (as opposed to its form);
- going over the 155 KiB first-load budget.

## Judgment guidance

- Form (layout, spacing, sizes, component structure, copy that restates existing meaning): decide, implement, record.
- Meaning: prefer the reading that claims less. If a change would still alter meaning beyond what "Copy" approves,
  don't make it; note it under "Still open".
- If a specification here turns out wrong in practice (a breakpoint that looks worse on real data, a measurement
  target that cannot be met), fix it in the spirit of the review and record the change and the reason.
- Keep the site calm: one accent color for data, one warm color for "lower" and the age boxes, generous whitespace,
  no decoration that isn't information. The chart stays the focus of every view.
