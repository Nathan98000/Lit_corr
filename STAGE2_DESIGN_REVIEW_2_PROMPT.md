# Stage 2 design review, round 2: check the redesign with fresh eyes, then make it better

You are working in the `Literotica_Correlations` project. Its Stage 2 website lives in `site/`: a static React +
Vite app that lets ordinary visitors explore which story characteristics are associated with popularity on
Literotica, overall and within each genre. It has already had one full design review and a large redesign, both done
quickly by other Claude sessions. Your job is a **second, independent review**: judge what was built against my
brief, check the claims made about it, find what still doesn't work for real people, and propose the next round of
improvements. Be candid. Nothing is sacred except the hard rules below, but this round has a higher bar for big
changes (see "The bar for this round").

## Read first

1. `docs/stage2/DESIGN_REVIEW.md`: round 1. Sections 1–7 are the review (findings F1–F36, concepts, ideas I1–I5).
   Section 8, "Before and after", says what was implemented, gives measurements, 25 judgment calls and what is still
   open. Screenshots are in `docs/stage2/design-review/` (`b…` before, `m…` mock-ups, `a…` after). Section 8 was
   written by the session that did the implementation, so treat its numbers as claims to check, not facts.
2. `STAGE2_DESIGN_REVIEW_PROMPT.md` (the round-1 brief) and `STAGE2_DESIGN_IMPLEMENTATION_PROMPT.md` (my decisions and
   the specification that was implemented).
3. `site/README.md`, everything in `site/src/` (start with `App.jsx`, `components/Explorer.jsx`,
   `components/Controls.jsx`, `components/RangeChart.jsx`, `lib/rangeLayout.js`, `lib/wording.js` and `styles.css`)
   and `site/src/test/`.
4. `litcorr/stage2/wording.py` (labels, topics, the Popular list, search synonyms, example questions) and
   `litcorr/stage2/site_data.py`.

**Which code to review.** The redesign is on branch `design-review` (17 commits on top of `main`, not pushed). If I
have merged it into `main` by the time you start, use `main`. Check with `git log` before you begin.

## What the site is for

These requirements come from my original brief. Judge the design against them.

- **Audience.** A popular data-exploration site, not an academic project. A visitor who knows nothing about statistics
  should understand the interface within seconds, and should enjoy playing with it for 10–20 minutes.
- **Core interaction.** Genre → popularity measure → story characteristic → see how popularity varies with that
  characteristic. It must be easy to move between these, and to compare the relationship across genres.
- **Every chart answers a simple question.** It has a plain-English title, a short explanation below it, the sample
  size, and the median and/or mean with some sense of the spread. It never implies more precision than the data
  supports.
- **Look.** Minimalist, editorial and data-journalism in feel. Generous whitespace, clear typography, restrained
  color. Charts are the visual focus. The palette is inspired by Literotica's own, but restrained. It must not look
  like a generic SaaS dashboard, and it must not be sexualized or gimmicky. It must work well on phones and on
  desktops.
- **Quality checks named in the brief.** No overlapping labels, no unreadable charts, long genre names don't break the
  layout, the mobile layout works, charts have clear titles and axes, tooltips are understandable, and nothing turns a
  descriptive association into a causal claim.

## Current state, in brief

- **Pages.** Explore (`#/explore?…`), Patterns (`#/patterns?…`) and How it works (`#/methodology`,
  `#/methodology/<section>`). The masthead says "Story Patterns"; the headline "What do popular Literotica stories
  have in common?" is a small kicker line with the story and genre counts.
- **The controls are a sentence.** "In [All genres], how do [favorites per 1,000 views] vary with [story length]?"
  Genre and "Only include" are native selects laid over inline text. The measure opens a menu with one-line help. The
  characteristic opens a search-first picker (Popular, eight topics, search with synonyms): a bottom sheet on phones,
  a popover on desktop. Comparing genres: "Genre by genre, how do …" with "Back to one genre".
