# Stage 2: a detailed design review of the Genres page

You are working in the `Literotica_Correlations` project. Its Stage 2 website lives in `site/`: a static React + Vite
app for ordinary visitors. Explore and Patterns show which story characteristics go with popularity on Literotica. The
newest page, **Genres**, shows how the genres' stories differ. It was proposed, approved with my decisions and built by
Claude sessions in one day, and nobody independent has looked at it as built. Your job is a **detailed, independent
design review** of that page:

- judge it against my brief and the approved proposal;
- check the claims its builder made;
- find what doesn't work for real people on phones and desktops;
- propose improvements.

Be candid. Nothing is sacred except the hard rules below.

## Read first

1. `docs/stage2/GENRES_PAGE_PROPOSAL.md`, all of it.
   - Sections 1–12 are the proposal. Its mock-up figures, g01–g08, are in `docs/stage2/genres-page/`.
   - Section 13, "As built", gives:
     - the commits;
     - the acceptance numbers (13.3) and measurements (13.4);
     - screenshots b01–b10 (13.5);
     - 39 judgment calls (13.6);
     - what is still open (13.7).

     The session that built the page wrote it, so treat its numbers and judgment calls as claims to check, not facts.
2. `STAGE2_GENRES_PAGE_PROMPT.md`: my decisions D1–D10, the specification and the approved copy (its section 6).
3. `docs/stage2/DESIGN_REVIEW_2.md`:
   - sections 1 and 5 show the shape I want for a review (grades, findings with evidence);
   - section 8 lists what worked on the rest of the site;
   - sections 10–12 say what rounds 2 and 3 built and what I changed afterwards.

   Round 1 is `docs/stage2/DESIGN_REVIEW.md`.
4. The code.
   - `site/README.md`.
   - The page itself:
     - in `site/src/components/`: `GenresPage.jsx`, `GenreAnswer.jsx`, `GenreChart.jsx`, `GenreMix.jsx`,
       `GenreSplit.jsx`, `GenreDetails.jsx`, `GenreTable.jsx`, `GenreProfile.jsx` and `useRowDetails.js`;
     - in `site/src/lib/`: `genres.js`, `genreLayout.js`, `rangeLayout.js`, `urlState.js` and `data.js`;
     - `site/src/genres.css`.
   - What it shares with the rest of the site:
     - `App.jsx` (the masthead, the kicker, the routes);
     - `Explorer.jsx` (the D7 button and Keep exploring);
     - `Controls.jsx`, `CharacteristicPicker.jsx` and `InlineSelect.jsx`;
     - `Methodology.jsx` ("Comparing genres");
     - `styles.css`.
   - The tests in `site/src/test/`: the `genres*` files, `exploreLayoutGuard.test.js`, `siteText.test.js`,
     `scans.js` and `median.test.jsx`.
5. The data side:
   - `litcorr/stage2/site_data.py`: the genre functions and constants;
   - `litcorr/stage2/wording.py`: `GENRE_PAGE_EXCLUDED` and `DIRECTION_WORDS`;
   - the format of `site/public/aggregates/genres/<included>.json`, described in the comment on `loadGenres` in
     `data.js` and in 13.2 of the proposal.
6. Reference material in `Claude outputs/`:
   - `genres-page-mockups/`: the proposal's static mock-up;
   - `genre-profiles/gp_rule.py`: the rule, computed with the project's own helpers;
   - `design-review-2-tools/`: the measuring scripts. The end of its `README.txt` lists the ones for the Genres page.

   Read them and run copies outside the repository. Never import from them and never commit them.

**Which code to review.** The page is on branch `genres-page`: 10 commits on top of `main` at `a5118ce`, not pushed.
If I have merged it into `main` by the time you start, use `main`. Check with `git log` before you begin, and name the
commit you reviewed at the top of your report.

## What the site is for

These requirements come from my original brief. Judge the page against them.

- **Audience.** A popular data-exploration site, not an academic project. A visitor who knows nothing about statistics
  should understand the interface within seconds, and should enjoy playing with it for 10–20 minutes.
- **Every chart answers a simple question.** It has a plain-English title, a short explanation, the sample size, and
  the median with some sense of the spread. It never implies more precision than the data supports.
- **Look.** Minimalist, editorial and data-journalism in feel.
  - Generous whitespace, clear typography, restrained color. Charts are the visual focus.
  - It must not look like a generic SaaS dashboard, and it must not be sexualized or gimmicky.
  - It must work well on phones and on desktops.
- **Quality checks named in the brief.**
  - No overlapping labels, and no unreadable charts.
  - Long genre names don't break the layout, and the mobile layout works.
  - Charts have clear titles and axes, and tooltips are understandable.
  - Nothing turns a descriptive difference into a causal claim.

**What the Genres page adds.** Two questions the rest of the site can't answer, about the stories themselves rather
than their popularity:

1. *How does a characteristic differ between genres?* One characteristic in all 30 genres. On screen it is "One
   characteristic"; below it is called View 1.
2. *What stands out about a genre's stories?* One genre against all genres, on every characteristic. On screen it is
   "One genre"; below it is called View 2.

