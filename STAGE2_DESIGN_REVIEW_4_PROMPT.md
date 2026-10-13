# Stage 2 design review, round 4: the whole site, for clarity, ease and looks

You are working in the `Literotica_Correlations` project. Its Stage 2 website lives in `site/`: a static React + Vite
app, *Story Patterns*, that lets ordinary visitors explore Literotica stories in aggregate: how popularity varies with
a story's characteristics (Explore, Patterns), how genres differ (Genres), and how stories changed over time (Trends).
It was built page by page over several rounds, each reviewed and implemented by a different Claude session. Nobody has
yet looked at the **whole site at once**.

Your job is a **fourth, independent design review of the entire site**, against three goals:

1. **Easy to understand.** A first-time visitor with no statistics background can tell what each page is for, and reads
   each chart's answer correctly, without help.
2. **User friendly.** Every common task takes few steps and has no dead ends, the five pages work alike, and the site is
   as good on a phone as on a desktop, for keyboard and screen-reader users too.
3. **Aesthetically pleasing.** It looks like polished, editorial data journalism: one coherent visual system across all
   pages, with the charts as the focus.

Judge what is there, check the claims made about it, find what still fails real people, and propose the next round of
improvements, with evidence. Be candid. Then stop and wait for my approval.

## What "good" means for each goal

Measure each goal; don't just assert it.

| Goal | Good looks like | How to measure it |
|---|---|---|
| Easy to understand | Within five seconds a newcomer can say what a page is for. They read each answer, number and unit right, and can say what every mark, color and term on screen means, or find out from something on the same screen. One idea has one name everywhere | Fresh-eyes comprehension scores (Phase 1); the words stand-ins couldn't explain; a census of terms that name the same thing differently on different pages |
| User friendly | The tasks in Phase 1 succeed in few steps, with no dead ends or surprises. Controls that look alike behave alike on every page. Back, Forward and shared links land where people expect. The phone experience is first-class. WCAG 2.2 AA holds, and the budgets hold | Steps, errors and hesitations per task; real tap areas; axe; keyboard and screen-reader walk-throughs; load and layout-shift numbers |
| Aesthetically pleasing | Generous whitespace, clear typography, restrained color, charts as the focus, and the same visual grammar on every page. Polished details. Not a SaaS dashboard; not sexualized or gimmicky | Stand-ins' 1–5 ratings of the look, and the three words each uses for it; a visual-system inventory (sizes, weights, colors, spacing, radii, marks) with its inconsistencies counted; side-by-side page comparisons |

## Read first

1. The earlier reviews and their "as built" sections, so that you don't repeat them and can check their claims. Treat
   every number in a "Before and after" or "As built" section as a claim to check, not a fact.
   - `docs/stage2/DESIGN_REVIEW.md` (round 1) and `docs/stage2/DESIGN_REVIEW_2.md` (round 2; its sections 11 and 12
     are round 3 and its follow-up).
   - `docs/stage2/GENRES_PAGE_PROPOSAL.md` and `docs/stage2/GENRES_PAGE_REVIEW.md`.
   - `docs/stage2/ONE_GENRE_REVIEW.md`.
   - `docs/stage2/TRENDS_PAGE_PROPOSAL.md` and `docs/stage2/TRENDS_REVIEW.md` (its sections 9–11 are my latest
     changes).
   - Each review's screenshots are in the folder of the same name under `docs/stage2/`.
2. The prompts in the repository root, which hold my decisions, in this order: `STAGE2_DESIGN_REVIEW_PROMPT.md`,
   `STAGE2_DESIGN_IMPLEMENTATION_PROMPT.md`, `STAGE2_DESIGN_REVIEW_2_PROMPT.md`,
   `STAGE2_DESIGN_IMPLEMENTATION_2_PROMPT.md`, `STAGE2_DESIGN_IMPLEMENTATION_3_PROMPT.md`,
   `STAGE2_GENRES_PAGE_PROMPT.md`, `STAGE2_GENRES_PAGE_REVIEW_PROMPT.md`,
   `STAGE2_GENRES_REVIEW_IMPLEMENTATION_PROMPT.md`, `STAGE2_SIMPLIFY_AND_PNG_PROMPT.md`,
   `STAGE2_ONE_GENRE_REVIEW_PROMPT.md`, `STAGE2_ONE_GENRE_IMPLEMENTATION_PROMPT.md`, `STAGE2_TRENDS_PAGE_PROMPT.md`
   and `STAGE2_TRENDS_REVIEW_IMPLEMENTATION_PROMPT.md`. Where they disagree, the later one wins.
