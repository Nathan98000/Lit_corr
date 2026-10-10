# Stage 2: implement the Genres page review

You are working in the `Literotica_Correlations` project, on its Stage 2 website (`site/`, a static React + Vite
app). The Genres page is on branch `genres-page` at `c1ea0f5`: 10 commits on `main` at `a5118ce`, not merged and not
pushed. It has had an independent design review:

- the review: `docs/stage2/GENRES_PAGE_REVIEW.md`, with screenshots in `docs/stage2/genres-review/`;
- the prompt it followed: `STAGE2_GENRES_PAGE_REVIEW_PROMPT.md`.

All three are untracked. The owner has approved every recommendation in the review, with the decisions below, which
settle its questions. One of them, decision 2, departs from the review after a measurement made since. Implement all
of it.

Where this prompt leaves a detail open, decide, implement it, and record it under *Judgment calls* (see "Finishing").
Stop only for the things under "Checkpoints".

## Read first

1. `docs/stage2/GENRES_PAGE_REVIEW.md`, all of it. Findings F60–F80, quick wins (section 6), concepts M, P and Q
   (section 7), ideas I9–I11.
2. `docs/stage2/GENRES_PAGE_PROPOSAL.md`: sections 3, 5 and 13 (the page as designed and as built, 39 judgment calls).
   Also `STAGE2_GENRES_PAGE_PROMPT.md`: the decisions D1–D10, the spec and the approved copy. Everything there still
   holds unless this prompt changes it.
3. `docs/stage2/DESIGN_REVIEW_2.md`, sections 10–12, for the house style of "Before and after".
4. The code:
   - `site/README.md`;
   - `site/src/` and `site/src/test/`, especially the files named in the review's prompt;
   - `litcorr/stage2/wording.py` and `litcorr/stage2/site_data.py` (the genre functions);
   - `tests/test_stage2_site_data.py`.
5. Reference material in `Claude outputs/` (read it, run copies outside the repository, never import from it, never
   commit it):
   - `genres-review-mockups/mock.html` and its README: concepts M1, M2, P1 and P2 drawn with the real aggregates;
   - `design-review-2-tools/` and its `genres-review/` subfolder: the measuring scripts. `README.txt` lists them;
     `mockL.mjs` and `mockQ.mjs` hold the CSS behind m01 and m06.

   The review's scripts were written in a Linux container, so their paths start at `/home/claude/…`. Change them to
   yours, and use this Mac's cached Chromium as before.

## The owner's decisions

The review's questions (its section 8) and the choices its findings left open:

