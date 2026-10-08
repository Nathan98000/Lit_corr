# What makes a Literotica story popular? (Stage 2 website)

A static website for exploring how the popularity of Literotica stories varies with their characteristics,
overall and within each of Literotica's genres. Pick a genre, a popularity measure and a story characteristic;
the chart shows the typical story (median), the middle half of stories and the mean for each group of stories,
with the number of stories behind every figure. "Compare genres" shows the same relationship for every genre
side by side.

The site shows **descriptive associations only**, never causes, and it ships **only precomputed summaries of
groups of stories**: no story text, titles, authors, addresses or story-by-story records.

## How the data gets here

```
data/handoff/litcorr_stage2_handoff_YYYYMMDD.zip      (Stage 1 output: the authoritative corpus)
        │   python -m litcorr site-data                (run from the repository root)
        ▼
site/public/aggregates/meta.json                       genres, measures, characteristics, wording, facts
site/public/aggregates/v/<characteristic>/<included>.json
        │   npm run build
        ▼
site/dist/                                             the static site
```

`python -m litcorr site-data` (code in `litcorr/stage2/`) reads only the handoff zip and writes, for every
genre × characteristic × group of stories × popularity measure, the number of stories, their median age, and
the median, quartiles and mean of the measure, plus a pattern summary used to word chart titles. "All genres"
weights each story by its genre's size on Literotica. Groups of fewer than 10 stories are left out. The output
is committed, so the website builds without Python and without the private data.

The aggregates are about 66 MB uncompressed (1,684 small files; git and web hosts compress them to roughly a
third). A chart loads one file of about 15–20 KB.

## Local development

Requires Node 20.19 or newer (see `.nvmrc`).

```bash
cd site
npm install
npm run dev        # http://localhost:5173
npm test           # data helpers, chart wording, and the explorer's interactions (Vitest + Testing Library)
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
`#/methodology`), so it needs no server configuration.

**Vercel.** Import the GitHub repository, set **Root Directory** to `site`, and keep the detected Vite settings
(`npm run build`, output `dist`). `site/vercel.json` adds caching headers for the aggregates.

**Netlify.** Import the repository; `netlify.toml` at the repository root already sets the base directory
(`site`), the build command and the publish directory (`dist`).

**Anything else** (GitHub Pages, a plain web server): run `npm run build` and upload `site/dist/`.

## Source layout

```
src/
  App.jsx                 page shell, routing, example questions, footer
  components/
    Explorer.jsx          the explorer: loads data, chooses the chart, writes the notes
    Controls.jsx          genre → popularity → characteristic (+ "stories included")
    GroupChart.jsx        one genre: median, middle half and mean per group (SVG + d3-scale)
    CompareTable.jsx      every genre side by side, relative to each genre's typical story
    NumbersTable.jsx      the chart's numbers as a table
    Methodology.jsx       the methodology page
  lib/
    data.js               loading and reading the aggregates
    wording.js            chart titles and notes (no causal language; tested)
    format.js             number formatting
    urlState.js           settings in the address, so views can be shared
  styles.css              all styling; colours are CSS variables at the top
```

Wording that comes with the data (measure names, phrases for every characteristic, the "stories included"
options, example questions) lives in `litcorr/stage2/wording.py`; rebuild the aggregates after editing it.

## Design notes

- Literotica's own accent blue (`#4a89f3`, the theme colour its pages declare) carries the data; everything else
  is neutral. Change the palette in the `:root` block of `styles.css` and in `CompareTable.jsx`.
- A chart title says "tend to" only when the pattern is clear: a rank correlation of at least 0.1 that is clear
  of zero at the 99% level, groups of at least 30 stories at both ends, and a gap of at least 10% between their
  medians (0.1 stars for ratings). Otherwise titles are neutral ("How … vary with …").
- Story age is never hidden: totals carry a note, every group shows its typical age, and a note appears when the
  groups compared differ a lot in age.
- Genres are always listed alphabetically, never ranked.