3. `site/README.md`; everything in `site/src/` (start with `App.jsx`, `components/pages.js`, the page components,
   `lib/wording.js`, `styles.css`, `comparison.css`, `genres.css` and `trends.css`); and `site/src/test/`.
4. `litcorr/stage2/wording.py` (labels, nouns, definitions, topics, search synonyms) and `litcorr/stage2/site_data.py`.

**Which code to review.** `main` at `3b04164` (pushed), which holds every round so far, the One genre and Trends
pages and their reviews included. Check with `git log` before you begin, review the newest commit on `main`, and say in
the review which commit you reviewed.

## What the site is for

These requirements come from my original brief. Judge the design against them.

- **Audience.** A popular data-exploration site, not an academic project. A visitor who knows nothing about statistics
  should understand the interface within seconds, and should enjoy exploring for 10–20 minutes.
- **What visitors do.**
  - See how popularity varies with a story characteristic, in one genre or all (Explore), and which characteristics
    show a clear pattern (Patterns).
  - See how genres differ (Genres) and how stories changed (Trends).
  - Learn how it was all measured (How it works).
  - Moving between these should feel like one site, not five.
- **Every chart answers a simple question.** It has a plain-English title, a short explanation, its sample size, and
  the median and/or mean with some sense of the spread. It never implies more precision than the data supports.
- **Look.** Minimalist, editorial and data-journalism in feel: generous whitespace, clear typography, restrained color,
  with the charts as the visual focus. The palette is inspired by Literotica's own, but restrained. It must not look
  like a generic SaaS dashboard, and it must not be sexualized or gimmicky. It must work well on phones and desktops.
- **Quality checks named in the brief.** No overlapping labels, no unreadable charts, long genre names don't break the
  layout, the mobile layout works, charts have clear titles and axes, tooltips are understandable, and nothing turns a
  descriptive association into a causal claim.

## Current state, in brief

Check all of this yourself; it is a summary, not a specification.

- **Masthead and footer.** The masthead reads "Story Patterns" with links to Explore, Genres, Trends, Patterns and How
  it works. On narrow screens it sheds links: How it works below 602 px, Explore below 414 px and Patterns below
  352 px (the links tighten below 484 px). The footer lists every page and says the site is independent of
  Literotica.
- **Explore** (`#/explore?genre=…&metric=…&var=…&include=…`).
  - The controls are a sentence: "In [All genres], how does the [average rating] vary with [story length in words]?"
    The average rating is the default measure.
  - The chart has one row per group of stories: the median (its value printed) and the interquartile range, with the
    number of stories, and the mean in each group's details. Its heading says "tend to" only through the pattern rule.
  - On a total (views, favorites, comments), a note, "Totals grow with time online.", with a switch to a per-month or
    per-1,000-views measure. Then "Download PNG" and "Keep exploring".
- **Patterns** (`#/patterns?genre=…&metric=…`): every clear pattern for a genre and a measure, topic by topic, with
  the count of characteristics without one.
- **Genres** (`#/genres?var=…&include=…&sort=value`; `#/genres?view=genre&genre=…&include=…`).
  - "How do genres differ in [story length in words]?" draws one characteristic in every genre, in one of four forms.
    ▲ ▼ ≠ mark a genre that clearly differs; the order is A–Z or, if the reader asks, "By median".
  - "What stands out about stories in [Romance]?" ("One genre") lists the characteristics that set a genre apart, as
    rows with a dot on a 0–100 scale, then every characteristic by topic.
- **Trends** (`#/trends`; `#/trends?genre=…&include=…`; `#/trends?var=…&genre=…&include=…`).
  - It opens on **All changes**: "What has changed in stories across [all genres]?", with the same rows as "One
    genre", comparing stories from 2020 or later with 2000–2009.
  - **One characteristic** draws five periods, with the two windows compared bracketed and the periods between them
    gray.
- **How it works** (`#/methodology`, `#/methodology/<section>`): a sidebar of contents on desktops, a section bar on
  phones, and a glossary of every characteristic.
- **Visual system.**
  - Color tokens in `styles.css`: background `#fbfaf7`; Literotica's blue `#4a89f3` (ink `#2b63c6`) carries the
    data; a warm orange (`#e8894a`, ink `#a9531d`) marks "lower" and story-age warnings.
  - Source Serif 4, weight 600 only, self-hosted, for headings; the system sans for everything else.
  - 44 px targets; motion off under reduced motion; system colors on the charts in forced colors; no dark mode (every
    color is a variable).