| # | Question | Decision |
|---|---|---|
| 1 | Keep the order toggle (D3)? | **Keep it.** Add the order line (F75), which also holds the toggle (F69) |
| 2 | r to three decimals? | **No.** Measured since the review, a third decimal adds 2.8–3.2 KB to each gzipped genres file, not about 1 KB. "At least 10,000 views" would reach 59.8 KB of its 60 KB cap. Ties keep their current deterministic order (topics' order, A–Z). The file format doesn't change |
| 3 | View 2: Copy link and Show the numbers? | **Yes** (F80) |
| 4 | Page titles from the question? | **Yes** (F73) |
| 5 | Concepts and ideas | **M1** for mostly-zero characteristics. **P2** for View 2, plus P1's units, key and mix-row label. **Q1** for phones. Ideas **I9** and **I10**: yes. **I11: no**, since it would turn the answer's lists into up to 16 extra tab stops for a small gain |
| 6 | New and changed wording | **Approved as written under "Copy"** below |
| 7 | The story-age note's coverage (F71) | **Approved** (touches a hard rule; the rule is updated below) |
| 8 | A real phone | The owner will try it separately. Not part of this work |
| 9 | Git lock files | **Approved:** git may delete its lock files. If your environment asks, request deletion permission for the project folder |
| — | The ▲▼ position (F61a) | **One mark column beside the genre's name, for every form**: numbers, yes/no, mostly zero, bands and named groups. Today only named groups have one. The value column then holds only the number |
| — | F64, the age note's button | Keep `replaceState`, as Explore's "Switch to …" does. Fix only focus |
| — | F78, the takeaway's words | Keep the D10 words where they exist and "higher / lower" elsewhere. Fix only the duplicates and the double parentheses |
| — | Q1 on Explore | No. Explore's K1 line stays as it is; Q1 is for the Genres page only |

## Rules that still hold (updated for this round)

- **No network access to Literotica.** Never open literotica.com with any tool.
- **Data stays private and aggregated.**
  - Ship only `meta.json`, `v/<characteristic>/<included>.json`, `patterns.json` and `genres/<included>.json`.
  - No new data fields or files, and no format changes. Decision 2 keeps r at two decimals.
  - Each genres file stays at or under 60 KB gzipped.
  - `data/` is read-only. Never run `probe`, `collect`, `process` or `export-handoff`.
  - `python -m litcorr site-data` (offline) runs once, for phase 2's direction words. Then regenerate the fixtures
    (`python -m litcorr.stage2.synthetic site/src/test/fixtures/aggregates`). `git diff` must show only `meta.json`
    (the real one and the fixtures'). If any `v/` file, `patterns.json` or genres file changes, find out why before
    going on.
- **Honest interpretation.**
  - No causal language. No notes about chance, and no reminders that correlation is not causation.
  - "Clearly differs", "stands out" and "sets apart" are said only through the D2 rule.
  - Genres are A–Z by default; the only other order is the D3 toggle. View 2 orders characteristics within one genre
    and never orders genres.
  - Sample sizes stay visible.
  - **The story-age note (updated, F71).**
    - View 1 shows it whenever the genres' median ages in the current option span 5 years or more, whatever the
      option, except on publication year and story age.
    - View 2 shows it whenever the genre's median age and all genres' differ by 3 years or more, whatever the option.
    - In both, the "Compare stories published 2020 or later" button shows only with All stories, and only where the
      characteristic allows that option.
  - The independence statement stays.
- **Methodology is unchanged.** The measures, binning, weights, MIN_N 10 / SMALL_N 30, the "tend to" rule, and the D2
  rule with its thresholds and reference group.
- **No new dependencies.** No npm or Python packages, fonts or font weights, CDNs, analytics or external requests.
  Checking tools run from a temporary directory outside the repository.
- **Explore, Patterns and How it works keep their behavior.** The exceptions are the one Explore fix in phase 1 and
  How it works' sentences in phase 10. `exploreLayoutGuard.test.js` must keep passing unchanged.
- **Addresses keep working:** `#/explore?…` (with `&check=age`), `#/patterns?…`, `#/genres?…` (`var`, `include`,
  `genre`, `sort`, `view`), `#/methodology` and `#/methodology/<section>`.
- **US English** for everything a visitor reads. The scans in `siteText.test.js`, `scans.js` and `median.test.jsx`
  must pass on all new copy (no "because", no causal words, no UK spellings, no "typical story" or "middle half").

## Budgets and quality bar

- **First load** ≤ 155 KiB of gzip response bodies (`firstbodies.mjs`; 152.3 KiB now on this Mac). This round should
  add well under 0.5 KiB to it. Report what a visit that starts on `#/genres` costs (203.6 KiB now), and the Genres
  chunk's size.
- **Layout shift** under 0.1 everywhere (`clsgenres.mjs`; 0.091 now after another option at 375 px). No "Loading…"
  flash after the first chart.
- **Page movement:** `snapgenres.mjs` stays at 0 px in 64 of 64 cases. Choosing the order from its new place counts,
  and so does Highlight with I9's repeated row.
- **Reduced motion** is honored (I10).
- **No overlaps.** Real glyph boxes stay clean for every form at 320, 375, 768 and 1440 px, with the site font and
  with `'"DejaVu Sans", Verdana'`: `labelsgenres.mjs`, and the review's `labelsfont.mjs` with `FONT=…`. That includes
  the new mark column, M1, P2, I9's row and the order line.
- **Touch targets** of at least 44 px. **Text contrast** of 4.5:1 or more. **Non-text contrast** of 3:1 or more for
  every mark that carries meaning.
- **axe-core:** no violations (`axegenres.mjs`, extended to the new states). **Lighthouse:** no label-in-name failure
  on either view.

## Copy (approved; US English; nothing causal)

Counts, names and numbers come from the data; the examples use today's data. "{min_n}" is `meta.genre_rule.min_n`
(30) and "{min}" is `meta.min_n` (10). Never write the literals.

| Where | Text |
|---|---|
| View 1 heading (F63) | "{k} of {m} genres clearly differ from all genres", or "1 of {m} genres clearly differs from all genres", or "No genre clearly differs from all genres". *m* is the number of genres with at least {min_n} stories with the characteristic in this option |
| View 1, after the takeaway's lists, when *m* < 30 (F63) | "Too few stories to compare: Chain Stories (12)." Several genres: "Too few stories to compare: How To (13), Letters & Transcripts (29), Reviews & Essays (15)." in A–Z order. Muted, on its own line after the All genres line |
| View 1 age note (F69) | "**Story age.** The genres’ median ages run from 4.7 to 19.5 years. [Compare stories published 2020 or later]". One paragraph, with the button as an inline link-style button |
| View 2 age note | Unchanged: "**Story age.** Stories in How To have a median age of 15.7 years; stories in all genres, 9.3 years." plus the button where allowed |
| Order line (F75) | "Genres in alphabetical order", "Genres by median, highest first", "Genres by share, highest first", or "Genres by share with any, highest first". Named groups and bands always read "Genres in alphabetical order" |
| Live region after an order change (F75) | The order line's words only, with a period |
| Value-column heading (F74) | "Median" (numbers), "Share" (yes/no), "Median" and "With any" (mostly zero, M1) |
| M1 heading over the plot (F79) | "Among stories with any ({unit})", with the unit only when it is a plain one (as `splitHeadings` does now) |
| M1 on phones, the value column's heading | "Median" over "with any" (two lines, right-aligned) |
| Mostly zero, everywhere (F79) | "above 0" becomes "with any" (the next five rows) |
| — legend | "Share of stories with any" is gone in M1. The legend reads "Median and interquartile range among stories with any" and the ▲▼ key |
| — All genres line | "All genres: **43%** of stories have any; among those, median 0.422 per 1,000 words, interquartile range 0.227–0.768." |
| — details and row names | "73% with any · among those, median 0.709 per 1,000 words · interquartile range …" |
| — table columns | "With any · Median among those · Interquartile range among those" |
| — order toggle | "A–Z / By share with any" |
| View 2 small sample (F60), 10 ≤ n < {min_n} | Heading: "Fewer than 30 stories in Chain Stories match “Published 2020 or later”: too few to compare." Then the "Show all stories" button and the topics |
| View 2, nothing stands out | "Its stories are close to those of all genres on each of the {m} characteristics compared." *m* counts the characteristics with at least {min_n} stories |
| View 2 topic counts (F63) | "{k} of {m} stand out", with *m* the characteristics compared in that topic. Else "{n} characteristics" |
| View 2 key, P2 (F67) | Two items. A bar swatch: "How often a Romance story is the higher one, against a story from all genres (times in 100)". A zone swatch: "No clear difference: 40 to 60 in 100 (how this is decided)", where "how this is decided" links to `#/methodology/genres`. When mix rows are shown, a third: "A different mix: Romance above, all genres below" |
| View 2, above each list and each open topic (P2) | Tick labels "0", "25", "50", "75", "100 in 100" (phones: "0", "50", "100"). Over the values column: "Romance · all genres" |
| View 2 values (F67, F61b) | Numbers: "7.79 · all 19.3 per 1,000 words" (the unit only when plain). Yes/no: "24% · all 27%". Mostly zero: "76% with any, median 2.57 · all 83%, 1.19 per 1,000 words". Bands: "6–20 · all 2–5". Named groups: unchanged ("Second person (you) 55% · all 2%") |
| View 2, a row too small to compare | In the plot cell, muted: "Too few stories to compare" |
| View 2 actions (F80) | "Show the numbers" / "Hide the numbers" · "Copy link" |
| View 2 table (F80) | Caption: "The numbers behind the lists: What stands out about stories in Romance?" Columns: "Characteristic · Romance · All genres · Stories in Romance · Compared with all genres" |
| Page titles (F73) | View 1: the question ("How do genres differ in story length in words?"). View 2: "What stands out about stories in Romance?". While the page or its file loads: "How do the genres’ stories differ?" |
| Picker on the Genres page (F77), a query matching publication month or weekday | "Publication month and weekday aren’t compared on this page." |
| Picker on the Genres page (F77), a query naming a popularity measure | "“Average rating” is a popularity measure, not a story characteristic." (Explore's sentence) with the link "See it in Explore →", opening Explore with that measure and the current characteristic |
| Picker on the Genres page (F77), topic blurbs | A topic that holds a characteristic the page leaves out lists its remaining characteristics' labels instead: "Publication year, published on a weekend, years online" |
| How it works, "Comparing genres", first paragraph (F74) | Add: "All genres includes each genre’s own stories; the largest genre, Erotic Couplings, is about 12% of it." The name and the share come from `meta.genres` (`size`), rounded to a whole percent |
| How it works, second paragraph (F74, F75) | Add: "The comparison uses every story, not only the medians, so a genre can clearly differ while its median is close to that of all genres, or the reverse. The lists above a chart name the genres in order of the size of their difference, largest first." |
| How it works, third paragraph (F79) | "When most stories score 0 on a characteristic, the page shows how many stories have any, and the median and interquartile range among them." The month and weekday sentence stays |
| Direction words (F72, adds to D10) | The five "where … peaks" characteristics (`pace_sex_peak_position`, `pace_emotion_peak_position`, `pace_dialogue_peak_position`, `pace_action_peak_position`, `pace_descriptive_peak_position`): "Later" / "Earlier" |
| "Open in Explore" (F76) | Visible text unchanged ("Open in Explore →"); accessible name "Open in Explore: story length in words" (the noun) |

## Work plan

Commit each phase in the repository's style ("Stage 2 genres review: …"). After each phase:

- run the three test commands (`npm test` and `npm run build` in `site/`; `.venv/bin/python -m pytest
  tests/test_stage2_site_data.py`);
- look at 320, 375, 768 and 1440 px and at 200% zoom: no sideways scroll, no overlaps, everything usable by touch,
  mouse and keyboard;
- for phases that change a chart, re-run the glyph-box check for the forms touched and `snapgenres.mjs`.

### Phase 0: branch and first commit

- Create `genres-review` from `genres-page` (`c1ea0f5`).
- The first commit holds the review, its screenshots and its prompt: `docs/stage2/GENRES_PAGE_REVIEW.md`,
  `docs/stage2/genres-review/`, `STAGE2_GENRES_PAGE_REVIEW_PROMPT.md`.
- This prompt is committed at the end, with the "Before and after" section, as earlier rounds did.
- Never commit `.claude/`, `Claude outputs/` or anything under `data/`.

### Phase 1: quick wins (review section 6)

1. **Focus after the age note's button (F64).** After "Compare stories published 2020 or later" (View 1 and View 2)
   and after View 2's "Show all stories", move focus to the panel's heading (`tabIndex={-1}`,
   `focus({ preventScroll: true })`). The page must not move.
   *Test:* `document.activeElement` is the heading.
2. **Fetch the genres file at once (F68).** When the first route is the Genres page, call `prefetchGenres(sub)` and
   `GenresPage.preload()` while the app starts, before `meta.json` arrives. In the review's scratch build this was
   three lines in `App.jsx`'s initial route.
   *Check:* `perfgenres.mjs`. The review measured 0.89 → 0.54 s on fast 4G, 2.63 → 2.21 s on slow 4G and 6.62 →
   5.85 s on 3G, and +20 bytes to the main chunk.
3. **The compact desktop card (F70).**
   - The card's numbers go in two pairs of columns (`dl` with `grid-template-columns: repeat(4, auto)`): label, value,
     label, value.
   - Its width follows its content, up to 420 px.
   - Named groups' and bands' shares sit two to a line.
   - *Check:* `detailsgenres.mjs`. About 138 px tall for numbers (230 now), covering at most 5 rows (8 now).
4. **Label-in-name (F76).**
   - "Open in Explore →" gets the name under "Copy".
   - View 2's rows drop their `aria-label`. The visible text comes first and the full description follows in a
     visually hidden span, so each row's accessible name starts with what is on screen.
   - *Check:* Lighthouse's label-in-name passes on both views.
5. **Explore: a no-break space before "→"** in Keep exploring's items. At 375 px, "How do genres differ in story
   length in words? →" puts the arrow on a line of its own.
6. **One more pixel between a one-line genre name and its "N stories" line** on phones (count baseline at
   `first + 15`). Rows keep their 44 px minimum. Measured with Inter, the boxes overlap by 2 px today.
7. **A 30 s timeout** on the real-data sentence scan in `genresWords.test.js`. It takes 13.7 s on a 2-core machine,
   against Vitest's 5 s default.

### Phase 2: the direction words for positions (F72, the data part)

- Add the five "where … peaks" characteristics to `DIRECTION_WORDS` in `wording.py` with "Later" / "Earlier".
- Run `site-data` and regenerate the fixtures, as under "Rules".
- Update the tests that count the D10 characteristics: 20 become 25.
- *Check:* the lists say "▼ Earlier: Non-Erotic, Reviews & Essays, How To." for where sexual language peaks. Row
  names and the table say "clearly earlier than all genres".
- The legend keeps "▲▼ Clearly higher or lower than all genres", as it does for the D10 numbers ("Longer / Shorter").

### Phase 3: small samples (F60, F63)

1. **View 2 (F60).**
   - With 10 ≤ n < {min_n} stories in the option, the heading is the small-sample sentence under "Copy", followed by
     "Show all stories" and the topics. There are no lists and no sub-line.
   - The topics' rows show their values with the small-group styling, and no comparison bar (P2): their r is null.
   - Fewer than {min} stories keeps today's layout, without topics.
2. **View 2, nothing stands out.** The sub-line counts the characteristics compared.
3. **View 2 topic counts.** They count only the characteristics compared.
4. **View 1 (F63).**
   - The heading's denominator is the number of genres compared.
   - The "Too few stories to compare: …" line follows the takeaway when any genre is left out.
   - The chart's accessible name (title) and the live region use the same words.
   - The heading's count of marked genres is unchanged: genres with too few stories are never marked.
5. *Tests:*
   - Chain Stories with 2020 or later: View 2's heading, no sub-line, topics present.
   - View 1 says "of 29" and names Chain Stories (12).
   - With "5,000 words or more", three genres are named.
   - With All stories, nothing changes except where a characteristic's missing values leave a genre under {min_n}:
     `dlg_adverb_tag_share`, "of 28".

### Phase 4: number formats (F66)

One function decides how a chart prints its numbers. View 1's value column, the All genres line, the details, the
row names and the table all use it, and so do View 2's values, row names and table, per characteristic.

- **Decimals.**
  - Numbers (`fmt: "num"`): *d* = the most decimals among the All genres median, p25 and p75 as the file writes them
    (three significant digits, no trailing zeros), capped at 3. Every number in the chart is written with *d*
    decimals ("43.0 words, interquartile range 31.7–62.2"; "18.0" above "18.4"), as Explore writes one number of
    decimals per column.
  - A non-zero value that would print as 0, or with a single significant digit, gets two significant digits instead
    ("0.088").
- **Percentages** (`fmt: "percent"`): whole percents. With one decimal when the All genres median is under 10%
  ("1.9%" against "2.3%").
- **Shares** (yes/no, with any, groups): whole percents, one decimal under 1%. A share above 0 that would round to
  "0.0%" reads "<0.1%". No percentage reads "0%" unless it is 0.
- **Years:** whole.
- **Minus signs:** "−" everywhere, percentages included.
- **Ranges** use an en dash ("2,050–6,320"), but "to" when either end is negative ("−0.333 to 0.059").
- *Tests:*
  - Rare words: How To and all genres no longer print the same value.
  - Paragraph length prints one number of decimals.
  - "Unrecognized words" never prints "0%" among stories with any.
  - Build-up of dialogue uses "−" and "to".
  - Story length is unchanged ("3,610", "2,050–6,320").

### Phase 5: the mark column and the mostly-zero chart (F61, F65, F79; concept M1)

1. **The mark column (F61a), every form.**
   - Every View 1 chart gets a mark column right after the genre's name (18 px; the named groups' ≠ column, extended
     to all forms in `rangeLayout`'s genre options and in `genreLayout.js`).
   - ▲ ▼ ≠ move there. The value column prints only the number.
   - Explore's layout must not change (the fingerprint guard).
2. **M1 replaces the split chart** at every width.
   - One row per genre: name, mark, then a plot of the interquartile range and median among stories with any, on its
     own scale with ticks.
   - The value columns:
     - Wider screens: "Median" (the median among stories with any), then "With any", a 40 px bar of the share and its
       percentage, then Stories.
     - Phones: one value cell with the median (13 px, semibold) over the share (12 px, muted).
   - The dashed line is all genres' median among stories with any, labeled under the plot, as now.
   - All genres first on its band, hatching for small genres, and "Fewer than {min} stories" (or "Fewer than {min}
     stories with any" in the plot when the genre has enough stories but too few with any).
   - One tab stop, one details line (phones) or card (desktop).
   - The order toggle's second option sorts by the share with any, as D3 specified.
   - Follow `mock.html?c=M1` in `Claude outputs/genres-review-mockups/`.
   - *Check:* the page for romance language is about 1,730 px at 375 px (3,933 now).
3. **"with any" everywhere (F79)**, as under "Copy", including How it works.
4. *Tests:*
   - M1's layout has no overlaps (estimated boxes) at 320–1440 px.
   - How To's ▲ for repeated five-word phrases sits in the mark column, not beside "76%".
   - One tab stop.
   - The table's columns.
   - The new words.

### Phase 6: a tapped genre on a phone (F62, concept Q1)

- On the Genres page, below 560 px, the details line sticks to the bottom of the screen while its chart is on screen.
  Use `position: sticky; bottom: 0`, as the compare table's tapped cell does (`.cell-detail`, F53), with a top shadow
  and rounded top corners.
- It stays a line under the chart in the document, so a screen reader finds it where it is today.
- *Check:*
  - `mockQ.mjs`'s Q1 case on the real code: after tapping Anal 300 px from the top, the line is on screen (548–667 px
    in the review).
  - The same for M1, yes/no and named groups.
  - Tapping again or Escape closes it, and the page doesn't move.

### Phase 7: the answer above the chart (F69, F71, F74, F75)

1. **The age note (F69, F71).**
   - The shorter View 1 wording.
   - The updated coverage under "Rules": any option, not on publication year or story age.
   - The button only with All stories.
2. **The legend on phones (F69):**
   - at most two lines for numbers and yes/no at 375 px;
   - 12.5 px text, row gap 2 px, column gap 12 px;
   - if it still doesn't fit, drop the "Median of all genres" key below 560 px, since the dashed line is labeled under
     the chart and passes through All genres' dot, and record it.
3. **The order line (F75)** is a line of its own between the legend and the chart.
   - On the left, in the axis-title style (12.5 px, semibold, second ink), its words from "Copy".
   - On the right, the A–Z / By … toggle, moved out of the controls row. Draw it compact (36 px visible), with an
     invisible 44 px target.
   - Named groups and bands have the line without a toggle.
   - The live region says only the line's words when the order changes.
   - *Check:* the first genre row at 375 × 667 is at about 875 px or less (925 now), and the controls take three lines
     at 320 px (four now).
4. **The value-column heading (F74):** "Median" or "Share", like the Stories heading. M1 has its two headings.
5. **I10: rows glide when the order changes.**
   - Each row moves from its old place to its new one in 300 ms with Explore's glide easing (`lib/motion.js`,
     `useGlide.js` for the pattern).
   - Only the order toggle triggers it. With reduced motion, rows jump.
   - No page movement, and no layout shift (transforms only).

### Phase 8: named groups and bands (F72)

- **Group names on the chart.** Above the All genres row (between the order line and the first row), each group's
  name sits over the middle of its segment of All genres' bar, when the segment is at least the name's width plus
  8 px. Names that don't fit are left to the legend. Glyph boxes must stay clean at every width.
- **The near-white group** (#efece6) gets a 1 px #a5a29a outline on its segments.
- **Bands:** colors on an even scale of contrast from #e1ebfd to #1d4a99, so that neighbors differ equally (about
  1.39:1 with 7 bands, 1.64:1 with 5).
  - A share prints in white or ink only where that ink reaches 4.5:1 on the segment, and the segment is at least 34
    px wide. Otherwise the share is only in the details and the table.
- **"Genre medians run from X to X"** is left out when both ends are the same (bands and numbers).
- **The palettes** move from `genreLayout.js` into custom properties in `genres.css`. Segments refer to them by group
  index; each color's ink is a class.
  - A test reads the values from `genres.css` and checks every share's ink at 4.5:1.
  - It also checks neighboring band colors at 1.3:1 or more.

### Phase 9: View 2 (F61b, F67, F78, F80; concept P2)

1. **P2 rows.** Every row except named groups shows the comparison bar.
   - **The scale:** 0 to 100. A shaded zone from 40 to 60 (#ece9e2), with its two edges drawn as 1 px #8f8a80 lines
     (3.3:1 against the page), since they carry the rule's thresholds. A thin center line at 50 (third ink).
   - **The bar:** from 50 to 50 × (1 + r), 10 px tall, the accent ink (#2b63c6). Its rounded number is printed at the
     bar's end (12 px, second ink).
   - **Named groups** keep their two thin 100% bars and gain the key's third line.
   - **Rows with r null** (fewer than {min_n} stories) show "Too few stories to compare" in the plot cell, muted.
   - **Headers.** Each list and each open topic gets a header row with the ticks and the values column's heading,
     from "Copy".
   - **Layout.** Desktop keeps the 250 px label column. Phones keep the label on its own line, then the plot and the
     values. The values may wrap to two lines.
   - Follow `mock.html?c=P2`.
   - P2 replaces the two-layer plot, and with it the gray band. The review's quick win 7 (outlines for that band) is
     therefore moot, except for named groups' two bars, which keep their 1 px segment strokes.
2. **Values with units and both numbers for mostly-zero rows**, as under "Copy" (F61b, F67).
3. **The key**, as under "Copy". It replaces today's g03 key.
4. **The takeaway (F78).**
   - When publication year is among the three largest, story age is skipped and the next one is taken.
   - A noun that ends in a parenthesis takes its word after a comma: "word variety (type–token ratio), higher".
5. **Copy link and the numbers (F80)**, under the topics, as on View 1.
   - The table has every characteristic the file holds, in topics' order, with a topic row heading each group.
   - Values follow the View 2 values (phase 4's formats).
   - "Compared with all genres" uses the row comparison words ("Clearly lower", "No clear difference", "Too few
     stories to compare", "A clearly different mix").
6. *Tests:*
   - The bar's length from r, and r null → no bar.
   - The zone and the key.
   - How To's repeated five-word phrases shows both numbers.
   - Chain Stories' takeaway skips story age.
   - Copy link, and the table's rows and caption.
   - The accessible names start with the visible text.

### Phase 10: titles, the picker, How it works (F73, F74, F77)

1. **Page titles** (F73), as under "Copy".
   - Set them when the file is on screen, as Explore does with `document.title = d.title`.
   - The fallback while loading replaces "Genres · What do popular Literotica stories have in common?".
2. **The picker on the Genres page** (F77):
   - the excluded-characteristic line;
   - the popularity-measure line with its link (the picker's `onPickMetric` path, pointed at Explore);
   - topic blurbs built from the kept characteristics.

   Explore's picker must not change (its tests).
3. **How it works** (F74, F75, F79): the sentences under "Copy". The largest genre's name and share come from `meta`.

### Phase 11: the highlighted genre at the top (I9)

- When a genre is highlighted, every View 1 form draws its row a second time right under All genres, in both orders.
  - It has the highlight wash, its name in semibold, its mark, its values, and a 1 px rule under it.
  - The row in its place stays as it is.
- The repeat is `aria-hidden` and not part of the keyboard sequence. Hovering or tapping it shows that genre's
  details, as its own row does.
- With no highlight, nothing changes.
- *Checks:*
  - Choosing Highlight doesn't move the page (`snapgenres.mjs` from the top and 300 px down).
  - The glyph boxes stay clean.
  - The heading's counts are unchanged.

### Phase 12: finishing

1. **Measure** with copies of the tools (add new scripts to `Claude outputs/design-review-2-tools/genres-review/`,
   never to the repository), and compare with the review's numbers:
   - `firstbodies.mjs`, and a visit that starts on `#/genres` (bytes, requests, the chunk);
   - `perfgenres.mjs`: the first chart on four networks for both views, and the cost of each change;
   - `respgenres.mjs` at 1×, 4× and 6×, including M1 and View 2 with every topic open;
   - `detailsgenres.mjs`: phones (Q1) and the compact card;
   - `labelsgenres.mjs` and `labelsfont.mjs` (DejaVu Sans), all forms, View 2 rows;
   - `snapgenres.mjs`, `clsgenres.mjs`, `tapsgenres.mjs`, `taprows.mjs`;
   - `axegenres.mjs`, extended to M1, the small-sample View 2 and View 2's table;
   - `forcedgenres.mjs` in light and dark (M1, P2, the group names, the sticky line);
   - Lighthouse on both views;
   - `heightsgenres.mjs`: page heights and the first row;
   - `a11ygenres.mjs`: announcements and focus;
   - `history.mjs`;
   - `sentences.mjs`: read every changed sentence again.

   Two of the builder's scripts use the genre id `fan-fiction-and-celebrities`, which doesn't exist; the real id is
   `celebrity-stories`. Fix it in your copies.
2. **After screenshots** as `docs/stage2/genres-review/a….png`, small and palette-compressed like the review's:
   - the first screen at 320 and 375 px;
   - story length at 375 and 1440 px (the mark column, the order line, the value heading, I9 with Romance);
   - romance language and repeated five-word phrases in M1 at 375 and 1440 px;
   - a tapped row at 375 px (Q1);
   - the compact card;
   - named groups with their names, and a band chart;
   - View 2 for Romance at 375 and 1440 px (P2);
   - View 2 for Chain Stories with 2020 or later;
   - View 2's table;
   - the order line after "By median";
   - the picker for "month" and "rating".
3. **Write up.** Add **"10. Before and after"** to `docs/stage2/GENRES_PAGE_REVIEW.md`, shaped like section 10 of
   `DESIGN_REVIEW_2.md`:
   - a headline-numbers table (the review's number, then after);
   - every finding, concept and idea with its commit;
   - the after screenshots;
   - *Judgment calls* (one line of reasoning each);
   - *Still open*;
   - *Not done, on purpose*: decision 2 and I11, with their reasons.

   Also update:
   - the status line at the top of the review;
   - `site/README.md`, where it describes the Genres page's forms, View 2, the details on phones, the titles and
     `loadGenres`.
4. **Final run** of the three test commands and the build. Commit, with this prompt, and don't push. Summarize for the
   owner in a few lines.

## Tests to add (Vitest, with the fixtures)

- Phases 1–11 name each one.
- Keep or update every existing Genres test whose words or layout changed, and say in the commit which assertions
  changed and why.
- The banned-word and US-spelling scans must cover every new sentence, including How it works' and the picker's.

## Checkpoints: stop and ask before

- Any change to the data shipped beyond phase 2's `meta.json`: a new field, a file, a format change, or a genres file
  over 60 KB gzipped.
- Anything else in the hard rules' territory: interpretation, methodology (including the D2 rule and its
  thresholds), dependencies, fonts or external requests.
- Wording beyond "Copy", except grammar fixes built from the data's existing fields, recorded as judgment calls.
- Going over the 155 KiB first-load budget, or a layout shift of 0.1 or more.
- A change to Explore, Patterns or How it works beyond phase 1's arrow and phase 10's sentences.
