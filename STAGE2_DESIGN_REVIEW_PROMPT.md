# Stage 2 design review: make the website as user-friendly and as pleasing to look at as possible

You are working in the `Literotica_Correlations` project. Its Stage 2 website lives in `site/`: a static React +
Vite app that lets ordinary visitors explore which story characteristics are associated with popularity on
Literotica, overall and within each genre. It works and is tested. Your job is to **critically evaluate its
design, both usability and aesthetics, and then make it better**. Look at it with fresh eyes. It was built
quickly by another Claude session, so be candid. Nothing about the current design is sacred except the hard
rules below.

Before judging anything, read `site/README.md`, everything in `site/src/` (start with `App.jsx`,
`components/Explorer.jsx`, `components/Controls.jsx`, `components/GroupChart.jsx`, `components/CompareTable.jsx`,
`lib/wording.js` and `styles.css`), and `litcorr/stage2/wording.py`, which holds the labels, chart-title phrases
and filter options that the site receives with its data.

## What the site is for

These requirements come from my original brief. Judge the design against them.

- **Audience.** A popular data-exploration site, not an academic project. A visitor who knows nothing about
  statistics should understand the interface within seconds, and should enjoy playing with it for 10–20 minutes.
- **Core interaction.** Genre → popularity measure → story characteristic → see how popularity varies with that
  characteristic. It must be easy to move between these, and to compare the relationship across genres.
- **Every chart answers a simple question.** It has a plain-English title, a short explanation below it, the
  sample size, and the median and/or mean with some sense of the spread. It never implies more precision than
  the data supports.
- **Look.** Minimalist, editorial and data-journalism in feel. Generous whitespace, clear typography, restrained
  colour. Charts are the visual focus. The palette is inspired by Literotica's own, but restrained. It must not
  look like a generic SaaS dashboard, and it must not be sexualised or gimmicky. It must work well on phones and
  on desktops.
- **Quality checks named in the brief.** No overlapping labels, no unreadable charts, long genre names don't break
  the layout, the mobile layout works, charts have clear titles and axes, tooltips are understandable, and nothing
  turns a descriptive association into a causal claim.

## Current state, in brief

- **Explorer.** A mode toggle (*One genre* / *Compare genres*) and numbered controls: 1 Genre, 2 Popularity
  (10 measures in 4 groups, with an info tip), and 3 Story characteristic. The characteristics are 187 options,
  chosen through 6 group tabs plus a long select with sub-groups. A secondary *Stories included* filter has 9
  options.
- **One-genre chart.** An SVG chart showing, for each group of stories: the median (dot), the middle half of
  stories (bar), the mean (diamond), and a dashed line for all stories shown. Below each label are the sample
  size (*n*), hover or focus tooltips, a *Show the numbers* table and a *Copy a link* button.
- **Notes under each chart.** How clear the pattern is, notes about story age, the characteristic's description
  and caveat, help text for the measure, and a no-causation reminder.
- **Compare genres.** A colour-coded table: one row per genre (alphabetical), with each group's median shown as a
  multiple of that genre's typical story (e.g. "1.3×"), plus a pattern arrow per genre.
- **Pages.** A hero with *What makes a Literotica story popular?* and six example-question chips; a long
  plain-language methodology page with a glossary of all 187 characteristics; and a footer with the required
  disclaimer and an independence statement.
- **Visual system.** Defined in `styles.css`. Off-white background, near-black ink, and Literotica's accent blue
  `#4a89f3`, the `theme-color` of its pages, taken from pages already saved on my computer. A warm orange
  `#e8894a` marks "lower" in the comparison table. Headings use a system serif stack (Iowan Old Style, Palatino,
  Georgia) and body text a system sans. There are no web fonts and no dark mode.

### Things the builder noticed but did not fix

Verify these yourself; don't take them as given.

- **Layout.**
  - On a 375 px phone, the six hero chips and the controls push the first chart about 1,100 px down the page.
  - The group tabs, chips and mode-toggle buttons are about 30–32 px tall, which may be below a comfortable
    touch-target size.
- **Charts and tables.**
  - Tooltips are designed for hover and keyboard focus. On touch screens they may be awkward.
  - Switching characteristic briefly replaces the chart with "Loading…", which can make the layout jump.
  - The compare table scrolls sideways on phones. The meaning of "1.3×", of the colour scale and of the arrows
    may not be obvious.
  - Totals such as views are very skewed, and the y-axis is linear.
  - The off-scale mean marker (a small triangle) is not explained in the legend.