- **Numbers today** (the Trends review's final build):
  - first load: 150.0 KiB of gzip response bodies in 6 requests, against a 155 KiB budget;
  - a visit that starts on Genres' One genre: 208.9 KiB; on Trends: 175.2 KiB; on How it works: 141.3 KiB;
  - layout shift: 0.000 on a Trends visit, worst 0.021;
  - axe: no violations in the Trends review's 63 runs (both Trends views, One genre and the error state);
  - tests: 509 (Vitest), 218 (pytest).

## Decisions that stand

These are my decisions from earlier rounds, as they stand now. The file and line where each is stated are given
so that you can read the reasoning. "P1–P3" are the three `STAGE2_DESIGN_IMPLEMENTATION_*` prompts; "GP", "SP",
"GRI", "OGI", "TP" and "TRI" are the Genres page, Simplify, Genres review, One genre, Trends page and Trends review
prompts; "DR2" is `docs/stage2/DESIGN_REVIEW_2.md`. The Genres (D1–D10) and Trends (D1–D12) decisions share the D
prefix, so cite them with their page.

**Site-wide**
- US English and US dates. The headline "What do popular Literotica stories have in common?" and the masthead name
  "Story Patterns" (`SITE_NAME` in `App.jsx`) stay (P1:27–29). On Trends the question is the h1 (TRI:329–332).
- Five pages in the masthead, no menu (TP:55, 233). The footer's independence sentence has no link, over a list of
  every page, with at least 64 px above the footer (48 px at 760 px or less; TRI:185–192).
- No dark mode yet (P1:31, P2:55). Source Serif 4, weight 600 only, for headings only; no second weight (P1:32–33,
  P2:55).
- No causation reminders and no disclaimer (P2:26–35), and no chance note on Patterns (DR2:1148). The no-causal-language
  rule stands.
- "Median" and "interquartile range" are used without explanation (P3:99–102), and "interquartile range" stays (O1,
  TRI:54). "Typical story", "typical age", "middle half", "borderline" and "just past" are banned by scans.
- Open Graph and Twitter tags, but no share image (P2:54).
- No "Copy link" anywhere (O2, TRI:55).
- **"Download PNG"** is:
  - Explore's only action (SP:115);
  - on the Genres page's one characteristic, before "Open in Explore →" (SP:116);
  - after the lists on each comparison view, One genre and All changes (TRI:403–412).

  The image holds the title, subtitle, key and chart, with the credit "Chart by Nathan Nguyen, @NathanDNguyen" (SP:39).

**Explore and Patterns**
- **The default view** is average rating by story length in words, all genres, all stories, with the Rating group
  first in the measure menu (P3:51, 112–117).
- **What it has**: eight topics and a 12-item Popular list (P1:39); the question bar on phones; "Keep exploring",
  with Patterns, Genres and Trends items and example questions (GP:360–364, TP:388).
- **What it doesn't have** (SP:31–36): no compare mode, no story-age box or similar-age charts (the totals box with
  "Switch to …" stays), no median age, no "Show the numbers".
- **The chart**: the mean only in a group's details (SP:222–224); "Stories grouped by …" on a line of its own, with
  none for yes/no characteristics (DR2:1151); the rating axis titled just "Average rating" (DR2:1150).
- **Patterns**: grouped by topic, A–Z, with its count line and the key line's ↗ and ↘ (P3:130–131, DR2:1147–1149).

**Genres**
- **Order**: A–Z by default; "By median" (or "By share") only when the reader asks, with the line that says the order
  (D3; GRI:45, GP:62–65).
- **Marks and forms**: one ▲ ▼ ≠ column in every form (GRI:54); the mostly-zero form M1, "with any" (GRI:49, 129).
- **Behavior**: on phones a tapped genre's line sticks to the bottom (Q1), and rows glide to a new order (GRI:49, 57).
- **Removed**: no Highlight menu, no story-age note (SP:33, 38).
- **One genre**:
  - the lollipop row (R3) in R2's layout, with a small filled gray dot for a row that doesn't stand out (a hollow dot
    means fewer than 30 stories);
  - S1 and T1;
  - rows stacked under a 900 px chart;
  - over each named-group row, the mix line with a swatch and a key of every group (OGI:64–72; ONE_GENRE_REVIEW.md
    10.8–10.9).

