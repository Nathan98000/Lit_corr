# Stage 2: implement the one-genre review (View 2)

You are working in the `Literotica_Correlations` project, on its Stage 2 website (`site/`, a static React + Vite
app). `main` is at `0d8611d` (the simplification and "Download PNG", merged; same as `origin/main`). Make a new
branch, `one-genre`, from it. Commit as you go and don't push.

The Genres page's "One genre" view (View 2, `#/genres?view=genre&genre=…&include=…`) has had an independent review:

- the review: `docs/stage2/ONE_GENRE_REVIEW.md`, with screenshots in `docs/stage2/one-genre-review/`;
- the prompt it followed: `STAGE2_ONE_GENRE_REVIEW_PROMPT.md`.

All three are untracked. The review was written against `692939e`. Since then `main` has removed three things it
covers: "Show the numbers" and its table, the story-age note, and the highlighted genre (the review's opening note
lists what that makes moot). Everything else it describes is unchanged on `main`.

The owner has approved the review with the decisions below. Implement all of it. Where this prompt leaves a detail
open, decide, implement it, and record it under *Judgment calls* (see "Finishing"). Stop only for the things under
"Checkpoints".

## Read first

1. `docs/stage2/ONE_GENRE_REVIEW.md`, all of it: findings F81–F96 (section 5), the quick wins (section 6), concepts
   R, S and T (section 7), the "after" (section 8) and the questions (section 9). Look at m01–m09.
2. `site/README.md`, all of it, and `docs/stage2/GENRES_PAGE_REVIEW.md` section 10 (View 2 as built, and the house
   style of "Before and after").
3. The code:
   - `components/GenreProfile.jsx` (all of View 2), `GenresPage.jsx`, `GenreAnswer.jsx` (`HOW_DECIDED`),
     `GenreDetails.jsx` (`ViewLink`), `CopyLink.jsx`, `useWidth.js`, `useMediaQuery.js`, `useScrollFloor.js`;
   - `App.jsx`: the history calls (`replaceState(null, …)`, `pushState(null, …)`) and `hashchange`;
   - `lib/genres.js`: `genreProfile`, `profileHeading`, `nounOf`, `standOutWord`, `profileTakeaway`,
     `profileValueParts`, `profileValues`, `comparisonBar`, `noDifferenceZone`, `profileRowDescription`,
     `numberFormat`, `plainUnit`, `withUnit`, `formatPercent`, `biggestGap`, `bandQuartiles`;
   - `lib/wording.js` (`lowerFirst`), `lib/rangeLayout.js` (`PHONE`, `textWidth`), `lib/genreLayout.js`
     (`mixColors`), `lib/motion.js`;
   - `genres.css` (`.profile-*`, `.p2-*`), `styles.css` (`:root`);
   - the tests: `genresProfile.test.jsx`, `genresQuickWins.test.jsx`, `genresWords.test.js`, `genresLinks.test.jsx`,
     `genresShell.test.jsx`, `App.test.jsx`, `noPageMove.test.jsx`, `motion.test.jsx`, `siteText.test.js`,
     `scans.js`, `median.test.jsx`.
4. Reference material in `Claude outputs/`. Read it, run copies outside the repository, never import from it, never
   commit it.
   - `one-genre-review-mockups/`: `inject.js`, its `lib/` and `README.md`. The mock-ups inject markup into the built
     page. **`approved-375-beside-today.png`, `approved-1440-beside-today.png` and `approved-states.png` there show
     exactly what this prompt asks for**, drawn on a build of `0d8611d` with
     `apply({ row: "R3", top: "S1", topics: "T1", after: true, sample: true, approved: true })`. Where the prompt and
     the mock-up differ, the prompt wins. The mock's CSS is a good starting point for sizes and spacing.
   - `design-review-2-tools/one-genre-review/`: the review's measuring scripts, raw outputs and fresh-eyes answers
     (its `README.txt` lists them), plus `approvedmeasure.mjs`, which measured the approved mock-up.
   - `design-review-2-tools/`: the earlier rounds' checks. `snapgenres.mjs`, `clsgenres.mjs` and `firstbodies.mjs` are
     at its top. The latest copies of `p2check.mjs`, `labelsfont.mjs`, `labelinname.mjs`, `axegenres.mjs`,
     `forcedgenres.mjs`, `tapsgenres.mjs`, `a11ygenres.mjs`, `heightsgenres.mjs` and `topicopen.mjs` are in
     `genres-review/after/`.

   The scripts were written in a Linux container, so their paths start at `/home/claude/…` and name a Linux Chromium.
   Change them to yours and use this Mac's cached Chromium, as before. Their selectors target today's markup
   (`.profile-row`, `.profile-plot-cell`, `.p2-num` …): adapt your copies to the new markup and keep each measurement
   the same.

