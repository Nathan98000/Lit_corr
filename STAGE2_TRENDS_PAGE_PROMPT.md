# Stage 2: build the Trends page

You are working in the `Literotica_Correlations` project. Its Stage 2 website (`site/`, a static React + Vite app)
has Explore, the Genres page, Patterns and How it works. The owner has approved a new page, **Trends**, that shows how
story characteristics changed over time. The design is in `docs/stage2/TRENDS_PAGE_PROPOSAL.md`, with figures in
`docs/stage2/trends-page/` (t01–t12). Both are untracked, and your first commit adds them.

The owner accepted every recommendation in the proposal (R1–R10, D1–D12). This prompt fixes those decisions and the
details the proposal left open. Where it still leaves a detail open, decide, implement it, and record the choice
under *Judgment calls* (see "Finishing"). Stop only for the things listed under "Checkpoints".

## Branch

* `main` is at `0d8611d`. The `one-genre` branch (tip `0aa851d` when this prompt was written) holds the approved
  "One genre" view that this page's second view shares, and it was not merged yet.
* If `main` contains `one-genre` (`git branch --merged main`), make the branch `trends-page` from `main`. Otherwise
  make it from the tip of `one-genre`. Say which in the summary.
* Commit as you go, in the repository's style ("Stage 2 trends page: …"). Don't push.
* Never commit `.claude/`, `Claude outputs/` or anything under `data/`.
* git may delete its lock files. If your environment asks, request deletion permission for the project folder.

## Read first

1. `docs/stage2/TRENDS_PAGE_PROPOSAL.md`, all of it, and its figures. Where the proposal and this prompt differ, this
   prompt wins. It differs on purpose in four places, all in "Copy": the zero-kind numbers line, the named-group and
   band headings and the too-few heading, which the proposal's examples didn't make general enough, and View 2's note,
   which gains "One genre"'s sentence about gray dots.
2. `docs/stage2/GENRES_PAGE_PROPOSAL.md` section 13 and `STAGE2_GENRES_PAGE_PROMPT.md`: how the Genres page was built.
   This page follows the same patterns.
3. `docs/stage2/ONE_GENRE_REVIEW.md` and `STAGE2_ONE_GENRE_IMPLEMENTATION_PROMPT.md`: the approved "One genre" view.
   View 2 here is that view with other labels.
4. `STAGE2_SIMPLIFY_AND_PNG_PROMPT.md`: the owner's preference for lean pages, and "Download PNG".
5. `site/README.md`, everything in `site/src/` and `site/src/test/`, and on the Python side `litcorr/stage2/`
   (`site_data.py`, `stats.py`, `wording.py`, `synthetic.py`), `litcorr/cli.py` and `tests/test_stage2_site_data.py`.
6. Reference material in `Claude outputs/`. Read it and run copies outside the repository. Never import from it and
   never commit it.
   * `trend-profiles/tp_build.py`: the prototype builder. **Its output format and its statistics are the approved
     ones**, with one addition: each file also carries `rule` (§1.2). `tp_numbers.py` printed every acceptance number
     in §1.7.
   * `trends-page-mockups/`: the static mock-up (`README.md` says how to serve it). It shows the layout and copy, not
     the final markup.
   * `design-review-2-tools/`: the measuring scripts from earlier rounds (`README.txt`). They were written in a Linux
     container: change their paths to this Mac's and use its cached Chromium, as before.

## The owner's decisions

| # | Decision |
|---|---|
| D1 | **Approved:** a new aggregate file family, `site/public/aggregates/trends/<included>/<genre>.json`: 4 options × (All genres + 30 genres) = 124 files |
| D2 | **Approved:** "clearly changed" compares stories published 2020 or later with stories published 2000–2009, with the Genres page's thresholds: rank-biserial \|r\| ≥ 0.20 and clear at the 99.9% level (z 3.29), with at least 30 stories on each side; named groups: total variation distance ≥ 0.20 and a two-sample chi-square at 99.9% |
| D3 | **Approved:** periods 2000–04, 2005–09, 2010–14, 2015–19, then 2020 to the newest story (one period, equal to the "now" window) |
| D4 | **Approved:** upright range columns with time running left to right (a new chart), not the periods as rows |
| D5 | **Approved:** 180 characteristics. Left out: publication year, years online, publication month, weekday, published on a weekend, number of tags, author's story count |
| D6 | **Approved:** "Only include" offers All stories and the three Length options only |
| D7 | **Approved:** five pages in the masthead with no menu; new breakpoints, measured on this Mac (§2.1); a footer line with every page |
| D8 | **Approved:** the page is "Trends", between Genres and Patterns; kicker "How have the stories changed?" |
| D9 | **Approved:** the page opens on All genres, not on a genre remembered from another page |
| D10 | **Approved:** View 2 ("What changed") shares "One genre"'s rows, lists and topics through a component extracted from `GenreProfile.jsx` |
| D11 | **Approved:** links in: the masthead, one Explore "Keep exploring" item, How it works. Nothing new on the Genres page |
| D12 | **Approved:** for All genres, the fixed-mix check (`rm`, `fm`), shown in one line only when it changes the verdict. No list of genres under All genres |