**Trends**
- **Opening view**: it opens on All changes, and the switch reads "All changes · One characteristic" (O4, TRI:57).
- **All changes**:
  - its rows are One genre's, values first ("51.6 → 38.8 (−25%)"), on a scale zoomed to the view;
  - the lists are "▼ Fell", "▲ Rose" and "≠ A different mix" (O7);
  - the note is exactly "Each dot compares a story from 2020 or later with a story from 2000–2009 (50 is a tie)",
    with no link and no final period, in open topics too (TRENDS_REVIEW.md 10.1).
- **Removed**: the borderline check (on the page and in the data) and the length-band line (TRENDS_REVIEW.md 10–11).
- **One characteristic** (O7, TRI:92):
  - each bracket carries its window's number; the middle periods are gray and "not compared"; a path line;
  - a side rail from 960 px;
  - the actions "See all changes →" (primary), "Compare genres →" and "Download PNG".

**Data in `meta.json`**
- The `plural` flags and `trend.too_few` (O5).
- The nine definitions, and the story's description named "blurb" on the site (TRENDS_REVIEW.md 10.2).

You may challenge any of these, but only with evidence from a task, the fresh eyes or a measurement. Mark such
findings "(revisits a decision)", and say which decision.

## Known open items to verify

These are recorded as unresolved in the latest documents. Verify each, in either direction.

- **No real phone, Safari, VoiceOver, TalkBack or NVDA** has been tried, and Safari is untested for the PNG.
  `safaridriver` needs a Safari setting only I can turn on (TRENDS_REVIEW.md 8; TRENDS_PAGE_PROPOSAL.md 13).
- **The build-up percents**: 15 of 4,015 rows reach 1,000% or more, up to "0.0034 → 5.1 (+149,028%)"
  (TRENDS_REVIEW.md 8).
- **Words readers miss**:
  - 5 of 6 stand-ins didn't know "interquartile range", and why Trends compares only the two ends is explained only in
    How it works (TRENDS_REVIEW.md 9.2).
  - "Blurb", the nine definitions and the one-sentence Trends note haven't met fresh eyes (TRENDS_REVIEW.md 10.5).
  - One genre: "23% vs 17%" against "5.86 vs 5.79", "medians", "Zipf scale" and uneven decimals (ONE_GENRE_REVIEW.md
    10.6).
- **Words that differ between the comparisons**: "One genre" says "is the higher one" where Trends says "comes out
  higher" (TRENDS_REVIEW.md 9.5).
- **Fonts and lines**:
  - Verdana-only overlaps in 13 Trends charts at 320 px (TRENDS_REVIEW.md 10.3).
  - One-word last lines, and a "?" alone on its line (ONE_GENRE_REVIEW.md 10.6).
- **Color**:
  - The Trends middle periods' hatching is #d9d4ca, 1.41:1 (TRENDS_REVIEW.md 8).
  - The named groups' palette (ONE_GENRE_REVIEW.md 10.9), and a group's color changing with the genre
    (TRENDS_PAGE_PROPOSAL.md 13).
  - A 2.4:1 outline among the Genres page's leftovers (GENRES_PAGE_REVIEW.md 10.5; not re-checked since).
- **Named-group rows** show no verdict (ONE_GENRE_REVIEW.md 10.9).
- **Movement and layout**:
  - The view switches open the other view at the top of the page (TRENDS_REVIEW.md 8).
  - 0.04–0.08 layout shift after scripted changes, and the keyboard-opened popover (DESIGN_REVIEW_2.md 11.5).
  - At 320 × 568 Explore's first chart row ends at 698 px, below the first screen (DESIGN_REVIEW_2.md 12).
- **Taps and speed**: the question's words are 34–35 px tap targets (TRENDS_PAGE_PROPOSAL.md 13), and a topic
  takes 66–79 ms to open at 4× CPU (ONE_GENRE_REVIEW.md 10.6).
- **For me to decide**: a grouping line for yes/no charts (DESIGN_REVIEW_2.md 12), dark mode, and median age, which is
  still in the data files though no longer shown.

## The bar for this round

- Every page has had its own review; this one looks at the **site as a whole**. In order of priority:
  1. anything that makes a visitor misread an answer;
  2. friction or dead ends in common tasks;
  3. inconsistency between pages (controls, words, chart grammar, layout, type and color);
  4. visual polish.
- Propose a structural change only with evidence that the current design fails people: a task, a fresh-eyes score or
  a measurement. Then test it: show the alternatives to fresh eyes, as the One genre review did.
- If something works, say so and leave it alone. A short list of well-evidenced findings beats a long one.
- Keep what you measured separate from what you believe.