## The owner's decisions

Decisions 1–3 are the owner's. The rest are the reviewer's recommendations, which the owner approved.

| # | Question | Decision |
|---|---|---|
| 1 | The row (concept R) | **R3, the lollipop, in R2's layout.** One change from the mock-ups: a row that doesn't stand out gets a **small filled gray dot**, not a hollow one. Elsewhere on the site a hollow dot means "fewer than 30 stories" (`GenreChart.jsx`, How it works), so it can't mean "no clear difference" here |
| 2 | The top of the answer (concept S) | **S1**, with the key folded into an axis title over the first list and a note under it, as in the "after" |
| 3 | The topics (concept T) | **T1.** No "Find a characteristic" box, and no links to the genres before and after (T2, F91: not done) |
| 4 | Ideas I12–I14 | **None.** I12 would add up to nine tab stops above the lists, the reason I11 was turned down last round. I13 repeats what the axis title says, and 6/6 stand-ins read the title right. I14 is moot: there is no table |
| 5 | New and changed wording | **Approved as written under "Copy"** |
| 6 | F61b, mostly-zero rows (revisits an owner decision) | **Approved.** Both columns show the share of stories with any. The median among them is shown only for a stand-out whose share goes the other way from its dot (0–2 rows per option) |
| 7 | Unit text under the labels | **The data's own unit text where it explains a scale** ("Zipf scale (higher = more common)"), plain units otherwise, and none that the label already names |
| 8 | A longer page on phones | **Accepted.** Romance at 375 px goes from 2,461 to about 2,800 px |
| 9 | 768 px | **The stacked row below a chart width of 900 px**, which gives the plot about 716 px at 768 instead of 252 |
| 10 | A real phone and VoiceOver | The owner will check after this round. List them under *Still open* |
| 11 | F92's table column, F95 | **Moot.** There is no table on `main` |
| 12 | Quick wins 1–10 (review section 6) | **All of them**, except quick win 6's table part |
| 13 | Git lock files | git may delete its lock files. If your environment asks, request deletion permission for the project folder |

## What the reader sees, top to bottom

1. The masthead, the question, the view switch and "Only include": unchanged.
2. **The heading**, unchanged in words. It may run to 62ch from a 1,000 px window, so it takes one line at 1440 (F94).
   The question keeps the site's 34ch.
3. **The sample line** (F93): "300 stories in Romance."
4. **The takeaway** (S1, F90): "▼ Lower: …" and "▲ Higher: …", plus "≠ A different mix: …" when there is one.
5. **No separate key** (F86). Its words move to the first list.
6. **The lists.** "Lower in Romance than in all genres", "Higher in …" and "A different mix", each with its first
   seven rows and "Show all {n}", as today. On the first list:
   - the axis title, "How often a story in Romance is the higher one, out of 100";
   - the zone's bracket, "40–60: no clear difference";
   - the rows, with the tick labels "0 25 50 75 100";
   - "Show all 18";
   - then the note: "Each dot compares the Romance story with a story from all genres; …".
7. **The rows** (R3): the label with its unit under it, the plot, the two numbers, and "›" at the end.
8. **The topics** (T1): "Every characteristic, by topic" with a line under it, then eight topics, each with
   "{k} of {m} stand out".
9. **Copy link**, unchanged.

## The changes

Commit each phase in the repository's style ("Stage 2 one genre: …").

After each phase:

- run the three test commands: `npm test` and `npm run build` in `site/`, and `.venv/bin/python -m pytest`;
- look at 320, 375, 768 and 1440 px and at 200% zoom. There should be no sideways scroll and no overlaps, and
  everything should work by touch, mouse and keyboard.

### Phase 0: branch and first commit

- Create `one-genre` from `main` (`0d8611d`).
- The first commit holds the review, its screenshots and its prompt: `docs/stage2/ONE_GENRE_REVIEW.md`,
  `docs/stage2/one-genre-review/` and `STAGE2_ONE_GENRE_REVIEW_PROMPT.md`.