Moving between the two views, and between this page and Explore, must be easy. Each genre is a random sample of about
300 stories. All genres is 8,996 stories, weighted by each genre's size on Literotica.

## The page as built, in brief

**Addresses and navigation**

- The addresses:
  - `#/genres` is View 1 for story length in words, with all stories;
  - `#/genres?var=sex_terms_per_1k&include=y2020&genre=adult-romance&sort=value` adds an option, a highlighted genre
    and the order;
  - `#/genres?view=genre&genre=adult-romance&include=all` is View 2.
- Controls replace the address. The view switch and the links between the views add a history entry.
- The masthead reads Explore · Genres · Patterns · How it works.
  - Below 560 px, How it works leaves it; the footer keeps its link.
  - Below 420 px the links tighten. Below 360 px, Explore leaves and the brand links to Explore.
  - The Genres link opens the last Genres address of the visit. It preloads the page's code and data file on hover or
    focus.
- The kicker reads "How do the genres’ stories differ? · about 9,000 stories · 30 genres".
- The page title is "Genres · What do popular Literotica stories have in common?" for every view.

**View 1, from top to bottom**

1. The question: "How do genres differ in [story length in words]?" For yes/no characteristics it reads "How common
   are [first-person stories] in each genre?". The word opens Explore's search picker, without publication month and
   weekday (D5).
