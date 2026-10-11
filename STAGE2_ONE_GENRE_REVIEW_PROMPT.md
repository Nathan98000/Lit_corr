# Stage 2: a critical review of the Genres page's "One genre" view

You are working in the `Literotica_Correlations` project. Its Stage 2 website, *Story Patterns*, lives in `site/`: a
static React + Vite app for ordinary visitors. The **Genres** page has two settings, chosen by a switch at the top:
"One characteristic" (below called View 1) and **"One genre" (View 2)**. View 2 answers *"What stands out about stories
in [Romance]?"* by comparing one genre with all genres on every characteristic.

In a few days View 2 was proposed, built, reviewed once, and largely rebuilt after that review (concept P2). Each round
so far checked correctness, honesty, accessibility and speed thoroughly. This round asks two other questions, and
only these:

1. **Is View 2 user-friendly?**
2. **Is it aesthetically appealing?**

Your job is a **critical, independent evaluation of View 2 against those two goals**, with concrete proposals and
mock-ups. Then stop and wait for me. Be candid. If something looks cluttered or confuses people, tell me; don't tell
me it's fine. Nothing is sacred except the hard rules below.

## What I mean by the two goals

**User-friendly.** Picture someone who knows nothing about statistics and arrives from a link shared on a phone. They:

- understand within five seconds what the page says about the genre, and can repeat one finding, with its direction,
  in their own words;
- read any row correctly the first time: what the bar means, what its number means, which number belongs to the genre
  and which to all genres, and what the units are;
- find what they're curious about without hunting, whether that's a characteristic outside the lists, another genre,
  or the numbers behind a row;
- always know where they are, how to go deeper and how to get back;
- are never overwhelmed by numbers, and never misled by them.

All of this must also be true for a desktop visitor, for someone who uses only a keyboard, and for a screen-reader
user.

**Aesthetically appealing.** Polished editorial data journalism, the kind people screenshot and share. That means:

- a clear focal point and a calm hierarchy, with the answer first and the evidence after it, and the charts carrying
  the page;
- typography with a deliberate scale and comfortable line lengths, with no awkward wraps, orphans or ragged columns;
- consistent spacing and rhythm, a visible grid, and alignment that holds from row to row;
- restrained color, used only where it means something;
- chart marks drawn with craft, so that proportions, weights, end labels, ticks and rules look intentional;
- good use of the screen at every width, neither cramped on phones nor stranded in white space on desktops;
- a minimalist look that is never a generic SaaS dashboard, and never sexualized or gimmicky;
- a page that is recognizably the same site as Explore, Patterns and View 1.

Judge everything you find by whether it helps or hurts these two goals. Honesty, accessibility and performance
constrain the design (see the hard rules), so respect them, but don't re-audit them for their own sake.

## The bar for this review

- Be concrete. "The plot is 118 px wide at 375 px, so move the unit into the list's header and the values fit on one
  line" beats "the rows feel cramped".
- Keep what you measured separate from what you believe.
- Aesthetic judgments are welcome. Argue each one from a design principle and show it in a mock-up.
- Refinements and bolder redesigns of View 2 are both welcome. A redesign has to beat today's page on the tasks and the
  fresh-eyes questions (see "Working setup"), shown with mock-ups that draw the real data.
- If something works, say so and leave it alone. A short list of well-evidenced findings beats a long one.

## Scope

- **In scope:**
  - every state of `#/genres?view=genre&…`: each genre and each "Only include" option, the lists and "Show all", the
    topics, the key, the age note, the actions and the table, the edge states, loading and errors;
  - the parts of the page View 2 shares with View 1, as they appear here: the masthead, the kicker, the question with
    its genre select, the view switch and "Only include";
  - every way into View 2:
    - the view switch;
    - View 1's "What stands out about stories in {genre}? →";
    - Explore's Keep exploring;
    - a shared link;
  - every way out of it: a row's link to View 1, "how this is decided", and Back.
- **Out of scope:** View 1's charts, Explore, Patterns and How it works. The exceptions are a View 2 change that would
  touch them, or a question of consistency with them.

## Read first