- This prompt goes in the last commit.
- Never commit `.claude/`, `Claude outputs/` or anything under `data/`.

### Phase 1: the row (R3; F81, F82, F83, F85, F87, F92's row names, F94, F96; quick wins 1–3 and 9)

**One grid for every list and every open topic (F81).** Every block uses the same columns, so the plot has one width
and 50 one x on the whole page. "Show all" and "Show fewer" add and remove rows without redrawing anything else.
`valuesWidth`, `--values-w` and `wrap-words` go.

- **Wide** (chart width 900 px or more): the label, with its unit under it, in a 250 px column · the plot (the rest)
  · the genre's number, 76 px · all genres' number, 76 px · "›", 14 px. Column gap 12 px.
- **Stacked** (chart width under 900 px; a new constant beside `PHONE`, used only by View 2's rows): line 1 holds the
  label with its unit, the genre's number (58 px), all genres' number (58 px) and "›" (12 px). Line 2 is the plot
  across the full row.
- The approved mock-up measured these numbers. Hold them:
  - the plot is 284 px at 320, 339 at 375, 716 at 768 and 564 at 1440;
  - 50 sits at the same x in every list;
  - Romance's first seven stems spread 20.3 px at 375 (8.9 today).

**The plot** (SVG, `aria-hidden`, geometry in percent as today):

- **The zone and lines are as today:** the zone from `noDifferenceZone(file.rule)` (#ece9e2), its edges 1 px #8f8a80,
  and the 50 line in the third ink.
- **A stand-out** (`f` ≠ 0): a 2 px stem in `--accent-ink` from 50 to 50 × (1 + r), and a 10 px dot in `--accent-ink`
  at the value.
- **A row that doesn't stand out** (`f` = 0, r not null): a 1.5 px stem and a **7 px filled dot**, both in a new
  variable `--quiet-mark: #857f75`. That is 3.80:1 on the page and 3.27:1 on the zone.
- **Not compared** (r null): "Too few stories to compare" in the plot cell, muted, as today. No dot.
- **Named groups** keep their two thin 100% bars, the genre's above all genres', with `mixColors`.
- **The number** (`comparisonBar(r).times`):
  - It sits beside the dot on the side away from 50, 8 px from the dot's edge, in tabular figures.
  - Stand-outs: 13 px, weight 600, in the ink. Others: 12 px, regular, in the third ink.
  - A halo of the page's color sits behind it (`paint-order: stroke`, 4 px, round joins).
  - **A dot inside the zone** (40 < end < 60) has its number printed just outside the zone's edge on the dot's side,
    so no number ever sits on a line (F83, quick win 1).
  - **Near the scale's ends**, a number that would pass the plot's edge goes on the dot's inner side, its halo over
    the stem.
  - Put the placement in a pure helper (side and x from r and the zone) and test it.
  - `comparisonBar`'s `inside` goes if nothing else uses it.

**The numbers** (F85, F96; quick wins 3 and 9). A new pure helper in `lib/genres.js`, `profileColumns(item)`, returns
`{ genre, all, unit }`, where `genre` and `all` are each `[main, second?]`. It replaces `profileValueParts` and
`profileValues`; delete them once unused.

- **Numbers:** the medians, each trimmed of trailing zeros on its own ("1.72", "10", "0.78"; never inside "4,390").
  This happens only in View 2's columns and row names. View 1 keeps one number of decimals per chart (F66).
- **Yes/no:** the shares (`formatPercent`). No unit line.
- **Mostly zero** (decision 6): the shares with any, and the unit line "stories with any".
  - For a stand-out whose genre share is not on the same side of all genres' share as its dot
    (`Math.sign(g.share − a.share) !== Math.sign(r)`), each column adds a second small line with the median among
    those ("–" when there is none).
  - That row's unit line reads "with any · median among those", plus ", {plain unit}" when there is one.
- **Bands:** the median band labels, with the unit line "median".
- **Named groups:** the shares of the group that differs most (`biggestGap`). The unit line is that group's name.
- **The unit line** (decision 7). A helper `profileUnit(item)` holds the rule:
  - Use the plain unit (`nf.unit`) if there is one.
  - Otherwise use the data's unit text, except: "share…", "yes/no", anything starting "1 =", lists with " / ",
    and the month and weekday units.
  - "position (0 = start, 1 = end)" becomes "of the way through the story".
  - Drop it when the label already names it, case-insensitively ("Sex scenes per 10,000 words", "Years online",
    "Publication year", "Part number").
  - The unit goes after the label in 12.5 px third ink. It may share the label's last line when it fits, never breaks
    inside a unit of up to about 18 characters, and longer ones wrap on their own line.
- **The column heads** (12 px, weight 600, second ink, right-aligned):
  - Wide: "{genre}" and "All genres" in each block's head row. The genre's name takes up to two lines of its
    column. When it needs more, use "Genre".
  - Stacked: "{genre}" and "All". In a list they sit on the list's title line; in an open topic, in a head row. Use
    the name when it fits 58 px at 12 px 600 (`textWidth`), else "Genre".

**The axis of each block:**

- Wide: the head row over the plot holds the bracket "40–60: no clear difference" (11.5 px, second ink) over a 1 px
  #8f8a80 bracket from 40 to 60 with 5 px ends. Under it go the tick labels "0", "25", "50", "75" and "100" (12 px,
  third ink).
- Stacked: the bracket goes over the first row. The tick labels, with 4 px tick marks, go under the last row.
- The ticks never say "in 100" (F96). Five labels always fit now, so the three-label variant goes.
- A block with no dot (named groups only, or nothing compared) has no bracket and no ticks. Its heads stay.

**The row:**

- min-height 44 px, a 1 px `--rule` line under it, and the hover wash as today.
- "›" in the third ink, 18 px, `aria-hidden`, at the end of every row in lists and topics (F87).
- The link still opens View 1 for that characteristic (`ViewLink` to `{ v, sub }`).

**The row's accessible name** (F92). Build it from the row's own content, with no `aria-label`, so it starts with the
visible label and contains the visible numbers in reading order. Hide the unit line and "›" from the name: their
words come after the numbers. The name reads:

- a stand-out: "Sexual language: 26 in 100; Romance 7.8, all genres 19.3 per 1,000 words; clearly less. Opens every
  genre’s numbers."
- not a stand-out: "…; no clear difference. Opens every genre’s numbers."
- not compared: "Word count: Chain Stories 3,660, all genres 4,100 words; too few stories to compare. Opens every
  genre’s numbers." With fewer than {min} stories, the genre's part reads "fewer than 10 stories".
- mostly zero: "Romance 73% with any, all genres 43%". Where the median line shows, add "; among those, median 0.709
  and 0.422 per 1,000 words".
- bands: "Romance median 6–20, all genres median 2–5".
- named groups: every group's share for both, as today, and "a clearly different mix".
- The unit follows all genres' number, once, through `withUnit`, so it reads "1 page", never "1 pages".

This replaces `profileRowDescription`, keeping its comparison words (`profileComparison`).

*Tests:*

- `profileColumns` for each form, including the other-way mostly-zero row and trimmed zeros;
- `profileUnit`: plain, a scale's text, the position phrase, none when the label names it, none for share, yes/no
  and "1 =";
- the number's placement: its side, outside the zone's edge, and on the inner side near the ends;
- the stand-out and quiet dot classes, and "Too few stories to compare" with no dot;
- every block has the same column template, and there is no per-list width;
- "›" on every row, hidden from the name;
- the row names for every form: each starts with the label and contains the visible numbers.

### Phase 2: the top of the answer (S1; F86, F90, F93, F94; quick wins 4, 5 and 10)

**The sample line** (F93), under the heading, 15 px, second ink, 2 px under it. `n` is `file.n[gi]`, via
`formatCount`.

- All stories: "300 stories in Romance."
- Another option: "100 stories in Romance match “Published 2020 or later”."
- The small-sample state (from {min} up to {min_n} stories): "12 stories in Chain Stories match “Published 2020 or
  later”.", under its heading.
- Under {min} stories there is no sample line. The heading already says "Fewer than 10 …", and no smaller count is
  shown anywhere on the site.

**The takeaway** (S1, F90). `profileTakeaway` becomes up to three lines, in the takeaway box as today:

- "▼ Lower: sexual language, sentences with sexual language, anatomical terms."
- "▲ Higher: romance language, where the first sex scene starts, words before first explicit term."
- "≠ A different mix: narrative perspective." (How To)

Each line follows these rules:

- It appears only when its list has items, and names that list's first three, in its order, as `lowerFirst(label)`.
- The marks are `aria-hidden`. The words "Lower:", "Higher:" and "A different mix:" are weight 650.
- Story age is publication year again: when publication year is among the items shown, story age is left out and
  the next one is taken (the rule in `profileTakeaway` today).
- With nothing standing out there is no takeaway; "Its stories are close to …" stays.
- `profileAnnouncement` reads the heading, then the lines without their marks: "28 characteristics clearly set
  Romance apart from all genres. Lower: …. Higher: …."

**The key moves into the lists** (F86). `ProfileLegend` goes.

- Over the first list's rows goes the axis title, "How often a story in Romance is the higher one, out of 100".
  12.5 px, weight 600, second ink, `text-wrap: balance`, with no break inside "out of 100".
- Under the first list, after its "Show all" button, goes the note (13 px, second ink, at most 70ch): "Each dot
  compares the Romance story with a story from all genres; every story counts, not only the medians (how this is
  decided). Gray dots, in the topics below, show no clear difference. Tap a row for every genre’s numbers."
  - "how this is decided" links to `HOW_DECIDED`, with no-break spaces inside the parentheses and an invisible
    44 px tap extension (quick win 4).
  - "Tap" when `(hover: none)` matches (`useMediaQuery`), else "Click".
- **With no list** (nothing stands out, as on Fetish): every open topic with dots carries the axis title over its
  rows and the note under them. The note leaves out ", in the topics below," there.
- **In the small-sample state** (nothing compared) there is no axis title, no note and no bracket.
- **The mix line** (quick win 5) appears only where named groups are compared. "A different mix: Romance above, all
  genres below" goes over the "A different mix" list's rows, and over an open topic whose named-group row has a
  comparison. It appears nowhere else.
- The grammar is "a story in {genre}" everywhere. "a {genre} story" goes.

**The lists' heads** (stacked layout):

- The column heads sit at the right of the list's title line, as in the mock-up.
- The visible lone count goes ("Show all 18" keeps the number). Screen readers keep "18 characteristics".
- Below a 360 px chart the heads wrap under the title, right-aligned.
- Below `PHONE`, the list titles are 17 px.

**The heading** may run to 62ch from a 1,000 px window (F94, quick win 10).

*Tests:*

- the sample line in all four states;
- the takeaway's lines: up to three each, in order, `lowerFirst`, the story-age skip, the mix line, none when
  nothing stands out;
- the announcement;
- no key list;
- the axis title only over the first list, from the genre's name;
- the bracket's numbers from `noDifferenceZone`, never the literals;
- the note after the first list's "Show all", with its link, "Tap" or "Click" by the media query;
- Fetish-like fixtures: the title and note in each open topic, without "in the topics below";
- the small-sample state: no title, note or bracket;
- the mix line only with a compared named group;
- no "a {genre} story" anywhere.

### Phase 3: the topics (T1; F84, F89, F92's summaries; quick wins 7 and 8)

- "Every characteristic, by topic" at 23 px (quick win 8). Under it, 14.5 px second ink: "How many characteristics in
  each topic stand out. Open a topic to see them all: blue dots stand out, gray dots show no clear difference." The
  line is left out when nothing was compared (the small-sample state).
- **Each topic's summary:**
  - The topic's name in 16 px sans, weight 600. There is no `h4` inside `<summary>`: the summary is named by its text
    (F92).
  - A visually hidden ", " between the name and the count, so the name reads "Length & structure, 1 of 28 stand out".
  - The count is "{k} of {m} stand out" whenever *m* > 0, including "0 of 13 stand out", with *k* at weight 650 in
    the ink. When *m* = 0 it reads "{n} characteristics". It never breaks inside.
  - min-height 50 px, with the "+" / "−" as today.
- **An open topic's rows** are phase 1's rows. Stand-outs carry their ▲ ▼ ≠ in a 16 px column before the label
  (`aria-hidden`; the name says it). Rows that don't stand out get the gray stem and dot (F84, quick win 7). Rows in
  the lists have no mark column.

*Tests:*

- the counts' wording, including "0 of {m}" and "{n} characteristics";
- no `h4` in a summary, and the summary's name;
- the topics line, and its absence in the small-sample state;
- the marks only on stand-outs in topics.

### Phase 4: the way back (F88; quick win 6)

- **Keep the open topics and the lists shown in full in `history.state`**, under a View 2 key (for example
  `oneGenre: { topics: […], all: [ "lower", … ], y }`).
  - Update it with `replaceState` on each change. The address doesn't change, so every address keeps working.
  - `App.jsx`'s `replaceState(null, …)` calls must keep that key (pass the current state through), or a change of
    option would wipe it. A new entry (`pushState`) starts empty.
  - On mount, read it before the first paint, so the page is as tall as it was.
  - Then restore the scroll position if the browser's own restoration was clamped. Do it instantly, with no motion.
  - Changing the genre or the option keeps the open topics and "Show all", as today.
- **After "Show fewer":** if its button has left the screen, bring the list's heading into view. Do it instantly
  under reduced motion and smoothly otherwise (`scrollBehavior()`), without moving focus.
  - This is the one control on the page that moves it, on purpose. Update `noPageMove.test.jsx` and say so in the
    commit.
  - When the button is still on screen, nothing moves.
- *Check:* the review's b07 walk. Open "Dialogue & characters" at 375 px, scroll to 2,315 px, tap a row, then press
  Back. The topic should be open again at the same scroll position. Do the same at 1440 px from 1,300 px.
- *Tests:* restore after a remount on the same entry; a new entry starts closed; the App's replace calls keep the
  key; "Show fewer" scrolls only when its button left the screen, and keeps focus.

### Phase 5: finishing

1. **Measure** with copies of the tools. Compare each with the review's number and the approved mock-up's
   (`approvedmeasure.mjs`), in a table:
   - **Plot width and 50's x** at 320, 375, 768 and 1440 px, for every list and an open topic.
   - **First row's top at 375 × 667:** 655 px in the mock-up, its dot at 708.
   - **Page height** for Romance with the topics closed. Today: 2,687, 2,461, 1,967 and 2,000 px at 320, 375, 768
     and 1440. Mock-up: 3,167, 2,797, 2,310 and 2,085. Also give How To and Fetish.
   - **Numbers crossing a line or the plot's ends:** must be 0, for every genre with every topic open, at 375 and
     1440 px. Use the review's `numcross.mjs` adapted; today's count is 3,710 of 5,982 at 375.
   - **Glyph boxes** for every genre, every topic open, All stories, "Under 2,000 words" and "Published 2020 or
     later", at 320, 375, 768 and 1440 px, with the site's font and with `'"DejaVu Sans", Verdana'` (`p2check.mjs`,
     `labelsfont.mjs`). Nothing may overlap: labels, units, numbers, heads, the bracket, the ticks and the dots.
   - **Bad breaks** (the review's `wraps.mjs`, both fonts): no unit alone on a line, no line starting with "·", and
     no count broken ("stand / out"). Today there are 700, 106 and 57 at 375 px.
   - **Movement and timing:**
     - `snapgenres.mjs`: 0 px everywhere except "Show fewer" (phase 4).
     - `clsgenres.mjs`: under 0.1.
     - The review's `feel.mjs` at 1× and 4× CPU for "Show all", opening the largest topic, another genre and another
       option. `topicopen.mjs` with Word choice & style (62 rows).
   - **Taps, names, contrast and accessibility:**
     - Tap areas (`tapsgenres.mjs`, the review's `taps.mjs`): 44 px for rows, the note's link, the summaries and
       "Show all".
     - `labelinname.mjs` and Lighthouse's label-in-name on View 2.
     - `axegenres.mjs` on View 2: Romance, How To, Fetish, Chain Stories (2020 or later), and a topic open.
     - `forcedgenres.mjs`, light and dark. Stand-out dots must be filled and quiet dots smaller in system colors, with
       the zone's edges, the 50 line and the numbers visible.
   - **Bytes:**
     - `firstbodies.mjs`: the first load must not change, and stays at or under 155 KiB (148.5 KiB in the README now).
     - A visit that starts on `#/genres?view=genre…`.
     - The Genres chunk: Vite printed 16.57 kB JS and 3.16 kB CSS gzipped for `0d8611d`. The review estimated 2–3 KiB
       more JS with T2's find box. Report the real figure.
2. **Fresh eyes.** Repeat the review's stand-in test on the built page:
   - Use three phone and three desktop subagents, each shown only screenshot paths and `fresh-eyes/questions.txt`,
     with the review's situation line: "Situation: a friend sent you this link and you opened it on your phone" (or
     "on your desktop computer"). "You've never seen this site; you have no background in statistics." Tell them to
     open each screenshot with the Read tool, look at nothing else, and reply with numbered answers only.
   - The phone set is Romance at 375 px, scrolled through, then two shots with "Dialogue & characters" open. The
     desktop set is Romance at 1440 px (two screens, then the topic open).
   - Q9(c) asks about a table that no longer exists; don't score it.
   - Save the answers verbatim in `Claude outputs/design-review-2-tools/one-genre-review/fresh-eyes/built.md`. Score
     them with `scores.md`'s rubric, beside the "after, second version" row.
   - Aims: Q4, Q5, Q7 and Q9b at 6/6, and the gray dots read as "no clear difference" by at least 5/6.
   - If an aim is missed, record it under *Still open*. Don't change wording beyond "Copy" without asking.
   - If you can't run subagents, say so under *Still open*.
3. **After screenshots** as `docs/stage2/one-genre-review/a….png`, small and palette-compressed (64 colors) like the
   review's:
   - a01: the first screens at 320, 375, 768 and 1440 px;
   - a02: Romance's whole page at 375 and 1440 px, beside the review's b02;
   - a03: an open topic at 375 and 1440 px (gray dots, marks, heads);
   - a04: the numbers by the zone's lines, beside b04;
   - a05: How To at 375 px;
   - a06: Fetish with a topic open;
   - a07: Chain Stories with "Published 2020 or later";
   - a08: into View 1 and back, beside b07;
   - a09: 768 px, the stacked row;
   - a10: forced colors and 200% zoom;
   - a11: long genre names at 320 px (Fan Fiction & Celebrities, Exhibitionist & Voyeur);
   - a12: squint and grayscale, beside b12.
4. **Write up.** Add **"10. Before and after"** to `docs/stage2/ONE_GENRE_REVIEW.md`, shaped like section 10 of
   `GENRES_PAGE_REVIEW.md`:
   - a headline-numbers table: the review's number, the mock-up's, then after;
   - every finding F81–F96, quick win and concept with its commit, or "not done" with its reason (T2 and F91, I12–I14,
     F95 and F92's table column);
   - the after screenshots and the fresh-eyes scores;
   - *Judgment calls* (one line of reasoning each), *Still open*, and *Not done, on purpose*.

   Also update:
   - the review's status line;
   - `site/README.md`: the opening paragraph's sentence on "What stands out about stories in [Romance]?",
     `GenreProfile.jsx`'s entry in the file map, any design note that mentions the key, and the budget line if it
     moves.
5. **Final run** of the three test commands and the build. Commit, with this prompt as
   `STAGE2_ONE_GENRE_IMPLEMENTATION_PROMPT.md`, and don't push. Summarize for the owner in a few lines: what changed,
   the headline numbers, *Judgment calls*, *Still open*.

## Copy (approved; US English; nothing causal)

Names, counts and numbers come from the data; the examples use Romance with All stories. {min} is `meta.min_n` (10),
{min_n} is `file.rule.min_n` (30), and the zone's ends come from `noDifferenceZone(file.rule)`. Never write the
literals.

| Where | Text |
|---|---|
| Sample line (F93) | "300 stories in Romance." With another option: "100 stories in Romance match “Published 2020 or later”." Small sample: "12 stories in Chain Stories match “Published 2020 or later”." None under {min} |
| Takeaway (F90) | "▼ Lower: {up to three labels}." · "▲ Higher: {…}." · "≠ A different mix: {…}." Labels via `lowerFirst`, joined with ", " |
| Announcement | "{heading}. Lower: {…}. Higher: {…}. A different mix: {…}." |
| Axis title (F86) | "How often a story in Romance is the higher one, out of 100" |
| Zone bracket | "40–60: no clear difference" |
| Ticks (F96) | "0", "25", "50", "75", "100" |
| Column heads | Wide: "Romance" · "All genres". Stacked: "Romance" · "All". "Genre" when the name doesn't fit |
| The note under the first list (F84, F86, F87) | "Each dot compares the Romance story with a story from all genres; every story counts, not only the medians (how this is decided). Gray dots, in the topics below, show no clear difference. Tap a row for every genre’s numbers." With "Click" when the device can hover. In an open topic when no list is shown: "… Gray dots show no clear difference. …" |
| Mix line (quick win 5) | "A different mix: Romance above, all genres below" |
| Unit lines (F85, decision 7) | The plain unit ("per 1,000 words", "words" …); the data's unit text for scales ("Zipf scale (higher = more common)", "ratio (1 = random order)", "score (higher = easier)", "US school grade" …); "of the way through the story"; "stories with any"; "with any · median among those" (+ ", {plain unit}"); "median" (bands); the group's name (named groups) |
| Topics line (F89) | "How many characteristics in each topic stand out. Open a topic to see them all: blue dots stand out, gray dots show no clear difference." |
| Topic count (F89) | "{k} of {m} stand out"; "{n} characteristics" when *m* = 0 |
| Row names (F92) | "Sexual language: 26 in 100; Romance 7.8, all genres 19.3 per 1,000 words; clearly less. Opens every genre’s numbers." and the variants in phase 1 |
| Removed | The key's three lines, "Biggest difference(s): …", the values' head "Romance · all genres", "100 in 100", "a {genre} story" |

## Rules that still hold

- **No network access to Literotica.** Never open literotica.com with any tool.
- **Data stays private and aggregated.**
  - Ship only `meta.json`, `v/<characteristic>/<included>.json`, `patterns.json` and `genres/<included>.json`.
  - No new data fields or files, and no format changes. This round needs no `site-data` run, and `git diff` must
    show nothing under `site/public/aggregates/` or the fixtures.
  - `data/` is read-only. Never run `probe`, `collect`, `process` or `export-handoff`.
- **Honest interpretation.**
  - No causal language. No notes about chance, and no reminders that correlation is not causation.
  - "Clearly differs", "stands out" and "sets apart" are said only through the D2 rule (the file's flags).
  - View 2 orders characteristics by the size of their difference within one genre, and never orders genres.
  - Sample sizes stay visible: the new sample line, and every row's numbers.
  - The independence statement stays.
- **Methodology is unchanged:** the measures, binning, weights, MIN_N 10 / SMALL_N 30, the "tend to" rule, and the D2
  rule with its thresholds (0.20, 99.9%, TVD 0.20, 30 stories) and its reference group.
- **No new dependencies.** No npm or Python packages, fonts or font weights, CDNs, analytics or external requests.
  Checking tools run from a temporary directory outside the repository.
- **Only View 2 changes.** Explore, "One characteristic" (View 1), Patterns, How it works and "Download PNG" keep
  their behavior and their tests (`exploreLayoutGuard.test.js` unchanged). Shared helpers that View 1 uses keep
  their output for View 1.
- **Addresses keep working:** `#/explore?…`, `#/patterns?…`, `#/genres?…` (`var`, `include`, `genre`, `sort`, `view`),
  `#/methodology` and `#/methodology/<section>`.
- **Quality bar.**
  - First load at or under 155 KiB.
  - Layout shift under 0.1, with no "Loading…" flash.
  - Controls never move the page, except "Show fewer" (phase 4). Reduced motion is honored.
  - Touch targets of at least 44 px.
  - Text contrast of 4.5:1 or more. Non-text contrast of 3:1 or more for every mark that carries meaning.
  - No glyph overlaps at 320, 375, 768 and 1440 px with either font.
  - axe: no violations.
- **US English** for everything a visitor reads. The scans in `siteText.test.js`, `scans.js` and `median.test.jsx`
  must pass on all new copy: no "because", no causal words, no UK spellings, no "typical story", "typical age" or
  "middle half". Extend `genresWords.test.js` so the scans cover every new sentence for every genre and option:
  takeaway lines, sample lines, axis titles, notes, unit lines, counts and row names.

## Checkpoints: stop and ask before

- Any change to the data shipped, or a genres file over 60 KB gzipped.
- Anything else in the hard rules' territory: interpretation, methodology, dependencies, fonts or external requests.
- Wording beyond "Copy", except grammar fixes built from the data's own fields, recorded as judgment calls.
- Going over the 155 KiB first-load budget, or a layout shift of 0.1 or more.
- A change to Explore, View 1, Patterns, How it works or "Download PNG".
- A layout where a measured number misses the approved mock-up's by a lot (for example, the plot at 375 px under
  300 px, or numbers crossing lines), when the fix would need something this prompt doesn't allow.