- **The one-genre chart (concept C2).**
  - An answer heading derived from the existing pattern rule: "Longer stories tend to …", "No clear pattern", "Each
    group on its own", "Too few stories to judge a pattern" or "Too few stories to compare here".
  - A takeaway line with two medians.
  - One row per group: the median as a dot with its value printed, the middle half as a capsule, and a dashed line
    for all stories shown. Groups under 30 stories are hatched with hollow dots; groups under 10 keep an empty row.
  - Rows are focusable, and a tap pins their details. The mean appears only in the details and the numbers table.
- **Notes.**
  - Story-age warnings appear as boxes with one-tap actions. "Check stories of similar age" opens the same chart for
    three publication periods; "Switch to views per month" changes the measure.
  - Definitions sit behind three disclosures on narrow screens, or in a margin column at 900 px and wider.
  - Then come the association note; the buttons Show the numbers, Copy link and Compare all 30 genres; next
    questions; and "Try another question".
- **Compare genres (D2, with D1 as the numbers).** One small chart per genre, alphabetical, with its verdict in words.
  The heading counts the verdicts ("Tends higher in 18 of 30 genres, tends lower in none, no clear pattern in 12.").
  The repaired table is behind "Show the numbers".
- **Patterns.** For a genre and a measure, the page says how many characteristics show a clear pattern, then lists
  them by topic, alphabetically, each with a strength word. A toggle shows the rest. It is backed by
  `site/public/aggregates/patterns.json`, approved in round 1.
- **Visual system.**
  - Color tokens in `styles.css`: accent `#4a89f3` / `#2b63c6`, warm `#a9531d`, and the age-box colors.
  - Source Serif 4 at weight 600 (self-hosted, headings only); system sans for body text.
  - 44 px targets.
  - Motion: a 250 ms glide when the genre or measure changes and a 150 ms cross-fade for a new characteristic, both
    off under reduced motion.
  - No dark mode.
- **Round 1's claims** (section 8.1):
  - the first chart row is visible at 375 × 667, and the whole default chart at 1440 × 900;
  - cumulative layout shift is 0.00;
  - the first load is 154.7 KB gzipped, against a 155 KB budget;
  - no chart labels overlap and nothing scrolls sideways at any tested width;
  - every color pair passes contrast;
  - 64 Vitest tests and 18 pytest tests pass.

## Things the implementer noticed but did not fix (or could not check)

Verify these yourself; don't take them as given, in either direction.

**The chart**
- Label overlaps are tested with *estimated* text widths (`textWidth` in `site/src/lib/rangeLayout.js`), never with
  real glyphs. Check the real boxes (`getBBox`) in a browser for every characteristic and measure at 320 and 375 px.
  Also think about wider fallback fonts on Android and Linux.
- When the measure changes, the axis is rescaled. The ticks jump while dots and bars glide from their old to their
  new positions, which may suggest that values changed on one scale. Is that honest?
- On phones the pinned details open under the row; they can cover the following rows or run off the screen.
- Rows are focusable `role="img"` elements that pin their details on Enter or Space. That is an unusual pattern for
  assistive technology.

**The sentence and the controls**
- The measure and characteristic words are `<span role="button">`, because a real button can't wrap like text.
  - Their 44 px tap areas are invisible pseudo-elements.
  - The genre select is a transparent native select enlarged 6 px above and below.
  - On phones the sentence's lines are about 30 px apart, so tap areas on adjacent lines overlap.
  - Round 1's touch-target audit measured element boxes and could not see any of this. Measure the real hit areas,
    for example by sampling `document.elementFromPoint`.
- Is a dotted underline enough to tell a first-time visitor on a phone that the words are controls? Some sentences get
  long: "…differ between stories whose title marks a chapter or part and other stories?" or "…vary with descriptive
  and sensory language in the first fifth?".
- The bottom sheet locks scrolling with `overflow: hidden` on `body`, which iOS Safari doesn't fully honor, and the
  on-screen keyboard may hide the search results. Nobody has tried it on a real phone.
- Below 400 px the nav drops "Explore" (the site name links to the explorer instead).

**Words and hierarchy**
- The answer heading is short on purpose ("No clear pattern"); the full chart title appears only as the page title and
  the chart's accessible name. Does the heading stand on its own when someone scrolls, or arrives from a shared link?
