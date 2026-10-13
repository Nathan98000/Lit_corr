# What do popular Literotica stories have in common? (Stage 2 website)

**Story Patterns**: a static website for exploring how the popularity of Literotica stories varies with their
characteristics, overall and within each of Literotica's genres. The controls are the question itself: "In [all
genres], how does the [average rating] vary with [word count]?" (the default view; the average rating is the default
measure and leads the measure menu; "all genres" is lowercase inside every sentence, and the lists keep "All genres").
For each group of stories the chart shows the median (with its value printed, starting clear of the dashed line of all
stories) and the interquartile range, with the number of stories behind every figure ("2,631 stories" beside each row
on phones); the mean is in each group's details. Above the chart a line of its own says what the rows are and in what
unit ("Stories grouped by word count"; yes/no characteristics, whose two rows name themselves, have none), and the
measure's name sits over the plot, on its ticks, with the rating's scale ("Average rating (1 to 5 stars)"). Right under
the chart one line leads to the same characteristic on the other pages: "By genre →" and "Over time →" (the way across;
see below). "Download image" saves the chart on screen as a PNG: its title, subtitle and key, the chart, and the
credit. The Patterns page lists every clear pattern for a genre and a measure, topic by topic; it opens as the other
pages do, with its question, "Clear patterns in [all genres] with the [average rating]", as its h1.