2. The controls:
   - the view switch, a radio group: One characteristic / One genre;
   - "Only include", with the options that conflict with the characteristic turned off;
   - "Highlight": None or a genre. It marks a row and never filters;
   - for numbers, yes/no and mostly-zero characteristics, the order toggle "A–Z / By median" ("By share", "By share
     above 0").
3. The heading: "8 of 30 genres clearly differ from all genres".
4. The takeaway:
   - "▲ Longer: … ▼ Shorter: …", each list ordered by the size of the difference. Twenty characteristics have
     their own words (D10); the others say Higher / Lower or More common / Less common.
   - "All genres: median 3,610 words, interquartile range 2,050–6,320. Genre medians run from 1,280 to 5,060."
5. The story-age note, with All stories, when the genres' median ages span 5 years or more. Today they always do: 4.7
   to 19.5 years. Its button reads "Compare stories published 2020 or later".
6. A legend.
7. The chart, in one of four forms chosen by the characteristic's kind. Of the 185 characteristics, 117 are numbers, 45
   mostly zero, 13 yes/no, 6 ordered bands and 4 named groups.
   - **Numbers:** range rows. The interquartile range is a capsule and the median a dot; the median is printed in a
     value column.
   - **Yes/no:** share rows on a 0–100% axis.
   - **Named groups and ordered bands:** one 100% bar per genre. Groups get a rank palette, bands a range of blues.
   - **Mostly zero:** the split chart, with the halves "Stories above 0" and "Among stories above 0". They sit side by
     side from a 760 px screen and are stacked below it.

   What every form shares:
   - All genres comes first, on a shaded band. For numbers, yes/no and the split chart it is also a dashed line.
   - ▲ ▼ (≠ for named groups) mark the genres that clearly differ.
   - Desktop has a Stories column. Phones show a count under a genre's name when it has fewer than 250 stories.
   - Genres with fewer than 30 stories are hatched and never marked. Below 10 stories they read "Fewer than 10
     stories".
8. The details. Hovering, focusing or tapping a genre shows its numbers:
   - on wider screens in a card under its row;
   - on phones in the line under the chart (K1).

   Both end with "What stands out about stories in {genre}? →". Each chart is one tab stop; ↑ ↓, Home and End move
   between rows.
9. The actions: Show the numbers (a table for every form), Copy link, and Open in Explore →.

**View 2**

- The question: "What stands out about stories in [Romance]?", with a select of the 30 genres.
- The controls: the view switch and "Only include".
- The heading: "28 characteristics clearly set Romance apart from all genres".
- The takeaway: "Biggest differences: …", naming the three largest.
- The story-age note, when the genre's median age differs from all genres' by 3 years or more. Then a legend.
- The lists:
  - "Lower in Romance than in all genres" and "Higher in Romance than in all genres", ordered by the size of the
    difference. Each shows 7 rows, then "Show all".
  - "A different mix" lists named groups.
- "Every characteristic, by topic": eight folded topics, each with a count ("9 of 27 stand out").
- Each row is a link to View 1 with the genre highlighted. A row has:
  - a label;
  - a small plot on its own scale, with no ticks: the genre's interquartile range and median, drawn over all genres'
    in gray;
  - values ("7.79 · all 19.3").
- The edge states:
  - nothing stands out (Fetish);
  - 116 stand-outs (How To);
  - a small sample (Chain Stories, with 12 stories published 2020 or later);
  - too few stories (fewer than 10; never with today's data).

**The rule (D2)**

- A genre clearly differs from all genres on a characteristic when:
  - the rank-biserial correlation is at least 0.20 in size and clear at the 99.9% level;
  - and the genre has at least 30 stories with the characteristic.
- All genres is weighted and includes the genre's own stories.
- Named groups use the total variation distance instead (at least 0.20), with a chi-square test at 99.9%.
- With all stories, 922 of 5,547 genre × characteristic pairs clearly differ. Per genre that runs from 0 (Fetish) to
  116 (How To).
- How it works explains the rule in "Comparing genres" (`#/methodology/genres`).

**Weight**

- Nine files, `genres/<included>.json`, each 53–57 KB gzipped. Each loads only when the page needs it.
- The page's code is a lazy chunk: 14.9 KiB of JavaScript and 2.2 KiB of CSS.
- The site's first load is 152.3 KiB, against a budget of 155.

**Elsewhere on the site**

- Explore's "Compare all 30 genres →" became "See this pattern in every genre →" (D7).
- Explore's Keep exploring list gained one Genres item.

## Things the builder noticed but did not fix (or could not check)

Verify these yourself; don't take them as given, in either direction.

**Length and placement**

- At 375 × 667 the first chart row starts at 881 px. Before it come:
  - the kicker and the question;
  - three lines of controls;
  - the heading and the takeaway;
  - the story-age note;
  - a legend of four lines.

  The heading and the lists are on the first screen; the chart is not.
- The story-age note shows on every View 1 chart with All stories, in the same words each time.
- At 375 px the split chart is 3,933 px tall. Its halves are stacked, so a genre's share and its range among stories
  above 0 are about 1,700 px apart.
- On phones, a tapped genre's details appear in the line under the chart, as on Explore.
  - Nothing scrolls them into view.
  - With 31 rows of 44–57 px, that line is about 1,300 px below a top row. Check what someone sees after tapping Anal.
- On desktop the details card opens under its row and covers about seven rows (b10).
- At 375 px the plot is about 150 px wide, next to a 116 px label column and the value column. For story length it gets
  two tick labels, 0 and 5,000.
- The dashed All genres line is labeled only under the axis, at the bottom of a chart about 950 px tall.

**Numbers and words**

- Numbers keep three significant digits, so one column mixes decimals: "18" above "13.2", "0.38" near "0.422". Explore
  prints one number of decimals per column.
- The takeaway's lists are ordered by the size of the difference, and the page never says so. The order can look
  random: "Reviews & Essays, How To, Letters & Transcripts, Toys & Masturbation, Humor & Satire, Anal, Crossdressing".
- The heading always says "of 30 genres", even when some genres have too few stories to compare. For example:
  - with `include=long`, How To has 13 stories and Reviews & Essays 15;
  - with `include=y2020`, Chain Stories has 12.
- View 2's takeaway mixes D10 words and generic ones: "sexual language (less), the share of sentences with sexual
  language (lower), anatomical terms (less)".
- View 2's values have no units ("7.79 · all 19.3").
- Mostly-zero characteristics say "above 0": "Stories above 0", "73% above 0 · all 43%". Is that clear for "romance
  language per 1,000 words"? The proposal said "stories with any".
- The tests scan the generated sentences for gaps, banned words and UK spellings, but nobody has read them all. Some
  may read badly, for example:
  - "How do genres differ in where descriptive and sensory language peaks?"
  - "How common are stories whose title marks a chapter or part in each genre?"
- Every view has the same page title, so tabs and history entries can't be told apart. The title also asks the
  popularity question on a page about the stories themselves.
- r is stored to two decimals, and its ties put a few lists in a different order (13.3). Keeping three decimals would
  cost about 1 KB per file.

**Charts**

- Named groups use a rank palette: #2b63c6 for the largest group across all genres, then #c9c3b8, #d98a52, #8fb4f4,
  #efece6 and #a5a29a.
  - The near-white color relies on the bar's outline.
  - A 0.1% segment can't be seen.
  - Shares are printed only in segments at least 34 px wide.
  - In forced colors the bars keep their own colors.
- Ordered bands use the light and dark ends of a blue range and skip the middle, where neither dark nor white text
  reaches 4.5:1. Does the order still read as a sequence?
- The palettes are hard-coded in `genreLayout.js`. The rest of the site takes its colors from the variables in
  `styles.css`.
- In View 2:
  - each row has its own scale and no ticks;
  - the genre's blue capsule is drawn over the gray band of all genres.

  The bars look comparable from row to row, but they aren't.
- "By median" puts the genres in an order that the page never explains. The highlighted genre moves, and ties are
  A–Z. Does it read as a ranking? (D3 allows the toggle.)
- Nothing moves when the order or the characteristic changes: rows jump to their new places. On Explore, a new genre
  glides the chart's marks to their new places.

**Controls and navigation**

- The view switch carries the genre: the Highlight genre becomes View 2's genre, and back. Nothing on screen says so.
- The view switch's label, "Compare", exists only for screen readers.
- On phones the controls take three lines: the switch; "Only include"; Highlight and the order.
- As on Explore, picking a characteristic that conflicts with the option resets the option to All stories. Nothing
  says so.
- "Compare stories published 2020 or later" replaces the address. The view switch and the links add history entries.
- View 2 has no actions: no Copy link and no numbers table.

**Accessibility**

- Chart rows are focusable `role="img"` elements in an SVG `role="group"`, with a roving tab index. Each row's name
  holds all its numbers.
- View 2's rows are links.
- None of it was tried with a real screen reader.
- The polite live region repeats the heading and the takeaway on every change, the order included.
- On phones, the question's word is 34 px tall and View 2's genre select 36 px, the same as the words of Explore's
  sentence.

**Performance**

- A visit that starts on `#/genres` loads 203.6 KiB in 8 requests.
  - `genres/all.json` alone is 51.8 KiB, about three times a typical characteristic's file
    (`v/<characteristic>/all.json`: median 18 KB).
  - The time to the first chart on slow 4G and 3G was not measured.
- Each other "Only include" option is another file of about 55 KB.
- View 2 with every topic open draws about 200 small SVG plots. Nobody has profiled it with a slower CPU.
- After a new option, layout shift is 0.091 at 375 px on slow 4G, against a limit of 0.1.
- The page's chunk is 14.9 KiB; the proposal estimated 6–9 KB.

**Never checked**

- A real phone (iOS Safari, Android Chrome) and its native select pickers.
- VoiceOver, TalkBack or NVDA.
- Real glyph boxes with a wider fallback font. The Genres overlap check used this Mac's system font. Explore's was also
  run with "DejaVu Sans", Verdana.
- 200% and 400% zoom.
- Lighthouse.

## Decisions that stand

- US English for everything a visitor reads ("gray", "favorites"), and US dates.
- The name "Story Patterns". The footer holds only the independence statement and the How it works link.
- No disclaimer, no reminders that correlation is not causation, and no notes about chance.
- "Median" and "interquartile range" are used without explanation.
- No dark mode yet; you may ask again.
- Source Serif 4, weight 600 only, for headings; the system sans for everything else.
- Explore as it is after round 3 and my follow-ups, including:
  - the question sentence and the picker;
  - the rows, and the K1 line on phones;
  - the average rating as the default measure.
- For this page, my decisions D1–D10:

  | # | Decision |
  |---|---|
  | D1 | The `genres/<included>.json` files |
  | D2 | The "clearly differs" rule |
  | D3 | The order toggle; A–Z by default |
  | D4 | On phones How it works leaves the masthead; no Menu button |
  | D5 | No publication month or weekday on this page |
  | D6 | The split chart for mostly-zero characteristics |
  | D7 | Explore's "See this pattern in every genre →" |
  | D8 | View 2's default genre: the last one chosen in the visit, else the largest |
  | D9 | The nav item "Genres" |
  | D10 | Direction words for 20 characteristics |

- The approved copy, in section 6 of `STAGE2_GENRES_PAGE_PROMPT.md`.
- The slimmer file format I chose at the size checkpoint (13.2 of the proposal).

You may challenge any of these, but only with evidence from a task or a measurement. Mark such findings "(revisits an
owner decision)".

## The bar for this review

- This is the page's first independent review, and the first time anyone judges it as built rather than as mock-ups.
  If a chart form, a view or one of my decisions fails people in practice, say so, with evidence.
- Prefer refinement. Propose a structural change only with evidence that the current design fails a task. That
  includes another chart form, another split between the views, and another place in the nav.
- The page should feel like part of the same site as Explore and Patterns. Where it differs (number formats, details,
  motion, controls), say whether the difference earns its place.
- If something works, say so and leave it alone. A short list of well-evidenced findings beats a long one.
- Keep what you measured separate from what you believe.

## Hard rules

1. **No network access to Literotica.**
   - Never open literotica.com with any tool: browser, fetch, curl or anything else. Its robots.txt disallows AI
     agents.
   - If you want to compare the page with Literotica's look, or to see it on my phone, ask me for screenshots.
2. **The data stays private and aggregated.**
   - The site ships only `meta.json`, `v/<characteristic>/<included>.json`, `patterns.json` and
     `genres/<included>.json`.
   - Never add story-level data, a data download, new data fields or new aggregate files without asking me.
   - Each genres file stays at or under 60 KB gzipped.
   - `data/` is read-only. Never run `probe`, `collect`, `process` or `export-handoff`.
   - You may run `python -m litcorr site-data` (offline) when an approved change touches `wording.py` or
     `site_data.py`. Then:
     - regenerate the fixtures with `python -m litcorr.stage2.synthetic site/src/test/fixtures/aggregates`;
     - check that `git diff` shows only what the change explains.
3. **Honest interpretation stays intact.**
   - No causal language anywhere ("cause", "drive", "make readers", "lead to", "boost", "because of", "effect of",
     "impact", "result in" …).
   - No notes about chance, and no reminders that correlation is not causation. How it works explains the rules.
   - "Clearly differs", "stands out" and "sets apart" are said only through the D2 rule. "Tend to" is said only through
     the pattern rule.
   - Genres are A–Z by default, and the only other order is the D3 toggle.
   - View 2 orders characteristics within one genre, and never orders genres.
   - Explore, compare mode and Patterns keep their orders.
   - No discovery feature may encourage cherry-picking, or the over-reading of chance differences.
   - Sample sizes stay visible, and the story-age note stays where it is specified.
   - The statement that the site is independent of Literotica stays.
4. **Methodology is not design.**
   - Don't change these without asking:
     - the measures, the binning and the weights;
     - the minimum group sizes (10 and 30);
     - the "tend to" rule;
     - the D2 rule: 0.20, the 99.9% level, the total variation distance of 0.20, 30 stories, and all genres as the
       reference.
   - How they are *presented* is fair game.
5. **No new dependencies without asking.**
   - That covers npm and Python packages, fonts or font weights, CDNs, analytics and external requests.
   - It stays a static site with no server.
   - Checking tools (Playwright, axe-core, Lighthouse) may run from a temporary directory outside the repository.
     Never add them to `package.json`.
6. **Budgets.**
   - The first load stays at or under 155 KiB of gzip response bodies (`firstbodies.mjs`). It is 152.3 KiB now, so a
     proposal that adds to the main chunk must say what pays for it.
   - The Genres chunk and files are lazy, but report what a visit that starts on `#/genres` costs (203.6 KiB now).
   - Cumulative layout shift stays under 0.1, and there is no "Loading…" flash after the first chart.
   - Opening or choosing from a menu, the picker or any control never moves the page: `window.scrollY` stays the same.
     This is round 3's rule.
   - Reduced motion is honored.
7. **Existing addresses keep working:**
   - `#/explore?…`, with `&check=age`;
   - `#/patterns?…`;
   - `#/genres?…`, with `var`, `include`, `genre`, `sort` and `view`;
   - `#/methodology` and `#/methodology/<section>`.
8. **Tests and build pass at every checkpoint.**
   - The commands are `npm test` and `npm run build` in `site/`, and
     `.venv/bin/python -m pytest tests/test_stage2_site_data.py`.
   - Add tests for any new behavior.
   - The scans ban some words, and any copy you propose must pass them:
     - `siteText.test.js` and `scans.js` ban causal words (even a plain "because") and UK spellings;
     - `median.test.jsx` bans "typical story", "typical age" and "middle half".
9. **Git.**
   - Commit nothing during Phases 0–3.
   - After my approval, create the branch `genres-review` from the branch that holds the Genres page.
   - The first commit holds the review, its screenshots and this prompt. After that, commit each logical change
     separately, in the repository's style ("Stage 2 genres review: …").
   - Don't push. Never commit `.claude/` or `Claude outputs/`.
   - The repository is public, so check that nothing under `data/` is in a commit.
   - I have approved letting git delete its lock files. If your environment asks, request deletion permission for the
     project folder.

## Working setup

- **Running the site.**
  - Run `cd site && npm install && npm run dev` to serve it at http://localhost:5173.
  - `.claude/launch.json` has two configurations for the built-in browser: `site` (port 5173) and `site-5174`.
  - The built-in browser can't take screenshots while its pane is hidden. Headless Chromium, driven by Playwright from
    a temporary directory, works well. The Chromium build is cached in
    `~/Library/Caches/ms-playwright/chromium_headless_shell-1243/`.
- **Python** is `.venv/bin/python`; there is no `python` on the PATH.
- **Measure like a host.**
  - Build the site, copy `site/dist` to a frozen folder and serve that copy with gzip (`serve.mjs`, port 4180).
    Rebuilding under a running server breaks long runs.
  - Use the earlier settings, so the numbers compare:
    - 320 × 568, 375 × 667, 768 × 1024 and 1440 × 900;
    - 200% zoom (720 px at device scale 2) and 400% zoom (320 CSS px);
    - fast 4G (9 Mbps, 60 ms), slow 4G (1.6 Mbps, 150 ms, 4× slower CPU) and 3G (400 kbps, 300 ms).
  - The page was built and measured on this Mac, so your numbers should match section 13 within noise. Where they
    don't, find out why.
- **The measuring scripts** are in `Claude outputs/design-review-2-tools/`; `README.txt` explains each one.
  - Copy them to a temporary directory and install their tools there:
    `npm init -y && npm install playwright-core@1.56.0 axe-core@4.10.3`.
  - Add new scripts to that folder, never to the repository.
  - Measure independently what the scripts could not see.
- **A phone's own browser.** If this Mac has Xcode's iOS Simulator, use its Safari for the phone tasks; it reaches the
  served build at localhost. Check the native selects, the picker's sheet and taps there. If there is no simulator,
  say so. Ask me before downloading other browsers.
- **Mock-ups.**
  - Make them as small static HTML pages in `Claude outputs/genres-review-mockups/` that draw the real aggregates
    (`site/public/aggregates/meta.json` and `genres/*.json`). Or inject CSS and markup into the running site.
  - `Claude outputs/genres-page-mockups/` and `Claude outputs/design-review-2-mockups/` show both approaches.
  - Never import anything from `Claude outputs/` into `site/`.
- **Screenshots** for the review go in `docs/stage2/genres-review/`: `b…` for the baseline and `m…` for mock-ups.
  - Keep them small and palette-compressed, like the earlier reviews'. Pillow in a temporary virtual environment does
    it, with `compose3.py`.
  - For documentation, shoot tall viewports. Avoid `fullPage` captures with a narrow clip: one once re-laid the page
    out.
- Write in US English, like the site.

## Phase 0: Baseline (no code changes)

1. Build the site and run the three test commands; record the counts. Section 13 reports 226 Vitest tests in 27 files
   and 30 pytest tests.
2. **Screenshots.** Take these views at 375 and 1440 px, and at 320 and 768 px where those differ in interesting ways.
   Compare each with the proposal's mock-ups (g01–g08): where the build departs from them, is it better or worse?

   | View | Address |
   |---|---|
   | First screen | `#/genres` |
   | Numbers, a genre highlighted | `#/genres?var=story_words&include=all&genre=adult-romance` |
   | Yes/no (first person is known for only 119 How To stories) | `#/genres?var=pov_is_first_person&include=all` |
   | Named groups | `#/genres?var=pov_class&include=all&genre=adult-how-to`, `#/genres?var=gender_composition` |
   | Ordered bands | `#/genres?var=author_stories_count`, `#/genres?var=pace_sex_peak_position` |
   | Mostly zero (also at 759 and 760 px, where the halves go side by side) | `#/genres?var=rel_romance_per_1k&include=all&genre=adult-romance` |
   | Mostly zero, no genre marked, a genre with fewer than 10 stories above 0 | `#/genres?var=reader_address_per_1k` |
   | Years; percentages | `#/genres?var=pub_year`; `#/genres?var=dlg_word_share` |
   | 14 genres marked; none marked | `#/genres?var=pace_sex_shift`; `#/genres?var=desc_chars` |
   | By median, with a small genre and recent stories | `#/genres?var=sex_terms_per_1k&include=y2020&genre=adult-romance&sort=value` |
   | Small genres and "Fewer than 10 stories" | `#/genres?var=dlg_adverb_tag_share&include=short`, `#/genres?var=series_part_number&include=long` |
   | Long questions | `#/genres?var=pace_descriptive_early`, `#/genres?var=title_has_chapter_marker` |
   | One genre (then "Show all", then a topic open) | `#/genres?view=genre&genre=adult-romance&include=all` |
   | One genre with 116 stand-outs (75 lower, 37 higher, 4 different mixes) | `#/genres?view=genre&genre=adult-how-to&include=all` |
   | One genre with none; with a small sample | `#/genres?view=genre&genre=fetish-stories&include=all`; `#/genres?view=genre&genre=chain-stories&include=y2020` |
   | One genre with too few stories | Not reachable with today's data: the smallest genre in any option has 12 stories. Serve an edited copy of a genres file through a Playwright route. |
   | Explore's links to the page | `#/explore` (the D7 button and Keep exploring); `#/explore?mode=one&genre=adult-romance&metric=pop_rating&var=story_words&include=all` (the View 2 item) |
   | How it works | `#/methodology/genres` |
   | The masthead, on every page | 320, 359, 360, 375, 419, 420, 559, 560, 768 and 1440 px |
   | Interactive states | the picker (empty, searching "romance", inside a topic); "Only include" with options turned off (`var=story_words`); Highlight; the order toggle; a tapped row on a phone (a top row, a middle row, the last row); the desktop card for a top and a bottom row; the numbers table for every form; the view switch both ways; Back after a link between the views |
   | Loading and errors | the placeholder on 3G; requests to `aggregates/genres/` blocked (the error and Retry) |

3. **Re-measure everything in 13.3 and 13.4** with the same method; `genres_acceptance.py` computes 13.3. Report each
   number next to the claim, and explain any difference.
4. **Measure what the builder did not.**
   - **Time and bytes.**
     - The time to the first chart for a visit that starts on `#/genres`, and for one that starts on View 2, on the
       three networks.
     - The bytes and time of a new characteristic (no new file), a new option (a new file) and the view switch.
   - **Responsiveness.** Long tasks and frame times at 4× and 6× CPU slowdown for:
     - a new characteristic, the order toggle and a new option;
     - View 2's "Show all", and every topic opened;
     - the picker.
   - **A wide fallback font.** Real glyph boxes with `'"DejaVu Sans", Verdana'`, as `labels3.mjs` does for Explore,
     for every form at 320 and 375 px.
   - **Where the details appear.** For a top row, a middle row and the last row, on phones and on desktops: are the
     tapped or focused genre's details in view, and what do they cover? (WCAG 2.4.11 for focus.)
   - **Tap areas.** Real tap areas (`elementFromPoint`) on phones of the chart rows, View 2's rows, "Show all" and the
     topic summaries.
   - **The accessibility tree** (Playwright's aria snapshots) of:
     - the question and the controls;
     - a chart row of each form, and the details;
     - the numbers table;
     - a View 2 row, and a topic.
   - **Announcements.** What the live region says, in order, after each control.
   - **Focus.** Where focus lands after each action: the view switch, a link between the views, "Show all", a topic,
     the age note's button, Retry and "Open in Explore".
   - **Contrast.**
     - Every new pair of text and color: the text on each group and band color, the hatch, the highlight wash, the
       muted counts, the age note.
     - Non-text contrast (WCAG 1.4.11) of the bars, the segments, the dashed line and View 2's gray band.
   - **Display settings.** Forced colors (light and dark), reduced motion, and 200% and 400% zoom.
   - **History.** Back, Forward and reload after the view switch, a link between the views, each control, the age
     note's button, and arriving from Explore.
   - **Every generated sentence, read.** The tests only check the sentences for gaps, banned words and spelling.
     1. Write these to a text file in your scratch space:
        - for every characteristic, with All stories and with "Published 2020 or later": the question, the heading,
          the lists, the All genres line, the legend and one row's name;
        - for every genre: View 2's heading and takeaway.
     2. Read all of it, and list what reads badly.

## Phase 1: Walk through real tasks

Do each task as the person described, on a phone and on a desktop. Write down every moment of confusion, hesitation,
extra tap, misreading or ugliness.

1. **A curious first-time visitor on a phone** taps "Genres" in the masthead.
   - Can they tell within five seconds what the page answers, and how it differs from Explore?
   - Do they find the second view?
   - Do they read the chart, or only the lists above it?
2. **A Romance writer** wants to know what sets Romance stories apart. Then they:
   - look at one of those differences across all genres;
   - check whether it holds for stories published 2020 or later;
   - see how it relates to popularity in Explore.
3. **A reader of a small genre** (How To, Chain Stories or Letters & Transcripts) wants to know whether its stories
   are longer or shorter than the rest, and where it sits among the genres. Small samples, missing values and the
   order toggle all come into play.
4. **Someone curious about one characteristic** asks "Which genres have the most dialogue?" or "Where is first-person
   narration most common?".
   - Do they find "By median", and how do they read the order?
   - Do they understand the yes/no, named-group and split charts?
5. **A sceptic** asks:
   - What does "clearly differ" mean?
   - Why does Fetish have nothing that stands out?
   - Why compare a genre with all genres, which include it?
   - How many stories is a number based on?
   - Why is a genre whose median looks far off not marked?

   Can they find the answers on the page and in How it works?
6. **A keyboard-only user and a screen-reader user** operate:
   - the question, the switch, the selects and the order;
   - the chart rows and their links;
   - View 2's lists, "Show all" and the topics.

   Can they understand each chart form, especially the 100% bars and the split chart?
7. **A 15-minute explorer** goes back and forth between Explore and Genres: "See this pattern in every genre", the
   Genres page, Keep exploring, the links between the views, "Open in Explore", and Back.
   - Does the journey stay coherent?
   - Do the two ways of comparing genres get confused?
   - Does anything tempt them to fish for differences?
8. **Someone sharing a finding** sends a friend two links: View 1 with a genre highlighted and sorted by median, and a
   View 2 address (View 2 has no Copy link). The friend opens them on a phone.
   - What do they see first?
   - Does the answer survive out of context?
   - What do the tab title and the link preview say?
9. **A visitor on a slow phone** (a mid-range Android on slow 4G with a 4× slower CPU) opens a shared View 2 link,
   switches to recent stories and opens three topics.

## Phase 2: Expert review

Cover each of these areas with specific, evidence-based findings, not generic advice.

- **Purpose and information architecture.**
  - Does the page earn its place in the nav? Is "Genres" the right name next to Explore's "See this pattern in every
    genre"?
  - The kicker, the two views and the switch between them.
  - The default characteristic (story length in words) and the default genre (D8).
  - The links in and out: the masthead, Explore's actions and Keep exploring, How it works, "Open in Explore".
- **Controls.**
  - The question and the picker on this page. Is the Popular list, chosen for Explore, the right first list here? Try
    what people would type: "dialogue", "length", "first person", "romance", "sex", "swearing", "tense", "month".
  - The view switch.
  - "Only include" and its turned-off options.
  - Highlight: what it does, and what it carries into View 2.
  - The order toggle and its labels.
  - The layout of the controls on phones, and their weight against the answer.
- **The answer above the chart.**
  - The headings, the lists and their order, the D10 words and the generic ones.
  - The All genres line, the story-age note, and the legend and its link.
  - Is the answer visible at a glance, on a phone too?
  - Does anything claim more precision than samples of about 300 stories support?
- **Each chart form:** range rows, share rows, 100% bars (named groups and bands) and the split chart.
  - The encoding.
  - The axis and its ticks, including years and percentages.
  - The All genres band, line and label.
  - The value column and its marks, the Stories column and the counts under labels.
  - The hatching, and "Fewer than 10 stories".
  - Row height and density, long genre names, and the phone layout.
  - Color: both palettes, and the highlight wash.
  - Whether another form would serve better, particularly for the split chart on phones and for small groups in the
    100% bars.
- **Details.** The card and the phone line: what they say, where they appear, how they close, the link to View 2, and
  hover against tap.
- **View 2.**
  - The heading and the takeaway.
  - The lists, "Show all" and "A different mix".
  - The rows: their own scale without ticks, the gray band under the blue capsule, and values without units.
  - The topics, the edge states (none, 116, small, too few) and the missing actions.
- **Order and honesty.**
  - Do "By median" and View 2's order invite reading an order as a ranking, or fishing for differences?
  - The heading's "of 30".
  - Comparing a genre with a total that contains it: Erotic Couplings is 11.7% of all genres' weight.
  - Do "clearly" and "stands out" overstate? Does anything slide toward a causal or judging reading?
- **Words.**
  - Every generated sentence, read aloud (from Phase 0).
  - The mix of D10 words and generic ones, "above 0", units, and the number formats against Explore's.
  - "Comparing genres" in How it works.
  - Consistency with Explore's phrases ("Fewer than 30 stories", "too few stories to compare").
  - US English throughout.
- **Visual design.**
  - Hierarchy: is the chart the focus?
  - The type scale and spacing, the alignment of the chart's columns, the age note's box, and the legend.
  - The actions: the filled "Open in Explore" button sends people away from the page.
  - Does the page look like the same site as Explore and Patterns? Is it polished data journalism?
- **Accessibility.**
  - WCAG 2.2 AA, including:
    - use of color (1.4.1) in the 100% bars;
    - non-text contrast (1.4.11);
    - target size (2.5.8);
    - focus not obscured (2.4.11) by the card;
    - the names, roles and states of the switch, the selects and the rows.
  - Can a screen-reader user understand each chart from its rows' names and the numbers table?
  - Forced colors, zoom and reduced motion.
- **States and edge cases.**
  - Loading: the first visit, and a new option.
  - Errors.
  - Small genres, and too few stories.
  - Missing values, such as How To's 119 first-person stories.
  - Conflicting options, and Chain Stories with 12 recent stories.
  - Long names at 320 px.
  - Extreme values, such as Non-Erotic's sexual language.
- **Performance.**
  - The first load and its 2.7 KiB of headroom.
  - The chunk and the files.
  - The time to the first chart, and the cost of each change.
  - View 2 with everything open.
  - Layout shift after a new option, and prefetching.
- **Navigation and history.**
  - Addresses that round-trip.
  - Back and Forward, and `replaceState` against `pushState`.
  - Focus and the scroll position after each navigation.
  - The Genres link, which remembers the last address.
- **Regressions.** Anything on Explore, Patterns or How it works that changed or got worse with this branch:
  - the D7 button and Keep exploring;
  - the masthead at narrow widths (How it works gone below 560 px, Explore below 360 px);
  - the first load (+2.5 KiB).
- **Delight.** Ideas that would make comparing genres more enjoyable within the rules. No discovery feature may
  encourage cherry-picking.

## Phase 3: Report and proposals, then STOP

Write `docs/stage2/GENRES_PAGE_REVIEW.md`. Link to the proposal and to the earlier reviews instead of repeating them.
Include:

1. **A short verdict:**
   - a grade per area of Phase 2;
   - the three biggest problems;
   - what works and should be left alone.
2. **The builder's claims, checked.**
   - A table of the numbers in 13.3 and 13.4, the items in 13.7, and the items under "Things the builder noticed"
     above. Mark each one confirmed, different (with your number) or wrong.
   - The judgment calls in 13.6 that you would reverse, and why.
3. **The tasks**, on a phone and on a desktop.
4. **Prioritized findings**, numbered from F60 so the IDs never clash with rounds 1 and 2. For each give:
   - the evidence: the address, the width, and what you saw or measured;
   - why it matters to people;
   - a concrete fix, with exact sizes, colors, copy or layout;
   - the impact (high, medium or low) and the effort (small, medium or large).

   Mark these findings:
   - "(needs your approval)" for those that would change wording or meaning;
   - "(revisits an owner decision)" for those that challenge one of my decisions;
   - "(touches a hard rule)" for those in the hard rules' territory.
5. **Quick wins**: small, safe changes you would make straight away.
6. **Concepts for any larger change.**
   - Give two or three alternatives for each, with mock-ups that draw the real aggregates, pros and cons, and a
     recommendation.
   - Name concepts with letters not used before, starting at L. Rounds 1 and 2 used A–E, G, H, J, K and N; the
     proposal's alternatives used B–F.
   - Number new ideas from I9.
7. **Questions for me.** For example:
   - Should the order toggle stay? Should the page say what the lists are ordered by?
   - r to three decimals, which would end the ties (about 1 KB per file)?
   - A Copy link and a numbers table for View 2?
   - Page titles that name the characteristic or the genre?
   - Anything that touches the hard rules.

**Then stop and wait for my approval.** Don't change `site/`, `litcorr/` or `tests/` before I reply.

## Phase 4: Implement what I approve

- Create `genres-review` from the branch that holds the Genres page. The first commit holds the review, its
  screenshots and this prompt. Then make the approved changes in small, focused commits.
- After each group of changes:
  - re-check the four widths and 200% zoom;
  - re-run the overlap check for the forms you touched, and the page-movement check;
  - update the tests;
  - run the three test commands and the build.
- At the end, add a **Before and after** section to `GENRES_PAGE_REVIEW.md`, shaped like section 10 of
  `DESIGN_REVIEW_2.md`. It should give:
  - each change, with its commit and before-and-after numbers;
  - after screenshots (`a…`);
  - your judgment calls;
  - what is still open;
  - anything you decided not to do, and why.
- Don't push. Summarize for me in a few lines.

## Checkpoints: stop and ask me before

- changing anything in the hard rules' territory: the data shipped (including the genres files' format),
  interpretation, methodology (including the D2 rule), dependencies, fonts or external requests;
- adding a feature that was not in the approved list;
- making a change that alters the meaning of a chart, heading, list or note, as opposed to its form;
- using wording I haven't approved;
- going over a budget.

**Start with Phase 0.**
