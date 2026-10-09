# What do popular Literotica stories have in common? (Stage 2 website)

**Story Patterns**: a static website for exploring how the popularity of Literotica stories varies with their
characteristics, overall and within each of Literotica's genres. The controls are the question itself: "In [All
genres], how does the [average rating] vary with [story length in words]?" (the default view; the average rating is
the default measure and leads the measure menu). For each group of stories the chart shows the median (with its
value printed) and the interquartile range, with the number of stories behind every figure; the mean is in each
group's details and in "Show the numbers". Above the rows a line says what they are and in what unit ("Stories
grouped by story length in words"). "Compare all 30 genres" shows the same relationship for every genre as small
charts, and the Patterns page lists every clear pattern for a genre and a measure, topic by topic.

The site shows **descriptive associations only**, never causes, and it ships **only precomputed summaries of
groups of stories**: no story text, titles, authors, addresses or story-by-story records.

## How the data gets here

```
data/handoff/litcorr_stage2_handoff_YYYYMMDD.zip      (Stage 1 output: the authoritative corpus)
        │   python -m litcorr site-data                (run from the repository root)
        ▼
site/public/aggregates/meta.json                       genres, measures, characteristics, wording, facts
site/public/aggregates/v/<characteristic>/<included>.json
site/public/aggregates/patterns.json                   the existing pattern verdicts, collected for the Patterns page
        │   npm run build
        ▼
site/dist/                                             the static site
```

`python -m litcorr site-data` (code in `litcorr/stage2/`) reads only the handoff zip and writes, for every
genre × characteristic × group of stories × popularity measure, the number of stories, their median age, and
the median, quartiles and mean of the measure, plus a pattern summary used to word chart titles. "All genres"
weights each story by its genre's size on Literotica. Groups of fewer than 10 stories are left out. The output
is committed, so the website builds without Python and without the private data.

`patterns.json` re-packages the pattern results already in the per-characteristic files ("All stories" only): for
every genre and measure, one character per characteristic giving the direction and the strength band (weak,
moderate, strong) of the existing effect. No medians, no counts; about 11 KB gzipped.

The aggregates are about 66 MB uncompressed (1,685 small files; git and web hosts compress them to roughly a
third). A chart loads one file of about 15–20 KB.

## First-load budget and lazy parts

The **first load** is the HTML, the main script, the CSS, the heading font, `meta.json` and the first chart file:
**148.6 KiB of gzip response bodies in 6 requests** (October 2026). The budget is **155 KiB of gzip response
bodies** for that set, measured on the built site served with gzip (the design review's `firstload.mjs` with
`serve.mjs`; response headers are not counted).

Parts that the first chart does not need load their code when first used (`React.lazy` through
`src/components/lazyPart.jsx`), each a small chunk of about 1–6 KiB gzipped:

| Part | Chunk | Fetched ahead of time |
|---|---|---|
| Characteristic picker (and the search code) | `CharacteristicPicker-*.js`, `search-*.js` | when the browser is idle after the first chart; when its word is hovered or focused |
| Measure menu | `MetricMenu-*.js` | the same |
| Genre cards and the compare table | `CompareGrid-*.js`, `CompareTable-*.js` | when "Compare all 30 genres" is hovered or focused |
| Stories of similar age (its charts) | `AgeCheckCharts-*.js` | when "Check stories of similar age" is hovered or focused |
| Patterns page | `PatternBrowser-*.js` | when a link to it is hovered or focused |
| How it works | `Methodology-*.js` (shares `search-*.js`) | when a link to it is hovered or focused |

The sheet or popover of the picker and the menu (title, Close) opens at once and keeps its size while its body
arrives; the pages hold one screen with a placeholder. If a part's code cannot be loaded, it shows the usual "We
couldn't load the data" message, and Try again fetches it anew. `vite.config.js` has one code-splitting group that
keeps React and everything else in the main chunk, so the first load is a single script.

## Local development

Requires Node 20.19 or newer (see `.nvmrc`).

```bash
cd site
npm install
npm run dev        # http://localhost:5173
npm test           # wording, chart layout, search, the explorer's interactions (Vitest + Testing Library)
npm run build      # static site in site/dist/
npm run preview    # serve the built site locally
```

The Python side has its own tests: `python -m pytest tests/test_stage2_site_data.py` (sample sizes, medians and
weights checked against the source data; small groups hidden; no story-level data in the output).

To rebuild the aggregates after a new handoff: `python -m litcorr site-data` from the repository root. The
test fixtures in `src/test/fixtures/` come from a synthetic handoff:
`python -m litcorr.stage2.synthetic site/src/test/fixtures/aggregates`.

## Deploying

The built site is plain static files with relative paths and hash-based addresses (`#/explore?...`,
`#/patterns?...`, `#/methodology` and `#/methodology/<section>`), so it needs no server configuration.

**Vercel.** Import the GitHub repository, set **Root Directory** to `site`, and keep the detected Vite settings
(`npm run build`, output `dist`). `site/vercel.json` adds caching headers for the aggregates.

**Netlify.** Import the repository; `netlify.toml` at the repository root already sets the base directory
(`site`), the build command and the publish directory (`dist`).

**Anything else** (GitHub Pages, a plain web server): run `npm run build` and upload `site/dist/`.

## Source layout