## Hard rules

1. **No network access to Literotica.**
   - Never open literotica.com with any tool: browser, fetch, curl or anything else. Its robots.txt disallows AI
     agents.
   - If you want to compare the design with Literotica's look, or to see the site on my own phone, ask me for
     screenshots.
2. **The data stays private and aggregated.**
   - The site may only ship precomputed summaries of groups of stories: `meta.json`,
     `v/<characteristic>/<included>.json`, `patterns.json`, `genres/<included>.json` and
     `trends/<included>/<genre>.json`.
   - Never add story-level data, a data download, new data fields or new aggregate files without asking me.
   - Groups under 10 stories stay hidden, and no smaller count is ever shown.
   - Size limits: each `genres/` file at most 60 KB gzipped and each `trends/` file at most 16 KB. Ask before
     `meta.json` grows by more than 2 KB gzipped.
   - `data/` is read-only. Never run `probe`, `collect`, `process` or `export-handoff`. A collector may be running on
     this Mac: leave it alone.
   - You may run `python -m litcorr site-data` (offline, from `data/handoff/litcorr_stage2_handoff_20261008.zip`) only
     for a change I approve in `litcorr/stage2/wording.py` or `site_data.py`. If a newer handoff zip is in
     `data/handoff/`, stop and ask.
3. **Honest interpretation stays intact.**
   - No causal language anywhere ("cause", "drive", "make readers", "lead to", "boost", "because of", "effect of",
     "impact", "result in" …). The tests scan every visible string for it.
   - Nothing on the site reminds visitors that correlation is not causation (my decision of October 2026), and nothing
     claims a cause either. Don't bring the old disclaimer or the association notes back.
   - "Tend to", "clearly differs" and "clearly changed" appear only through their rules.
   - Genres are never ranked or sorted by a result, except the Genres page's "By median" order when the reader asks
     for it. Patterns are never sorted by strength.
   - Sample sizes stay visible, and totals keep their note that they grow with time online.
   - No discovery feature may encourage cherry-picking or the over-reading of chance patterns.
   - The statement that the site is independent of Literotica stays.
4. **Methodology is not design.**
   - Don't change these without asking: the measures; the binning; the minimum group sizes (10 and 30); the pattern
     rule; the Genres page's rule; the Trends page's rule, windows and periods.
   - How they are *presented* is fair game.
5. **No new dependencies without asking.** That covers npm packages (runtime or dev), fonts or font weights, CDNs,
   analytics and external requests.
   - It stays a static site with no server.
   - Checking tools (Playwright, axe-core, Lighthouse) may run from a temporary directory outside the repository;
     never add them to `package.json`.
   - Budgets: the first load stays at or under 155 KiB of gzip response bodies (150.0 now), so any proposal that adds
     weight must say what pays for it. Cumulative layout shift stays under 0.1 (today's worst is 0.021), and there is
     no "Loading…" flash after the first chart.
   - The quality bar:
     - controls never move the page ("Show fewer" in a list is the one deliberate exception);
     - targets are at least 44 px;
     - text contrast is at least 4.5:1, and 3:1 for marks that carry meaning;
     - no glyph overlaps, and no axe violations.
6. **Existing addresses keep working**: every address in "Current state", `#/methodology/<section>` for every
   section, and the older ones the site still settles: Trends addresses with `view=changes`, and Explore links that
   carry `mode=…` or `check=age`.
7. **Tests and build must pass at every checkpoint.**
   - The commands are `npm test` and `npm run build` in `site/`, and `.venv/bin/python -m pytest` at the root.
   - Add tests for any new behavior. Numbers, years and thresholds come from the data, never as literals in the
     code.
   - `exploreLayoutGuard.test.js` and One genre's fingerprints pin those views on purpose. Update them only for a change
     you make to those views on purpose, and say so in the commit.
   - The tests scan visitor text for UK spellings, causal words, a plain "because", "typical story", "typical age",
     "middle half", "borderline" and "just past". Any copy you propose must pass them.
8. **Git.**
   - Create a new branch, `design-review-4`, from the commit you review.
   - Commit nothing during Phases 0–3. Once I approve, the review and its screenshots become the first commit, with
     this prompt.
   - After that, commit each logical change separately, and read the test results before each commit.
   - Don't push. Never commit `.claude/`, `Claude outputs/` or anything under `data/`.

## Working setup

- **Running the site.**
  - Run `cd site && npm install && npm run dev` to serve it at http://localhost:5173; `.claude/launch.json` has a
    `site` configuration for the built-in browser.
  - For screenshots and measurements, use headless Chromium driven by Playwright from a temporary directory outside
    the repository. The cached build is
    `~/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`.
    Install `playwright-core@1.56` and `axe-core@4.10` there from the npm cache (`npm install --prefer-offline`),
    the versions earlier rounds used.
- **Python** is `.venv/bin/python`; there is no `python` on the PATH. `/usr/bin/python3` has Pillow for images.
- **Measure like a host.** Build the site, then serve `site/dist` with gzip.
  - Widths: 320 × 568, 375 × 667 (or 812), 768 × 1024, 1280 × 720, 1440 × 900, plus 200% zoom (720 px at device
    scale 2) and 400% zoom (320 CSS px).
  - Throttling: fast 4G (9 Mbps, 60 ms), slow 4G (1.6 Mbps, 150 ms, 4× slower CPU) and 3G (400 kbps, 300 ms).
- **Earlier rounds' scripts** are in `Claude outputs/design-review-2-tools/` and its subfolders (`genres-review/`,
  `one-genre-review/`, `trends-review/tools/`); each `README.txt` explains them. They include:
  - `serve.mjs`, a gzip server for a frozen build;
  - first-load and per-visit bytes;
  - layout shift on slow 4G;
  - axe and label-in-name checks;
  - real glyph boxes for overlaps, with a wide-font variant ('"DejaVu Sans", Verdana');
  - line breaks, tap areas sampled with `elementFromPoint`, forced colors, and PNG downloads.

  Reuse them so that numbers compare, and copy them before changing them.
