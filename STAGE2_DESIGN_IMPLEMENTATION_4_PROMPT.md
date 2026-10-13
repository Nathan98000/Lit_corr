# Stage 2: implement design review round 4

You are working in the `Literotica_Correlations` project. Its Stage 2 website, *Story Patterns* (`site/`, a static
React + Vite app), lets visitors explore Literotica stories in aggregate on five pages: Explore, Patterns, Genres
(with its "One genre" view), Trends (All changes and one characteristic) and How it works.

The whole site has had a fourth design review: `docs/stage2/DESIGN_REVIEW_4.md`, with its screenshots in
`docs/stage2/design-review-4/`. The owner has decided what to do with it (below). Implement those decisions. Where
this prompt leaves a detail open, decide, implement it, and record the choice under *Judgment calls* (Phase 9). Stop
only for the things under "Checkpoints".

## Branch

- The branch `design-review-4` exists, made from `main` at `3b04164`, with nothing committed. The review, its
  screenshots and `STAGE2_DESIGN_REVIEW_4_PROMPT.md` are untracked files in the working tree. Check out
  `design-review-4` (`git status` should show only those files, `.claude/`, `Claude outputs/` and this prompt as
  untracked).
- **First commit:** `docs/stage2/DESIGN_REVIEW_4.md`, `docs/stage2/design-review-4/` and
  `STAGE2_DESIGN_REVIEW_4_PROMPT.md` ("Stage 2 design review 4: the review, its screenshots and the prompt").
- Then one commit per logical change, in the repository's style ("Stage 2 design review 4: …"). Read the test results
  before each commit (`npm test | grep … && git commit` commits even when tests fail). Don't push.
- Never commit `.claude/`, `Claude outputs/` or anything under `data/`.
- git deletes its own lock files. If your environment asks, request deletion permission for the project folder. The
  leftover `Claude outputs/_transfer/dr4-transfer.tgz` may be deleted then; it is never committed.

## Read first

1. `docs/stage2/DESIGN_REVIEW_4.md`, all of it. Its findings (F97–F118), concepts (L, U, W, X), ideas (I15–I17) and
   questions (O8–O19) are referred to below by number.
2. The mock-ups the decisions were made on: `Claude outputs/design-review-4-mockups/mocks.js` (`L1`, `U1`, `W1`,
   `X1`, `X2`) and the fresh-eyes answers in `Claude outputs/design-review-4/fresh-eyes/` (`mock/`, `x/` and their
   `scores.md`). The mock-ups were CSS and text injected into the built page. Build the real thing in the components;
   never import anything from `Claude outputs/` into `site/`.
3. The prompts in the repository root, which hold the decisions that still stand. The list is in
   `STAGE2_DESIGN_REVIEW_4_PROMPT.md` ("Decisions that stand"). Where they and this prompt differ, this prompt wins.
