# Stage 2: implement the Trends page review

You are working in the `Literotica_Correlations` project. Its Stage 2 website, *Story Patterns* (`site/`, a static
React + Vite app), has a new **Trends** page (`#/trends`) with two views: "One characteristic" (below, View 1: one
characteristic over five periods) and "What changed" (View 2: every characteristic, 2000–2009 against 2020 or later).

The page had an independent design review against three goals: user-friendly, easy to understand and visually
pleasing. The owner approved almost all of it, with the decisions below. Implement all of it. Where this prompt leaves
a detail open, decide, implement it, and record the choice under *Judgment calls* (see "Phase 8"). Stop only for the
things under "Checkpoints".

## Branch

- The page was built on `trends-page` (tip `e634304`, "Stage 2 trends page: as built, the screenshots and the
  prompt"). When this prompt was written, neither `trends-page` nor `one-genre` was merged into `main` (`0d8611d`).
- If `main` contains `trends-page` (`git branch --merged main`), make the branch `trends-review` from `main`.
  Otherwise make it from the tip of `trends-page`. Say which in the summary.
- Commit as you go, in the repository's style ("Stage 2 trends review: …"). Don't push.
- Never commit `.claude/`, `Claude outputs/` or anything under `data/`.
- git may delete its lock files. If your environment asks, request deletion permission for the project folder.

## Read first

1. `docs/stage2/TRENDS_PAGE_PROPOSAL.md`, all of it, including section 13 ("As built"), and
   `STAGE2_TRENDS_PAGE_PROMPT.md`. Where they and this prompt differ, this prompt wins.
2. `STAGE2_ONE_GENRE_IMPLEMENTATION_PROMPT.md` and `docs/stage2/ONE_GENRE_REVIEW.md` section 10: View 2 shares "One
   genre"'s rows, lists and topics through `ComparisonProfile.jsx`. **The Genres page's "One genre" changes only as O2
   says** (Copy link out, Download PNG in).
3. `STAGE2_SIMPLIFY_AND_PNG_PROMPT.md`: the owner's preference for lean pages, and how "Download PNG" works.
4. `site/README.md`, and the code:
   - `components/`: `TrendsPage.jsx`, `TrendAnswer.jsx`, `TrendChart.jsx` (`Table`, `Ticks`, `TrendSplit`),
     `TrendMix.jsx`, `TrendChanges.jsx`, `ComparisonProfile.jsx`, `CharacteristicPicker.jsx`, `IncludeSelect.jsx`,
     `InlineSelect.jsx`, `GenreSwitch.jsx` (`Segmented`), `DownloadPng.jsx`, `CopyLink.jsx`, `GenreProfile.jsx`,
     `GenresPage.jsx`, `GenreAnswer.jsx` (`genresImage`-style helpers, `genresFileName`), `Explorer.jsx` (the
     "Keep exploring" item), `App.jsx` (`Kicker`, the footer, `lastTrends`, `lastTrendChart`);
   - `lib/`: `trends.js`, `trendLayout.js`, `urlState.js` (`sanitizeTrends`, `toHash`, `parseHash`,
     `subsetConflict`, `TREND_PAGE_EXCLUDED`), `chartImage.js`, `wording.js`, `genres.js`, `data.js`;
   - `trends.css`, `comparison.css`, `palettes.css`, `styles.css` (`:root`, `main.wrap`, `.site-footer`,
     `.footer-pages`, `.kicker`);
   - the tests: `trends.test.jsx`, `trendsChanges.test.jsx`, `png.test.jsx`, `oneGenre.test.jsx`, `genresProfile.test.jsx`,
     `oneGenreFingerprint.test.jsx` and `__fingerprints__/`, `noPageMove.test.jsx`, `App.test.jsx`, and the copy
     scans (`siteText.test.js`, `scans.js`, `median.test.jsx`, `genresWords.test.js`) wherever they live.
   - Python: `litcorr/stage2/wording.py` (`NOUN`, `noun_for`, the metrics' `plural`), `litcorr/stage2/trends.py`,
     `litcorr/stage2/site_data.py` (meta), `litcorr/stage2/synthetic.py`, `tests/test_stage2_site_data.py`.
5. Reference material in `Claude outputs/` (read it; never import from it; never commit it):
   - `trends-review/`: the review's screenshots of the page as built (01–14), named by issue.
   - `design-review-2-tools/`: the measuring scripts from earlier rounds (`README.txt`). They were written in a Linux
     container. Change their paths to this Mac's and use its cached Chromium, as before.

## The owner's decisions

| # | Decision |
|---|---|
| O1 | **Keep "interquartile range".** Don't use "middle half" anywhere (the copy scans already ban it) |
| O2 | **No "Copy link" anywhere on the site.** It goes from both views that have it today: the Trends page's View 2 and the Genres page's "One genre" (both through `ComparisonProfile`). Don't add one to Trends' View 1. **Each of those two views gets one "Download PNG"** in its place, for its lists (phase 6). `CopyLink.jsx`, its CSS and its tests are deleted |
| O3 | **The footer is never flush with the content above it.** Every page leaves clear space between its last button (or list, or topic) and the footer's line (phase 2) |
| O4 | **The page opens on View 2** and the switch reads "All changes · One characteristic", in that order (phase 3) |
| O5 | **Two small additions to `meta.json` are approved:** a `plural` flag on characteristic entries whose noun is plural (as the metrics already have), and `meta.trend.too_few` (phase 1). Nothing else in the shipped data changes |
| O6 | **"Borderline"** is the approved word for an All-genres verdict that the fixed-mix check (`fm`) disagrees with (D12's line is replaced, phase 4) |
| O7 | **Everything else in the review is approved as written in this prompt**, including the new copy under "Copy" |

## What the reader sees, top to bottom

**View 2, "All changes" (the page's default):**

1. The masthead and the kicker (no line starts or ends with "·").
2. The question: "What has changed in stories across [all genres ▾]?" ("…in stories in [Romance ▾]?" for a genre). It
   sits at least 16 px above the controls.
3. The controls: the switch "All changes · One characteristic", then "Only include".
4. The heading: "26 of 180 characteristics clearly changed from 2000–2009 to 2020 or later", and the sample line.
5. The takeaway: the length line (when word count clearly changed), then "▼ Fell: …" and "▲ Rose: …", then (All genres
   with All stories only) the length-band line.
6. The note ("Each dot compares…"), now above the first list.
7. The lists, titled "▼ Fell", "▲ Rose" and "≠ A different mix". Each row reads label (and unit), the values
   "51.6 → 38.8 (−25%)", the dot on a zoomed scale, and "›".
8. One "Download PNG" for the lists.
9. "Every characteristic, by topic", unchanged except for the row changes. No Copy link.
10. Clear space, then the footer.

**View 1, "One characteristic":**

1. The question: "Across [all genres ▾], how have [very long paragraphs ▾] changed over time?" (has or have by the
   noun; "In [Romance ▾], …" for a genre).
2. The controls.
3. The heading (one line at 1280 and 1440 px for word count), with "borderline" when `f` and `fm` disagree.
4. **Desktop (answer width ≥ 960 px):** the chart on the left and a right rail on the right, holding the takeaway, the
   key and the actions. The chart's x-axis, its table and both brackets are visible without scrolling at 1280×720.
   **Narrower:** stacked as today.
5. The chart: the compared periods in blue and the middle periods (2010–14, 2015–19) in gray, marked "not compared".
   Each bracket carries its window's pooled number ("2000–2009 · median 2,810"). The line breaks where a period isn't
   drawn.
6. The actions: "See all changes →" (primary), "Compare genres →" and "Download PNG" (both secondary).
7. Clear space, then the footer.

## The changes

After each phase:

- run `npm test` and `npm run build` in `site/`, and `.venv/bin/python -m pytest`;
- look at 320, 375, 768, 1280×720 and 1440 px, and at 200% zoom. Check for no sideways scroll, no overlaps, and that
  everything works by touch, mouse and keyboard.

### Phase 0: branch, before screenshots, baseline

- Create the branch (see "Branch").
- Take the **before** screenshots on the starting commit's build, palette-compressed to 64 colors like earlier rounds,
  into `docs/stage2/trends-review/` as `b01…`:
  - b01: `#/trends` at 1440 and 375;
  - b02: `#/trends` at 1280×720 (first screen only);
  - b03: View 2 for All genres at 1440 and 375;
  - b04: View 2 with "Dialogue & characters" open;
  - b05: "Announces a continuation" (`end_to_be_continued`);
  - b06: touch words (`sense_touch_per_1k`);
  - b07: very long paragraphs (`story_long_paragraph_share`);
  - b08: narrative perspective (`pov_class`);
  - b09: Chain Stories, both views;
  - b10: Romance with "2,000–5,000 words", dialogue share;
  - b11: the picker open, at 1440 and 375;
  - b12: the footer on a long page at 1440 and 375 (Explore, Genres, both Trends views);
  - b13: the Genres page's "One genre" for Romance, its lists and its end with Copy link, at 1440 and 375.
- Record the baseline numbers you'll compare against in phase 8: first-load bytes (`firstbodies.mjs`), the Trends
  chunk's gzipped JS and CSS from Vite, and page heights for the b01 and b03 states.
- First commit: these screenshots.

### Phase 1: data (O5)

**Plural nouns.**

- In `litcorr/stage2/wording.py`, give every characteristic whose noun is grammatically plural a plural flag, the way
  the metrics have `"plural": True`.
- `meta.json`'s characteristic entries gain `"plural": true` where it applies. The key is absent otherwise, as for the
  metrics.
- Decide each noun by its head word, not by a trailing "s":
  - plural: "very long paragraphs", "commas", "sex scenes per 10,000 words", "syllables per word", "action verbs in the
    first fifth", "home settings";
  - singular: "the number of pages", "story length in words", "the build-up of action verbs", "where action verbs
    peak", "reliance on a few words", "overlap between neighboring sentences", "part number in a series".
- About 64 of the 180 Trends characteristics should come out plural. List them all in the write-up.

**Genres that can't be compared.** Add `meta.trend.too_few`: for each Trends option, the ids of the genres whose two
windows can't be compared (the same test as `windowsCompared` in `lib/trends.js`), A–Z.

```json
"too_few": {"all": ["chain-stories", "transgender"], "short": [ … 24 ids … ], "medium": [ … 16 … ], "long": [ … 29 … ]}
```

**Build and check:**

- Run `python -m litcorr site-data --handoff data/handoff/litcorr_stage2_handoff_20261008.zip`, then regenerate the
  fixtures (`python -m litcorr.stage2.synthetic site/src/test/fixtures/aggregates`). The synthetic data must give at
  least one plural noun and at least one too-few genre.
- `git diff` may show only `meta.json` and the fixtures. Every file under `v/`, `genres/` and `trends/`, and
  `patterns.json`, must be byte-identical to the build before. Compare them.

*Python tests:* the plural flags for the examples above; `too_few` agrees with the trends files for every option;
meta's other keys are unchanged; the output is deterministic.

### Phase 2: wording and the site-wide fixes

**Has or have** (review item 8):

- View 1's question uses "have" when `variable.plural`: "Across all genres, how have very long paragraphs changed over
  time?". The share wording for yes/no is singular ("how has the share of …").
- The tab title, the PNG title and the live region follow the question.
- Fix the same agreement in Explore's "Keep exploring" item (`changedOverTime` in `lib/wording.js`).
- Grep every sentence template that puts a characteristic's noun before a verb (`noun}` then " is", " has", " was",
  " changed", …) on every page. Fix each one, and list them in the write-up.

**"Across all genres"** (quick win):

- With All genres, the questions read "Across [all genres ▾], how …" and "What has changed in stories across
  [all genres ▾]?".
- With a genre, they read "In [Romance ▾], how …" and "What has changed in stories in [Romance ▾]?".
- The slot shows "all genres" in lower case. The option list keeps "All genres".
- View 1's takeaway drops its leading "{genre}:" (the question already names the genre).
- View 2's sample line ends "across all genres." with All genres, and "in {genre}." otherwise.

**The kicker** (site-wide, since `Kicker` is shared):

- No line may start or end with "·".
- When the kicker wraps, the counts go on their own line, without a leading "·". Pieces never break inside
  ("about 9,000 stories", "2000–2026").
- Check every page that shows a kicker, at 320, 360, 375 and 414 px.

**The footer** (O3, site-wide):

- Leave space between the last thing on a page and the footer's line: at least 64 px at widths over 760 px and at least
  48 px at 760 px or less. Do it in one place (for example, bottom padding on `main.wrap`, with
  `box-sizing: border-box` so `min-height: 100vh` still holds).
- Short pages keep the footer below the first screen, as `min-height: 100vh` does today.
- The independence sentence keeps its words but loses its "How it works" link. The page list below it already has
  one, so the link appears once.
- No page link sits alone on a line in the page list, from 320 to 480 px. Tighten the gap on phones, or let the list
  wrap in balanced lines.
- Check Explore, the Genres page (both views), both Trends views, Patterns and How it works.

*Tests:* has/have for every Trends characteristic in the real `meta.json` (a plural noun is never followed by "has");
the Keep exploring item; "across all genres" and "in {genre}" in both questions and the tab title; no kicker
separator at a line's start (a layout test or the measuring script); one "How it works" link in the footer.

### Phase 3: the default view, the switch and the actions (review items 1 and 5; O2, O4)

**Addresses:**

- `#/trends` with no `var` opens View 2 (All genres, All stories). `#/trends?genre=…&include=…` without `var` opens
  View 2 too.
- Any address with `var=` opens View 1, as today. `view=changes` keeps working.
- Choose the canonical form of View 2's address, keep every address from the `trends-page` build working, and record
  the choice. Update `sanitizeTrends`, `toHash`, `parseHash` and their tests.
- The masthead's and footer's "Trends" links still return to the last Trends address of the visit.
- Switching to View 1 with no characteristic remembered opens word count.

**The switch:**

- It reads "All changes" then "One characteristic", with View 2 first.
- It must fit on one line at 320 px.

**View 1's actions:**

- "See all changes →" is the primary button. It opens View 2 with the same genre and option, as a new history entry.
  Its accessible name is "See all changes in {genre}".
- "Compare genres →" becomes a secondary button.
- "Download PNG" stays.
- Order on phones: primary first. In the desktop rail (phase 5) they stack.

**Copy link goes from the site** (O2):

- Remove `<CopyLink />` from `ComparisonProfile`, so the Trends page's View 2 and the Genres page's "One genre" both
  lose it.
- Delete `CopyLink.jsx`, its CSS (`.copy-link` in `styles.css`; keep the `.png-download` rules it shares), and its
  test in `App.test.jsx`. Update comments that mention it, such as `DownloadPng.jsx`'s "Copy link's size".
- Each view's "Download PNG" arrives in phase 6. Until then, the views simply end with their topics.

*Tests:* the addresses, both ways; the switch order and labels; the primary button's target and name; no "Copy link"
button anywhere on the site (`#/trends`, `#/genres?view=genre…`, Explore, Patterns).

### Phase 4: View 1's chart tells the same story as its verdict (review items 2, 3 and 10)

**Pooled numbers on the brackets** (item 2). Each bracket's label carries its window's number, the one the takeaway
uses:

- numbers: "2000–2009 · median 2,810" and "2020 or later · median 4,100";
- yes/no: "2000–2009 · 9%";
- mostly zero, on each half: the share with any on the left ("2000–2009 · 57% with any") and the median among those
  on the right;
- named groups and bands: the label stays as it is.

Use `entry.t` for the "then" window and the last period's cell for "now", formatted by the chart's own formatter.

- Where the label doesn't fit the bracket's width (phones), the number takes a second line under the period.
- Extend `trendOverlaps` so the labels are checked.

**The middle periods** (item 3):

- Periods outside both windows (2010–14 and 2015–19 today; derive them from `file.then` and `file.now`) are drawn in
  the quiet gray (`--quiet-mark`, as View 2's gray dots).
  - Numbers: the dot and the capsule's outline in gray, the capsule's fill a light neutral.
  - Yes/no and mostly zero: the dot in gray.
- The line through the medians or shares is gray throughout. The compared periods' marks stay blue.
- "not compared" (12 px, third ink, italic) goes in the bracket row, centered under the middle periods.
- Named groups and bands keep their colors and get only the "not compared" label.
- Hover, focus and the details work as today on every period.

**The path line** (item 3). For numbers, yes/no and mostly zero (its share), add one takeaway line when a middle period
falls clearly outside the two windows' values, so a "No clear change" never sits silently beside a dip:

- Only middle periods with at least SMALL_N (30) stories count.
- A period counts when it is beyond both window values by more than 3 percentage points (shares) or 10% of the larger
  window median (numbers).
- Name only the most extreme such period: "In between, it dipped to 5% in 2010–14." or "In between, the median rose
  to {value} in {period}." Format the numbers as the chart does. It never says "clearly".
- Report how many characteristics get the line for All genres with All stories, and in total across genres. If more
  than 45 of the 180 get it for All genres, stop and report (Checkpoints).

**Borderline** (item 3, O6). For All genres, when `f` and `fm` disagree (2 characteristics with All stories; 1, 5 and
4 with the Length options):

- The heading is "{Noun}: a borderline change from 2000–2009 to 2020 or later".
- The takeaway's mix line is replaced by one of these:
  - `f` ≠ 0, `fm` = 0: "By the site’s rule it clearly {fell}, but not once each genre’s share of stories is held fixed
    (how this is decided)."
  - `f` = 0, `fm` ≠ 0: "By the site’s rule the change is not clear, but it clearly {rose} once each genre’s share of
    stories is held fixed (how this is decided)."
- `mixFixedLine` goes or is rewritten. Every other heading is unchanged.

**The marks** (item 10):

- **Yes/no:** drop the share bar. Draw the dot and the line, as for numbers, with a hollow dot under SMALL_N stories,
  as numbers have.
- **The key:** its "share of stories" icon becomes a dot on a short line. "Median" and "interquartile range" become one
  entry, a dot inside a capsule. That way the split chart's two dots are no longer identical in the key.
- **Named groups:** when two or more groups are under 3% in every drawn period, merge them into one "Other" segment in
  a neutral color. The key reads "Other ({names, lowercase-first, comma-separated})", and the details still give every
  group's share. With only one such group, leave it as it is. Narrative perspective is the test case.
- **The line breaks where a period isn't drawn** (under MIN_N stories). Chain Stories' 2015–19 is the test case: no
  segment joins 2010–14 to 2020–26.
- **The asterisk** in the table under SMALL_N is explained in the key: "Fewer than 30 stories (*)", with the number
  from `file.rule.min_n`.

*Tests:* the bracket labels for each form; the middle-period classes and "not compared"; the path line's rule (fires
for the continuation fixture, not for word count, never for a period under 30 stories); borderline headings and lines
for both disagreements; no share bar; "Other" merging; the broken line; the key's entries.

### Phase 5: View 1's layout (review item 9)

**Desktop rail.** When the answer is at least 960 px wide:

- The heading spans the full width. It may run to the panel's width, not 34ch, so word count's heading is one line at
  1280 and 1440 px.
- Under it go two columns: the chart (the rest of the width, still at most 760 px) and a right rail of about 240 px,
  32 px apart. The rail holds the takeaway, the key and the actions, top-aligned with the chart.
- Under 960 px, everything stacks as today.
- The split chart (mostly zero) needs two halves. Either fit them in the chart column or let the split chart span the
  full width with the rail's content above it, whichever reads better at 1280 and 1440. Record the choice.

**Fold target:** at 1280×720 and 1440×900, for word count with All genres and All stories, the x-axis labels, the table
and both brackets with their labels are fully visible without scrolling. If needed, the plot may shrink with the
window's height, but not under 200 px. If the target can't be met, stop and report (Checkpoints).

**Width:** View 1 and View 2 use the same overall content width at 1440 px, so the page doesn't jump when the switch
changes view.

**Spacing:**

- At least 16 px between the question's last line (including its dotted underlines) and the controls. Today it is
  4 px (`.trends-controls { margin-top: 4px }`).
- Check the space above the heading too.

**The heading element** (quick win): on the Trends page, the question is the page's `h1` and the kicker is not.

- Do it with the least change to the shared `Kicker` (for example a prop that renders it as a `p`). Other pages keep
  theirs.
- Check that axe passes and that the heading's spoken text reads sensibly with its two slots.
- If it doesn't, leave the kicker as the `h1` and record it under *Still open*.

*Tests:* the rail's presence at ≥ 960 px and its absence below; the heading's `h1` (or the recorded fallback); the
16 px gap (a layout script, phase 8).

### Phase 6: View 2 (review items 4 and 7; O2; quick wins)

All of this is **Trends-only**, through opt-in props on `ComparisonProfile`, **except "Download PNG"** at the end of this
phase, which "One genre" gets too (O2). Apart from that button and Copy link's removal (phase 3), "One genre"'s output
must not change.

**The heading** gains its denominator: "{k} of {m} characteristics clearly changed from 2000–2009 to 2020 or later". *m*
is the number of characteristics compared in this file (180 with All stories, 179 with a Length option). It reads
"None of the {m} characteristics…" when *k* = 0 and "1 of {m} characteristics…" when *k* = 1. The sample line follows
the "across all genres" wording.

**The takeaway:**

- **The length line** comes first, when word count is in the file and clearly changed: "Stories got longer: median
  2,810 words in 2000–2009, 4,100 in 2020 or later." ("shorter" when it fell). It is absent otherwise, and absent with
  the Length options, which leave word count out.
- **The ▼/▲/≠ lines** follow, unchanged.
- **The length-band line** comes last, for All genres with All stories only. Load `trends/short/all.json`,
  `medium/all.json` and `long/all.json` after the main file, lazily, so the first paint doesn't wait for them.
  - A clear change (`f` ≠ 0) that has an entry in the length files and is clear (`f` ≠ 0) in none of the three is
    "not clear within any length band".
  - The line reads "{j} of these changes are not clear within any length band." when *j* > 0.
  - Those rows' unit line ends with "· not clear within any length band".
  - Today this is 6 rows: Pages on site, Dialogue share, Recurring names, Question sentences, Questions per 1,000 words,
    Dialogue in the last fifth. Word count has no length-file entry and gets no tag.
  - Paragraph count, for example, stays clear in all three bands and gets no tag. Nothing here may say or imply that
    length explains a change: the words state only what the rule found.

**Borderline rows** (O6): a row whose `f` and `fm` disagree ends its unit line with "· borderline".

**The note** ("Each dot compares a story from 2020 or later with a story from 2000–2009; …") moves above the first
list, under the takeaway. Its words stay.

**The list titles** become "▼ Fell", "▲ Rose" and "≠ A different mix", with the marks `aria-hidden`. The counts stay at
the right. The periods are in the heading, so they leave the titles; screen readers keep the full title.

**The rows** (item 4):

- **Values first.** One values column right after the label replaces the two number columns at the right:
  "51.6 → 38.8 (−25%)".
  - The percent change is the medians' relative change, rounded to a whole percent, with a true minus sign.
  - It appears only for numbers with a plain unit (words, sentences, per 1,000 words, …) and both medians above 0.
    Shares, scales ("score", "ratio", "Zipf scale", "US school grade"), positions, bands and named groups get no
    percent.
  - Shares read "57% → 40%". Mostly zero uses the shares with any. Bands use their median labels. Named groups use the
    biggest-gap group's shares, as today.
  - Its head reads "2000–09 → 2020+".
- **Wide** (chart width ≥ 900 px): label with unit · values (fit its widest value, about 150–170 px) · plot (the rest)
  · "›".
- **Stacked:** line 1 holds the label with its unit, the values and "›". Line 2 is the plot.
- **The dot's number** stays, at 12 px regular in the second ink, for every row. The values are now the row's main
  read.
- **The zoomed scale.** The plot's domain is 50 ± *d* for the whole view (every list and topic in this file, so opening
  a topic never rescales anything). *d* is the largest |value − 50| among the compared rows, plus 5, rounded up to a
  multiple of 5, kept between 20 and 50. Ticks go every 10. The 40–60 zone and its bracket stay. Report *d* for all
  124 files.
- **The accessible names** keep their form ("{label}: {n} in 100; …"), with the values in the new order.

**Named groups' mix bars** in View 2 read top to bottom in time order: 2000–2009 above, 2020 or later below. The mix line
follows ("A different mix: 2000–2009 above, 2020 or later below").

**"Download PNG" on both comparison views** (O2): the Trends page's View 2 and the Genres page's "One genre". Each
gets one button, built once in `ComparisonProfile` so the two stay alike.

- **Where:** right after the lists (after the last list's "Show all", or the note where it follows), before "Every
  characteristic, by topic". It does not go at the view's end, where Copy link was: the button sits by what it saves.
- **What it draws:** title: the view's question as the page shows it ("What has changed in stories across all
  genres?", "What stands out about stories in Romance?"). Subtitle: the heading, then the sample line.
- **Then the lists as that view shows them,** with their titles, the axis title, the zone's bracket, the rows, the ticks
  and the mix line where a named-group row is drawn:
  - Trends draws its values-first rows on the zoomed scale, with the list titles' marks.
  - "One genre" draws its own rows unchanged: the label and unit, the dot and its number on 0–100, and the genre's and
    all genres' numbers under their column heads.
- **Size and limits:** a fixed 760 CSS px wide on every screen, at 2×, with the credit. "Show all" decides how many
  rows it draws. No "›", no buttons, no link.
- **How to build it:** as an SVG made from the data and helpers (not by cloning the HTML rows), drawn through
  `chartImage.js`'s pipeline. Use one image builder for both views, given the same row options `ComparisonProfile`
  gets. Extend the pipeline without changing what it draws for Trends' View 1, Explore and the Genres page's "One
  characteristic" (`png.test.jsx` must pass unchanged for them).
- **Accessible names:** "Download PNG of these changes" (Trends) and "Download PNG of what stands out" ("One genre").
- **File names:** follow `trendsFileName`'s and `genresFileName`'s patterns, for example `trends-changes-all-all.png`
  and `genres-genre-romance-all.png`. Record the exact forms.
- **When there is no button:** in the too-few state, and when no list is shown (nothing changed; on "One genre",
  nothing stands out, as on Fetish).
- **`DownloadPng` finds its panel** with `closest(".chart-panel")`. Make sure it finds the right element in both views.
- **Fingerprints:** "One genre"'s fingerprints change only by Copy link's removal and the new button. Regenerate them,
  and read the diff to check it shows nothing else.

*Tests:* the denominator wording; the length line (rose, fell, absent); the band tags and line from fixture files; the
borderline suffix; the note's position; the titles; `changesValues` (or whatever you name the helper) for every form,
including where the percent is left out; the domain rule; the mix order; for both views, the button's place, name and
absence, and the PNG's plan (`imagePlan`-style test: title, subtitle, rows drawn); "One genre"'s rows otherwise
unchanged.

### Phase 7: finding what changed, and no dead ends (review items 5 and 6; quick wins)

**The picker's "Clearly changed" group:**

- On the Trends page only, the characteristic picker shows a group above "Popular": "Clearly changed in all genres"
  (or "…in Romance"; add "· {option}" when an option is on).
- It lists the file's clear changes by size, as View 2 orders them, with ▼ ▲ ≠ in each chip (`aria-hidden`; the chip's
  name adds ", fell", ", rose" or ", changed").
- It shows the first 10 and a "Show all {k}" chip, and is absent when nothing changed or nothing was compared.
- Add it to `CharacteristicPicker` as an opt-in prop. Explore and the Genres page don't change.

**Genres that can't be compared:**

- In the genre slot's option list, a genre in `meta.trend.too_few[sub]` reads "{name} (too few to compare)". It stays
  selectable: View 1 still draws its periods.
- **View 2's too-few state** keeps its heading and gains:
  - a compact table of stories per period (2000–04 … 2020–26), with "fewer than 10" under MIN_N (no smaller count is
    ever shown);
  - the existing "Show All genres" or "Show all stories" button;
  - a secondary "One characteristic over time →" that opens View 1 for that genre and option. Use the remembered
    characteristic, or word count; when the option rules word count out, use paragraph count. Record the choice.

**"Only include" on Trends:** options that don't apply to the characteristic (the Length options with word count) are
left out, not listed as "(not with word count)".

- When only "All stories" is left, show "Only include: All stories" as plain text with a short muted note, "Length
  options don't apply to word count", instead of a control.
- Use an opt-in prop. The Genres page keeps its behavior.

*Tests:* the group's items, order, marks, names and absence; "Show all {k}"; the too-few labels for each option; the
too-few state's table and buttons; Only include's options and its plain-text form.

### Phase 8: finishing

1. **Measure** with copies of the earlier tools, adapted to the new markup, and report each in a table beside the
   baseline:
   - **Fold:** the brackets' bottom against the viewport at 1280×720 and 1440×900 (word count, All genres); the gap
     between the question and the controls; the footer gap on every page at 375 and 1440.
   - **Widths:** View 1's and View 2's content width at 1440, 1280 and 1024.
   - **Glyph boxes:** no overlaps at 320, 375, 768, 1280 and 1440 px, with the site's font and with
     `'"DejaVu Sans", Verdana'`. Cover every characteristic for All genres and Romance with all four options in View 1
     (including the new bracket labels and "not compared"), and View 2 for every genre with every topic open.
   - **Breaks:** no line starts or ends with "·"; no value broken inside "51.6 → 38.8 (−25%)"; no unit alone on a line.
   - **Counts:** plural nouns, path lines, borderline verdicts, band tags, and *d* for all 124 files (see "Acceptance
     numbers").
   - **Movement and timing:** controls never move the page (`noPageMove`; "Show fewer" excepted); layout shift under
     0.1; no "Loading…" flash; the length files don't delay View 2's first paint.
   - **Accessibility:** taps of at least 44 px; axe with no violations on both views (All genres, Romance, Chain
     Stories, a topic open, the picker open); label-in-name; forced colors light and dark (the gray middle periods,
     the hollow dots and "Other" must stay visible).
   - **Bytes:** first load at or under 155 KiB (meta.json grows slightly); the Trends chunk's gzipped JS and CSS before
     and after; each lazily loaded length file.
   - **PNG:** View 1's image for word count, the continuation, very long paragraphs and narrative perspective; View 2's
     for All genres (lists folded and "Show all") and Romance; "One genre"'s for Romance (folded and "Show all") and
     How To (a mix row). Open each and look at it. If you can, check Safari.
2. **Fresh eyes**, if you can run subagents. Use three phone and three desktop stand-ins, each shown only the after
   screenshots by file path, with the situation line from earlier rounds ("a friend sent you this link…"; "you have no
   background in statistics"). Ask:
   - What does this page say changed in stories, in one sentence?
   - In View 1 for the continuation: did it change, and what happened in between?
   - What do the gray periods and "not compared" mean?
   - In View 2: read the "Average paragraph length" row aloud in your own words.
   - What does "borderline" mean on the touch words chart?

   Save the answers verbatim in `Claude outputs/design-review-2-tools/trends-review/fresh-eyes.md` and summarize them.
   If you can't run subagents, say so under *Still open*.
3. **After screenshots** `a01…a13`, the same states as b01–b13, plus a14 (View 2's PNG), a15 ("One genre"'s PNG) and
   a16 (the too-few state at 375).
4. **Write up** `docs/stage2/TRENDS_REVIEW.md`, shaped like section 10 of `ONE_GENRE_REVIEW.md`:
   - a short summary;
   - each change in this prompt with its commit, and the owner's decisions O1–O3 as "not done, on purpose";
   - before and after side by side;
   - the measurements and acceptance numbers;
   - the plural list and the shared wording you fixed;
   - *Judgment calls* (one line of reasoning each) and *Still open*.

   Also update:
   - `site/README.md`: the Trends page's description (default view, the switch, the rail, the PNG), the file map, and
     the budget line if it moves;
   - `docs/stage2/TRENDS_PAGE_PROPOSAL.md` section 13 and `docs/stage2/ONE_GENRE_REVIEW.md` section 10: one line each
     pointing to the review for what changed ("One genre": Copy link replaced by Download PNG).
5. **Final run** of the three test commands and the build. Commit, with this prompt as
   `STAGE2_TRENDS_REVIEW_IMPLEMENTATION_PROMPT.md` in the last commit, and don't push. Summarize for the owner in a
   few lines: what changed, the headline numbers, *Judgment calls*, *Still open*.

## Copy (approved; US English; nothing causal)

Names, counts and numbers come from the data. {min} is `meta.min_n` (10), {min_n} is `file.rule.min_n` (30). Never
write the literals.

| Where | Text |
|---|---|
| Switch | "All changes" · "One characteristic" |
| View 2 question | "What has changed in stories across [all genres ▾]?" · "What has changed in stories in [Romance ▾]?" |
| View 1 question | "Across [all genres ▾], how has [story length in words ▾] changed over time?" · "…, how have [very long paragraphs ▾] changed over time?" · "…, how has the share of [stories that announce a continuation ▾] changed over time?" · "In [Romance ▾], …" |
| Genre option, too few | "{name} (too few to compare)" |
| View 2 heading | "{k} of {m} characteristics clearly changed from 2000–2009 to 2020 or later" · "1 of {m} characteristics…" · "None of the {m} characteristics…" |
| Sample line | "2,561 stories from 2000–2009 and 3,346 from 2020 or later across all genres." (genre: "…in Romance.") |
| Length line | "Stories got longer: median 2,810 words in 2000–2009, 4,100 in 2020 or later." ("shorter") |
| Length-band line | "{j} of these changes are not clear within any length band." |
| Row suffixes | "· not clear within any length band" · "· borderline" |
| List titles | "▼ Fell" · "▲ Rose" · "≠ A different mix" |
| Values | "51.6 → 38.8 (−25%)" · "57% → 40%" · head "2000–09 → 2020+" |
| Mix line | "A different mix: 2000–2009 above, 2020 or later below" |
| View 2 PNG button | "Download PNG" (name: "Download PNG of these changes") |
| "One genre" PNG button | "Download PNG" (name: "Download PNG of what stands out") |
| View 1 primary button | "See all changes →" (name: "See all changes in {genre}") |
| Bracket labels | "2000–2009 · median 2,810" · "2020 or later · median 4,100" · "2000–2009 · 9%" · "2000–2009 · 57% with any" |
| Middle periods | "not compared" |
| Path line | "In between, it dipped to 5% in 2010–14." · "In between, the median rose to {value} in {period}." (or "dipped to") |
| Borderline heading | "{Noun}: a borderline change from 2000–2009 to 2020 or later" |
| Borderline line | "By the site’s rule it clearly {fell}, but not once each genre’s share of stories is held fixed (how this is decided)." · "By the site’s rule the change is not clear, but it clearly {rose} once each genre’s share of stories is held fixed (how this is decided)." |
| Key | "Share of stories" · "Median and interquartile range" · "Fewer than {min_n} stories (*)" · "Other ({names})" |
| Picker group | "Clearly changed in all genres" · "Clearly changed in Romance · 2,000–5,000 words" · "Show all {k}" |
| Too-few state | "Stories per period" (table head) · "One characteristic over time →" |
| Only include, nothing left | "All stories" + "Length options don’t apply to word count" |
| Removed | "Copy link" (everywhere) · "{genre}:" at the start of View 1's takeaway · the periods in View 2's list titles · "Holding each genre’s share of stories fixed, …" · "(not with word count)" on Trends · the footer sentence's "How it works" link |

## Acceptance numbers (real data; report the built figures, and give a cause for any difference)

- All genres, All stories: **26 of 180** clearly changed (21 rose, 5 fell). Length options: 8, 16 and 15 of 179.
- `too_few`: All stories 2 (Chain Stories, Transgender); Under 2,000 words 24; 2,000–5,000 words 16; 5,000 words or
  more 29.
- Plural nouns: about 64 of the 180.
- Borderline: 2 with All stories (touch words −0.213 → −0.199; build-up of sexual language −0.206 → −0.192); 1, 5
  and 4 with the Length options.
- Length-band tags: 6 rows (listed in phase 6).
- Path line: fires for "Announces a continuation" (8.9% and 9.1% in the windows; 5.2% in 2010–14) and not for word
  count (3,260 and 4,060 lie between 2,810 and 4,100). Report the totals.
- View 2's *d* for All genres, All stories: its values run from 34 to 68, so *d* should be 25 (domain 25–75).

## Rules that still hold

- **No network access to Literotica.** Never open literotica.com with any tool.
- **Data stays private and aggregated.**
  - The data changes only as O5 allows: `plural` on characteristic entries and `meta.trend.too_few`.
  - Every other shipped file is byte-identical.
  - `data/` is read-only. Never run `probe`, `collect`, `process` or `export-handoff`. A collector may be running on
    this Mac: leave it alone.
  - `site-data` is offline and fine to run, from `data/handoff/litcorr_stage2_handoff_20261008.zip`. If a newer
    handoff zip is in `data/handoff/`, stop and ask.
- **Interpretation:**
  - No causal language and no "because". Stories "rose", "fell", "changed", "got longer".
  - "Clearly" is said only through the D2 rule (`f`, and `fm` in the borderline line). "Borderline" is said only
    where `f` and `fm` disagree.
  - The path line and the length-band words describe; they never claim a change or a cause.
  - Sample sizes stay visible.
  - Nothing orders genres.
  - The independence statement stays.
- **Methodology is unchanged:** the measures, periods, windows, weights, MIN_N 10 / SMALL_N 30, and D2 with its
  thresholds.
- **No new dependencies** (npm or Python), fonts, font weights or external requests.
- **Other pages keep their behavior,** except where this prompt says so:
  - site-wide: the footer, the kicker's line breaks, has/have agreement in shared wording;
  - Explore's "Keep exploring" item;
  - the Genres page's "One genre": Copy link out, Download PNG after its lists (O2).

  `exploreLayoutGuard.test.js` stays unchanged. "One genre"'s fingerprints change only by O2. Apart from O2, shared
  components change only through opt-in props whose defaults keep today's output.
- **Addresses keep working:** `#/explore?…`, `#/genres?…`, `#/patterns?…`, `#/methodology…`, and every `#/trends?…`
  address. Only bare `#/trends` changes what it opens (O4).
- **Quality bar:**
  - first load ≤ 155 KiB;
  - layout shift < 0.1;
  - controls never move the page;
  - reduced motion honored;
  - taps of at least 44 px;
  - text contrast of at least 4.5:1, and non-text contrast of at least 3:1 for every mark that carries meaning,
    including the gray middle periods;
  - no glyph overlaps;
  - axe with no violations.
- **US English** for everything a visitor reads. The copy scans must cover every new sentence for every genre and
  option.

## Checkpoints: stop and ask before

- Any data change beyond O5, or a `meta.json` that grows by more than 2 KB gzipped.
- Anything in the hard rules' territory: interpretation, methodology, dependencies, fonts or external requests.
- Wording beyond "Copy", except grammar fixes built from the data's own fields (record them as judgment calls).
- Going over the 155 KiB first-load budget, or a layout shift of 0.1 or more.
- A change to "One genre", Explore, Patterns or How it works beyond what this prompt lists.
- The path line firing for more than 45 of the 180 characteristics with All genres and All stories.
- The fold target at 1280×720 that can't be met without shrinking the plot under 200 px.