- **Lessons from earlier rounds.**
  - A Playwright init script can't add a style before the document has a head: add it at `DOMContentLoaded`, and check
    that the font really applied.
  - A glyph check's scope depends on which genres it covers, so compare like with like.
  - `npm test | grep … && git commit` commits even when tests fail.
  - `npx vitest run -u <file>` runs, and can rewrite, every test file's snapshots: check `git status` afterwards.
  - A test that fires a faked observer right after `findBy…` can race React's effects under load: wait for what it
    needs.
- **Fresh eyes (stand-ins).** Use subagents that see only screenshots, as the One genre and Trends reviews did:
  - three per page on a phone and three on a desktop;
  - screen-sized captures (the screens a visitor would scroll through, not one tall image);
  - a one-line situation ("A friend sent you this link; you've never seen the site") and the questions, nothing else.
    Never give them the code, the docs or your opinion.

  Write the questions before you take the screenshots, keep them identical across alternatives, and record the
  answers verbatim in `Claude outputs/design-review-4/fresh-eyes/`. Score them against answers you fix in advance.
- **Mock-ups.**
  - Make them as small static HTML pages that draw the real aggregates, in `Claude outputs/design-review-4-mockups/`,
    or inject CSS and markup into the running site.
  - Never import anything from `Claude outputs/` into `site/`.
- **Screenshots** for the review go in `docs/stage2/design-review-4/` (`b…` for baseline, `m…` for mock-ups). Keep
  them small and palette-compressed like earlier rounds' (`compose4.py` in `trends-review/tools/` does it).
- Write in US English, like the site, in plain words.

## Phase 0: Baseline (no code changes)

1. Build the site and run the three test commands; record the counts.
2. **Screenshots** at 375 and 1440 px, and at 320, 768 and 1280 × 720 where they differ in interesting ways.

   | Page | Views |
   |---|---|
   | Explore | `#/explore` (the first screen); a yes/no characteristic; 12 groups (`var=pub_month`); a total with its note (`metric=pop_views`); a small genre; the picker (empty, searching, inside a topic); the measure menu; a pinned row on a phone |
   | Patterns | `#/patterns?genre=all&metric=pop_rating`; one genre |
   | Genres | `#/genres` (and each of the four forms); "By median"; a tapped genre on a phone; `#/genres?view=genre&genre=adult-romance`; a genre with nothing standing out; one too small to compare (Chain Stories, 2020 or later) |
   | Trends | `#/trends`; a topic open; `#/trends?var=story_words`; a yes/no, a named-group, a banded and a mostly-zero characteristic; Chain Stories (too few) in both views; the picker |
   | How it works | `#/methodology`; `#/methodology/trends`; the glossary filtered |
   | Everywhere | the masthead at 320, 352, 414, 484 and 602 px; the footer; an error (block `aggregates/`); keyboard focus on each kind of control; each "Download PNG" image |