- The takeaway repeats a strength sentence on every chart: "This is a moderate pattern: the typical story differs
  between the groups, but individual stories vary a lot within every group." That is four or five lines on a phone.
- "Weak", "moderate" and "strong" appear on charts and on the Patterns page, but nothing a visitor can read defines them
  (they are cut-offs of 0.2 and 0.4 on the rank correlation).
- The kicker says 8,996 stories and the default chart 8,987 (stories with both measures). Nothing near the chart
  explains the difference.
- Next questions are labels ("Next in Length & structure: Sentence count →"), not questions.
- For characteristics without an order, the heading ("Each group on its own") and the note under it say the same thing.

**Compare, Patterns and How it works**
- On a phone the 31 genre cards run to about 2,200 px. Long genre names are cut with "…" in the two-column cards, and
  there is no way to jump to one genre.
- In compare mode the numbers table exists only once opened; the one-genre table is always in the page.
- Patterns lists 71 sentences for the default view. Does it invite fishing despite the guardrails (alphabetical order,
  the count of characteristics without a clear pattern, the note on chance)? Is "The other 110 don't, which is just as
  informative." clear?
- On phones, How it works opens with a 13-item contents list in two columns before any text.

**Performance, sharing, and checks never done**
- The first load is 154.7 KB of the 155 KB budget, and nothing is code-split: How it works, Patterns, the picker, the
  age check and the compare table all ship in the first bundle. Vite's `import()` needs no new dependency.
- The glide re-renders the whole chart through React state on every frame; nobody has profiled it on a slow device.
- There are no link-preview (Open Graph) tags. With hash addresses, every shared link would show the same preview
  anyway.
- Never checked:
  - a real phone;
  - a real screen reader (VoiceOver, TalkBack or NVDA);
  - axe or Lighthouse;
  - Windows forced colors (the SVG fills are set in CSS);
  - 400% zoom.

## Decisions from round 1 that stand

- US English for everything a visitor can read, and US dates.
- The headline "What do popular Literotica stories have in common?" and the masthead name "Story Patterns" (the
  `SITE_NAME` constant in `App.jsx`).
- No dark mode yet. You may ask again; all colors are CSS variables.
- Source Serif 4, weight 600 only, Latin subset, self-hosted, for headings only.
- The default view: story length × favorites per 1,000 views, all genres, all stories.
- The mean stays off the chart (it is in the details and in the numbers table).
- The approved wording: the headline, answer headings, takeaway, one-group message, compare summary, mode controls,
  "Only include" and the example questions.
- The eight topics and the 12-item Popular list; the pattern browser and `patterns.json`.
- Concepts B (the sentence), 2A (the picker), C2 (rows), D2 with D1 as the numbers, and E1 + E2 (notes); ideas I1–I5.

You may challenge any of these, but only with evidence from a task or a measurement. Mark such findings "(revisits a
round-1 decision)".

## The bar for this round

- Round 1 rebuilt almost everything, so this round should mostly refine.
  - Fix what fails a task, a hard rule or an accessibility criterion.
  - Polish what is merely good.
  - Propose another structural change only with evidence that the current design fails real people.
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
     `v/<characteristic>/<included>.json` and `patterns.json`.
   - Never add story-level data, a data download, new data fields or new aggregate files without asking me.
   - `data/` is read-only. Never run `probe`, `collect`, `process` or `export-handoff`.
   - You may run `python -m litcorr site-data` (offline) when an approved change touches `litcorr/stage2/wording.py` or
     `site_data.py`.
3. **Honest interpretation stays intact.**
   - No causal language anywhere ("cause", "drive", "make readers", "lead to", "boost", "because of", "effect of",
     "impact", "result in" …).
   - "Tend to" appears only through the existing pattern rule.
   - Genres are never ranked or sorted by a result, and patterns are never sorted by strength or effect.
   - Sample sizes stay visible, and story age stays visible where it matters.
   - No discovery feature may encourage cherry-picking or the over-reading of chance patterns.
   - The disclaimer stays word for word: *"The visualizations show descriptive associations in stories on Literotica.
     They do not establish causation, and the stories and users represented on Literotica should not be assumed to
     represent all erotic fiction, readers, or human sexuality."*
   - The statement that the site is independent of Literotica stays.