## Rules that still hold (updated for this page)

- **No network access to Literotica.** Never open literotica.com with any tool.
- **Data stays private and aggregated.**
  * Ship only `meta.json`, `v/<characteristic>/<included>.json`, `patterns.json`, `genres/<included>.json` and now
    `trends/<included>/<genre>.json` (D1). Add no other data fields or files beyond §1.
  * `data/` is read-only. Never run `probe`, `collect`, `process` or `export-handoff`. A collector may be running on
    this Mac: leave it alone.
  * `python -m litcorr site-data` is offline and fine to run. Build from `data/handoff/litcorr_stage2_handoff_20261008.zip`.
    If a newer handoff zip is in `data/handoff/`, stop and ask (Checkpoints).
- **Interpretation.**
  * No causal language: stories "rose", "fell", "changed", "moved later"; authors never "chose", "switched" or "moved
    to". The banned-word and US-spelling tests cover every new file.
  * No notes about chance and no correlation reminders on the page. How it works explains the rule.
  * "Clearly" is said only through the D2 rule (the file's `f`, and `fm` for the fixed-mix line).
  * Sample sizes stay visible: the stories under each period, the hatching under 30, "Fewer than 10".
  * View 2 orders characteristics by the size of their change within one group of stories. Nothing on this page orders
    genres; the genre slot lists them A–Z after All genres.
  * The independence statement in the footer stays.
- **Methodology is unchanged:** measures, binning, weights, MIN_N 10 / SMALL_N 30, the "tend to" rule and the Genres
  page's rule. This page's rule is D2 exactly.
- **No new dependencies** (Python or npm), fonts, font weights or external requests.
- **Performance.** First load ≤ 155 KiB of gzip response bodies (`firstbodies.mjs`; 148.5 KiB in the README now).
  Layout shift < 0.1. Reduced motion honored. Each trends file ≤ 16 KB gzipped.
- **Addresses keep working:** `#/explore?…`, `#/genres?…`, `#/patterns?…`, `#/methodology`,
  `#/methodology/<section>`.
- **Other pages keep their behavior.** Explore, the Genres page, Patterns and How it works don't change except where
  this prompt says so: the masthead and footer (§2.1), one Keep exploring item and one How it works section (§5), and
  two small fixes to "One genre"'s numbers that come with the shared component (§4.2). `exploreLayoutGuard.test.js`
  stays unchanged.
- **Tests and build pass at every commit:** `npm test` and `npm run build` in `site/`, and
  `.venv/bin/python -m pytest tests/test_stage2_site_data.py`.

## 1. Data: `trends/<included>/<genre>.json`

### 1.1 Which characteristics, options, periods and windows

* **Characteristics:** every characteristic in `meta.variables` minus `TREND_PAGE_EXCLUDED` (a new constant in
  `wording.py`): `pub_year`, `age_years`, `pub_month`, `pub_weekday`, `pub_is_weekend`, `meta_tag_count`,
  `author_stories_count`. Each gets its kind from `genre_kind(make_bins(…))`: num 114, zero 45, bin 12, band 5, grp 4
  (180 in all). `story_words` is absent from the three Length options (`subset_conflict`).
* **Options:** `TREND_SUBSETS = ["all", "short", "medium", "long"]` in `wording.py`, using the existing `SUBSETS`
  definitions.
* **Genres:** `all` plus the 30 genres, `meta.genres` order. One file per option and genre.
* **Periods:** five-year periods starting at the first year in the data, up to `TREND_NOW_FROM - 1`, then one period
  from `TREND_NOW_FROM` to the newest year: `[[2000,2004],[2005,2009],[2010,2014],[2015,2019],[2020,2026]]` today.
* **Windows:** then = `TREND_THEN = (2000, 2009)`, now = `TREND_NOW_FROM = 2020` to the newest year. "Now" is exactly
  the last period; "then" is exactly the first two.

### 1.2 Format

Compact JSON, as `tp_build.py` writes it, plus `rule`.

```jsonc
{
  "s": "all", "g": "all",                       // the option and the genre
  "rule": {"min_r": 0.2, "z": 3.29, "min_tvd": 0.2, "min_n": 30},
  "periods": [[2000, 2004], [2005, 2009], [2010, 2014], [2015, 2019], [2020, 2026]],
  "then": [2000, 2009], "now": [2020, 2026],
  "n": [903, 1658, 1524, 1565, 3346],           // stories per period in this option and genre (any count)
  "c": {
    "story_words": {
      "k": "num", "fmt": "num",
      "q": [[901, 1640, 2500, 4220], …],         // per period: n, p25, median, p75; null under MIN_N stories
      "t": [2558, 1680, 2810, 4760],             // the "then" window, in the same form
      "r": 0.25, "f": 1,                         // now against then (§1.3); r null when a window has < SMALL_N
      "rm": 0.246, "fm": 1                       // all.json only: the same with the genre mix held fixed (§1.3)
    },
    "story_has_author_note": {"k": "bin", "q": [[901, 0.204], …], "t": [2558, 0.181], "r": 0.145, "f": 0, …},
    "rel_consent_per_1k": {"k": "zero", "fmt": "num",
      "q": [[903, 81, 0.098, 0.15, 0.243, 0.395], …],  // n, stories above 0, (All genres only: their weighted share),
                                                        //   then p25, median, p75 among them (absent under MIN_N above 0)
      "t": [2561, 233, 0.11, 0.144, 0.229, 0.388], "r": 0.092, "f": 0, …},
    "desc_pov": {"k": "grp", "q": [[903, 0.014, 0.012, 0.373, 0.601], …], "t": […], "r": 0.084, "f": 0, …}
  }                                              // bin: [n, share]; grp and band: [n, a share per group]
}
```

**Rounding:** quartiles with `sig(x, 3)`; shares to 3 decimals, rounded by largest remainder (`_genre_shares`) for grp
and band so a column adds up to 1; r and the total variation distance to **3** decimals, never "-0.0". A genre's share
above 0 is worked out on the page from its two counts; All genres keeps its weighted share.

### 1.3 Statistics

* **Weights.** Within a genre every story weighs the same. All genres uses `sampling_weight`, for both the periods'
  quartiles and the windows. Quartiles come from `weighted_quantiles`.
* **num, zero, bin, band:** r = 2 · `weighted_auc(x_now, w_now, x_then, w_then)` − 1 on the raw values (bands on their
  codes). SE = `rank_biserial_se(effective_n(w_now), effective_n(w_then))`. f = sign(r) when both windows have at least
  SMALL_N stories with the characteristic, |r| ≥ 0.20 and |r| / SE ≥ 3.29; otherwise 0. r is null when a window has
  fewer than SMALL_N.
* **grp:** shares in each window (weighted for All genres); tvd = ½ Σ |p_now − p_then|; pooled shares
  p = (p_then·n_eff_then + p_now·n_eff_now) / (n_eff_then + n_eff_now), with the groups whose pooled share is under 1%
  pooled into one; chi² = (n_eff_then·n_eff_now / (n_eff_then + n_eff_now)) · Σ (p_now − p_then)² / p; f = 1 when
  tvd ≥ 0.20 and chi² exceeds `GENRE_CHI2[df]`, df = groups kept − 1.
* **The fixed-mix check (`rm`, `fm`; All genres only).** The same comparison, with other weights: in each window, each
  genre's stories share equally the genre's share of all the option's stories that have the characteristic (weighted
  by `sampling_weight`). That is `mix_fixed` in `tp_build.py`. `rm` and `fm` follow the rules above.