3. **Re-measure the latest claims** with the same scripts and settings, and report each number next to the claim:
   - first load and per-visit bytes;
   - layout shift;
   - axe and label in name;
   - glyph overlaps in the site font and the wide font;
   - line breaks;
   - forced colors;
   - fold positions;
   - the test counts.
4. **Measure the whole site, which no earlier round did:**
   - **A visual-system inventory.** From computed styles, collect every font size, weight and line height; every
     color, border, radius and shadow; the spacing between blocks; and each kind of button, link, select, switch and
     chart mark, page by page. Count the distinct values, and list near-duplicates (say, two grays a few steps apart,
     or 13 px beside 13.5 px).
   - **A copy and terms census.** Collect every string a visitor can read, across the main states of every page.
     Note where one idea has several names, or one name means two things. List the jargon a newcomer may not know.
   - **Real tap areas** on phones for every control, sampled with `elementFromPoint`, and where they overlap.
   - **Wayfinding.** For each page, how a visitor reaches every other page, and what each cross-link is called.
   - **Effort.** The steps for each task in Phase 1, counted on a phone and a desktop.
   - **A real screen reader.** Use VoiceOver with Safari if it can be driven here. If it can't (Safari's remote
     automation is a setting for me to turn on), say what you would need, and use the accessibility tree instead.

## Phase 1: Fresh eyes and tasks

**Fresh eyes.** For each of these views, six stand-ins (three phone, three desktop), with their own questions:

- the site's first screen, `#/explore`: "What can you do on this site? Which page would you use to see how story length
  changed over the years, how genres differ, and what makes stories popular?";
- Explore, the default chart; Patterns; Genres, one characteristic; Genres, One genre;
- Trends, All changes; Trends, one characteristic;
- How it works, the first screen.

On every view, ask:

- two or three comprehension questions with fixed right answers (what the answer is, what a number and its unit mean,
  what a color or mark means);
- one "what would you tap to …" question;
- "How easy was this to understand, from 1 to 5?";
- "How does it look, from 1 to 5? Describe its look in three words";
- "What confused you, and what looks cluttered, unfinished or out of place?".

Report the scores per view, with short verbatim excerpts. Run the stand-ins in parallel batches; if the whole set is
too many for one session, ask me which views matter most.

**Tasks.** Do each as the person described, on a phone and on a desktop. Write down every moment of confusion,
hesitation, extra tap, misreading or ugliness, and compare with the earlier rounds' walk-throughs.

1. **A curious first-time visitor with two minutes, on a phone.** Can they tell within five seconds what the site is
   and what to do? Do they find the other pages, and understand how those differ from Explore?
2. **A writer in Romance.** What sets Romance stories apart? Does present-tense narration go with higher ratings in
   Romance? Have Romance stories changed since the 2000s?
3. **Someone comparing genres.** Do genres differ in story length? Which genres have more dialogue, without the site
   ranking them?
4. **Someone curious about change.** Did stories get longer? What else changed, and does it hold within one genre?
5. **A sceptic.** How was a characteristic measured? Why does a chart say "no clear pattern" or "no clear change"? How
   many stories is a number based on? What makes a difference or a change "clear"?
6. **A keyboard-only user and a screen-reader user**, on every page: every control, every chart, every list.
7. **A 15-minute explorer** who moves between all five pages. Does it feel like one site? Does it stay fun? Any dead
   ends, surprises from Back and Forward, or temptations to fish for chance patterns?
8. **Someone sharing a finding.** They download a PNG, or copy the address, and send it to a friend, who opens it on a
   phone. Does the image or the page stand on its own?
9. **A visitor on a slow phone** (a mid-range Android on slow 4G with a 4× slower CPU): the first chart, then a page
   switch, the picker and a search, a genre change.

## Phase 2: Expert review

Cover each area with specific, evidence-based findings, not generic advice.

- **Information architecture and wayfinding.**
  - The five pages: their names, the masthead (and what it drops on phones), the kicker lines, the footer.
  - The cross-links ("Open in Explore →", "Compare genres →", "See all changes →", "Keep exploring") and the way back.
  - Does a newcomer understand how Explore, Patterns, Genres and Trends differ?
- **Consistency across pages.**
  - Controls: the sentence on Explore against the question slots on Genres and Trends; the switches; "Only include";
    the pickers; "Download PNG".
  - Words: the same idea named alike everywhere, and units always said.
  - Chart grammar: dots, capsules, bars, hatching, gray, the accent and the warm color meaning the same thing on every
    page.
  - Layout: headings, takeaways, keys, rails, spacing and widths.