Every page but How it works opens the same way (round 4's X2): a kicker, then the page's question as its h1, at one
size, in balanced lines at every width and at most 44 characters wide from 760 px (so its last word is never left
alone on a desktop). On Explore the kicker is the site's headline; on the others it names the page and the source
("Genres · about 9,000 Literotica stories · 30 genres", "Trends · about 9,000 Literotica stories · 2000–2026",
"Patterns · …"), and its "·" never starts or ends a line.

**The way across** (round 4's I15): under each one-characteristic chart (Explore's, the Genres page's and the Trends
page's) the same line of links, named the same way and in the same order: "By genre →" (the Genres page, with this
"Only include" option), "Over time →" (the Trends page, with this genre and option where it offers them) and "With
popularity →" (Explore, with this genre and option and the measure last used there). A link shows only where its page
has the characteristic, the page being read drops out, and each is named for the characteristic ("Word count by
genre"); it describes that one characteristic and never suggests another.

The **Genres** page compares the stories themselves, not their popularity, genre by genre. "How do genres differ in
[word count]?" (the page's h1) draws one characteristic in every genre (All genres first), in one of four forms: range
rows for numbers, share bars for yes/no characteristics, 100% bars for named groups and ordered bands (the groups' names
over All genres' bar), and, for characteristics where most stories score 0, one row per genre with the range and
median among its stories with any, then that median and how many have any. ▲ ▼ ≠ mark a genre that clearly differs, in
a column beside its name; the line above the chart says the order ("Genres in alphabetical order", or by median or
share with its A–Z / By … switch); under the chart, the way across ("Over time →", "With popularity →") and "Download
image". "What stands out about stories in [Romance]?" gives the genre's number of stories and a line for each direction
(▼ Lower, ▲ Higher, ≠ A different mix; a position is listed under its own word: "▲ Later: where the first sex scene
starts", "▼ Earlier", "▼ Sooner"), then a note above the first list, in the Trends page's words: "Each dot compares a
story in Romance with a story from all genres, counting every story, not only the medians (50 is a tie; how this is
decided). Tap a row for every genre's numbers." ("Click" where the device can hover). Then the
characteristics that set the genre apart from all genres, the largest differences first. Each row has a dot on one
scale (under the axis title "How often a story in Romance comes out higher than a story from all genres, out of 100",
with the no-difference zone at 40–60 bracketed), the genre's and all genres' numbers in two columns with the same
decimals ("7.8 vs 19.3", "10.0 vs 3.8": three significant digits for the larger, at least two for the smaller), the
unit on a line of its own under the name (its last two words kept together), and "›" for every genre's numbers. A
named group's row (narrative perspective, say) draws two 100% bars instead, the genre's above all genres', with a key
of every group under them, and prints the shares of the group that differs most after a swatch of its color, with "%
of stories" under it; "Romance above, all genres below" sits over each such row in an open topic ("A different mix: …"
over that list). "Download image", right after the lists, saves them as a PNG with the question as its title. Then
every characteristic by topic ("1 of 28 stand out"), where gray dots show no clear difference; Back from every genre's
numbers finds the open topics and the lists shown in full as they were. On phones a tapped genre's numbers stay at the
bottom of the screen while its chart is in view. The tab is named after the question on screen. A genre "clearly
differs" only by the rule in How it works (`meta.genre_rule`): a rank-biserial correlation of at least 0.2 against all
genres (for named groups, a total variation distance of at least 0.2), clear at the 99.9% level, with at least 30
stories; a genre with fewer is named as too few to compare.

**Definitions in place** (round 4's I16): every row of "One genre" and of the Trends page's "What changed" (lists and
open topics) has a "?" just after its name, kept on the line of the name's last word (in a cell too narrow for the two,
it takes the next line rather than run past the cell): an 18 px circle named "What “Word count” measures", with
`aria-expanded` and `aria-controls`. Pressing it shows the characteristic's `description` from `meta.json` under the
row's name (13 px, at most 62ch); pressing it again hides it, and a new answer or Back starts with every definition
closed. The row is a container whose link (its name, stretched over the row) opens its chart from
anywhere but the "?", whose area is 44 px wide and the row's height; one tab stop for each. The images draw no "?" and
no definition.

The **Trends** page shows how the stories themselves changed over time. It opens on **All changes**: "What has
changed in stories across [all genres]?" ("… in [Romance]?") says how many of the characteristics compared clearly
changed from 2000–2009 to 2020 or later ("26 of 180 characteristics clearly changed …") and how many stories each
window has. A takeaway follows: how word count changed, and the ▼ Fell / ▲ Rose / ≠ lines, each naming up to three
changes and ending "and 2 more" when its list holds more. Then the note, "Each dot compares a story from 2020 or later
with a story from 2000–2009 (50 is a tie). Tap a row for its chart over time." ("Click" where the device can hover),
and the lists, the largest change first, in "One genre"'s rows (with their "?" definitions and their units on a line of
their own). Each reads the two windows' values first ("51.6 → 38.8 (−25%)", under "Median story or share"), then a dot
on a scale zoomed to the view (how often a story from 2020 or later comes out higher than a story from 2000–2009, out
of 100). "Download image" saves the lists, every characteristic by topic follows, and a row opens its chart over time.
A genre whose windows have too few stories says so, with its stories per period. The switch "All changes · One
characteristic" leads to one characteristic over five periods of publication (2000–04 to 2020 and later): "Across
[all genres], how has [word count] changed over time?" ("how have" for a plural noun; "In [Romance], …").
It is drawn in one of four forms on one time axis:

- range columns for numbers;
- dots on a line for yes/no characteristics;
- 100% columns for named groups and ordered bands, with groups under 3% in every period merged as "Other";
- a split chart for characteristics where most stories score 0.

Under the plot, aligned with the columns: the periods, their medians or shares, their stories, and brackets under the
two windows compared, each with its window's number ("2000–2009 · median 2,810"); the periods between them are gray and
"not compared", as the key says; the key draws each mark as the chart does (the median's capsule with its dot, the
brackets' line with its ticks), centered on the first line of its words. The heading says whether the characteristic
clearly rose, fell, moved later or earlier, or changed between the windows, by the Genres page's rule. Under the heading
the page says what the characteristic measures, from `meta.json`'s description. A line names a clear dip or rise in
between. The way across ("By genre →", "With popularity →") sits right under the chart, in the chart's cell; on a
desktop the takeaway, the key and the actions ("See all changes →", "Download image") sit in a rail beside it. Its
picker lists the characteristics that clearly changed first, and "Only include" is always a menu ("All stories ▾"),
with the options that don't apply turned off inside it (the Length options with word count). Publication year, month
and weekday, story age, the number of tags and the author's number of stories are not on the page.

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
site/public/aggregates/trends/<included>/<genre>.json  the Trends page: every period's quartiles or shares, and the change
        │   npm run build
        ▼
site/dist/                                             the static site
```

`python -m litcorr site-data` (code in `litcorr/stage2/`) reads only the handoff zip and writes, for every genre ×
characteristic × group of stories × popularity measure, the number of stories and the median, quartiles and mean of
the measure, plus a pattern summary used to word chart titles. A group's cell is `[n, m0, m1, …]`, one entry per
measure in `meta.metrics` order (`[median, p25, p75, mean]`, with a fifth number when fewer stories have the measure,
or `null`); the stories' median age, never shown, left the cells in round 4 (O18). "All genres" weights each story by
its genre's size on Literotica. Groups of fewer than 10 stories are left out. The output is committed, so the website
builds without Python and without the private data.

`patterns.json` re-packages the pattern results already in the per-characteristic files ("All stories" only): for
every genre and measure, one character per characteristic giving the direction and the strength band (weak,
moderate, strong) of the existing effect. No medians, no counts; about 11 KB gzipped.

`genres/<included>.json` (one per "Only include" option, 53–57 KB gzipped) holds, for every characteristic but
publication month and weekday, and for every genre (All genres first): the number of stories with it, their quartiles
(All genres also the 10th and 90th percentiles) or their shares, and the comparison with all genres (the rank-biserial
correlation, or for named groups the total variation distance) with whether the genre clearly differs. For mostly-zero
characteristics it gives the stories above 0 and their quartiles instead; a genre's share above 0 is worked out on the
page from its two counts. Each genre's number of stories in the option comes with it (its median story age, never
shown, left the files in round 4). Genres with fewer than 10 stories are left out, as everywhere.
`loadGenres(include)` and `prefetchGenres(include)` in `src/lib/data.js` read it, through the same cache as the other
files; a visit that starts on the Genres page fetches it, and the page's code, while the app starts, before
`meta.json` arrives (`App.jsx`).

`trends/<included>/<genre>.json` (one per genre and Length option: 4 × 31 files, 1.6–12.4 KB gzipped) holds, for every
characteristic on the Trends page, each period's number of stories and quartiles or shares (none under 10 stories),
the 2000–2009 window's, and the comparison of 2020 or later with 2000–2009: the rank-biserial correlation (for named
groups the total variation distance) with whether it clearly changed. `meta.json`'s `trend` gives the periods, the
two windows, the rule, the options, the characteristics left out and `too_few` (per option, the genres whose two
windows can't be compared); a characteristic whose noun is plural has `"plural": true`. `loadTrends(include, genre)` and `prefetchTrends` in `src/lib/data.js` read
them.

The aggregates are about 70 MB uncompressed (1,818 small files, 26.7 MB gzipped; git and web hosts compress them to
roughly a third). A chart loads one file of about 15–20 KB; the Genres page one file of about 55 KB gzipped per
option; the Trends page one of at most 12.4 KB.

## First-load budget and lazy parts

The **first load** is the HTML, the main script, the CSS, the heading font, `meta.json` and the first chart file:
**150.5 KiB of gzip response bodies in 6 requests** (October 13, 2026, after design review 4; 150.0 before it, 149.7
before the owner's changes to the Trends review, 148.5 before the Trends page). The Genres and Trends pages' own
code, styles and files load only when they are opened. A visit that starts on the Genres page is 210.3 KiB in 9
requests (204.4 in 8 before the Trends page: the code the two pages share is now a chunk of its own). One that starts
on the Trends page is 176.9 KiB in 9, on either view; one on How it works 142.3 KiB in 7.
Layout shift is 0 on a visit to any page, and after any change once 500 ms have passed (what moves at once is the
question or the lists reflowing with the visitor's own choice). The budget is **155 KiB of
gzip response bodies** for that set, measured on the built site served with gzip (the design review's `firstload.mjs`
with `serve.mjs`; response headers are not counted).

Parts that the first chart does not need load their code when first used (`React.lazy` through
`src/components/lazyPart.jsx`), each a small chunk of about 1–6 KiB gzipped:

| Part | Chunk | Fetched ahead of time |
|---|---|---|
| Characteristic picker (and the search code) | `CharacteristicPicker-*.js`, `search-*.js` | when the browser is idle after the first chart; when its word is hovered or focused |
| Measure menu | `MetricMenu-*.js` | the same |
| "Download image" (the code that makes the image) | `chartImage-*.js` | when the button is hovered or focused (or pressed) |
| Patterns page | `PatternBrowser-*.js` | when a link to it is hovered or focused |
| Genres page (its components, helpers and styles) | `GenresPage-*.js`, `GenresPage-*.css`, and `IncludeSelect-*.js`, which it shares with the Trends page ("Only include", the comparison of "One genre" and "What changed", the Genres page's helpers) | when a link to it is hovered or focused (the masthead's link and the way across's "By genre →" also fetch its file); a visit that starts on it fetches both while the app starts |
| Trends page (its components, helpers and styles) | `TrendsPage-*.js`, `TrendsPage-*.css`, and the shared `IncludeSelect-*.js` | when a link to it is hovered or focused (the masthead's link and the way across's "Over time →" also fetch its file); a visit that starts on it fetches both while the app starts |
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
`#/genres?...`, `#/trends?...`, `#/patterns?...`, `#/methodology` and `#/methodology/<section>`), so it needs no
server configuration.

**Vercel.** Import the GitHub repository, set **Root Directory** to `site`, and keep the detected Vite settings
(`npm run build`, output `dist`). `site/vercel.json` adds caching headers for the aggregates.

**Netlify.** Import the repository; `netlify.toml` at the repository root already sets the base directory
(`site`), the build command and the publish directory (`dist`).

**Anything else** (GitHub Pages, a plain web server): run `npm run build` and upload `site/dist/`.

## Source layout

```
src/
  App.jsx                 page shell: masthead with five pages (four links below 602 px, three below 414 and two below
                          352, its links tighter below 484 px; the page being read is always one of them: where a
                          width's set leaves it out, that set's last link that isn't it makes room (navSet, navDrop),
                          so 375 px on Explore reads "Explore Genres Trends"; How it works keeps the earlier sets, How
                          it works leaving first, as its section bar names the page; the footer lists every page),
                          routes, the kicker (Kicker: in pieces, so no line starts or ends with "·"; Explore's is the
                          site's headline and its h1; on Genres, Trends and Patterns it names the page and the source,
                          a paragraph over the question, which is the h1 there), footer; remembers the Genres and
                          Trends pages' last addresses, Explore's last measure (for "With popularity →") and the last
                          genre chosen in the visit (the default of "One genre"); an address changed in place keeps the
                          history entry's state (where "One genre" and "What changed" keep their open topics)
  genres.css              the Genres page's styles, loaded with its code
  trends.css              the Trends page's styles, loaded with its code
  comparison.css          "One genre"'s and "What changed"'s styles; genres.css and trends.css import it
  palettes.css            the 100% bars' and columns' palettes; genres.css and trends.css import it
  components/
    Explorer.jsx          the explorer: keeps the shown chart until the next one loads, answer heading, takeaway,
                          the way across under the chart, "Download image", "Keep exploring" (Patterns, the chosen
                          genre's "What stands out …?" and three example questions)
    WayAcross.jsx         the way across (I15): "By genre →", "Over time →", "With popularity →" under each
                          one-characteristic chart, for the pages that have the characteristic, the page being read
                          left out; each named for the characteristic and fetching its page ahead on hover and focus
    Controls.jsx          the question sentence, "Only include", the sheets of the picker and the measure menu, and
                          the question bar on phones
    CharacteristicPicker.jsx  (lazy) search-first picker body (combobox with listbox): Popular, eight topics, search,
                          a measure typed by mistake; on the Trends page, the characteristics that clearly changed first
    MetricMenu.jsx        (lazy) the popularity-measure menu's body
    Overlay.jsx           bottom sheet on phones; on wider screens a popover under (or over) its word that always
                          fits on the screen (title and Close)
    InlineSelect.jsx      a native select shown as a word of the sentence; SlotWords keeps a slot's last word
                          and its caret together
    RangeChart.jsx        one genre: one row per group (median dot with value, interquartile-range capsule); one
                          tab stop with arrow keys; details as a card, or a line under the chart in the phone layout;
                          the genre-change glide on one scale
    useRowDetails.js      a chart's rows as one tab stop with details on demand (RangeChart, the Genres page, and the
                          Trends page's columns, where ← → move too)
    GenresPage.jsx        (lazy) the Genres page: the question, the view switch and "Only include"; keeps
                          the shown file until the next one has loaded; the live region (only the order's words after
                          an order change); the tab's title; focus to the answer's heading after a button that changes it
    GenreAnswer.jsx       (lazy) one characteristic in every genre: heading (the genres compared), ▲/▼ lists, All
                          genres line, the genres too few to compare, legend, the order line with its A–Z / By …
                          switch, the chart for its form, the way across and "Download image"
    GenreChart.jsx        (lazy) range rows (numbers) and share bars (yes/no), built on rangeLayout: the mark column,
                          the value column's heading
    GenreAny.jsx          (lazy) mostly-zero characteristics: one row per genre with the range and median among its
                          stories with any, then that median and how many have any
    GenreMix.jsx          (lazy) 100% bars for named groups and ordered bands, the groups' names over All genres' bar
    GenreGlide.jsx        (lazy) the rows' glide to a new order (transforms only; none under reduced motion)
    GenreSwitch.jsx       (lazy) the two-option switches (the view; the order, drawn compact)
    GenreDetails.jsx      (lazy) a genre's details: a compact card on wider charts, or on phones a line that sticks to
                          the bottom of the screen while its chart is in view; the link to the genre's own view
    GenreProfile.jsx      (lazy) one genre against all genres: the heading, the sample line and the takeaway (▼ ▲ ≠),
                          the small-sample and too-few states, and "One genre"'s words for ComparisonProfile
    ComparisonProfile.jsx (lazy) a comparison of two sides, characteristic by characteristic ("One genre" and "What
                          changed"): the note above the first list, the lists with the first one's axis title,
                          "Download image" of the lists (listsPlan: the image is drawn from the data), every
                          characteristic by topic; each row a container whose stretched link is its name, then its
                          "?" (the description shown in place) and its unit on a line of its own (the last two
                          words together), a dot on one 0–100 scale and two number columns (for "What changed",
                          opt-in props: the values first and a scale zoomed to the view), on one grid for the whole
                          page (stacked under a 900 px chart); the open topics and lists shown in full kept in the
                          history entry, so Back returns to them; configured by each page's words and rows
    IncludeSelect.jsx     (lazy) "Only include", shared by the Genres and Trends pages (always a menu; on the Trends
                          page the options that don't apply are turned off inside it)
    TrendsPage.jsx        (lazy) the Trends page: the question (the page's h1), the switch "All changes · One
                          characteristic" and "Only include"; keeps the shown file, and the last answer it can draw,
                          until the next one has loaded; the live region; the tab's title; focus to the answer's
                          heading after a button that changes it
    TrendAnswer.jsx       (lazy) one characteristic over time: the heading, what the characteristic measures, the
                          takeaway (the windows' numbers, the path line), the key (the periods compared and the gray
                          ones between, each mark drawn as the chart draws it), the chart for its form with the way
                          across under it, and the actions ("See all changes →", "Download image"), in a rail beside
                          the chart from a 960 px answer; the too-few state
    TrendChart.jsx        (lazy) range columns and dots on a line (numbers, yes/no) and the split chart (mostly zero),
                          with the table under the plot and the windows' brackets with their numbers, the periods
                          between them gray and "not compared"; one tab stop; a card beside a column, or the line under the
                          chart on phones; the glide to another genre or option
    TrendMix.jsx          (lazy) 100% columns for named groups and ordered bands
    TrendChanges.jsx      (lazy) all changes from 2000–2009 to 2020 or later, the page's default: the heading with its
                          denominator, the sample line, the takeaway (the length line, ▼ ▲ ≠, each line "and 2 more"
                          when its list holds more) and the too-few state (stories per period, a period's label
                          breaking only before its dash), with "What changed"'s words and values for
                          ComparisonProfile
    ChartNotes.jsx        the totals box (story age) with its switch, and the three explanations (disclosures at every
                          width)
    DownloadPng.jsx       "Download image": the button ("Download image of this chart", "… of these changes", "… of
                          what stands out"), its lazy code and its failure message (Explore, both views of the Genres
                          and Trends pages); the file is a PNG
    PatternBrowser.jsx    (lazy) the Patterns page: topics folded with their counts, one row per pattern
    Methodology.jsx       (lazy) How it works, with the sticky section bar below 1,000 px ("How it works" beside its
                          Contents button at the top, "How it works › {section}" once a section is reached)
    lazyPart.jsx          lazy parts with preload, their error boundary, and whenIdle
    pages.js              the lazy pages, shared by App and Explorer
    useScrollFloor.js     keeps the scroll position when a new question makes the page shorter
    LoadError.jsx, useWidth.js, useMediaQuery.js, useGlide.js
  lib/
    data.js               loading and reading the aggregates (loadGenres and prefetchGenres for the Genres page,
                          loadTrends and prefetchTrends for the Trends page)
    rangeLayout.js        the chart's geometry (pure; tested for overlapping labels), with the Genres page's options
                          (a mark column, a value column with its heading, a Stories column, two-line names in a
                          phone column); STACKED, the chart width under which "One genre"'s rows stack
    genres.js             (lazy) reading genres/<included>.json, every sentence of the Genres page (One genre's
                          columns, unit lines, row names, the note and axis title, the takeaway's position words and
                          the dots' numbers' places too), numberFormat (one number format per chart) and pairText
                          (a One genre row's two values with the same decimals)
    genreLayout.js        (lazy) the geometry of the 100% bars (with the groups' names and their inks) and of the
                          mostly-zero chart, and their overlap checks
    trends.js             (lazy) reading trends/<included>/<genre>.json and every sentence of the Trends page: the
                          questions, headings, takeaway lines, the periods' details, the chart's number format, "What
                          changed"'s profile, rows and words; no year is written here (they come from the files)
    trendLayout.js        (lazy) the columns' geometry (axis, two-line periods, the table under the plot, sized by
                          the values' widths in a wide font and the last one set against the edge, brackets, the
                          split chart's halves, the 100% columns' segments) and its overlap checks
    search.js             characteristic search (picker and glossary)
    wording.js            titles, answer headings, takeaway, notes, the question sentence ("all genres" inside it),
                          the rating's scale on its axis ("(1 to 5 stars)", by the measure's format) (no causal
                          language)
    tokens.js             the type scale and the marks' sizes for the charts' code, the same as styles.css's
                          custom properties (a test reads both)
    format.js             number formats (one number of decimals per axis and column)
    listScroll.js         keeps a menu's active option in view by scrolling the menu, never the page
    chartImage.js         (lazy) the PNG: the chart's <svg> cloned at rest with its computed styles, the title,
                          subtitle, key and credit drawn on a canvas at 2×, and the file saved; a comparison's lists
                          drawn from their plan, 760 px wide on every screen
    motion.js             reduced-motion checks
    urlState.js           settings in the address, so views can be shared (the Genres and Trends pages' too), and
                          where "Over time →" leads (overTimeState: the genre and option where the Trends page offers
                          them)
  styles.css              all styling; the system as custom properties at the top (round 4's X1): the type scale
                          (sans 12, 13, 14, 15, 16, 18; serif 18, the headings' 20–26 and the page question's
                          23–37), one line height per size, the spacing scale (4, 8, 12, 16, 24, 32, 48), the colors
                          (one gray, --control, for marks and control borders) and the marks' sizes; a test fails on
                          any other font size; and a forced-colors block that draws the charts with system colors
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
  by the size of their difference within that genre, never genres; so does "What changed" by the size of their change.
  The Trends page's genre slot lists All genres, then every genre A–Z.
- On the Trends page a characteristic "clearly" changed only by the rule in `meta.trend` (the Genres page's, applied to
  stories from 2020 or later against stories from 2000–2009, with at least 30 stories on each side). Its words say what
  changed (rose, fell, moved later), never why, and no year is written in its code. The Patterns page is grouped by
  topic and alphabetical, never sorted by strength, and always gives the count of characteristics without a clear
  pattern.
- Motion is switched off under "reduce motion": another genre glides the marks and the axis together (one scale
  in every frame; the printed values fade in at the end; on the Trends page another option too), another measure or
  characteristic cross-fades, the Genres page's rows glide to a new order, and scrolling is smooth.
- "Show fewer" in "One genre" is the one control that moves the page, on purpose: when the rows it hides take it off
  the screen, its list's heading is brought into view (at once under reduced motion); focus stays on it.
- Opening a menu, moving through it or choosing from it never moves the page: the menus scroll inside themselves,
  every focus change prevents scrolling, and a shorter chart keeps the scroll position.
- "Download image" draws the chart as the page shows it, at rest (no hover, tap or glide, no "?" and no open
  definition), from its own `<svg>` and the page's computed styles, at 2× pixels, with "Chart by Nathan Nguyen,
  @NathanDNguyen" at the bottom right, and saves it as a PNG; nothing leaves the browser.
- One visual system (round 4's X1, X2): one type scale and one spacing scale (`styles.css`, `lib/tokens.js`), one
  median dot (radius 6, a 2 px ring) and one interquartile capsule (10 px) on every range chart, one gray for marks and
  control borders, and one page frame (the kicker, then the question as the h1 at one size, balanced, at most 44
  characters wide from 760 px).
- The way across and the definitions in place describe the one characteristic on screen; nothing on the site suggests
  which characteristic to look at next, or ranks them.
- Keyboard: each chart is one tab stop (arrow keys, Home and End move between rows, and between the Trends page's
  columns with ← → too; Escape hides the details).
  Windows contrast themes get system colors on the charts (`@media (forced-colors: active)`).
- Nothing on the site reminds visitors that correlation is not causation (an owner's decision of October 2026);
  nothing on it claims a cause either: the titles say "tend to" only through the pattern rule, and the tests scan
  every visible string for causal words and UK spellings.