```
src/
  App.jsx                 page shell: masthead, routes, the headline (kicker), footer
  components/
    Explorer.jsx          the explorer: keeps the shown chart until the next one loads, answer heading, takeaway,
                          the compare view, "Keep exploring"
    Controls.jsx          the question sentence, "Only include", the sheets of the picker and the measure menu, and
                          the question bar on phones
    CharacteristicPicker.jsx  (lazy) search-first picker body (combobox with listbox): Popular, eight topics, search,
                          a measure typed by mistake
    MetricMenu.jsx        (lazy) the popularity-measure menu's body
    Overlay.jsx           bottom sheet on phones; on wider screens a popover under (or over) its word that always
                          fits on the screen (title and Close)
    InlineSelect.jsx      a native select shown as a word of the sentence; SlotWords keeps a slot's last word
                          and its caret together
    RangeChart.jsx        one genre: one row per group (median dot with value, interquartile-range capsule); one
                          tab stop with arrow keys; details as a card, or a line under the chart in the phone layout;
                          the genre-change glide on one scale
    ChartNotes.jsx        story-age warnings and the three explanations (disclosures at every width)
    AgeCheck.jsx          "Stories of similar age": the panel, its heading and Close
    AgeCheckCharts.jsx    (lazy) the same chart within 2000–2009, 2010–2019 and 2020+
    NumbersTable.jsx      the chart's numbers (always in the page; cards on phones)
    CompareGrid.jsx       (lazy) every genre as a small chart, alphabetical
    CompareTable.jsx      (lazy) the numbers behind the genre cards
    PatternBrowser.jsx    (lazy) the Patterns page: topics folded with their counts, one row per pattern
    Methodology.jsx       (lazy) How it works, with the sticky section bar below 1,000 px
    lazyPart.jsx          lazy parts with preload, their error boundary, and whenIdle
    pages.js              the two lazy pages, shared by App and Explorer
    useScrollFloor.js     keeps the scroll position when a new question makes the page shorter
    CopyLink.jsx, LoadError.jsx, useWidth.js, useMediaQuery.js, useGlide.js
  lib/
    data.js               loading and reading the aggregates
    rangeLayout.js        the chart's geometry (pure; tested for overlapping labels)
    compare.js            verdicts, the compare summary and the genre cards' geometry
    search.js             characteristic search (picker and glossary)
    wording.js            titles, answer headings, takeaway, notes, the question sentence (no causal language)
    format.js             number formats (one number of decimals per axis and column)
    listScroll.js         keeps a menu's active option in view by scrolling the menu, never the page
    motion.js             reduced-motion checks
    urlState.js           settings in the address, so views can be shared
  styles.css              all styling; colors are CSS variables at the top (ready for a dark theme later), and a
                          forced-colors block that draws the charts with system colors
public/
  fonts/                  Source Serif 4, weight 600, Latin subset (headings only), and its licence (OFL.txt)
  favicon.svg             the chart's own mark: a capsule with a dot
```

Wording that comes with the data (measure names, the order of the measure menu's groups and the default measure,
labels, topics, the Popular list, search synonyms, "only include" options, the example questions under "Keep
exploring", US spelling) lives in `litcorr/stage2/wording.py`; rebuild the aggregates after editing it. The measures
themselves keep their order in `METRICS`: the aggregate files hold them by position. Search synonyms are search-only text: they keep the spellings people type ("humour") and
are left out of the US-spelling conversion and checks. The masthead name is the `SITE_NAME` constant in `App.jsx`.

## Font

Headings use **Source Serif 4** (weight 600, Latin subset, 21.5 KB), self-hosted from `public/fonts/` with
`font-display: swap` and a preload in `index.html`; no external requests. It is licensed under the SIL Open Font
License 1.1 (`public/fonts/OFL.txt`, taken from `@fontsource/source-serif-4` 5.3.0). Body text uses the system sans.

## Design notes

- Literotica's own accent blue (`#4a89f3`, the theme color its pages declare) carries the data; a warm orange marks
  "lower" and story-age warnings; everything else is neutral. All colors are variables in `styles.css`.
- A chart's heading says "tend to" only when the pattern is clear: a rank correlation of at least 0.1 that is clear
  of zero at the 99% level, groups of at least 30 stories at both ends, and a gap of at least 10% between their
  medians (0.1 stars for ratings). Otherwise it says "No clear pattern" (or "Too few stories to judge a pattern");
  characteristics without an order say "Each group on its own".
- Story age is never hidden: totals carry a warning with a switch to a per-month or per-1,000-views measure, every
  group shows its median age, groups that differ in age get a warning and a one-tap check within three periods.
- Genres are always listed alphabetically, never ranked; the Patterns page is grouped by topic and alphabetical,
  never sorted by strength, and always gives the count of characteristics without a clear pattern.
- Motion is switched off under "reduce motion": another genre glides the marks and the axis together (one scale
  in every frame; the printed values fade in at the end), another measure or characteristic cross-fades, and
  scrolling is smooth.
- Opening a menu, moving through it or choosing from it never moves the page: the menus scroll inside themselves,
  every focus change prevents scrolling, and a shorter chart keeps the scroll position.
- Keyboard: each chart is one tab stop (arrow keys, Home and End move between rows; Escape hides the details).
  Windows contrast themes get system colors on the charts (`@media (forced-colors: active)`).
- Nothing on the site reminds visitors that correlation is not causation (an owner's decision of October 2026);
  nothing on it claims a cause either: the titles say "tend to" only through the pattern rule, and the tests scan
  every visible string for causal words and UK spellings.