* **Constants**, next to the Genres page's in `site_data.py` (or in the new module): `TREND_PERIOD_YEARS = 5`,
  `TREND_THEN = (2000, 2009)`, `TREND_NOW_FROM = 2020`, `TREND_MIN_R = 0.20`, `TREND_Z = 3.29`,
  `TREND_MIN_TVD = 0.20`. Keep them apart from `GENRE_*`.

### 1.4 The builder

* A new module, `litcorr/stage2/trends.py`, with the periods, the cells, the comparisons, the fixed-mix weights and a
  task per characteristic (every option and genre).
* `build_site_data` submits these tasks to the existing process pool **inside** its `with` block, alongside the `v/`
  and `genres/` tasks, and writes `trends/` after `genres/`. It reuses what the characteristics loop already computes:
  codes, `genre_kind`, `value_style`.
* Update `site_data.py`'s module docstring ("Output") and `litcorr/cli.py`'s help if it lists the outputs.

### 1.5 meta.json additions (nothing else changes in meta)

```json
"trend": {"periods": [[2000,2004],[2005,2009],[2010,2014],[2015,2019],[2020,2026]],
          "then": [2000,2009], "now": [2020,2026],
          "rule": {"min_r": 0.2, "level": 0.999, "min_tvd": 0.2, "min_n": 30},
          "subsets": ["all","short","medium","long"],
          "excluded": ["pub_year","age_years","pub_month","pub_weekday","pub_is_weekend","meta_tag_count","author_stories_count"]}
```

Then run `python -m litcorr site-data --handoff data/handoff/litcorr_stage2_handoff_20261008.zip` and regenerate the
fixtures (`python -m litcorr.stage2.synthetic site/src/test/fixtures/aggregates`). `git diff` must show `meta.json`,
the new `trends/` files and the fixtures. No `v/` file, `genres/` file or `patterns.json` may change: compare them byte
for byte with the build before.

The synthetic handoff must give the fixtures publication years across 2000–2026, at least MIN_N stories per period for
All genres, and at least one characteristic that changes on purpose between the windows (and one genre whose mix
changes the verdict, if you can arrange it cheaply). Extend `synthetic.py` the way the Genres round did
(`extended=True`) if the default doesn't.

### 1.6 Python tests (add to `tests/test_stage2_site_data.py`)

