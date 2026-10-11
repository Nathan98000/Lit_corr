# What do popular Literotica stories have in common? (Stage 2 website)

**Story Patterns**: a static website for exploring how the popularity of Literotica stories varies with their
characteristics, overall and within each of Literotica's genres. The controls are the question itself: "In [All
genres], how does the [average rating] vary with [story length in words]?" (the default view; the average rating is
the default measure and leads the measure menu). For each group of stories the chart shows the median (with its
value printed) and the interquartile range, with the number of stories behind every figure; the mean is in each
group's details. Above the chart a line of its own says what the rows are and in what unit ("Stories grouped by story
length in words"; yes/no characteristics, whose two rows name themselves, have none), and the measure's name sits over
the plot, on its ticks. "Download PNG" saves the chart on screen as an image: its title, subtitle and key, the chart,
and the credit. The Patterns page lists every clear pattern for a genre and a measure, topic by topic.

The **Genres** page compares the stories themselves, not their popularity, genre by genre. "How do genres differ in
[story length in words]?" draws one characteristic in every genre (All genres first), in one of four forms: range rows
for numbers, share bars for yes/no characteristics, 100% bars for named groups and ordered bands (the groups' names
over All genres' bar), and, for characteristics where most stories score 0, one row per genre with the range and
median among its stories with any, then that median and how many have any. ▲ ▼ ≠ mark a genre that clearly differs, in
a column beside its name; the line above the chart says the order ("Genres in alphabetical order", or by median or
share with its A–Z / By … switch); under the chart, "Download PNG" and "Open in Explore →". "What stands out about
stories in [Romance]?" lists the characteristics that set one genre apart from all genres, the largest differences
first, each row on one scale (how often the genre's story is the higher one against a story from all genres, out of
100, with the no-difference zone at 40–60) and with both genres' values; then every characteristic by topic, and "Copy
link". On phones a tapped genre's numbers stay at the bottom of the screen while its chart is in view. The tab is
named after the question on screen. A genre "clearly differs" only by the rule in How it works (`meta.genre_rule`): a
rank-biserial correlation of at least 0.2 against all genres (for named groups, a total variation distance of at least
0.2), clear at the 99.9% level, with at least 30 stories; a genre with fewer is named as too few to compare.

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
site/public/aggregates/genres/<included>.json          the Genres page: every genre's quartiles or shares per characteristic
        │   npm run build
        ▼
site/dist/                                             the static site
```

`python -m litcorr site-data` (code in `litcorr/stage2/`) reads only the handoff zip and writes, for every genre ×
characteristic × group of stories × popularity measure, the number of stories, their median age (no longer shown on
the site), and the median, quartiles and mean of the measure, plus a pattern summary used to word chart titles. "All
genres" weights each story by its genre's size on Literotica. Groups of fewer than 10 stories are left out. The output
is committed, so the website builds without Python and without the private data.

`patterns.json` re-packages the pattern results already in the per-characteristic files ("All stories" only): for
every genre and measure, one character per characteristic giving the direction and the strength band (weak,
moderate, strong) of the existing effect. No medians, no counts; about 11 KB gzipped.

`genres/<included>.json` (one per "Only include" option, 53–57 KB gzipped) holds, for every characteristic but
publication month and weekday, and for every genre (All genres first): the number of stories with it, their quartiles
(All genres also the 10th and 90th percentiles) or their shares, and the comparison with all genres (the rank-biserial
correlation, or for named groups the total variation distance) with whether the genre clearly differs. For mostly-zero
characteristics it gives the stories above 0 and their quartiles instead; a genre's share above 0 is worked out on the
page from its two counts. Each genre's median story age (no longer shown) and number of stories in the option come
with it. Genres with fewer than 10 stories are left out, as everywhere. `loadGenres(include)` and
`prefetchGenres(include)` in `src/lib/data.js` read it, through the same cache as the other files; a visit that starts
on the Genres page fetches it, and the page's code, while the app starts, before `meta.json` arrives (`App.jsx`).

The aggregates are about 68 MB uncompressed (1,694 small files; git and web hosts compress them to roughly a
third). A chart loads one file of about 15–20 KB; the Genres page one file of about 55 KB gzipped per option.

## First-load budget and lazy parts

The **first load** is the HTML, the main script, the CSS, the heading font, `meta.json` and the first chart file:
**148.5 KiB of gzip response bodies in 6 requests** (October 10, 2026, after the simplification and "Download PNG";
the Genres page's own code, styles and files load only when it is opened: a visit that starts on it is 201.8 KiB in 8
requests; no layout shift). The budget is **155 KiB of gzip response
bodies** for that set, measured on the built site served with gzip (the design review's `firstload.mjs` with
`serve.mjs`; response headers are not counted).

Parts that the first chart does not need load their code when first used (`React.lazy` through
`src/components/lazyPart.jsx`), each a small chunk of about 1–6 KiB gzipped:

| Part | Chunk | Fetched ahead of time |
|---|---|---|
| Characteristic picker (and the search code) | `CharacteristicPicker-*.js`, `search-*.js` | when the browser is idle after the first chart; when its word is hovered or focused |
| Measure menu | `MetricMenu-*.js` | the same |
| "Download PNG" (the code that makes the image) | `chartImage-*.js` | when the button is hovered or focused (or pressed) |
| Patterns page | `PatternBrowser-*.js` | when a link to it is hovered or focused |
| Genres page (its components, helpers and styles) | `GenresPage-*.js`, `GenresPage-*.css` | when a link to it is hovered or focused (the masthead's link also fetches `genres/all.json`); a visit that starts on it fetches both while the app starts |
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
`#/genres?...`, `#/patterns?...`, `#/methodology` and `#/methodology/<section>`), so it needs no server
configuration.

**Vercel.** Import the GitHub repository, set **Root Directory** to `site`, and keep the detected Vite settings
(`npm run build`, output `dist`). `site/vercel.json` adds caching headers for the aggregates.

**Netlify.** Import the repository; `netlify.toml` at the repository root already sets the base directory
(`site`), the build command and the publish directory (`dist`).

**Anything else** (GitHub Pages, a plain web server): run `npm run build` and upload `site/dist/`.

## Source layout

```
src/
  App.jsx                 page shell: masthead (How it works leaves it below 560 px, Explore below 360 px), routes,
                          the headline (kicker), footer; remembers the Genres page's last address and the last genre
                          chosen in the visit (the default of "One genre")
  genres.css              the Genres page's styles, loaded with its code
  components/
    Explorer.jsx          the explorer: keeps the shown chart until the next one loads, answer heading, takeaway,
                          "Download PNG", "Keep exploring"
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
    useRowDetails.js      a chart's rows as one tab stop with details on demand (RangeChart and the Genres page)
    GenresPage.jsx        (lazy) the Genres page: the question, the view switch and "Only include"; keeps
                          the shown file until the next one has loaded; the live region (only the order's words after
                          an order change); the tab's title; focus to the answer's heading after a button that changes it
    GenreAnswer.jsx       (lazy) one characteristic in every genre: heading (the genres compared), ▲/▼ lists, All
                          genres line, the genres too few to compare, legend, the order line with its A–Z / By …
                          switch, the chart for its form and the actions ("Download PNG", "Open in Explore →")
    GenreChart.jsx        (lazy) range rows (numbers) and share bars (yes/no), built on rangeLayout: the mark column,
                          the value column's heading
    GenreAny.jsx          (lazy) mostly-zero characteristics: one row per genre with the range and median among its
                          stories with any, then that median and how many have any
    GenreMix.jsx          (lazy) 100% bars for named groups and ordered bands, the groups' names over All genres' bar
    GenreGlide.jsx        (lazy) the rows' glide to a new order (transforms only; none under reduced motion)
    GenreSwitch.jsx       (lazy) the two-option switches (the view; the order, drawn compact)
    GenreDetails.jsx      (lazy) a genre's details: a compact card on wider charts, or on phones a line that sticks to
                          the bottom of the screen while its chart is in view; the link to the genre's own view
    GenreProfile.jsx      (lazy) one genre against all genres: stand-outs, the key, lists and topics with each row on
                          one 0–100 scale, every characteristic by topic, and "Copy link"; the small-sample and
                          too-few states
    ChartNotes.jsx        the totals box (story age) with its switch, and the three explanations (disclosures at every
                          width)
    DownloadPng.jsx       "Download PNG": the button, its lazy code and its failure message (Explore and "One
                          characteristic")
    PatternBrowser.jsx    (lazy) the Patterns page: topics folded with their counts, one row per pattern
    Methodology.jsx       (lazy) How it works, with the sticky section bar below 1,000 px
    lazyPart.jsx          lazy parts with preload, their error boundary, and whenIdle
    pages.js              the two lazy pages, shared by App and Explorer
    useScrollFloor.js     keeps the scroll position when a new question makes the page shorter
    CopyLink.jsx, LoadError.jsx, useWidth.js, useMediaQuery.js, useGlide.js
  lib/
    data.js               loading and reading the aggregates (loadGenres and prefetchGenres for the Genres page)
    rangeLayout.js        the chart's geometry (pure; tested for overlapping labels), with the Genres page's options
                          (a mark column, a value column with its heading, a Stories column, two-line names in a
                          phone column)
    genres.js             (lazy) reading genres/<included>.json, every sentence of the Genres page, and numberFormat
                          (one number format per chart)
    genreLayout.js        (lazy) the geometry of the 100% bars (with the groups' names and their inks) and of the
                          mostly-zero chart, and their overlap checks
    search.js             characteristic search (picker and glossary)
    wording.js            titles, answer headings, takeaway, notes, the question sentence (no causal language)
    format.js             number formats (one number of decimals per axis and column)
    listScroll.js         keeps a menu's active option in view by scrolling the menu, never the page
    chartImage.js         (lazy) the PNG: the chart's <svg> cloned at rest with its computed styles, the title,
                          subtitle, key and credit drawn on a canvas at 2×, and the file saved
    motion.js             reduced-motion checks
    urlState.js           settings in the address, so views can be shared (the Genres page's too)
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
- Story age: totals carry a warning with a switch to a per-month or per-1,000-views measure, and “Only include” can
  limit any chart to stories published in one period.
- Genres are listed alphabetically, never ranked, except where the reader asks for it: the Genres page's "By median"
  (or "By share") order (owner's decision D3), which the line above the chart says. "One genre" orders characteristics
  by the size of their difference within that genre, never genres. The Patterns page is grouped by topic and
  alphabetical, never sorted by strength, and always gives the count of characteristics without a clear pattern.
- Motion is switched off under "reduce motion": another genre glides the marks and the axis together (one scale
  in every frame; the printed values fade in at the end), another measure or characteristic cross-fades, the Genres
  page's rows glide to a new order, and scrolling is smooth.
- Opening a menu, moving through it or choosing from it never moves the page: the menus scroll inside themselves,
  every focus change prevents scrolling, and a shorter chart keeps the scroll position.
- "Download PNG" draws the chart as the page shows it, at rest (no hover, tap or glide), from its own `<svg>` and the
  page's computed styles, at 2× pixels, with "Chart by Nathan Nguyen, @NathanDNguyen" at the bottom right; nothing
  leaves the browser.
- Keyboard: each chart is one tab stop (arrow keys, Home and End move between rows; Escape hides the details).
  Windows contrast themes get system colors on the charts (`@media (forced-colors: active)`).
- Nothing on the site reminds visitors that correlation is not causation (an owner's decision of October 2026);
  nothing on it claims a cause either: the titles say "tend to" only through the pattern rule, and the tests scan
  every visible string for causal words and UK spellings.