4. `site/README.md` and the code you will change:
   - `App.jsx` (`Kicker`, the masthead and its links, the footer, `SITE_NAME`);
   - `components/`: `Explorer.jsx` (`KeepExploring`, `genresQuestion`, `trendsQuestion`), `Controls.jsx`,
     `InlineSelect.jsx`, `RangeChart.jsx`, `PatternBrowser.jsx`, `GenresPage.jsx`, `GenreAnswer.jsx`,
     `GenreProfile.jsx`, `ComparisonProfile.jsx`, `TrendsPage.jsx`, `TrendAnswer.jsx`, `TrendChart.jsx`,
     `TrendChanges.jsx`, `IncludeSelect.jsx`, `DownloadPng.jsx`, `Methodology.jsx` (the phone's section bar);
   - `lib/`: `wording.js`, `rangeLayout.js`, `genres.js` (`profileNote`, `axisTitle`, the takeaway, number formats),
     `trends.js` (`note`, `changesTakeaway`), `data.js` (the cell format), `chartImage.js`, `urlState.js`;
   - `styles.css`, `comparison.css`, `genres.css`, `trends.css`, `palettes.css`;
   - the tests in `site/src/test/`, including `exploreLayoutGuard.test.js`, the One genre fingerprints, the copy scans
     and `noPageMove`;
   - Python: `litcorr/stage2/wording.py`, `litcorr/stage2/site_data.py`, `tests/test_stage2_site_data.py`.
5. The review's measuring scripts: `Claude outputs/design-review-4/tools/` (`README.txt`) and the earlier rounds'
   `Claude outputs/design-review-2-tools/` (and its `trends-review/tools/`). They were written in a Linux container:
   change their paths to this Mac's and use the cached Chromium
   (`~/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`),
   with `playwright-core@1.56` and `axe-core@4.10` installed in a temporary directory outside the repository. On the
   Mac the wide font is Verdana, as in earlier rounds.

## The owner's decisions

| # | Decision |
|---|---|
| L1 | **Approved in part.** Explore's rating axis is titled **"Average rating (1 to 5 stars)"**. **No explanation of "median" or "interquartile range" anywhere** (the key stays "Median" · "Interquartile range"; P3:99–102 and O1 stand). The rest of L1 that isn't an explanation goes in: "2,631 stories" in place of "n = 2,631" on phones, and the value label starting clear of the dashed line |
| U1 | **Approved.** On phones the masthead always shows the page being read; the kickers of Genres, Trends and Patterns name the page and the source; Genres' question becomes its h1, as on Trends; Trends' word count keeps "Only include" as a menu. U1's Genres key sentence ("comparing every story, not only the medians") is **not** part of it, and U2 is not done |
| W1 | **Approved.** One genre's note moves above the first list, in Trends' words, and says what a tap does; One genre's axis takes Trends' words; position characteristics say "Later"/"Earlier" in the takeaway; the two values in a row share their decimals; units sit on their own line. Trends' note gains "Tap a row for its chart over time." This revisits the Trends review's 10.1 ("no final period"), as approved. W2 (values first) is not done |
| X1 | **Approved.** One type scale, one spacing scale, one median dot and bar on every range chart, one gray for marks and controls (Phase 2) |
| X2 | **Approved.** One page frame: kicker, the question as the h1 at one size, balanced lines at every width, up to 44 characters wide from 760 px; Patterns gets the kicker, the page-size question and the takeaway box; How it works' h1 takes the page-question size |
| I15 | **Approved.** "One way across": under each one-characteristic chart, the same links, named the same way: "By genre →", "Over time →", "With popularity →" (Phase 7) |
| I16 | **Approved.** Definitions in place on One genre's and Trends' rows, from `meta.json`'s descriptions (Phase 7) |
| O8 | **Approved.** The reading-list measure's `more` and `less` become "get added to more / fewer reading lists per 1,000 views" (F97), with a test, and a data rebuild |
| O9 | **Approved, with "Word count".** One name per idea. The characteristic `story_words` is called **"Word count"** everywhere: its label stays "Word count" and its noun becomes "word count" (no "story length in words" anywhere on the site). `age_years` is labeled "Story age (years online)" (its noun "story age" stays), as O9 proposed. Inside sentences, the genre option reads "all genres" in lowercase on every page, as Trends does today |
| O13 | **Leave it.** Genres' ▲▼≠ marks and their key don't change (F105) |
| O14 | **Denied.** No source line on the PNG images |
| O15 | **Approved.** "Download PNG" becomes **"Download image"** everywhere (the file stays a PNG; the buttons stay where they are) |
| O16 | **No dark mode.** |
| O18 | **Approved.** Median age is removed from the data files (`v/` cells and `genres/` files) |
| — | O10, O11 and O12 are answered by L1, W1 and U1 above. O17 (share image, second font weight) and O19 (renaming Patterns) were not taken up: change neither |

The review's quick wins (section 7) that aren't covered above are also in this round (Phase 8): F104 (Trends' key),
F109 (How it works' phone bar), F110 (44 px on Patterns), F112 (the 400% overflow) and F118 ("and 2 more").

**Not in this round**, on purpose: F101 (Trends' window copy), F105 (O13), the parts of F106 beyond W1 (new unit lines
for rows that have none, the Zipf wording), F111 (O14), F113, F115, F117, L2, U2, W2, I17, dark mode, a share image, a
second font weight, and any change to the Explore headline or the masthead's five pages.

## The changes

After each phase:

- run `npm test` and `npm run build` in `site/`, and `.venv/bin/python -m pytest` at the root;
- look at 320, 375, 768, 1280×720 and 1440 px, and at 200% and 400% zoom: no sideways scroll, no overlaps, and
  everything works by touch, mouse and keyboard.

### Phase 0: branch, baseline

- Check out `design-review-4` and make the first commit (see "Branch").
- The review's `b01`–`b16` screenshots are the "before". Re-measure the baseline on this Mac, with the same scripts
  you will use at the end, so that before and after compare like with like: first-load bytes (`firstbodies.mjs`),
  per-visit bytes (`visitbytes.mjs`), the gzip size of every file in `site/public/aggregates/` (total and the largest
  of each kind), the visual inventory (`inventory.mjs` + `py/inv.py`), the census (`census.mjs`), the tap areas
  (`taps.mjs`), tab stops (`tabcount.mjs`), and Explore's first chart row at 320×568 and 375×667 (`first4.mjs`).

### Phase 1: data (O8, O9, O18)

1. **O8, reading lists.** In `wording.py`: `"more": "get added to more reading lists per 1,000 views"`, `"less": "get
   added to fewer reading lists per 1,000 views"`. Add a test (Python, and a Vitest over `meta.json`) that every
   measure's `more` and `less` read after "tend to": they start with a base verb, never "are", "is", "has" or "were".
   Check the titles with a clear reading-list pattern ("Longer stories tend to get added to more reading lists per
   1,000 views").
2. **O9, one name.**
   - `story_words`: the noun becomes "word count" (singular: "has", "varies"). Its label stays "Word count".
   - `age_years`: the label becomes "Story age (years online)". Its noun stays "story age".
   - Then search the site's own text for "story length" (components, `lib/`, How it works, the PNG builder) and
     make it "word count" where it names this characteristic. "Longer stories", "Shorter" and other `more`/`less`
     phrasing stays.
   - Add a test that no visible string on any page contains "story length in words".
3. **O18, median age.** Remove the median age from every `v/` cell (`[n, medianAge, m0, …]` becomes `[n, m0, …]`)
   and from the `genres/` files (`age`). Update `data.js` (the cell's measures start at index 1), the comment that
   documents the format, every other reader (search for the old indexes and for `age` in `lib/` and `components/`),
   `site_data.py`'s docstring, and the Python tests. "Story age" the characteristic (`age_years`) and the measures'
   `age` flag (the totals note) are different things and stay.
4. Run `python -m litcorr site-data` once, offline, from `data/handoff/litcorr_stage2_handoff_20261008.zip`. If a
   newer handoff zip is in `data/handoff/`, stop and ask.
5. Report the sizes: `meta.json` gzip before and after (it may grow by a few bytes; stop if it grows by more than
   2 KB), every kind of file's total, and `v/story_words/all.json` (part of the first load).

### Phase 2: one visual system, the tokens (X1)

Define the system as custom properties on `:root` in `styles.css`, and use them everywhere (CSS and the SVG charts'
constants). Nothing else about the look changes.

- **Type scale.**
  - Sans: 12 (chart ticks and small labels), 13 (notes, units, keys' small text), 14 (secondary text, keys),
    15 (controls, Explore's body), 16 (rows, lists, How it works' body), 18 (lede). Every half size goes to the next
    whole size (12.5 → 13, 13.5 → 14, 14.5 → 15, 15.5 → 16); 11.5 → 12; 17 → 16 or 18 by role (say which).
  - Serif 600 (Source Serif 4, the only weight): 18 (masthead, sub-sections), `clamp(20px, 2.6vw, 26px)` (chart and
    list headings), `clamp(23px, 3.9vw, 37px)` (the page's question or title). 19 and 21 → 20; 25 → 26; Patterns'
    28–38 and How it works' 32–44 → the page-question size (Phase 5).
  - Line heights: one per size (record them). Don't change font weights in this round.
- **Spacing scale:** 4, 8, 12, 16, 24, 32, 48 px for gaps between blocks. Map today's values to the nearest step,
  but keep these as they are: Explore's first chart row on the first screen at 375×667 (today it ends at 641 px), the
  Trends fold at 1280×720 (the table above 720 px) and the footer's clear space (O3 of the Trends review).
- **Colors:** one gray for marks and control borders, `#857f75` (3.8:1 on the page): `--control` takes it, and the
  gray dots keep it. The other tokens stay. No dark mode.
- **Chart grammar:**
  - the median: a dot of radius 6 with a white 2 px ring on every range chart (Explore's goes from 7 to 6);
  - the interquartile range: a 10 px capsule in `--accent-bar` with a 1 px `--accent` edge (Explore's goes from 12
    to 10; the Genres page's "with any" capsule stays as the Genres decisions made it);
  - "all stories": the dashed 1 px `--ink-2` line;
  - a comparison's score (One genre, All changes): the radius-5 dot on its line, blue when clear, gray when not;
  - values printed beside marks: 13 px, 600, ink.
- The text-width estimates the charts lay out with (`textWidth(…, size, weight)` and friends) must use the new sizes.
- Add a test that fails when `styles.css` or the other CSS files use a font size outside the scale.
- Update `exploreLayoutGuard.test.js` and One genre's fingerprints for this change, on purpose, and say so in the
  commit.

### Phase 3: names and small fixes on Explore and everywhere (O9, O15, L1)

- **"all genres" in sentences.** Explore's and Patterns' questions show "all genres" in lowercase, as Trends' does
  ("In all genres, how does the average rating vary with word count?"). The option lists keep "All genres".
- **"Download image"** (O15) on every button that says "Download PNG" today, with accessible names to match
  ("Download image of this chart", "… of these changes", "… of what stands out"). The file and its name don't change.
- **The rating axis** (L1): Explore's axis title for the average rating reads "Average rating (1 to 5 stars)", on the
  page and in the image. Only the average rating's axis changes; the measure's label, menu and sentences don't. The
  scale's words are copy, not a data value: keep them in `lib/wording.js`, keyed on the measure's `format`
  ("rating"), and cover them in the copy tests.
- **"2,631 stories"** in place of "n = 2,631" beside each row on phones (`rangeLayout.js`); check its glyph boxes
  at 320 px with both fonts.
- **The value label clears the dashed line**: when the "all stories" line would pass through a row's printed value,
  start the value 6 px right of the line (keep it inside the chart; if there is no room, record what you did).

### Phase 4: where am I (U1)

- **The phone masthead keeps the page being read.** Today it drops How it works below 602 px, Explore below 414 px
  and Patterns below 352 px. New rule: at each width the same number of links shows as today, the page being read is
  always one of them, and the link that makes room is the last one (in the masthead's order) that isn't the page
  being read. So at 375 px on Explore: "Explore Genres Trends"; on How it works: "Genres Trends How it works". Check
  the fit for every page at 320, 352, 375, 414, 484 and 602 px (`mastfit.mjs`); if a page's set doesn't fit, stop and
  ask. The current page keeps today's underline.
- **Kickers name the page and the source**, built with `Kicker` so that its pieces never break badly (no "·" alone
  at a line's start or end; the earlier rounds' `breaks` check):
  - Genres (both views): "Genres · about 9,000 Literotica stories · 30 genres";
  - Trends (both views): "Trends · about 9,000 Literotica stories · 2000–2026";
  - Patterns: "Patterns · about 9,000 Literotica stories · 30 genres" (Phase 5);
  - Explore keeps the site's headline, as decided. How it works gets no kicker.
  The counts and years come from `meta.json`, as today.
- **Genres' question is its h1** (both views) and the kicker a `p`, as on Trends (TRI:329–332). Patterns follows in
  Phase 5. Check the accessibility tree: one h1 per page, the question's selects named as today.
- **Trends' word count keeps "Only include" a menu**: "All stories ▾", with its Length options turned off inside it,
  as Explore turns off the options that don't apply. The line "Length options don't apply to word count" goes.

### Phase 5: the page frame (X2)

- **The question** on Explore, Genres, Trends and Patterns: `text-wrap: balance` at every width (it keeps the blue
  phrase whole on phones: "vary with / word count ▾?"), and `max-width: 44ch` from 760 px (today 34ch). Check that no
  question's last word is left alone at 768, 1024, 1280 and 1440 px for every characteristic name.
- **Patterns** opens like the other pages: the kicker (Phase 4); the question "Clear patterns in [all genres ▾] with
  the [average rating ▾]" as the page's h1 at the page-question size (the "Patterns" h1 goes; the page's
  `<title>` keeps "Patterns"); the count line ("65 of 181 characteristics have a clear pattern …") in the takeaway's
  blue-ruled box, at the takeaway's size.
- **How it works**: its h1 takes the page-question size, `clamp(23px, 3.9vw, 37px)`.

### Phase 6: one grammar for the two comparisons (W1)

On One genre (`genres.js`, `GenreProfile.jsx`, `ComparisonProfile.jsx`) and Trends' All changes (`trends.js`):

- **One genre's note** moves above the first list, where Trends' note is, and reads:
  "Each dot compares a story in Romance with a story from all genres, counting every story, not only the medians
  (50 is a tie; how this is decided). Tap a row for every genre's numbers."
  - "how this is decided" stays the link it is today (never broken inside, a 44 px target).
  - "Click" where the device can hover, as today.
  - The gray-dots sentence goes from the note: the topics' own line says it, above the topics.
  - In an open topic with no list shown, the note keeps today's in-topic form, in the same words.
- **One genre's axis title** takes Trends' words: "How often a story in Romance comes out higher than a story from
  all genres, out of 100" (on the page and in the image).
- **The takeaway's position words**: a characteristic whose `more_word` and `less_word` name a position (today
  "Later"/"Earlier" and "Later"/"Sooner") is listed under its own word, not under "Higher"/"Lower": "▲ Later: where the
  first sex scene starts." The lists below keep their titles.
- **The same decimals in a row**: in each One genre row, the genre's value and all genres' value take the same number
  of decimals: the number that gives the larger of the two three significant digits, and never fewer than two
  significant digits for the smaller (then both take the extra decimal). "7.8 vs 19.3", "10.0 vs 3.8", "2.32 vs 5.75",
  "309 vs 137". Shares (%) keep today's format. A trailing zero is kept only when the other value in the row needs that
  decimal. Run it over every row of every genre and option, and list in the write-up any row where a value gains more
  than one trailing zero or drops below two significant digits.
- **Units on their own line** under the row's name, on One genre and Trends, wherever a row has a unit.
- **Trends' note**: "Each dot compares a story from 2020 or later with a story from 2000–2009 (50 is a tie). Tap a row
  for its chart over time." ("Click" where the device can hover, by One genre's rule.) The same note in open topics.

Update One genre's fingerprints for these changes on purpose, and say so in the commit.

### Phase 7: one way across, and definitions in place (I15, I16)

**I15, the same links under every one-characteristic chart.** On Explore's chart, the Genres page's one
characteristic and Trends' one characteristic, a single line of text links right under the chart:

- "By genre →" opens the Genres page's one characteristic for this characteristic (with this "Only include" option,
  as today's links do);
- "Over time →" opens Trends' chart for this characteristic (with this genre and option where Trends offers them, as
  `trendsQuestion` does today);
- "With popularity →" opens Explore for this characteristic (this genre, and the measure last used on Explore).

A link shows only when its page has the characteristic (the Genres page leaves out publication month and weekday;
Trends leaves out `meta.trend.excluded`), and the page you are on drops out. Accessible names say the characteristic
("Word count by genre", "Word count over time", "Word count with popularity"). The links prefetch on hover and focus
as today's do.

What this replaces:
- the Genres page's "Open in Explore →" button;
- Trends' "Compare genres →" button ("See all changes →" stays the primary action, and "Download image" stays);
- in Explore's "Keep exploring", the two characteristic items ("How do genres differ in word count? →", "How has word
  count changed over time? →"). Keep exploring keeps its Patterns item, the One genre item when a genre is chosen
  ("What stands out about stories in Romance? →") and its three example questions. This updates the Keep exploring
  decision (GP:360–364, TP:388), as approved. "Download image" stays Explore's only button.

**I16, definitions in place.** On One genre's and Trends' rows (lists and open topics), each row gets a small
definition button just after its name:
- an 18 px circle with "?" (13 px, `--ink-2`, a 1 px `--control` ring), with a 44 px hit area that doesn't overlap the
  row's link or the next row's;
- pressing it shows, under the row's name, the characteristic's `description` from `meta.json` (13 px, `--ink-2`, at
  most 62ch), and pressing it again hides it;
- its name is "What “Word count” measures" (Explore's notes already use that wording), with `aria-expanded` and
  `aria-controls`.

A button can't sit inside a link, so restructure the row: a container whose link still opens the chart from anywhere
on the row except the button (for example a stretched link), with one tab stop for the link and one for the button.
Report the tab stops to the first row before and after. Opening a definition must not move the rows above it
(`noPageMove`), and it isn't remembered across Back. Check axe, label in name, forced colors, and the PNG (the image
shows no buttons and no open definitions).

### Phase 8: the quick wins (F104, F109, F110, F112, F118)

- **F104, Trends' key**: draw each key mark as the chart draws it, so none looks like a form control: the blue
  capsule with its dot (no pill outline), the gray capsule, and the bracket as a 16 px line with 4 px ticks; each
  aligned with the first line of its text.
- **F109, How it works on a phone**: at the top of the page the bar reads "How it works" with its "Contents" button
  (no "› Contents"); once a section is reached, "How it works › Where the stories come from", as today.
- **F110, 44 px on Patterns**: each characteristic row's link is at least 44 px tall, and the two selects in Patterns'
  question answer taps over 44 px, as the question's selects do elsewhere. Measure with `taps.mjs`.
- **F112, 400% zoom**: no sideways scroll on `#/trends?genre=chain-stories` (or anywhere) at 320 CSS px.
- **F118**: when Trends' takeaway names fewer changes than its list holds, it ends "and {k} more" ("▼ Fell: average
  paragraph length, median paragraph length, very long paragraphs ('walls of text') and 2 more.").

### Phase 9: finishing

1. **Measure**, with the same scripts as Phase 0, and report each beside the baseline and the review's numbers:
   - bytes: the first load (at or under 155 KiB), each page's visit, the aggregates' sizes (O18's saving);
   - layout shift on every page and switch (under 0.1, worst today 0.021), and no "Loading…" flash;
   - axe: the review's 100-run set (`axesite.mjs`: every page's states at 375, 1440, 200% and 400%), plus a definition
     open (I16): no violations, no sideways scroll;
   - label in name; forced colors (light and dark) on every page;
   - glyph boxes at 320, 375, 768, 1280 and 1440 px with the site font and Verdana: Explore's charts (`labels3.mjs`),
     Trends' View 1 and View 2 (`tglyphs2.mjs`, `tv2glyphs2.mjs`), One genre's rows, the new "2,631 stories" and the
     value labels moved off the dashed line;
   - line breaks (`breaks`): the kickers, the questions, the values, the I15 line;
   - tap areas (`taps.mjs`): Patterns' rows and selects at 44 px or more; I16's buttons;
   - the inventory: target at most 11 font sizes in the page and 3 in the charts (today 22 and 5), and fewer text
     styles than the review's 66;
   - the census: no "story length in words", no "Download PNG", no "In All genres" left on any page;
   - tab stops to each page's first answer, and Explore's first chart row at 320×568 and 375×667;
   - Back and Forward (`backcheck.mjs`), and every address in the review prompt's rule 6 still opening its view.
2. **Fresh eyes.** Repeat the review's eight views with three phone and three desktop stand-ins each (48), with the
   same questions (`fresh-eyes/questions/views.md`), the same situation line and screen-sized captures
   (`fresh.mjs`). Before taking any screenshot, update the fixed answers only where the site's words changed (for
   example V1 Q3's question now ends "vary with word count?"), and note each update. Save the answers verbatim in
   `Claude outputs/design-review-4/fresh-eyes/after/` with a `scores.md` beside today's. Report the scores per view next
   to the review's, especially: V2 "unsure of the scale" (today 6/6), V6 "what to tap" (today 3/6), V5 "gray dots"
   (today 6/6), V1 phones naming their page (today none shown), V7 "developer's note" (today 6/6), and the desktop
   question's last word alone (today 11/24). Don't tune copy to a stand-in's answer; report what you see.
3. **After screenshots** `a01…a16`, the same states as `b01…b16` in `docs/stage2/design-review-4/`, palette-compressed
   to 64 colors (`compose5.py`), plus `a17` (I15's line on Explore, Genres and Trends at 375 and 1440) and `a18` (an
   open definition on One genre and Trends at 375 and 1440).
4. **Write up** a section 11, "Before and after", at the end of `docs/stage2/DESIGN_REVIEW_4.md`:
   - each decision above with its commit(s), and its before and after numbers;
   - the decisions not taken up (O13, O14, O16, O17, O19, and the "Not in this round" list) as "not done, on purpose";
   - before and after side by side (`b…`/`a…`);
   - the measurements, and the fresh eyes;
   - *Judgment calls* (one line of reasoning each) and *Still open* (including no real phone, Safari or screen
     reader, unless you could use them).

   Also update `site/README.md` (the masthead rule, the kickers, the page frame and type scale, I15, I16, "Download
   image", the data format without median age, the budget line if it moves).
5. **Final run** of the three test commands and the build. Commit, with this prompt as
   `STAGE2_DESIGN_IMPLEMENTATION_4_PROMPT.md` in the last commit, and don't push. Summarize for the owner in a few
   lines: what changed, the headline numbers, *Judgment calls*, *Still open*.

## Copy (approved; US English; nothing causal)

Names, counts and years come from the data; never write them as literals. "Romance" stands for any genre.

| Where | Text |
|---|---|
| Explore question | "In [all genres ▾], how does the [average rating ▾] vary with [word count ▾]?" |
| Explore, grouping line | "Stories grouped by word count" |
| Explore, rating axis | "Average rating (1 to 5 stars)" |
| Explore, a row's count on phones | "2,631 stories" (with "*" as today when fewer than 30) |
| Genres question | "How do genres differ in [word count ▾]?" · "What stands out about stories in [Romance ▾]?" |
| Trends questions | "What has changed in stories across [all genres ▾]?" · "Across [all genres ▾], how has [word count ▾] changed over time?" |
| Trends heading | "Word count clearly rose from 2000–2009 to 2020 or later" |
| Patterns question (h1) | "Clear patterns in [all genres ▾] with the [average rating ▾]" |
| Kickers | "Genres · about 9,000 Literotica stories · 30 genres" · "Trends · about 9,000 Literotica stories · 2000–2026" · "Patterns · about 9,000 Literotica stories · 30 genres" (Explore's headline unchanged) |
| Reading lists | "get added to more reading lists per 1,000 views" · "get added to fewer reading lists per 1,000 views" ("Longer stories tend to get added to more reading lists per 1,000 views") |
| Story age | label "Story age (years online)" |
| One genre note | "Each dot compares a story in Romance with a story from all genres, counting every story, not only the medians (50 is a tie; how this is decided). Tap a row for every genre's numbers." ("Click …" where the device can hover) |
| One genre axis | "How often a story in Romance comes out higher than a story from all genres, out of 100" |
| One genre takeaway | "▲ Later: where the first sex scene starts." (and "▼ Earlier: …", "▼ Sooner: …") |
| Trends note | "Each dot compares a story from 2020 or later with a story from 2000–2009 (50 is a tie). Tap a row for its chart over time." ("Click …" where the device can hover) |
| Trends takeaway, longer list | "… and {k} more." |
| Trends' word count, Only include | "All stories ▾" (a menu; its Length options turned off) |
| I15 links | "By genre →" · "Over time →" · "With popularity →" (names: "Word count by genre", "… over time", "… with popularity") |
| I16 button | "?" (name: "What “Word count” measures"); the text shown: the characteristic's `description` |
| Image buttons | "Download image" (names: "Download image of this chart", "… of these changes", "… of what stands out") |
| How it works, phone bar at the top | "How it works" · "Contents" |
| Removed | "story length in words" (everywhere) · "Download PNG" · "n = 2,631" · "In All genres" in sentences · the "Patterns" h1 · "How do the genres' stories differ?" and "How have the stories changed?" in the kickers · "Length options don't apply to word count" · "Gray dots, in the topics below, show no clear difference." in One genre's note · "is the higher one" · "Open in Explore →" · "Compare genres →" · Keep exploring's two characteristic items |

The copy scans (UK spellings, causal words, a plain "because", "typical story", "typical age", "middle half",
"borderline", "just past") must pass over every new string, for every genre, characteristic and option.

## Acceptance numbers (real data; report the built figures, and give a cause for any difference)

- Charts whose title said "tend to are added to": 1,146 with all stories (64 with All genres chosen) → 0.
- Visible strings containing "story length in words": 0. "Download PNG": 0.
- First load at or under 155 KiB (today 150.0 on the Mac; `v/story_words/all.json` shrinks with O18).
- Font sizes in the page at most 11, in the charts at most 3; text styles under 66.
- Explore's first chart row on the first screen at 375×667; Trends' table above 720 px at 1280×720.
- axe: 0 violations in every run; sideways scroll 0 px in every run at 400%.
- Tap areas: every control at least 44 px, except the question's words (33–35 px, known and unchanged).
- Layout shift under 0.1 everywhere; no "Loading…" flash.

## Rules that still hold

- **No network access to Literotica.** Never open literotica.com with any tool.
- **Data stays private and aggregated.**
  - The data changes only as O8, O9 and O18 say. Every other shipped byte is the same.
  - No new data fields, files or downloads. `meta.json` may not grow by more than 2 KB gzipped.
  - Groups under 10 stories stay hidden. Size limits: each `genres/` file at most 60 KB gzipped, each `trends/` file
    at most 16 KB.
  - `data/` is read-only. Never run `probe`, `collect`, `process` or `export-handoff`. A collector may be running on
    this Mac: leave it alone.
- **Interpretation.**
  - No causal language and no "because". Nothing reminds visitors that correlation isn't causation.
  - "Tend to", "clearly differs" and "clearly changed" appear only through their rules.
  - Genres are never ranked except "By median" on request; patterns are never sorted by strength.
  - Sample sizes stay visible; totals keep their note; the independence statement stays.
  - I15's and I16's links and text describe one characteristic; nothing suggests which characteristic to look at
    next, or ranks them.
- **Methodology is unchanged:** the measures, groups, minimum sizes (10 and 30), the pattern rule, the Genres and
  Trends rules, windows and periods.
- **No new dependencies** (npm or Python), fonts, font weights, CDNs, analytics or external requests. Static site.
- **Decisions that stand** (`STAGE2_DESIGN_REVIEW_4_PROMPT.md`) still hold except where the table above changes
  them: the headline and "Story Patterns", the five masthead pages and no menu, the footer, US English, "median" and
  "interquartile range" without explanation, no causation reminders, no Copy link, the image buttons' places and
  credit, Explore's default view and Popular list, Patterns grouped by topic A–Z, the Genres page's order, marks and
  forms, the switches ("One characteristic · One genre", "All changes · One characteristic"), Trends' opening view
  and list titles, no borderline or length-band line.
- **Addresses keep working:** every `#/explore`, `#/patterns`, `#/genres`, `#/trends` and `#/methodology` address
  in use today, `#/methodology/<section>` for every section, Trends addresses with `view=changes`, and Explore links
  that carry `mode=…` or `check=age`.
- **Quality bar:** first load ≤ 155 KiB; layout shift < 0.1; no "Loading…" flash; controls never move the page
  ("Show fewer" excepted); reduced motion honored; targets ≥ 44 px; text contrast ≥ 4.5:1 and marks that carry
  meaning ≥ 3:1; no glyph overlaps; axe with no violations; no sideways scroll at 400%.
- **Tests:** add tests for every new behavior (the reading-list grammar, one name per idea, the masthead rule, the
  kickers, the h1s, the notes, the decimals rule, the type scale, I15's links and when they show, I16's button and its
  states, "Download image", the data format without median age). Numbers and years come from the data, never as
  literals. `exploreLayoutGuard.test.js` and One genre's fingerprints change only for the changes above, on purpose,
  and the commit says so. After `npx vitest run -u <file>`, check `git status` for snapshots you didn't mean to change.

## Checkpoints: stop and ask before

- Any data change beyond O8, O9 and O18, or a `meta.json` that grows by more than 2 KB gzipped.
- Anything in the hard rules' territory: interpretation, methodology, dependencies, fonts or external requests.
- Wording beyond "Copy", except grammar built from the data's own fields (record those as judgment calls).
- Going over the 155 KiB first-load budget, or a layout shift of 0.1 or more.
- A masthead set that doesn't fit at some width once the page being read is kept.
- Explore's first chart row leaving the first screen at 375×667, or Trends' table leaving the first screen at
  1280×720, because of the type or spacing scale.
- I16 needing more than one extra tab stop per row, or a row that can no longer be opened from its name.
- Any change to a page beyond what this prompt lists.