* 4 × 31 files under `trends/`, and only the allowed file families under `aggregates/`.
* Every array as long as `periods`; non-null cells have n ≥ 10; p25 ≤ median ≤ p75; grp and band shares add up to 1
  (±0.002).
* `periods`, `then` and `now` agree with `meta.trend`; the last period equals the "now" window.
* `t` matches a direct computation of the "then" window, and the last `q` cell of the "now" window.
* r, f, rm and fm match a direct recomputation for a few characteristics on the synthetic handoff; r is null exactly
  when a window has fewer than 30 stories; f ≠ 0 only where the thresholds hold.
* `rm` and `fm` appear in `all.json` only.
* Left-out characteristics are absent; `story_words` is absent from the Length options.
* Each file ≤ 16 KB gzipped (the real ones are 1.6–12.9 KB); the output is deterministic (build twice and compare);
  no minimum, maximum or per-story value; the builder reads no story-level fields beyond the characteristic, the genre,
  the weight, the publication year and the length (for the options).

### 1.7 Acceptance numbers (real data, from `tp_numbers.py`)

* 180 characteristics: num 114, zero 45, bin 12, band 5, grp 4. 124 files; 3.9 MB raw; 1.6–12.9 KB gzipped
  (All stories: 8.8–12.9 KB).
* Stories per period, All genres: 903, 1,658, 1,524, 1,565, 3,346. Genre × period cells: 22 of 150 under 30, 4 under
  10.
* **All genres, all stories: 26 of 180 clearly changed** (21 rose, 5 fell, no named group). The largest: paragraph
  count r +0.351 (median 56 → 102). Story length r +0.250 (then median 2,810; periods 2,500, 3,010, 3,260, 4,060,
  4,100).
* Not clear: author's note r +0.145 (18.1% → 32.6%); consent language r +0.092; narrative perspective tvd 0.023.
* **Fixed-mix check:** with all stories it changes 2 verdicts (touch words −0.213 → −0.199; build-up of sexual
  language −0.206 → −0.192), and r moves by at most 0.014 among the 26. With the Length options it changes 1, 5 and 4
  verdicts; in "5,000 words or more" all four become clear only with the mix held fixed.
* Length options, All genres: 8 (Under 2,000 words), 16 (2,000–5,000) and 15 (5,000 or more) of 179 clearly changed.
* Genres, all stories: 302 of 5,005 comparable pairs clearly changed; per genre from 2 (BDSM, First Time, Gay Male,
  Humor & Satire) to 23 (Reluctance/NonConsent), median 9.5 of the 28 compared. Chain Stories (12 stories from 2020 or
  later) and Transgender (19 from 2000–2009) can't be compared. Romance: 14, with story length r +0.385 (2,930 →
  5,170).
* Genres that can't be compared under the Length options: 24, 16 and 29.

Report the built numbers in "Finishing". Any difference needs a cause.

## 2. Navigation, addresses and the page shell

### 2.1 Masthead and footer (D7, D8)

* Order: Explore · Genres · **Trends** · Patterns · How it works.
* Nothing may wrap, clip or scroll at any width from 320 to 1440 px. Text stays at 14.5 px or more and every link
  52 px tall. The proposal measured in a Linux Chromium whose system font is wider than the Mac's, so **measure here
  with `masthead.mjs`** and set each breakpoint at the narrowest width that keeps at least 8 px to spare. The
  proposal's starting values, in the order links leave:
  1. How it works leaves below about 640 px (today 560);
  2. the links tighten (14.5 px type, 6 px padding) below about 490 px (today 420);
  3. Explore leaves below about 412 px (today 360); the name already links to Explore;
  4. Patterns leaves below about 350 px.
* The footer gains a line listing every page in nav order ("Explore · Genres · Trends · Patterns · How it works"),
  a `nav` labeled "All pages", below the independence statement. The statement's own "How it works" link stays.
* The Trends link preloads the page's chunk and prefetches the file of the last Trends address (else
  `trends/all/all.json`) on pointer-enter or focus. Its address is the last Trends address of this visit, else
  `#/trends`.

### 2.2 Addresses

```
#/trends                                                       View 1: story_words, All genres, All stories
#/trends?var=dlg_word_share&genre=adult-romance&include=medium View 1
#/trends?view=changes&genre=all&include=all                    View 2
```

`parseHash` / `toHash` gain a `trends` page with `TREND_PARAMS = { view: "view", v: "var", genre: "genre", sub:
"include" }`. View 1 writes `var`, `genre`, `include`; View 2 writes `view`, `genre`, `include`. `sanitizeTrends`:

* an unknown `var`, or one in `TREND_PAGE_EXCLUDED`, becomes `story_words`;
* an unknown `genre` becomes `all`;
* an `include` not in `meta.trend.subsets` becomes `all`, and so does a Length option with `story_words`;
* `view` is kept only when it is `changes`. View 2 keeps the characteristic in memory for the way back, as "One genre"
  does.