4. **Methodology is not design.**
   - Don't change these without asking: the measures, the binning, the minimum group sizes (10 and 30), and the
     pattern rule (its thresholds, the 99% level, the 10% gap).
   - How they are *presented* is fair game.
5. **No new dependencies without asking.** That covers npm packages (runtime or dev), fonts or font weights, CDNs,
   analytics and external requests.
   - It stays a static site with no server.
   - Checking tools (Playwright, axe-core, Lighthouse) may run from a temporary directory outside the repository;
     never add them to `package.json`.
   - Budgets: the first load stays at or under 155 KB gzipped. It is 154.7 KB now, so any proposal that adds weight
     must say what pays for it.
   - Cumulative layout shift stays under 0.1, and there is no "Loading…" flash after the first chart.
6. **Existing addresses keep working.**
   - `#/explore?mode=…&genre=…&metric=…&var=…&include=…` (and `&check=age`)
   - `#/patterns?genre=…&metric=…`
   - `#/methodology` and `#/methodology/<section>`
7. **Tests and build must pass at every checkpoint.**
   - The commands are `npm test` and `npm run build` in `site/`, and
     `.venv/bin/python -m pytest tests/test_stage2_site_data.py`.
   - Add tests for any new behavior.
   - The tests scan all visitor text for UK spellings and causal words; `site/src/test/siteText.test.js` bans even a
     plain "because". Any copy you propose must pass them.
8. **Git.**
   - Create a new branch, `design-review-2`, from the branch that holds round 1.
   - Commit nothing during Phases 0–3. Once I approve, the review and its screenshots become the first commit.
   - After that, commit each logical change separately.
   - Don't push.
   - Never commit `.claude/` or `Claude outputs/`.

## Working setup

- **Running the site.**
  - Run `cd site && npm install && npm run dev` to serve it at http://localhost:5173. `.claude/launch.json` has a
    `site` configuration for the built-in browser.
  - The built-in browser cannot take screenshots while its pane is hidden. Headless Chromium driven by Playwright from
    a temporary directory works well; Chromium builds are cached in `~/Library/Caches/ms-playwright`.
- **Python** is `.venv/bin/python`; there is no `python` on the PATH.
- **Measure like a host.** Build the site, then serve `site/dist` with gzip. Use round 1's settings so the numbers
  compare:
  - widths of 320 × 568, 375 × 667, 768 × 1024 and 1440 × 900, plus 200% zoom (720 px at device scale 2);
  - throttling of fast 4G (9 Mbps, 60 ms), slow 4G (1.6 Mbps, 150 ms, 4× slower CPU) and 3G (400 kbps, 300 ms).
- **Round 1's measuring scripts** are in `Claude outputs/design-review-2-tools/`; its `README.txt` explains them.
  - Reuse them for comparable sizes and timings if you like.
  - Measure tap areas and label overlaps independently: those are exactly what the scripts could not see.
- **Mock-ups.**
  - Make them as small static HTML pages that draw the real aggregates, in `Claude outputs/design-review-2-mockups/`,
    or inject CSS and markup into the running site.
  - Round 1's mock-ups in `Claude outputs/design-review-mockups/` show the approach.
  - Never import anything from `Claude outputs/` into `site/`.
- **Screenshots** for the review go in `docs/stage2/design-review-2/` (`b…` for baseline, `m…` for mock-ups). Keep
  them small and palette-compressed like round 1's; for example, use Pillow in a temporary virtual environment.
- Write in US English, like the site.

## Phase 0: Baseline (no code changes)