- **Comprehension.**
  - Is every answer visible at a glance, and read right?
  - Units, keys and legends; "median", "interquartile range" (kept by decision) and "in 100".
  - Definitions: where a visitor learns what a characteristic means.
  - Numbers: formatting, rounding and percentages.
- **Visual design.**
  - Typography: the type scale, Source Serif 4 at one weight, line lengths, and the hierarchy on every page.
  - Color: the palette's use and meaning, contrast, and how much color each page carries.
  - Whitespace, density and rhythm; alignment and grid; the charts as the focus.
  - Details: icons and marks (▲ ▼ ≠ ›), focus rings, hover and pressed states, the favicon, empty and error states,
    and the PNG images' own look.
  - First impression: does the site read as polished data journalism, or as tools that grew one at a time?
- **Accessibility.** WCAG 2.2 AA, including target size (2.5.8) and focus not obscured (2.4.11); names, roles and
  states of the custom controls; charts for screen readers; forced colors; zoom; reduced motion.
- **Phones.** Thumb reach, sticky elements, sheets and menus, the keyboard covering inputs, and long genre names.
- **States and edge cases.** Loading (first and later), errors, empty and too-few states, extreme values and small
  genres.
- **Performance.** The first load and its headroom, each page's own load, view changes, and the glides on slow
  devices.
- **Delight.** Ideas that would make exploring more enjoyable, within the rules. No discovery feature may encourage
  cherry-picking.

## Phase 3: Report and proposals, then STOP

Write `docs/stage2/DESIGN_REVIEW_4.md`. Link to the earlier reviews instead of repeating them. Include:

1. **A short verdict.** Grades for each goal (easy to understand, user friendly, aesthetically pleasing) on each
   page and for the site as a whole, next to the earlier rounds' grades where they exist. Then the three biggest
   problems, and what works and should be left alone.
2. **Fresh eyes**: the method, the scores per view and short excerpts.
3. **The latest claims, checked.** A table of the numbers and the "Still open" items, each marked confirmed, different
   (with your number) or wrong.
4. **Prioritized findings**, numbered from F97 so the IDs never clash with the earlier rounds (which used F1–F96). For
   each give:
   - the evidence: the address, the width, and what you saw or measured;
   - why it matters to people, and which goal it serves;
   - a concrete fix, with exact sizes, colors, copy or layout;
   - the impact (high, medium or low) and the effort (small, medium or large).

   Mark findings that would change wording or meaning "(needs your approval)", and those that challenge a decision
   "(revisits a decision)".
5. **Quick wins**: small, safe changes you would make straight away.
6. **Concepts for any larger change.**
   - Give two or three alternatives for each, with mock-ups, fresh-eyes scores, pros and cons, and a recommendation.
   - If the pages need one visual system, propose it as a concept: a type scale, color roles, a spacing scale, and a
     chart grammar every page shares, with before-and-after mock-ups of each page.
   - Name concepts with letters the earlier rounds didn't use (they used A–E, G, H, J, K, M, N, P, Q, R, S and T;
     L and U–Z are free). Number new ideas from I15.
7. **Questions for me**, numbered from O8 (the Trends review's decisions were O1–O7), so that my answers become
   decisions with those numbers. For example:
   - dark mode now?
   - a share image for link previews (the tags exist; the image was turned down)?
   - a second font weight (about 21 KB; it revisits a decision, so only with budget room and evidence)?
   - anything that touches the hard rules or a decision that stands.

**Then stop and wait for my approval.** Don't change `site/`, `litcorr/` or `tests/` before I reply.

## Phase 4: Implement what I approve

- Make the approved changes in small, focused commits on `design-review-4`. The first commit holds the review, its
  screenshots and this prompt.
- After each group of changes:
  - re-check the widths and the zoom levels;
  - update the tests;
  - run the three test commands and the build.
- At the end:
  - repeat the fresh eyes on the changed views, with the same questions;
  - add a **Before and after** section to `DESIGN_REVIEW_4.md`, giving each change with its commit and its before
    and after numbers, the after screenshots, your judgment calls, what is still open, and what you decided not to
    do and why.

## Checkpoints: stop and ask me before

- changing anything in the hard rules' territory: data shipped, interpretation, methodology, dependencies, fonts or
  external requests;
- adding a feature that was not in the approved list;
- making a change that alters the meaning of any chart, title or note, as opposed to its form;
- going over a budget.

**Start with Phase 0.**