History, as on the Genres page: controls use `replaceState`; the view switch and the links between the views use
`pushState`. D9: the page opens on All genres. A genre chosen on this page does count as "chosen" for the Genres
page's D8 default.

### 2.3 The page shell

* `TrendsPage` is lazy (`pages.js`), with its own lazy stylesheet (`trends.css`, like `genres.css`) and `LAZY` entries
  in `vite.config.js`.
* A visit that starts on `#/trends` fetches the page's code and its file while the app starts, before `meta.json`
  arrives (as the Genres page does, F68).
* `loadTrends(sub, genre)` and `prefetchTrends(sub, genre)` in `data.js`, through the same cache.
* Kicker: "How have the stories changed? · about 9,000 stories · 2000–2026", the years from `meta.trend`.
* The tab's title is the question on screen (as on the Genres page), "How have the stories changed?" while loading.
  `data-page="trends"`. The skip link goes to the question.
* A placeholder holds the chart's place while code or file load. A load error shows `LoadError` with Try again.
* Changing the genre or option keeps the shown file until the next one arrives.

## 3. View 1: one characteristic over time

As in t01–t06 and t12, with the wording under "Copy". From top to bottom:

1. **Question** with two slots: the genre (`InlineSelect`: All genres, then the 30 genres A–Z) and the characteristic
   (`CharacteristicPicker` with `exclude={TREND_PAGE_EXCLUDED}`, no measure suggestion and no `v/` prefetch, as on the
   Genres page). `withoutExcluded` rewrites the Length & structure topic's blurb from its remaining labels; give that
   topic a short written blurb instead when items are left out ("Word count, paragraphs, series, titles" fits; record
   it).
2. **Controls:** the view switch (`GenreSwitch`, "One characteristic · What changed", group label "Show") and "Only
   include" (`InlineSelect`, the conflicting option disabled with Explore's wording).
3. **Heading** (the verdict), then the **takeaway**: the numbers line (num, bin, zero only) and, for All genres when
   `f ≠ fm`, the fixed-mix line.