1. Build the site and run the three test commands; record the counts.
2. **Screenshots.** Take these views at 375 and 1440 px, and at 320 and 768 px where those differ in interesting ways.

   | View | Address |
   |---|---|
   | First screen | `#/explore` |
   | Ranged characteristic (default) | `#/explore?mode=one&genre=all&metric=pop_fav_per_1k_views&var=story_words&include=all` |
   | Yes/no characteristic | `#/explore?var=pov_is_first_person` |
   | 12 groups | `#/explore?var=pub_month` |
   | Rating (zoomed axis) | `#/explore?metric=pop_rating&var=story_words` |
   | A total, with both age warnings | `#/explore?metric=pop_views&var=story_words` |
   | Stories of similar age | `#/explore?metric=pop_views&var=story_words&check=age` |
   | One group left | `#/explore?mode=one&genre=erotic-letters&metric=pop_fav_per_1k_views&var=age_years&include=long` |
   | Small genre | `#/explore?mode=one&genre=adult-how-to&metric=pop_fav_per_1k_views&var=dlg_paragraph_share&include=all` |
   | Large values | `#/explore?mode=one&genre=taboo-sex-stories&metric=pop_views&var=pace_descriptive_shift&include=y2000` |
   | Long sentences | `#/explore?var=title_has_chapter_marker`, `#/explore?var=pace_descriptive_early` |
   | Compare genres | `#/explore?mode=compare&genre=all&metric=pop_views_per_month&var=story_words&include=all` |
   | Compare, 12 groups | `#/explore?mode=compare&var=pub_month` |
   | Patterns | `#/patterns?genre=all&metric=pop_fav_per_1k_views` (toggle off and on), `#/patterns?genre=adult-romance&metric=pop_views_per_month` |
   | How it works | `#/methodology`, `#/methodology/tend-to` |
   | Interactive states | the picker (empty, searching "tense", inside a topic), the measure menu, a pinned row on a phone, the compare numbers table with a cell selected |
   | Error and empty states | block requests to `aggregates/` (error); a selection where no group has 10 stories (find one) |

3. **Re-measure everything in section 8.1 of `DESIGN_REVIEW.md`** with the same method. Report each number next to
   round 1's and explain any difference.