1. `docs/stage2/GENRES_PAGE_REVIEW.md`, the last review:
   - section 1 (the verdict), and section 5's View 2 findings: F60, F61, F67, F78 and F80;
   - 7.2, concept P: the P1 / P2 comparison, with mock-ups m04 and m05;
   - section 10, "Before and after": 10.1 and 10.2, the judgment calls in 10.4 (especially 5 and 20–31), 10.5 (still
     open) and 10.6.
2. `STAGE2_GENRES_REVIEW_IMPLEMENTATION_PROMPT.md`. Read three parts:
   - my decisions on that review;
   - the approved copy, in its "Copy" table;
   - Phase 9, the specification for P2.
3. `docs/stage2/GENRES_PAGE_PROPOSAL.md`: 3.3 (View 2 as designed), 3.5 (phones), 5 (the "clearly differs" rule) and
   8.2 (View 2's copy). Also `STAGE2_GENRES_PAGE_PROMPT.md`, for my decisions D1–D10.
4. `docs/stage2/DESIGN_REVIEW_2.md`: sections 1 and 5 show the shape of review I like, and section 8 lists what works
   on the rest of the site.
5. The screenshots in `docs/stage2/genres-review/`:
   - b13–b15: View 2 before the last review;
   - m04–m05: the P concepts;
   - a07–a09: View 2 as it is now.
6. The code:
   - `site/README.md`.
   - In `site/src/components/`:
     - `GenresPage.jsx`;
     - `GenreProfile.jsx`, which is View 2 itself;
     - `GenreAnswer.jsx`, for the age note;
     - `GenreDetails.jsx`, for `ViewLink`;
     - `GenreTable.jsx`, for `useScrollBox`;
     - `GenreSwitch.jsx`, `InlineSelect.jsx` and `CopyLink.jsx`.
   - In `site/src/lib/`:
     - `genres.js`: the `profile…` functions, plus `comparisonBar`, `noDifferenceZone`, `standsOutQuestion` and
       `genreAgeNote`;
     - `genreLayout.js`, for `mixColors`;
     - `rangeLayout.js`, `format.js` and `urlState.js`;
     - `data.js`, where the comment on `loadGenres` describes the file format.
   - `site/src/genres.css`, and `site/src/styles.css`, which holds the site's color and type variables.
   - The tests: `genresProfile.test.jsx` and the other `genres*` files, `siteText.test.js`, `scans.js` and
     `median.test.jsx`.
7. The data side, for what the numbers mean: the genre functions in `litcorr/stage2/site_data.py`, and
   `litcorr/stage2/wording.py`.
8. Reference material in `Claude outputs/`. Read it and run copies outside the repository. Never import from it, and
   never commit it.
   - `design-review-2-tools/` holds the measuring scripts. `README.txt` explains them; the Genres scripts are in its
     `genres-review/` and `genres-review/after/` subfolders.
   - `genres-review-mockups/mock.html`, with its README, holds the P1 and P2 mock-ups, drawn with the real aggregates.

**Which code to review.** `main` at `692939e` holds the Genres page and the last review's changes. Check with
`git log` before you begin, review the newest `main`, and name that commit at the top of your report.

## View 2 as it is now

**Addresses.** For example, `#/genres?view=genre&genre=adult-romance&include=all`.

- Without `genre`, View 2 opens on the last genre chosen in the visit, or else on the largest (D8).
- The view switch carries the genre in both directions: View 1's Highlight becomes View 2's genre, and back.

**From top to bottom** (Romance, all stories):

1. The masthead, and the kicker: "How do the genres’ stories differ? · about 9,000 stories · 30 genres".
2. The question, "What stands out about stories in [Romance]?". Its genre word is a select of the 30 genres. The tab
   title is the question.
3. The controls: the view switch (One characteristic / One genre) and "Only include: [All stories]".
4. The heading: "28 characteristics clearly set Romance apart from all genres".
5. The takeaway, in a box with a rule on its left: "Biggest differences: sexual language (less), the share of
   sentences with sexual language (lower), anatomical terms (less)."
6. The story-age note, when the genre's median age differs from all genres' by 3 years or more. For How To that is
   15.7 years against 9.3. Where allowed, the note includes a "Compare stories published 2020 or later" button.
7. The key, with three items:
   - "How often a Romance story is the higher one, against a story from all genres (times in 100)";
   - "No clear difference: 40 to 60 in 100 (how this is decided)";
   - "A different mix: Romance above, all genres below".
8. The lists:
   - "Lower in Romance than in all genres" (18 characteristics) and "Higher in Romance than in all genres" (10);
   - then "A different mix", when there is one.

   Each list shows 7 rows, then "Show all 18" / "Show fewer". Each has a header row: the ticks ("0 25 50 75 100 in
   100", or "0 50 100" on phones), and "Romance · all genres" over the values.
9. "Every characteristic, by topic": eight folded topics, each with a count, either "{k} of {m} stand out" or "{n}
   characteristics". An open topic lists every characteristic in it, with ▲ ▼ ≠ beside the values of those that stand
   out.
10. The actions:
    - "Show the numbers": a table of all 185 characteristics, topic by topic, that opens under its button;
    - "Copy link".

**A row (concept P2).**

- **The label**, then **the plot**. Every row's plot uses one scale: how often the genre's story is the higher one
  against a story from all genres, out of 100. The value is 50 × (1 + r), from the rule's own measure.
  - A shaded zone from 40 to 60 (#ece9e2), with 1 px edges (#8f8a80) and a center line at 50.
  - A 10 px accent bar (#2b63c6) runs from 50 to the genre's value, with its rounded number printed at the bar's end.
- **Then the values**, with units:
  - numbers: "7.8 · all 19.3 per 1,000 words";
  - yes/no: "9% · all 20%";
  - mostly zero: "73% with any, median 0.709 · all 43%, 0.422 per 1,000 words";
  - bands: "6–20 · all 2–5".
- **Named groups** draw two thin 100% bars instead, the genre's above all genres'. Their values name only one group:
  "≠ Second person (you) 55% · all 2%".
- **Rows with too few stories** read "Too few stories to compare", muted.
- **Every row is a link** to View 1 for that characteristic, with the genre highlighted.
- **Layout.**
  - On desktop: a 250 px label column, the plot, and the values aligned right.
  - On phones (a chart narrower than 560 px): the label on its own line, then the plot (about 110–150 px wide) and
    the values. The values take up to 58% of the row, often on two lines.

**The edge states.**

- **Nothing stands out:** Fetish. "Its stories are close to those of all genres on each of the {m} characteristics
  compared."
- **The most stand-outs:** How To, with 116 (75 lower, 37 higher and 4 different mixes).
- **A small sample:** Chain Stories with "Published 2020 or later", 12 stories. It reads "Fewer than 30 stories in
  Chain Stories match “Published 2020 or later”: too few to compare.", followed by "Show all stories" and the topics.
- **Too few stories** (fewer than 10): today's data never produce this state. To see it, serve an edited genres file
  through a Playwright route.

**Size and data.**

- At 375 px with the topics closed, the page is 2,461 px tall for Romance and 2,801 px for How To.
- The data cover 30 genres of about 300 stories each, and 185 characteristics in 8 topics.
- There are 9 "Only include" options, each with its own file.

## My first impressions, to check

I have looked only at a07 and a08. These are hypotheses, not findings. Confirm, refine or reject each one with
evidence, and don't let them narrow what you look for.

- **The chart is the smallest thing in a row.** On phones the plot is a sliver beside two lines of numbers. On desktop
  the plot and its values sit far apart. The numbers seem to carry the page, not the bars.
- **Each row has two kinds of number.** The bar's "26" (times in 100) sits next to "7.8 · all 19.3 per 1,000 words".
  Will people know which is which? Does anyone understand "times in 100" without the key?
- **The values are long and dense.**
  - Some are long: "73% with any, median 0.709 · all 43%, 0.422 per 1,000 words".
  - Some have trailing zeros: "1.720 · all 1.050".
  - The unit repeats on every row, and the right edges are ragged where values wrap.
- **The key** is three lines of small text that come before any chart. On phones, "(how this is decided)" wraps with
  its opening parenthesis.
- **The takeaway** says "sexual language" three times, and mixes "less" with "lower".
- **The hierarchy is off in places.**
  - "Every characteristic, by topic" looks smaller than the topic names under it.
  - Topic counts mix "1 of 28 stand out" with "13 characteristics", and they wrap on phones ("9 of 27 stand / out").
  - The lists' headings wrap to two lines on phones.
- **Named-group rows** use up to six colors, with no legend for those colors in this view. Their values name only one
  group.
- **On desktop:**
  - the question wraps at 1440 px ("…stories in / Romance?");
  - the content column looks narrow and small for the screen;
  - the ticks end in "100 in 100".
- **Finding things is hard.**
  - To find a characteristic outside the lists, you have to guess its topic; this view has no search.
  - To change genre, you use the select in the question; there is no way to step to the next genre.
- **The actions** sit at the very bottom, after the topics.

## Still open from the last round

These items from 10.5 concern View 2:

- On phones, the plots are about 110–150 px wide beside values on two lines.
- Trailing zeros appear where one number of decimals per chart meets quartiles with three decimals ("2.570 · all
  1.190").
- Some sentences still read badly:
  - "interquartile range 1–1";
  - "median 21–50, interquartile range 6–20 to 51–100";
  - "median 0.200 words";
  - Loving Wives' takeaway, which names "we / us / our" twice.
- The topic headings are `h4` elements inside `<summary>`.
- Opening every topic at once (271 rows) gives a worst frame of 117 ms at 4× CPU slowdown.
- View 2 has not been tried on a real phone or with a real screen reader.

## Decisions that stand

- **Language.** US English and US dates.
- **Name and footer.** The name "Story Patterns". The footer keeps its independence statement and its How it works
  link.
- **Interpretation.**
  - No disclaimers, no reminders that correlation is not causation, and no notes about chance.
  - "Median" and "interquartile range" are used without explanation.
- **Type and theme.**
  - Headings use Source Serif 4, weight 600 only; everything else uses the system sans.
  - No dark mode yet.
- **The decisions D1–D10**, including D2 (the "clearly differs" rule) and D8 (View 2's default genre).
- **From the last round:**
  - concept **P2** for View 2's rows, with P1's units, key and mix-row label;
  - the approved copy;
  - r at two decimals;
  - View 2's Copy link and table;
  - page titles taken from the question.

You may challenge any of these, P2 included, but only with evidence from a task, a fresh-eyes check or a measurement.
Mark such findings "(revisits an owner decision)". I chose P2 from mock-ups without watching anyone read it, so test it
squarely.

## Hard rules

1. **No network access to Literotica.**
   - Never open literotica.com with any tool: a browser, fetch, curl or anything else.
   - If you need to see Literotica's look, ask me for screenshots.
2. **The data stays private and aggregated.**
   - The site ships only `meta.json`, `v/<characteristic>/<included>.json`, `patterns.json` and
     `genres/<included>.json`.
   - No story-level data, data downloads, new fields, new files or format changes without asking me. Each genres file
     stays at or under 60 KB gzipped.
   - `data/` is read-only. Never run `probe`, `collect`, `process` or `export-handoff`.
   - If a proposal needs new data, say so and mark it "(touches a hard rule)".
3. **Interpretation stays honest.**
   - No causal language: "cause", "drive", "make readers", "lead to", "boost", "because of", "effect of", "impact",
     "result in" and the like. The scans ban even a plain "because".
   - No notes about chance, and no reminders that correlation is not causation.
   - "Clearly differs", "stands out" and "sets apart" are said only through the D2 rule.
   - View 2 orders the characteristics within one genre. It never orders or ranks genres.
   - Sample sizes stay visible.
   - The story-age note shows where its rule says. In View 2 that is wherever the genre's and all genres' median ages
     differ by 3 years or more. Its button shows only with All stories, and only where the characteristic allows that
     option.
   - No discovery feature may encourage cherry-picking, or the over-reading of chance differences.
   - The statement that the site is independent of Literotica stays.
4. **Methodology is not design.**
   - Don't change any of these:
     - the measures, the binning or the weights;
     - the minimum group sizes (10 and 30);
     - the "tend to" rule;
     - the D2 rule: 0.20, the 99.9% level, a total variation distance of 0.20, 30 stories, and all genres as the
       reference.
   - How they are *presented* is fair game; that is the point of this review.
5. **No new dependencies.**
   - That covers npm and Python packages, fonts or font weights, CDNs, analytics and external requests.
   - The site stays static, with no server.
   - Checking tools run from a temporary directory outside the repository. Never add them to `package.json`.
6. **Budgets.** Anything you propose must respect these:
   - The first load stays at or under 155 KiB of gzip response bodies. It is 152.5 KiB now.
   - The Genres chunk is lazy: 17.9 KiB of JavaScript and 3.4 KiB of CSS now. Say what a proposal adds to it.
   - Cumulative layout shift stays under 0.1, and there is no "Loading…" flash after the first chart.
   - Opening or choosing from any control never moves the page: `window.scrollY` stays the same.
   - Reduced motion is honored.
   - Touch targets are at least 44 px.
   - Text contrast is at least 4.5:1, and non-text contrast is at least 3:1 for every mark that carries meaning.
   - No glyphs overlap at 320, 375, 768 or 1440 px, with the site font or with `'"DejaVu Sans", Verdana'`.
   - axe-core reports no violations.
7. **Existing addresses keep working:**
   - `#/explore?…`, with `&check=age`;
   - `#/patterns?…`;
   - `#/genres?…`, with `var`, `include`, `genre`, `sort` and `view`;
   - `#/methodology` and `#/methodology/<section>`.
8. **Copy you propose must pass the scans** in `siteText.test.js`, `scans.js` and `median.test.jsx`. They ban causal
   words, UK spellings, "typical story", "typical age" and "middle half".
9. **No changes and no git.**
   - Don't change `site/`, `litcorr/` or `tests/`.
   - Commit nothing, create no branch, and don't push.
   - The review, its screenshots and this prompt stay untracked until I approve.
   - Never commit `.claude/` or `Claude outputs/`.
   - The repository is public, so nothing under `data/` may go into a file you would later commit.

## Working setup

**Running the site.**

- Run `cd site && npm install && npm run dev` to serve it at http://localhost:5173.
- `.claude/launch.json` has two configurations for the built-in browser: `site` (port 5173) and `site-5174`.
- The built-in browser can't take screenshots while its pane is hidden. Instead, drive headless Chromium with
  Playwright from a temporary directory. The Chromium build is cached in
  `~/Library/Caches/ms-playwright/chromium_headless_shell-1243/`.
- Python is `.venv/bin/python`; there is no `python` on the PATH.

**Measure like a host.**

- Build the site, copy `site/dist` to a frozen folder, and serve that copy with gzip (`serve.mjs`, port 4180).
  Rebuilding under a running server breaks long runs.
- Use the same settings as earlier rounds, so the numbers compare:
  - 320 × 568, 375 × 667, 768 × 1024 and 1440 × 900;
  - 200% zoom (720 px at device scale 2) and 400% zoom (320 CSS px).
- Throttle the network only where you look at loading:
  - fast 4G: 9 Mbps, 60 ms;
  - slow 4G: 1.6 Mbps, 150 ms, with a 4× slower CPU;
  - 3G: 400 kbps, 300 ms.

**Tools.**

- Copy `Claude outputs/design-review-2-tools/` to a temporary directory, and install its tools there:
  `npm init -y && npm install playwright-core@1.56.0 axe-core@4.10.3`.
- The last round's scripts are in `genres-review/after/`. Some paths in them start at `/home/claude/…`; change those to
  yours.
- Put new scripts in a new subfolder of that tools folder, `one-genre-review/`, and never in the repository.

**A phone's own browser.**

- If this Mac has Xcode's iOS Simulator, use its Safari for the phone tasks. It reaches the served build at localhost.
  Check the native genre select, taps, "Show all", the topics and Copy link there.
- If there is no simulator, say so. Ask me before downloading other browsers.

**Fresh eyes.** I have no budget for user testing, so use stand-ins, and say plainly in the report that they are
stand-ins.

- Use subagents as first-time visitors. Give each one only screenshots, by file path, and a one-line situation, such
  as "A friend sent you this link; you've never seen the site."
- Give them no repository, no docs and no code, and no hint of what you suspect. Tell them to look only at the images.
- Ask open questions first: "What is this page telling you?" and "What does the row 'Sexual language' say?".
- Then ask questions whose answers you can check against the data:
  - "Do Romance stories have more or less sexual language than all genres?"
  - "What do 26, 7.8 and 19.3 each mean?"
  - "Is dialogue higher or lower in Romance? Where would you look?"
  - "What would you tap to …?"
- Use at least three independent agents for each set of questions. Run phone and desktop screenshots separately.
  Record the answers verbatim, and score them.
- In Phase 3, ask the same questions about the mock-ups of your concepts, so that today's page and the alternatives are
  compared on equal terms.
- Models read static charts differently from people, and can't tap or scroll. Treat their answers as a way to surface
  ambiguity, never as proof that something is clear.

**Design checks.**

- A blur ("squint") test of each screen, to see what dominates.
- A grayscale version of each screen, to see what color alone carries.
- An inventory, taken from computed styles, of the font sizes, weights, colors, spacings and left edges that View 2
  uses.

**Reference.** You may look at published data journalism for patterns worth borrowing, for example The Pudding, the
FT, the New York Times' Upshot or Our World in Data. Cite what you borrow. Never look at Literotica.

**Mock-ups.**

- Make them as small static HTML pages in `Claude outputs/one-genre-review-mockups/` that draw the real aggregates
  (`site/public/aggregates/meta.json` and `genres/*.json`). Or inject CSS and markup into the running site.
  `Claude outputs/genres-review-mockups/mock.html` shows the static approach.
- Never import anything from `Claude outputs/` into `site/`.

**Screenshots.**

- Screenshots for the review go in `docs/stage2/one-genre-review/`: `b…` for the baseline and `m…` for mock-ups.
- Keep them small and palette-compressed, like the earlier reviews'. Pillow in a temporary virtual environment does
  it, with `compose3.py`.
- For documentation, shoot tall viewports. Avoid `fullPage` captures with a narrow clip; one once laid the page out
  again.

Write the report in US English, like the site.

## Phase 0: Baseline (no code changes)

1. **Build and test.** Build the site and run `npm test` and `npm run build` in `site/`, and
   `.venv/bin/python -m pytest tests/test_stage2_site_data.py`. Record the counts; the last round ended with 276
   Vitest tests in 28 files and 30 pytest tests.
2. **Screenshots.** Take these at 375 and 1440 px, and at 320 and 768 px where those differ in interesting ways.

   | State | Address or action |
   |---|---|
   | Romance: the first screen and the whole page | `#/genres?view=genre&genre=adult-romance&include=all` |
   | Romance: "Show all" in both lists; one topic open; every topic open | the same |
   | How To: the most stand-outs, the age note and its button | `#/genres?view=genre&genre=adult-how-to&include=all` |
   | Fetish: nothing stands out | `#/genres?view=genre&genre=fetish-stories&include=all` |
   | Chain Stories: a small sample | `#/genres?view=genre&genre=chain-stories&include=y2020` |
   | Too few stories | an edited genres file, served through a Playwright route |
   | Another option | `#/genres?view=genre&genre=adult-romance&include=long` |
   | Long genre names at 320 px | `celebrity-stories`, `non-consent-stories`, `exhibitionist-voyeur` |
   | The genre select open | on desktop, and in the simulator's native picker if there is one |
   | The table open; Copy link's confirmation | Romance |
   | Hover and keyboard focus on a row; focus on a topic | Romance |
   | The ways in | the view switch from View 1 with Romance highlighted; View 1's details link; Explore's Keep exploring item (`#/explore?mode=one&genre=adult-romance&metric=pop_rating&var=story_words&include=all`) |
   | Loading and errors | the placeholder on 3G; the error and "Try again" |
   | Display settings | 200% and 400% zoom; forced colors, light and dark |

3. **Fresh eyes on today's page**, as described under "Working setup".
4. **Measure what bears on the two goals.**
   - **The anatomy of a row**, at 320, 375, 768 and 1440 px:
     - the widths of the label, the plot and the values, and the plot's share of the row;
     - the space between a bar's end and its values;
     - how many pixels separate the longest and shortest bars in Romance's two lists;
     - the smallest text.
   - **The shape of the page.**
     - What is on the first screen at 375 × 667 and at 1440 × 900.
     - The scroll distance to the first row, the "Higher" list, the topics and the actions.
     - The page's height for Romance, How To and Fetish, with the topics closed and with all of them open.
   - **The visual system.**
     - The inventory under "Design checks", set against View 1's and Explore's.
     - Every line that wraps badly (a lone word, a parenthesis, a unit) at each width, with the site font and with
       `'"DejaVu Sans", Verdana'`.
   - **Effort.** The taps or tab stops it takes to:
     - reach a characteristic outside the lists, such as the share of dialogue;
     - switch to another genre and come back to the same place;
     - see a row in View 1 and return;
     - open the table.

     Also record what happens to open topics, "Show all" and the scroll position when the genre or the option
     changes.
   - **Feel.** Whether "Show all", opening a topic and changing genre feel instant, and whether anything jumps. Check
     reduced motion too.
   - **The basics that make or break usability:**
     - real tap areas (`elementFromPoint`);
     - text and non-text contrast;
     - focus visibility;
     - what a screen reader hears for the heading, the key, a row of each kind and a topic (Playwright's aria
       snapshots).
   - **Every sentence View 2 can show.**
     1. For each genre, with All stories and with "Published 2020 or later", write the heading, the takeaway, the key
        and every row's values to a file in your scratch space.
     2. Read all of it, and list what reads badly or runs long.

## Phase 1: Walk through real tasks

Do each task on a phone and on a desktop. Write down every moment of confusion, hesitation, extra tap, misreading or
ugliness.

1. **The first look.** A friend sends a phone user the Romance link.
   - Within five seconds, can they say what the page is about, and one thing it says?
   - Can they then say exactly what the first row means?
2. **The curious writer.** "Do Romance stories have more dialogue than others? Are they longer? More often in the first
   person?" Few or none of these are in the lists, so the writer has to use the topics. How long does each question
   take, and do they read the answer right?
3. **Two genres.** Someone compares Romance with Loving Wives, then goes back to Romance.
   - Does the page keep their place?
   - Can they tell what changed?
4. **The overwhelmed reader.** How To has 116 stand-outs.
   - Can they get the gist from the first screen?
   - Is "Show all 75" a wall?
5. **The empty answer.** On Fetish:
   - Does the page feel like an answer, or like something broke?
   - Is there anything to do next?
6. **The small sample.** Chain Stories with "Published 2020 or later".
7. **The sceptic** asks:
   - What does "26" mean?
   - Why doesn't "Talking to the reader" stand out at 58, when "Interpersonal closeness" does at 62?
   - What does "40 to 60 in 100" mean? Is the answer one tap away?
8. **Into the evidence and back.** From a row in View 2 to View 1, then Back. Are the scroll position and the open topic
   restored?
9. **Sharing.** Someone uses Copy link.
   - What do the tab title and the friend's first screen say?
   - Does the finding survive out of context?
10. **The desktop scanner.** Someone at 1440 px wants to scan all 185 characteristics of one genre. Is View 2's layout
    efficient for that, or do they reach for the table?
11. **A keyboard-only user and a screen-reader user** go from the question to the gist, then to a topic, a row and the
    table. Count the tab stops, and record what is announced.

## Phase 2: Critique

Give specific, evidence-based findings in each area, not generic advice.

**User-friendliness**

- **The first impression.** Is there a five-second answer?
- **The encoding.**
  - P2's bar and its number, the zone and the key.
  - Can a reader tell the bar's number from the values?
  - Is the direction obvious, with left meaning lower?
- **The values.** What they show, their length, the units, the number formats, and "all" as shorthand for all genres.
- **The words.** The heading, the takeaway, the lists' headings, the topic counts, the key and the edge states.
- **Structure and wayfinding.**
  - The lists, then the topics.
  - "Show all".
  - The order of the sections, and where the actions sit.
  - The page's length, and what is on the first screen.
- **Finding and comparing.** A characteristic outside the lists, another genre, and the numbers behind a row.
- **The controls.**
  - The genre select inside the question, the view switch and "Only include".
  - Feedback, from Copy link and while loading.
- **The edge states**, and what each offers as a next step.
- **Consistency with View 1 and Explore**, wherever the same idea appears: marks, number formats, row links, details
  and actions.
- **Accessibility, as part of usability.**
  - The keyboard path and focus.
  - Screen-reader names.
  - Zoom and reflow.
  - Forced colors and reduced motion.
  - Tap targets.

**Aesthetic appeal**

- **Focal point and hierarchy.** Run the squint test. Is the chart the focus?
- **Typography.**
  - The scale and the weights.
  - The roles of the serif and the sans.
  - Line lengths, wraps and orphans.
  - How the numbers align, including whether they use tabular figures.
- **Layout and grid.** The columns, the alignment, the use of width at each breakpoint, and how a row is composed on a
  phone.
- **Spacing and rhythm.** Row heights, the spacing of the lists and topics, and the dividers.
- **Color.** The accent, the zone, the grays, and the named-group palette. What does grayscale show?
- **The craft of the chart.**
  - The bar's thickness and length, and where its number sits.
  - The zone and the center line.
  - The ticks and their labels.
  - The named groups' bars.
- **The components.**
  - The key and its swatches, and the takeaway's box.
  - The lists' headers and "Show all".
  - The topics' disclosures (+ / −).
  - The buttons.
- **Motion and changes of state.**
- **Polish.** Corner radii, stroke widths, pixel alignment, consistent text colors, and small inconsistencies.
- **The whole.** Does it read as polished data journalism, and as the same site?

**Delight**

- Ideas that would make exploring a genre more enjoyable, within the rules.
- Nothing may rank genres or encourage fishing for differences.

## Phase 3: Report and proposals, then STOP

Write `docs/stage2/ONE_GENRE_REVIEW.md`. Link to the earlier reviews instead of repeating them. Include:

1. **A short verdict:**
   - a grade for each of the two goals, and for each area under it in Phase 2;
   - the three biggest problems;
   - what works and should be left alone.
2. **My first impressions, checked.** For each one, say whether it is confirmed, different or wrong, with the
   evidence.
3. **Fresh eyes.** Give:
   - the questions;
   - the answers, verbatim or as a fair summary with excerpts;
   - the scores;
   - the misreadings that recurred.
4. **The tasks**, on a phone and on a desktop.
5. **Prioritized findings**, numbered from F81 so the IDs never clash with earlier rounds. For each, give:
   - the evidence: the address, the width, and what you saw or measured;
   - why it matters to people;
   - a concrete fix, with exact sizes, colors, copy or layout;
   - the impact (high, medium or low) and the effort (small, medium or large).

   Mark these findings:
   - "(needs your approval)" for those that would change wording or meaning;
   - "(revisits an owner decision)" for those that challenge one of my decisions;
   - "(touches a hard rule)" for those in the hard rules' territory.
6. **Quick wins**: small, safe changes you would make straight away.
7. **Concepts for any larger change.**
   - Name concepts with letters from R onward; A–H, J, K, M, N, P and Q are taken. Number new ideas from I12.
   - For each concept, give two or three alternatives. Each needs:
     - mock-ups at 375 and 1440 px that draw the real aggregates;
     - pros and cons;
     - fresh-eyes scores, from the same questions as Phase 0.

     Then give your recommendation.
   - Include one **"View 2, after"** mock-up: the whole page, top to bottom, at 375 and 1440 px, with your recommended
     quick wins and concepts applied together, shown beside today's page. I want to judge the look as a whole, not
     piece by piece.
8. **Questions for me.**

**Then stop and wait for my approval.** Change nothing in `site/`, `litcorr/` or `tests/`, and commit nothing.

## Checkpoints: stop and ask me before

- downloading a browser or any other software beyond the checking tools named above;
- doing anything in the hard rules' territory, even to evaluate it;
- running anything against `data/` beyond reading the committed aggregates in `site/public/aggregates/`.

**Start with Phase 0.**