4. **Legend:** only the entries the chart shows.
5. **Chart** (§3.1).
6. **Actions:** "Download PNG", then "Compare genres →" (the Genres page's View 1 for this characteristic and option).

### 3.1 The chart: one geometry, four forms

A new pure module `lib/trendLayout.js` (the columns' geometry, tested for overlapping labels like `rangeLayout.js`) and
components `TrendChart.jsx` (num, bin, zero) and `TrendMix.jsx` (grp, band).

* **Columns.** One per period, evenly spaced, time left to right. A left gutter holds the value ticks and the row
  heads of the table under the plot. The chart is at most 760 px wide; on phones it takes the full width.
* **Under the plot,** aligned with the columns: the period labels ("2000–04" … "2020–26"), then a row of values in bold
  ("Median" for num, "Share" for bin) and a row "Stories" in muted ink (an asterisk under 30). Below a column width of
  about 58 px the period labels take two lines ("2000" over "–04").
* **The compared windows:** a bracket under the first two periods labeled "2000–2009", and one under the last labeled
  "2020 or later", from `meta.trend`. Labels stay inside the chart.
* **num:** an upright interquartile capsule and a median dot per period, joined by a thin line through the medians.
  Y axis: three to five ticks; the domain from the lowest p25 to the highest p75 (4% to spare), from 0 when the lowest
  is within half the span. Axis title: the label, plus the unit when it is a rate ("Sexual language, per 1,000 words").
* **bin:** a bar from 0 to the share with a dot on top, the same thin line; the axis from 0 to the smallest of 25%,
  50%, 75% and 100% that holds every share.
* **zero:** the split chart: "Stories with any" (share columns, as bin) and "Among stories with any" (range columns,
  as num, with its own axis). Side by side from a 760 px screen, stacked below.
* **grp and band:** one 100% column per period, groups in their own order, colors as `GenreMix` (`mixColors`: the rank
  palette for named groups, light-to-dark blues for bands); the groups' key above the chart; shares printed inside
  segments at least 16 px tall, ink by contrast as on the Genres page.
* **Small samples:** under 30 stories, the hatched capsule (or bar) and the hollow dot, as `GenreChart` draws them;
  under 10, nothing is drawn and the column says "Fewer than 10". The legend then adds "Fewer than 30 stories".
* **Numbers:** one number format per chart (the Genres page's F66 rule): decimals from the chart's own quartiles;
  percentages whole, with one decimal when the chart's largest median or share is under 10%.

### 3.2 Details, keyboard and motion

* One tab stop per chart. ↑ ↓, Home and End move between periods as rows do elsewhere; add ← → for column charts only
  (an option of `useRowDetails`, off for every existing chart). Escape hides the details.
* Details: a card on wider screens, the line under the chart on phones, as on the Genres page:
  "2015–19 · median 4,060 words · interquartile range 2,340–7,200 · 1,564 stories". bin: "… · 32% with an author’s
  note · 1,564 stories". grp and band: every group's share.
* Accessible names carry the same numbers; the table under the plot and the brackets are `aria-hidden`.
* The heading and takeaway go to the polite live region when the characteristic, genre or option changes.
* Another genre or option glides the dots, capsules and axis on one scale in every frame (`useGlide`); another
  characteristic cross-fades. Nothing moves under reduced motion. Opening a picker never moves the page.
* Forced colors: outlines on capsules, bars and segments; the hatch; the dots.

### 3.3 Too few stories

* When a window has fewer than 30 stories with the characteristic, r is null: the heading is the too-few sentence, the
  chart is still drawn, and there is no fixed-mix line.
* When a genre has fewer than 10 stories in every period for the option, show the sentence and a button: "Show all
  stories" when All stories would have more, else "Show All genres".

## 4. View 2: what changed

### 4.1 The view

"One genre" as approved, with these labels (t07, t08):

1. **Question:** "What has changed in stories in [genre ▾]?" (the same genre slot as View 1, All genres first).
2. **Heading** and **sample line** (Copy).
3. **Takeaway** in "One genre"'s order: "▼ Fell: …", "▲ Rose: …", "≠ A different mix: …" (up to three labels each).
4. **Lists** in the same order: "Fell from 2000–2009 to 2020 or later", "Rose …", "A different mix …", each with its
   first seven rows and "Show all {n}". The first list carries the axis title, the zone's bracket ("40–60: no clear
   change", from `noDifferenceZone(file.rule)`) and the note. Column heads "2000–09" and "2020+".
5. **Every characteristic, by topic:** the seven topics that have characteristics on this page, each "{k} of {m}
   changed".
6. **Copy link.**

Rows: the R3 lollipop on the 0–100 scale (how often a story from 2020 or later is the higher one against one from
2000–2009), the two numbers (num: medians; bin: shares; zero: shares with any; band: median band; grp: the group with
the largest change, as "One genre" prints it) and "›". A row opens View 1 for its characteristic, genre and option.
Unit lines follow "One genre"'s decision 7. A row with r null says "Too few stories to compare".

Too few: when both windows can't be compared for the genre (Chain Stories, Transgender), the heading is the too-few
sentence with the "Show All genres" button, and no lists or topics.

### 4.2 The shared component (D10)

1. **Extract first, change nothing.** Before touching `GenreProfile.jsx`, add a fingerprint test that renders "One
   genre" for at least Romance, How To, Fetish and Chain Stories with "Published 2020 or later", topics closed and one
   topic open, and stores the markup. Then move the rows, lists, topics, notes, the way back and "Copy link" into
   `components/ComparisonProfile.jsx` (with its styles in a stylesheet both pages load), configured by props: the two
   sides' names and short heads, the list titles, the axis title, the zone's words, the note, the topics' line and the
   row link. "One genre" must render exactly as before (the fingerprint test passes unchanged). Commit.
2. **Two fixes that apply to both pages,** as their own commit, with the fingerprint updated and the changed rows listed
   in the commit message:
   * **A clear change never prints 40 or 60.** In `comparisonBar`, when the row is flagged and its number equals the
     zone's edge, print it one step outward (Trends: build-up of sexual language, r −0.206, prints 39, not 40).
   * **Shares that would print the same get one decimal.** When a row's two shares printed with `formatPercent` are
     equal but the values differ, print both with one decimal.
3. **Then View 2.** Ties in |r| keep the topics' order.

## 5. Explore and How it works

* **Keep exploring** (`Explorer.jsx`) gets one item after the Genres item, for characteristics on this page: "How has
  {noun} changed over time? →" (yes/no: "How has the share of {yes_subject, lowercased} changed over time? →"). It opens
  View 1 with Explore's genre and, when this page offers it, Explore's option (else All stories).
* **How it works:** a new section `["trends", "Changes over time"]` after "Comparing genres", with the text under
  "Copy". The legend's "how this is decided" links to `#/methodology/trends`. Its numbers come from `meta.trend` (60 in
  100, 20 points, 20%, 99.9%, 30, the years), never literals.
* **READMEs:** `site/README.md` (the opening paragraphs, the data-flow diagram, the lazy-parts table, the file map, the
  design notes, the budget line) and the top `README.md` (`site-data` outputs).

## 6. Download PNG

The existing function with a Trends composition: the question as the title; the heading, then "{genre} · {option}" as
the subtitle; the key without "how this is decided"; the chart with its table, brackets and, for zero, both halves; the
credit "Chart by Nathan Nguyen, @NathanDNguyen" at the bottom right. File name `trends-<var>-<genre>-<include>.png`.
Everything else as `STAGE2_SIMPLIFY_AND_PNG_PROMPT.md` says (2× pixels, no hover state, lazy code, the failure message).

## 7. Copy (approved; US English; nothing causal)

Names, counts and numbers come from the data; the examples use All genres with All stories. {then} is "2000–2009" and
{now} "2020 or later", built from `meta.trend`; {min_n} is `file.rule.min_n`. Never write the literals.

| Where | Text |
|---|---|
| Nav | Trends |
| Kicker | How have the stories changed? · about 9,000 stories · 2000–2026 |
| View switch | One characteristic · What changed (group label "Show") |
| Question, View 1 | In **{genre}**, how has **{noun}** changed over time? |
| Question, View 1, yes/no | In **{genre}**, how has the share of **{yes_subject, lowercased}** changed over time? |
| Question, View 2 | What has changed in stories in **{genre}**? |
| Heading, num and zero | {Noun} clearly rose from {then} to {now} · {Noun} clearly fell from {then} to {now} · No clear change in {noun} from {then} to {now} |
| Heading, yes/no | The share of {yes_subject, lowercased} clearly rose (fell) from {then} to {now} · No clear change in the share of {yes_subject, lowercased} from {then} to {now} |
| Heading, band | {Noun} clearly moved later (earlier) from {then} to {now} · No clear change in {noun} from {then} to {now} |
| Heading, grp | {Noun} clearly changed from {then} to {now} · No clear change in {noun} from {then} to {now} |
| Heading, too few | Fewer than {min_n} stories in {genre} were published {then}: too few to compare (or {now}; with a Length option: "… in {genre} match “{option}” and were published {then} …") |
| Numbers line, num | All genres: median **2,810** words in {then}, **4,100** in {now}. |
| Numbers line, yes/no | All genres: {yes_subject, lowercased} made up **18%** of stories in {then}, **33%** in {now}. |
| Numbers line, zero | All genres: stories with any, **11%** in {then} and **21%** in {now}; among those, median 0.229 and 0.196 per 1,000 words. |
| Fixed-mix line | Holding each genre’s share of stories fixed, the change is not clear. · Holding each genre’s share of stories fixed, it clearly rose (fell; moved later; moved earlier; changed). |
| Legend | Median · Interquartile range · Share of stories (yes/no) · Fewer than {min_n} stories · ⎵ The periods compared (how this is decided) |
| Under the chart | Median (or Share) · Stories · {then} · {now} |
| Split chart | Stories with any · Among stories with any |
| Too few in a column | Fewer than 10 |
| Details | 2015–19 · median 4,060 words · interquartile range 2,340–7,200 · 1,564 stories |
| Row name, View 1 | 2015–19: median 4,060 words, interquartile range 2,340–7,200, 1,564 stories |
| Actions, View 1 | Download PNG · Compare genres → (name: "Compare genres: {noun}") |
| Heading, View 2 | 26 characteristics clearly changed from {then} to {now} · 1 characteristic clearly changed … · No characteristic clearly changed from {then} to {now} |
| Sample line, View 2 | 2,561 stories from {then} and 3,346 from {now} in All genres. (With an option: "… in All genres match “{option}”.") |
| Takeaway, View 2 | ▼ Fell: {up to three labels}. · ▲ Rose: {…}. · ≠ A different mix: {…}. (labels via `lowerFirst`) |
| Lists, View 2 | Fell from {then} to {now} · Rose from {then} to {now} · A different mix from {then} to {now} · "{n} characteristics" · Show all {n} / Show fewer |
| Axis title | How often a story from {now} is the higher one against a story from {then}, out of 100 |
| Zone | 40–60: no clear change |
| Column heads | 2000–09 · 2020+ |
| Note | Each dot compares a story from {now} with a story from {then}; every story counts, not only the medians (how this is decided). Gray dots, in the topics below, show no clear change. Tap a row for its chart over time. ("Click" when the device can hover.) |
| Topics | Every characteristic, by topic · How many characteristics in each topic changed. Open a topic to see them all: blue dots changed, gray dots show no clear change. · "{k} of {m} changed" |
| Row name, View 2 | Paragraph count: 68 in 100; {then} 56, {now} 102 paragraphs; clearly rose. Opens its chart over time. (Not clear: "no clear change"; r null: "too few stories to compare".) |
| Too few, buttons | Show all stories · Show All genres |
| Keep exploring | How has story length in words changed over time? → |
| Footer | Explore · Genres · Trends · Patterns · How it works |

**How it works, "Changes over time":**

> The Trends page groups stories by the year they were published: 2000–04, 2005–09, 2010–14, 2015–19, and 2020 to
> the end of the collection (October 2026). For each period it shows the median and the interquartile range, or the
> share of stories, with All genres counting each genre by its size on Literotica, as everywhere on this site.
>
> A characteristic clearly changed when, picking one story published in 2020 or later and one published 2000–2009 at
> random, the newer story would be the higher one at least 60 times in 100, or the lower one at least 60 times in 100
> (ties count as half), clear at the 99.9% level, with at least 30 stories on each side. That is the Genres page's
> rule. For yes/no characteristics it means a change of at least 20 percentage points; for characteristics with named
> groups, at least 20% of the newer stories would have to change group to match the mix of 2000–2009.
>
> The share of each genre among new stories changed too. For All genres the page also checks each change with every
> genre's share held fixed, and says so when that check gives another answer.
>
> The stories are the ones still on Literotica when they were collected, in today's categories: stories removed from
> the site are not in the sample. Two characteristics are not on this page: the number of tags, which jumps between
> stories published before 2005 (a median of 10) and after (4), and the author's number of stories, which was counted
> when the stories were collected, not when they were published.

(The collection month comes from `meta.source.collected_to`; the tag numbers may stay as text, since they describe the
handoff, but recheck them against the data you build from.)

## 8. Work plan

Commit after each step. After each one: the three test commands and the build, and a look at 320, 375, 768 and 1440
px (no sideways scroll, no overlapping text, usable by mouse, touch and keyboard).

1. **The proposal:** commit `docs/stage2/TRENDS_PAGE_PROPOSAL.md` and `docs/stage2/trends-page/` as they are.
2. **Data** (§1): the wording constants, the module, the meta additions, the Python tests; `site-data` and the
   fixtures; check §1.7 and the sizes.
3. **Shell** (§2): addresses and `sanitizeTrends`, the masthead and footer with their measurements, the lazy page,
   loading and errors.
4. **View 1, num and bin** (§3): `trendLayout`, the chart, heading, takeaway, fixed-mix line, legend, details, keyboard,
   actions, the PNG (§6).
5. **View 1, grp, band and zero** (§3.1).
6. **The shared component** (§4.2, steps 1 and 2: two commits).
7. **View 2** (§4.1).
8. **Explore and How it works** (§5), and the READMEs.

**Front-end tests to add** (Vitest, with the fixtures): addresses and sanitize; the masthead's links; kind → form;
every heading variant (rose, fell, moved later, changed, no clear change, too few, yes/no); the numbers lines; the
fixed-mix line shown exactly when `f ≠ fm`; `trendLayout` overlaps at 320, 375, 768 and 1440 px and the two-line
labels; small cells (hatching, "Fewer than 10"); details and keyboard (← → only here); View 2's order, lists, too-few
state and links; the two shared fixes; the fingerprint; Keep exploring's item; the How it works section; the PNG's
pure parts (title, subtitle, key items, file name); the lazy chunk; the banned-word and US-spelling scans over every new
sentence for every genre and option.

## 9. Finishing

1. **Measure** with copies of the tools (new scripts go in the tools folder, not the repository):
   * `firstbodies.mjs`: the first load (≤ 155 KiB), a visit that starts on `#/trends` (the proposal estimated about
     180 KiB), the page's chunk and CSS, and `trends/all/all.json`;
   * `axe` on View 1 for every form, View 2, a too-few state and the error (expect none);
   * a glyph-box check of View 1 for every characteristic with the four options, for All genres and five genres
     (Romance, How To, Chain Stories, Transgender, Fan Fiction & Celebrities), at 320, 375, 768 and 1440 px; and of
     View 2 with every topic open: no overlapping text, nothing outside the chart;
   * `masthead.mjs` at every width from 320 to 1440 px;
   * tap areas (44 px), page movement (`snapgenres.mjs` adapted: 0 px), layout shift on slow 4G (< 0.1), forced
     colors in light and dark;
   * page heights of both views at 375 and 1440 px.
2. **Screenshots** (small and palette-compressed) as `docs/stage2/trends-page/b01-….png`: View 1 for num, yes/no, grp,
   band and zero at 1440 px; num at 375 px; a fixed-mix line; a too-few genre; View 2 at 1440 and 375 px; the masthead
   at 320, 375, 560 and 768 px; the footer; Explore's new item; a downloaded PNG.
3. **Write up.** Add **"13. As built"** to `TRENDS_PAGE_PROPOSAL.md`: the commits; the §1.7 numbers as built, with any
   difference and its cause; the measurements and screenshots; *Judgment calls* (one line of reasoning each); *Still
   open* (at least: a real phone and VoiceOver; Safari for the PNG; the tie-uncorrected standard error, §5.1 of the
   proposal).
4. **Final run** of the three test commands and the build. Commit, with this prompt as `STAGE2_TRENDS_PAGE_PROMPT.md`,
   and don't push. Summarize for the owner in a few lines: what was built, the branch it started from, the headline
   numbers, *Judgment calls*, *Still open*.

## Checkpoints: stop and ask before

- A newer handoff zip than `litcorr_stage2_handoff_20261008.zip` in `data/handoff/`.
- Changing the D2 rule, its thresholds or windows, the periods (D3), the fixed-mix method, or shipping any field or
  file beyond §1.
- Built numbers that differ from §1.7 without a cause you can name.
- Going over 155 KiB on first load, 16 KB gzip for a trends file, or a layout shift of 0.1.
- Wording beyond "Copy", except grammar fixes built from the data's own fields (recorded as judgment calls).
- Any change to Explore, the Genres page, Patterns or How it works beyond §2.1, §4.2 and §5, or a fingerprint change
  beyond the two fixes of §4.2.
- A masthead that can't keep every rule of §2.1 with the four steps (for example, text under 14.5 px at 320 px).
- Anything else in the hard rules' territory: interpretation, methodology, dependencies, fonts, external requests.