4. **Measure what round 1 could not:**
   - the real tap areas, including the sentence's words on phones and where they overlap;
   - the real label boxes in the chart for every characteristic and measure at 320 and 375 px, for All genres, How To
     and Taboo/Incest;
   - axe-core (or Lighthouse's accessibility audit) on every page and key state;
   - the accessibility tree of the sentence, the picker, the chart and a genre card;
   - forced colors (Chromium's emulation), reduced motion, and 400% zoom (320 CSS px wide);
   - long tasks and frame times during the glide and while the picker opens, at 4× and 6× CPU slowdown;
   - what the page's tags give a link preview.

## Phase 1: Walk through real tasks

Do each task as the person described, on a phone and on a desktop. Write down every moment of confusion, hesitation,
extra tap, misreading or ugliness. Compare with round 1's walk-throughs (sections 3 and 8.2 of `DESIGN_REVIEW.md`).

1. **A curious first-time visitor with two minutes, on a phone.** Can they tell within five seconds what the site is
   and what to do? Do they realize the sentence's words are controls?
2. **A writer in one genre** who wants to know whether present-tense narration goes with more favorites in that genre,
   and whether the answer depends on story age.
3. **Someone comparing genres.** Does story length relate to views differently in different genres?
4. **A sceptic.** How was explicitness measured? Why does a chart say "no clear pattern"? How many stories is a number
   based on? What do "weak", "moderate" and "strong" mean?
5. **A keyboard-only user and a screen-reader user.** Can they operate everything, including the sentence, the picker
   and the chart, and understand each chart?
6. **A 15-minute explorer** who starts at the default chart and follows next questions, the picker and the Patterns
   page. Does it stay fun? Does anything tempt them to fish for or over-read weak patterns?
7. **Someone sharing a finding.** They copy a link to a chart and send it to a friend, who opens it on a phone. What
   does the friend see first, and does the answer survive out of context?
8. **A visitor on a slow phone** (a mid-range Android on slow 4G with a 4× slower CPU): the first chart, opening the
   picker and searching, switching measures.

## Phase 2: Expert review

Cover each of these areas with specific, evidence-based findings, not generic advice.

- **First impression and information architecture.**
  - The sentence as controls: discoverability, length, and its size against the answer heading.
  - The kicker and the name.
  - The three pages and the nav, and where Patterns and the age check live.
  - How it works.
- **Controls.**
  - The picker: try what people would really type ("pov", "dirty talk", "romance", "length", "sex", "swearing",
    "typos", "dialog", "tense").
  - The measure menu and the inline selects.
  - "Only include" and its disabled options.
  - Comparing genres and coming back.
- **Charts.**
  - Is each answer visible at a glance?
  - In the one-genre chart: the rows, printed values, small and hidden groups, the rating axis, the takeaway.
  - The age check.
  - The genre cards (verdict words, the band, hollow dots, the 1× line) and the numbers table.
  - Motion.
- **Words.**
  - Answer headings, the takeaway, notes, next questions, the Patterns page and How it works. Read them aloud.
  - US English throughout, nothing causal, and "tend to" only through the rule.
- **Visual design.**
  - Typography: the sentence at weight 600 only, and the type scale.
  - Spacing, alignment and hierarchy: is the chart the focus of every view?
  - Color.
  - Details: focus states, the favicon, empty and error states.
  - Does it now read as polished data journalism, or still as a form with a chart attached?
- **Accessibility.**
  - WCAG 2.2 AA, including target size (2.5.8) and focus not obscured (2.4.11).
  - Names, roles and states of the custom controls.
  - Charts for screen readers.
  - Forced colors, zoom and reduced motion.
- **States and edge cases.**
  - Loading, on the first load and later.
  - Errors: block the aggregates to see them.
  - Empty and one-group views.
  - Long genre names, 12 groups, extreme values and small genres.
  - The age check when groups are hidden.
- **Performance.** The first load and its headroom, the cost of each view change, code splitting, the glide on slow
  devices, and layout shifts.
- **Regressions.** Anything useful from before round 1 that was lost or got harder to reach.
- **Delight.** Ideas that would make exploring more enjoyable within the rules. No discovery feature may encourage
  cherry-picking.

## Phase 3: Report and proposals, then STOP

Write `docs/stage2/DESIGN_REVIEW_2.md`. Link to round 1 instead of repeating it. Include:

1. **A short verdict**, with a grade per area next to round 1's grades (section 1 of `DESIGN_REVIEW.md`) and the three
   biggest remaining problems.
2. **Round 1's claims, checked.** A table of the section 8.1 numbers and the "Still open" items, each marked confirmed,
   different (with your number) or wrong.
3. **Prioritized findings**, numbered from F37 so the IDs never clash with round 1. For each give:
   - the evidence: the address, the width, and what you saw or measured;
   - why it matters to people;
   - a concrete fix, with exact sizes, colors, copy or layout;
   - the impact (high, medium or low) and the effort (small, medium or large).

   Mark findings that would change wording or meaning "(needs your approval)", and findings that challenge a round-1
   decision "(revisits a round-1 decision)".
4. **Quick wins**: small, safe changes you would make straight away.
5. **Concepts for any larger change.**
   - Give two or three alternatives for each, with mock-ups, pros and cons, and a recommendation.
   - Number new ideas from I6.
   - Name concepts with letters round 1 didn't use (it used A–E, 2A–2C, C1–C3, D1–D3 and E1–E2).
6. **Questions for me.** For example:
   - dark mode now?
   - a second font weight for the sentence (about 21 KB, so only with budget room)?
   - link-preview tags or a share image?
   - code splitting?
   - anything that touches the hard rules.

**Then stop and wait for my approval.** Don't change `site/`, `litcorr/` or `tests/` before I reply.

## Phase 4: Implement what I approve

- Make the approved changes in small, focused commits on `design-review-2`. The first commit holds the review, its
  screenshots and this prompt.
- After each group of changes:
  - re-check the four widths and 200% zoom;
  - update the tests;
  - run the three test commands and the build.
- At the end, add a **Before and after** section to `DESIGN_REVIEW_2.md`, shaped like section 8 of round 1. It should
  give:
  - each change, with its commit and before-and-after numbers;
  - after screenshots;
  - your judgment calls;
  - what is still open;
  - anything you decided not to do, and why.

## Checkpoints: stop and ask me before

- changing anything in the hard rules' territory: data shipped, interpretation, methodology, dependencies, fonts or
  external requests;
- adding a feature that was not in the approved list;
- making a change that alters the meaning of any chart, title or note, as opposed to its form;
- going over a budget.

**Start with Phase 0.**