- **Text and wording.**
  - The notes block under each chart is text-heavy.
  - Spelling mixes US and UK English: "favorites" (Literotica's own word) next to "summarise", "humour",
    "neighbouring" and "unrecognised". Pick one, and ask me which.
  - The masthead name ("Story popularity · an explorer") and the default first view (story length ×
    favorites per 1,000 views, all genres) were chosen quickly.
- **Reach.** The 187-item characteristic picker may be hard to browse, and there is no search.
- **Fonts.** On Windows and Android, the serif headings fall back to Georgia.

## Hard rules

1. **No network access to Literotica.**
   - Never open literotica.com with any tool: browser, fetch, curl or anything else. Its robots.txt disallows AI
     agents.
   - If you want to compare the design with Literotica's look, ask me for screenshots.
2. **The data stays private and aggregated.**
   - The site may only ship precomputed summaries of groups of stories.
   - Never add story-level data, a data download, new data fields or new aggregate files without asking me.
   - `data/` is read-only. Never run `probe`, `collect`, `process` or `export-handoff`.
   - You may run `python -m litcorr site-data` (offline) if you change wording in `litcorr/stage2/wording.py`.
3. **Honest interpretation stays intact.**
   - No causal language anywhere ("causes", "drives", "makes readers" …).
   - Titles say "tend to" only through the existing pattern rule.
   - Genres are never ranked.
   - Sample sizes stay visible, and story age stays visible where it matters.
   - The required disclaimer stays word for word: *"The visualizations show descriptive associations in stories on
     Literotica. They do not establish causation, and the stories and users represented on Literotica should not
     be assumed to represent all erotic fiction, readers, or human sexuality."*
   - The statement that the site is not affiliated with Literotica stays.
4. **Methodology is not design.** Don't change the measures, the grouping (binning) rules, the minimum group sizes
   (10 and 30) or the pattern thresholds without asking. How they are *presented* is fair game.
5. **No new dependencies, web fonts, CDNs, analytics or other external requests without asking.** It must stay a
   static site with no server. If you think a font or library is worth it, make the case: what it adds, its size,
   and where it would load from.
6. **Tests and build must pass at every checkpoint.** That means `npm test` and `npm run build` in `site/`, and
   `python -m pytest tests/test_stage2_site_data.py`. Add tests for any new behaviour.
7. **Git.**
   - Work on a new branch (e.g. `design-review`) and commit each logical change separately.
   - Don't push unless I ask.
   - Never commit `.claude/` or `Claude outputs/`.

## Working setup

- **Running the site.** `cd site && npm install && npm run dev` serves it at http://localhost:5173.
  `.claude/launch.json` has a `site` configuration for previewing it in the built-in browser.
- **Widths to check.** At least 375 px (phone), 768 px (tablet) and 1,440 px (desktop). Also check 320 px for
  breakage.
- **Shareable views.** Every view has an address, e.g. `#/explore?mode=one&genre=adult-romance&metric=pop_views&var=story_words&include=all`.
  Use these addresses to refer to exactly what you looked at.
- **Previewing ideas.** You may try out CSS or markup ideas by injecting them in the browser and taking
  screenshots. Do that before you touch the source.

## Phase 0: Baseline (no code changes)

Run the site and record a baseline in `docs/stage2/DESIGN_REVIEW.md`:

1. **Screenshots.** Describe the key views at each width:
   - the home page as first seen;
   - a one-genre chart for a ranged characteristic, a yes/no characteristic and a 12-group characteristic
     (publication month);
   - *Compare genres*;
   - a filtered view that leaves only one group;
   - a small genre (e.g. How To);
   - the methodology page.
2. **Measurements.**
   - Scroll distance to the first chart on a phone.
   - Taps needed to change each control.
   - Touch-target sizes and text sizes.
   - Colour contrast of every text and colour pairing, including the pale small-sample cells.
   - Size of the first page load and of each view change, and the perceived speed when switching views.

## Phase 1: Walk through real tasks

Do each task as the person described, on a phone and on a desktop. Write down every moment of confusion,
hesitation, extra tap, misreading or ugliness.

1. **A curious first-time visitor with two minutes, on a phone.** Can they tell within five seconds what the site
   is and what to do? How quickly do they reach an interesting chart?
2. **A writer in one genre.** They want to know whether present-tense narration goes with more favorites in that
   genre, and whether the answer depends on story age.
3. **Someone comparing genres.** Does story length relate to views differently in different genres?
4. **A sceptic.** How was explicitness measured? Why does a chart say "no clear pattern"? How many stories is a
   number based on?
5. **A keyboard-only user and a screen-reader user.** Can they operate everything and understand each chart?

## Phase 2: Expert review

Cover each of these areas with specific, evidence-based findings, not generic advice:

- **First impression and information architecture.** The hero, the order of the controls, the default view, the
  example questions, the methodology page and glossary, the masthead and naming.
- **Controls.**
  - Is the genre → popularity → characteristic flow obvious?
  - Is the 187-option picker discoverable? Consider search, featured characteristics, better grouping, or a
    two-step picker.
  - Are the *Stories included* filter and the mode toggle clear?
- **Charts and tables.**
  - Do the encodings (dot, bar, diamond, line) read instantly? Is each chart's answer visible at a glance?
  - Check axes and scales (especially skewed totals), labels, legends, the treatment of small and hidden groups,
    off-scale values and tooltips (including on touch).
  - In the compare table, check the colour scale, the "×" numbers, the arrows and the layout on phones.
  - Would a different chart form serve some views better?
- **Words.**
  - Titles, subtitles, notes and help text: are they clear, short and plain? How do they read aloud?
  - Spelling and terms must be consistent: genre or category? favorites or favourites?
  - The text under the chart should help without overwhelming.
- **Visual design.**
  - Typography: type scale, line length, font choice and fallbacks.
  - Spacing rhythm, alignment and hierarchy.
  - Colour: its use, consistency and how it relates to Literotica's palette.
  - The details: favicon, focus states, micro-interactions and transitions (respecting reduced motion).
  - Is it beautiful, and does it feel like polished data journalism?
- **Accessibility.** WCAG 2.1 AA: contrast, keyboard access, focus order, names and roles, charts that screen
  readers can use, touch targets, zoom to 200%, and reduced motion.
- **States and edge cases.** Loading, errors, empty or too-few groups, long genre names, 12-group characteristics,
  extreme values, and genres with few stories.
- **Performance.** Initial load, data per interaction, layout shifts, perceived speed.

Also consider ideas that would make the site more delightful to explore. For example: smoother transitions
between views; a highlighted takeaway on each chart; a "next question" suggestion; or a way to browse the clearest
patterns. Any discovery feature must not encourage cherry-picking or over-reading chance patterns.

## Phase 3: Report and proposals, then STOP

Finish `docs/stage2/DESIGN_REVIEW.md` with:

1. **A short verdict**, with a grade per area from Phase 2 and the three biggest problems.
2. **A prioritised list of findings.** For each: the evidence (view address, width, what you saw), why it matters
   to users, a concrete fix (exact sizes, colours, copy or layout), and the impact (high, medium or low) and
   effort (small, medium or large).
3. **Quick wins.** Small, safe changes that you would make straight away.
4. **Two or three alternative concepts for each larger change** (for example the characteristic picker, the hero,
   or the chart style), with mock-ups. Make the mock-ups as screenshots of injected-CSS prototypes or as small
   static HTML files in your scratch space. List the pros and cons of each concept and give your recommendation.
5. **Questions for me.** For example: US or UK spelling, the site's name, whether to add dark mode, any web font
   you propose, and anything that touches the hard rules.

**Then stop and wait for my approval.** Don't change the source before I reply.

## Phase 4: Implement what I approve

- Make the approved changes in small, focused commits on your branch.
- After each group of changes, re-check all three widths and update the tests.
- Run `npm test`, `npm run build` and the Python tests.
- At the end, add a *Before and after* section to `docs/stage2/DESIGN_REVIEW.md` covering each change, what is
  still open, and anything you decided not to do and why.

## Checkpoints: stop and ask me before

- changing anything in the hard rules' territory: data shipped, interpretation, methodology, or dependencies and
  external requests;
- adding a feature that was not in the approved list;
- making a change that alters the meaning of any chart, title or note, as opposed to its form.

**Start with Phase 0.**
