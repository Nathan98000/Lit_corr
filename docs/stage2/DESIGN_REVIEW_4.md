# Stage 2 design review, round 4: the whole site

*Reviewed on October 12, 2026: `main` at `3b04164` (the newest commit, pushed). Branch `design-review-4` was created
from it; nothing is committed. Earlier rounds: [round 1](DESIGN_REVIEW.md), [rounds 2 and 3](DESIGN_REVIEW_2.md),
[the Genres page](GENRES_PAGE_REVIEW.md), [One genre](ONE_GENRE_REVIEW.md), [Trends](TRENDS_REVIEW.md).*

This round looks at the five pages together, against three goals: easy to understand, user friendly, and
aesthetically pleasing. It reports what 114 stand-ins read off screenshots (48 on today's site, 66 on mock-ups),
what nine tasks cost on a phone and a desktop, and what a set of whole-site measurements found. Screenshots are in
[`design-review-4/`](design-review-4/) (`b…` today, `m…` mock-ups). The stand-ins' answers, the questions and the
answers fixed in advance are in `Claude outputs/design-review-4/fresh-eyes/`; the mock-ups and every measuring script
are in `Claude outputs/design-review-4-mockups/` and `Claude outputs/design-review-4/tools/`.

**Where the numbers come from.** Everything was measured in a Linux container: the site built from `3b04164`
(`npm run build`; the same bundle names as on `main`, `index-CBtIU3K7.js`) and served with gzip by round 2's
`serve.mjs`; Playwright 1.56 with Chromium 1194 (headless), axe-core 4.10.3; the sans text in Inter (the container's
`system-ui`) instead of San Francisco, and DejaVu Sans as the wide font instead of Verdana. So byte counts and
layout-shift numbers compare directly with earlier rounds; glyph widths and timings compare within a few percent.
**No real phone, Safari, VoiceOver, TalkBack or NVDA could be used here** (section 4).

**What the stand-ins are.** Subagents shown only screenshots (the screens a visitor scrolls through, captured at
375 × 667 and 1440 × 900 at 2× pixels), a one-line situation and the questions. Models read static images differently
from people and can't tap or scroll. Their answers show where the site is ambiguous; they don't prove it is clear.

---

## 1. Verdict

The site reads as one calm, editorial site, and its answers are found: on today's site, all 48 stand-ins got their
page's main answer right, and **every one of them rated the look 4 of 5** ("clean", "calm", "bookish",
"editorial"). The question sentence works as a control everywhere: asked what they would tap to change the genre or
measure, 6 of 6 named the blue words on every page that has them. It is fast (149.9 KiB first load), stable (worst
layout shift 0.021) and clean for machines (axe: no violations in 100 runs across 25 states at 375, 1440, 200% and
400%).

What still fails people is **reading the numbers**, not finding them. The stand-ins found the right number and
then didn't know what kind of number it was: the interquartile range (30 of 30 where it is on screen), the rating's
scale (11 of 12), the two kinds of number in a comparison row, and why a genre is marked when a bigger-looking one
isn't (6 of 6, and again 12 of 12 with two attempted fixes). The two comparison views, One genre and Trends' All
changes, are the hardest pages on the site (ease 3.2 and 3.0 of 5, where every other page scores 3.5–4.0). And one
generated sentence is plain broken: **1,146 chart titles read "… tend to are added to more reading lists"** (F97).

### Grades

Letter grades for each goal, page by page, with the earlier rounds' grades where an earlier round graded the same
thing. The earlier rounds graded areas, not goals, so they are matched by meaning.

| Page | Easy to understand | User friendly | Aesthetically pleasing | Earlier grades |
|---|---|---|---|---|
| Explore | B | B+ | B+ | Round 2: first impression B+, the chart A− (phone and desktop), words B, visual design B+ |
| Patterns | B+ | B | B− | Round 2: "Patterns is a wall of blue sentences" (in visual design, B+) |
| Genres, one characteristic | B | A− | A− | Genres review: purpose A−, the answer B−, visual design A−, accessibility B+ |
| Genres, One genre | C+ | B | B | One genre review: user-friendliness B−, aesthetic appeal C+ |
| Trends, All changes | C+ | B− | B | none |
| Trends, one characteristic | B | B+ | B+ | none |
| How it works | B+ | B (phone C+) | B+ | none |
| **The site** | **B** | **B+** | **B+** | Round 2 overall: no single grade (areas B to A−) |

The reasons, in a line each:
- **Explore.** Every answer read right, but 0 of 6 knew what the pale bar is and 6 of 6 weren't sure the rating is out
  of 5; the label "4.19" sits on the dashed line (12 of 12 noticed). The L1 mock-up fixes all three (section 8).
- **Patterns.** Every answer right and ease 4.0; its header is built differently from every other page (6 of 6 in
  the side-by-side test), and "clear", "weak", "moderate" and "strong" aren't defined on the page (6 of 6).
- **Genres.** The best page: ease 4.0, every answer right; the one puzzle (why Mind Control isn't marked) is real.
- **One genre.** Every answer right, but ease 3.2, the note talks about gray dots no one can see (6 of 6), and
  "5.86 vs 5.79" standing out puzzles everyone (6 of 6).
- **Trends, All changes.** Ease 3.0 (the lowest), and only 3 of 6 knew that a row opens its chart; "Median story or
  share" puzzles 4 of 6; the row they need for story length is called "Word count".
- **Trends, one characteristic.** Every answer right, ease 3.7; the key's marks look like form controls (3 of 3 on
  phones), and "Length options don't apply to word count" reads as a developer's note (6 of 6).
- **How it works.** Clear and well organized; on a phone it is reachable only from the footer, its bar says
  "Contents" twice, and returning to Explore by the footer is 9,870 px of scrolling.

### The three biggest problems

1. **The comparison rows carry two kinds of number and explain them late** (One genre and Trends' All changes). The
   dot's "26 out of 100" is explained after the first list on One genre and in a different wording from Trends';
   nothing says a Trends row opens its chart over time (3 of 6 found it). The W1 mock-up, which only moves and
   words the notes, raised Trends' "what would you tap" from 3 of 6 to 6 of 6 and its ease from 3.0 to 3.8
   (F100, concept W).
2. **One idea has two names, and some sentences don't read.** "Story length in words" in every question is "Word
   count" in the question bar, the notes, Trends' list, Trends' axis, the PNG and the glossary (F98); "In All genres"
   on Explore and Patterns is "across all genres" on Trends; and the reading-list titles are ungrammatical on 1,146
   charts (F97).
3. **"Where am I, and what is this?"** On a phone the masthead hides the page you are on (Explore) and How it works.
   Only the Explore page says the stories are Literotica's; on Patterns, One genre and Trends' two views 17 of 24
   stand-ins noted that only the footer says so. The Genres kicker repeats the question under it (6 of 6). Naming the page and the source in
   every kicker settled the first in the mock-up (0 of 12 asked) and nearly the second (1 of 6 noticed a doubled
   "genres", which is easy to drop; F102, concept U).

### What works, and should be left alone

- **The question sentence and its blue words.** "What would you tap" was answered right by 6 of 6 on Explore (genre,
  measure), Patterns, Genres ("By median") and Trends' one characteristic. Keep it exactly as it is.
- **The takeaway box under each heading.** Question 1 ("what is the answer") was answered right by 6 of 6 on all
  eight views.
- **The Genres page**, its A–Z order, the ▲▼≠ column and "By median" on request (ease 4.0; nobody misread it).
- **The look.** All 108 stand-ins who rated a single page rated it 4 of 5 (in the One genre review every stand-in said
  3). Restrained,
  one accent, one serif weight. Concept X tidies its tokens; it doesn't need a new look.
- **Performance and stability**: the first load, the per-page visits, layout shift and "no Loading flash" all hold
  their claims (section 4). On slow 4G with a 4× slower CPU the first chart is drawn at 1.9 s and a genre change takes
  0.09 s.
- **Accessibility as machines see it**: 100 axe runs clean, including 200% and 400% zoom; every chart row has a
  complete name; Back restores an open topic and its scroll.
- **Honesty.** No stand-in read a pattern as a cause from the page's words; three asked whether "tends higher"
  means "causes", which is the reader thinking, not the page claiming. Nothing here argues for a reminder, and
  none is proposed.

---

## 2. Fresh eyes

**Method.** Eight views, each shown to six stand-ins (three phone, three desktop): the first screen; Explore's chart;
Patterns; Genres (one characteristic); One genre (Romance); Trends' All changes; Trends' word count; How it works.
The questions and their right answers were written before any screenshot was taken
(`fresh-eyes/questions/views.md`); every view ends with the same four (ease 1–5, look 1–5 in three words, what
confused you, what looks cluttered or unfinished). The same questions were then asked about ten mock-up × view pairs
(60 stand-ins) and a side-by-side test of concept X (6). Scoring: 1 right, ½ right with "I assume" or partly right,
0 wrong or "I don't know".

### Today's site (48 stand-ins)

| View | Q1 (the answer) | Q2 | Q3 | Q4 (what to tap) | Ease (mean; phone · desktop) |
|---|---|---|---|---|---|
| V1 First screen | 6/6 what the site does | 5.8/6 which page for change over time, genres, popularity ("Explore or Patterns?") | 6/6 the question and its blue words | 6/6 "All genres" | 3.5 (4,3,3 · 3,4,4) |
| V2 Explore's chart | 6/6 | 6/6 "4.42" is the group's median rating; **6/6 unsure it is out of 5** | 5/6 the marks; **0/6 know the bar** | 6/6 "average rating" | 3.8 |
| V3 Patterns | 6/6 | 6/6 "19 of 27 clear" | 6/6 ↗ | 6/6 "average rating" | 4.0 |
| V4 Genres | 6/6 | 6/6 "1,500" and ▼ | 6/6 Group Sex not marked | 6/6 "By median" | 4.0 |
| V5 One genre | 6/6 | 6/6 "26, 7.8, 19.3" (0/6 named the medians with confidence) | 6/6 "0 of 18" | 6/6 the row (from "Tap a row …") | 3.2 |
| V6 Trends, All changes | 6/6 | 6/6 the two windows (4/6 ask where 2010–2019 went) | 6/6 "51.6 → 38.8 (−25%)" and "34" | **3/6**: all six guess | **3.0** |
| V7 Trends, word count | 6/6 | 6/6 "3,260" and "1,522" | 6/6 gray = not compared (5/6 ask why) | 6/6 "all genres" | 3.7 |
| V8 How it works | 6/6 | 6/6 300 a genre, October 1–8 | 6/6 one snapshot | 4.5/6 "Changes over time" (phones 1.5/3) | 4.0 |

Look: 48 of 48 said 4 of 5. Their three words: clean 48, calm 46, bookish 25, editorial 11, magazine-like 4,
newspaper-like 4, tidy 3, muted 2, orderly 1.

**What tripped them, counted** (the full list is in `fresh-eyes/base/scores.md`):

| Stumble | Count |
|---|---|
| "Interquartile range" not known | 30 of 30 where it is on screen (V1, V2, V4, V7, V8) |
| "Median" of an "average rating": two averages? | 18 of 18 (V1–V3) |
| The rating's scale (out of 5?) not stated | 11 of 12 (V1, V2) |
| The label "4.19" sits on the dashed line | 12 of 12 (V1, V2) |
| The view switch unclear ("One characteristic · One genre", "All changes · One characteristic") | 18 of 18 (V4, V5, V7) |
| What the stories are (Literotica) is only in the footer | 17 of 24 on Patterns, One genre and Trends' two views (1 of 6 on Genres' one characteristic); on How it works, 4 of 6 said its first screen doesn't say |
| On desktops, the question's last word alone on a line ("words ⌄?", "Romance ⌄?") | 11 of 24 desktop |
| On desktops, the right third empty, the layout lopsided | 14 of 15 desktop (V1–V4, V8) |
| "Download PNG" techy, orphaned or out of place | 18 of 36 |
| One genre: the note speaks of gray dots; none are on screen | 6 of 6 |
| Genres: Mind Control (4,640) unmarked while Anal (2,580) gets ▼ | 6 of 6 |
| One genre: "Everyday vocabulary 5.86 vs 5.79" stands out; "Zipf scale" | 6 of 6 |
| Trends: "Median story or share" over "Average paragraph length" | 4 of 6 |
| Trends: what "Touch words", "Build-up of sexual language", "Pages on site" measure | 6 of 6 |
| Trends' key: its marks look like a radio button and an empty checkbox | 3 of 3 phones |
| Trends: "Length options don't apply to word count" reads as a developer's note | 6 of 6 |
| How it works on a phone: "How it works › Contents" with "Contents" again beside it | 3 of 3 phones |

**In their words:**
- Explore: "Nothing visible says 'out of 5' or 'stars'." "Pale blue bar: the legend calls it 'Interquartile range'. I
  don't know what that means. I'd guess it shows where most stories in the group fall, but that is a guess."
- Genres: "Why are some genres marked and others not? Mind Control (4,640), Sci-Fi & Fantasy (4,420), Romance
  (4,390) and Group Sex (4,240) are all well above [3,610] …"
- One genre: "The note mentions 'gray dots, in the topics below', but no gray dots are visible because the topics are
  closed."
- Trends' All changes, asked how to see paragraph length period by period: "I don't know. Nothing on the page says
  'over time' or 'by period'. The two things that might do it are the small '›' arrow … and the 'One characteristic'
  button." (All six hedged between the row's › and the switch; none was sure.)
- Trends' word count: "The legend icons (filled blue circle, gray pill) look like radio buttons or toggles, so I
  wasn't sure if I was supposed to tap them."

### The mock-ups (66 stand-ins)

The mock-ups and their scores are in section 8; the counts are in `fresh-eyes/mock/scores.md` and
`fresh-eyes/x/scores.md`. In short:

| Mock-up | View | What changed in the answers | Ease, today → mock-up |
|---|---|---|---|
| L1 (Explore says what its numbers are) | V2 | the bar 0/6 → **6/6**; unsure of the scale 6/6 → **0/6**; the label on the line 12/12 → 1/6 | 3.8 → 4.0 |
| L2 (L1, and "star rating") | V2 | as L1; "two averages?" unchanged (6/6) | 3.8 → 4.0 |
| U1 (where am I) | V1, V4, V7 | phones name the page they are on 3/3 (today: none shown); Literotica asked about 0/12 (V4, V7); the developer's note 6/6 → **0/6** | V1 3.5 → 3.8; V7 3.7 → 4.0 |
| U2 (U1, relabeled switch, the rule spelled out) | V4, V7 | the switch still unclear 12/12; the rule sentence "hard to follow" 6/6 | V4 4.0 → **3.5** |
| W1 (one grammar for the comparisons) | V5, V6 | gray dots 6/6 → **0/6**; Trends "what to tap" 3/6 → **6/6**; "Later" misread 6/6 → 2/6 | V6 3.0 → **3.8**; V5 3.2 → 3.0 |
| W2 (W1, values first on One genre) | V5 | 6/6 call 7.8 and 19.3 medians (today 0/6 with confidence) | 3.2 → 3.2 |
| X1 + X2 (one visual system) | six first screens side by side | more like one site: 6/6; more polished: 5/6; look 3.0 → 4.0 on desktops | — |

Ease scores move by up to 0.3 between two runs of identical screens (V1's desktop screens are the same in U1 and
today: 3.7 then 4.0), so only the moves of half a point, and the stumbles that disappear, count.

---

## 3. The tasks, walked

Each task was done on a phone (375 × 667) and a desktop (1440 × 900) by a script that counts actions (a tap or click
is 1, a native select 2, typing a word 1) and scrolling, with a screenshot after every step (`tools/walk.mjs`,
[b15](design-review-4/b15-tasks.png)). The confusions are the stand-ins' and mine, marked as such.

| Task | Phone | Desktop | What happened |
|---|---|---|---|
| 1. First visit, two minutes | Genres, Trends, Patterns: 1 tap each. How it works: the footer only (616 px down from Patterns); back to Explore from How it works by the footer: 9,870 px | 1 click each | Within five seconds the kicker and question say what the site is (V1 Q1 6/6). On a phone the masthead shows no "Explore", so nothing says which page this is (3/3); "Explore" and "Patterns" sound alike (4/6 hedged) |
| 2a. What sets Romance apart? | Genres, One genre: 2 actions walked (it opens on Erotic Couplings); Romance from the genre select makes 4 (2 if Romance was chosen on Explore) | the same | A fresh visit's One genre opens on Erotic Couplings, so the genre select is needed. The answer is right there (V5 Q1 6/6) |
| 2b. Present tense and ratings in Romance | 5 actions (genre 2, the picker 1, "present" 1, the result 1); round 2 counted 4 with the Popular chip | 5 | The honest answer: "Too few stories to judge a pattern" (28 present-tense Romance stories), with both groups still drawn and counted |
| 2c. Has Romance changed? | Trends 1, then Romance 2: 3 actions | 3 | Trends opens on all genres even after Romance was chosen elsewhere (D9, by decision) |
| 3. Do genres differ in length? More dialogue? | Genres 1 (story length is the default); dialogue: picker 1, "dialogue" 1, the result 1: 4 actions | 4 | A–Z by default, ▲ "More dialogue: Novels and Novellas", ▼ five genres; nothing ranks the genres |
| 4. Did stories get longer? Within a genre? | Trends 1 (the takeaway says so); the row: 1,261 px down (1.9 screens), named "Word count"; Romance 2: 4 actions | 4 (755 px of scrolling) | The answer is on the first screen. The row needed for "story length" is called "Word count" (F98), and only 3 of 6 stand-ins knew a row opens its chart (F100) |
| 5. A sceptic | "Why no clear pattern?" (Explore), "how this is decided" (Genres, Trends' one characteristic): 1 action each to the right section of How it works | the same | Trends' All changes has no link to its rule (by decision, the note has none); the rule is two taps away through How it works. Sample sizes are on every chart |
| 6. Keyboard and screen reader | 9–12 tab stops from the top to the first answer (How it works: its section bar comes first) | 11–14 (How it works: 8) | The focus ring is visible on every kind of control ([b16](design-review-4/b16-error-focus.png)). Each page has one h1 and its answer as an h2; every chart row is named in full ("Under 2,000: median 4.19, interquartile range …"; Trends' rows say "63 in 100; 2000–2009 2,810, 2020 or later 4,100 words (+46%); clearly rose. Opens its chart") |
| 7. Fifteen minutes, all pages | — | — | Back after a row restores the open topic and the scroll (One genre: 2,070 px). Back after a view switch returns to the top, not to where the reader was (Genres: 400 → 0). Controls replace the address, so after a few changes on Explore, Back leaves Explore (as designed; it keeps the history short) |
| 8. Sharing a finding | Every address opens the same view (3 of 3 tried) | — | The PNG holds the title, key, chart and credit but not where the data come from: a friend can't tell these are Literotica stories (F111, [b11](design-review-4/b11-pngs.png)) |
| 9. A slow phone | See below | — | Fast enough everywhere; topics with many rows are the slowest thing on the site |

**Task 9 in numbers** (375 px, `tools/slowphone.mjs`; times from the action to the next frame with the new content):

| | Fast 4G | Slow 4G, 4× CPU | 3G, 4× CPU | Round 2 (slow 4G) |
|---|---|---|---|---|
| First chart drawn | 0.51 s (LCP 0.32 s) | **1.89 s** (LCP 1.21 s) | 4.92 s (LCP 3.31 s) | 2.00 s |
| Page switch: Genres (chunk and 51.7 KiB file) | 0.41 s | 0.85 s | 2.22 s | — |
| Page switch: Trends | 0.41 s | 0.65 s | 1.29 s | — |
| The picker opens | 0.07 s | 0.18 s | 0.21 s | — |
| Search "tense": matches shown | 0.43 s after the first key (5 keys at 60 ms) | 0.90 s | 0.96 s | — |
| A result picked, the new chart drawn | 0.06 s | 0.15 s | 0.45 s | — |
| A genre change on Explore | 0.02 s | 0.09 s | 0.07 s | — |
| A topic opens (One genre, Trends; 4× CPU) | — | 67–119 ms; **Word choice & style (62 rows): 203–233 ms** | — | One genre review: 66–79 ms |

No "Loading…" flash on any switch, and no layout shift above 0.021 (section 4).

---

## 4. The latest claims, checked

| Claim (source) | Measured here | Verdict |
|---|---|---|
| First load 150.0 KiB of gzip bodies in 6 requests (Trends review) | **149.9 KiB in 6** (index 0.6, CSS 6.4, font 21.0, JS 84.8, meta 19.7, the first chart 17.4); 4.9 KiB fetched while idle | confirmed |
| A visit starting on One genre: 208.9 KiB | 208.9 KiB in 9 requests | confirmed |
| … on Trends: 175.2 KiB | 175.3 KiB in 9 | confirmed |
| … on How it works: 141.3 KiB | 141.4 KiB in 7 | confirmed |
| Layout shift 0.000 on a Trends visit, worst 0.021 | 0.000 on every visit and switch; worst 0.021 (1440, word count, Romance), 20 runs | confirmed |
| No "Loading…" flash | 0 frames in all 20 runs | confirmed |
| axe: no violations in 63 runs | the Trends review's script (`axetrends2.mjs`), 42 runs here: none; **100 new runs** (25 states of every page, 375 · 1440 · 200% · 400%): none | confirmed, and wider |
| Label in name: no failures | 12 runs, none | confirmed |
| Glyph overlaps, site font: none | Trends' View 1: 21,510 charts, 0; View 2: 620 pages, 49,650 rows, 0; Explore: 11,220 charts, 0 | confirmed |
| Glyph overlaps, wide font: 13 Trends charts at 320 px in Verdana | **7 problems in 5 charts at 320 px in DejaVu Sans** (6 "pace of dialogue shift" labels on each other in 4 charts; one "−0.067" past a chart's edge); View 2: 0 | different (another wide font; the same kind of overlap, still only at 320 px) |
| Explore's labels in a wide font: only "All stories shown: …" starting 1–3 px left of the chart | 504 charts, all of that kind (a group label or "All stories shown" at x = −1) | confirmed |
| Line breaks: no "·" at a line's start or end, no value broken (Trends) | 980 states, 1,400 "·", 69,510 values: 0 problems, both fonts | confirmed |
| Forced colors: system colors on the charts | six pages legible, every mark drawn ([b12](design-review-4/b12-forced.png)) | confirmed |
| The fold at 1280 × 720: the plot 230 px, the table above 720 | plot 230 px, table bottom at 700 px | confirmed |
| Tests 509 (Vitest), 218 (pytest); the build passes | 509 in 36 files; 218; built in 1.4 s | confirmed |
| **Still open:** no real phone, Safari, VoiceOver, TalkBack or NVDA | Not possible in a Linux container. Chrome's own accessibility tree was read instead (`tools/axname.mjs`, `axname.txt`, `outline.txt`): one h1 per page, the answer an h2, every chart row named in full. Needed from you: an iPhone with Safari's "Remote Automation" on, or screenshots | still open |
| Build-up percents: 15 of 4,015 rows reach 1,000% or more, up to +149,028% | 15 rows of 9,837 checked (every genre and option, topics open), up to "0.0034 → 5.1 (+149,028%)" | confirmed |
| 5 of 6 didn't know "interquartile range"; why Trends compares only the ends is explained only in How it works | 30 of 30 didn't know it; 4 of 6 (V6) and 5 of 6 (V7) asked why only the ends | confirmed (worse) |
| "Blurb", the nine definitions and the one-sentence Trends note haven't met fresh eyes | The note: 6 of 6 read "34" right, but only 3 of 6 knew a row opens its chart. "Blurb length" unexplained to 4 of 6; the definitions (V7's "Number of words in the story text …") read right by 6 of 6 | now tested: the note works for the dot, not for the rows |
| One genre: "23% vs 17%" against "5.86 vs 5.79", "medians", "Zipf scale", uneven decimals | 6 of 6 on "5.86 vs 5.79" and "Zipf"; 6 of 6 on the decimals; 0 of 6 named the medians with confidence | confirmed |
| "Is the higher one" (One genre) where Trends says "comes out higher" | both still on screen; the census found no third wording | confirmed |
| Verdana-only overlaps in 13 Trends charts at 320 px | see above: 7 in DejaVu Sans | different |
| One-word last lines, and a "?" alone on its line | the question's last word alone on desktops: 30 of 54 desktop stand-ins mention it (today and mock-ups) | confirmed |
| The middle periods' hatching #d9d4ca, 1.41:1 | unchanged, 1.41:1 | confirmed |
| The named groups' palette; a group's color changing with the genre | The colors are fixed per group: First person is blue and Second person orange in Romance and in How To. The swatch beside the name is the group the row reports. The light fills are 1.1–2.6:1 against the page (white seams and printed shares carry them) | the color change: **wrong**; the palette's contrast: confirmed |
| A 2.4:1 outline among the Genres page's leftovers | #a5a29a, 2.44:1, unchanged | confirmed |
| Named-group rows show no verdict | still none on One genre and Trends' lists | confirmed |
| The view switches open the other view at the top | yes; and Back from it returns to the top too | confirmed |
| 0.04–0.08 layout shift after scripted changes; the keyboard-opened popover | On Trends, every change ≤ 0.021. Explore's scripted changes were not re-measured | partly re-measured |
| At 320 × 568 Explore's first chart row ends at 698 px | 698 px | confirmed |
| The question's words are 34–35 px tap targets | 33–35 px tall on phones; every word owns its own box | confirmed (33 px is new: "average rating") |
| A topic takes 66–79 ms to open at 4× CPU | 67–119 ms, and 203–233 ms for Word choice & style (62 rows) | different (slower in the container; the big topic is over 200 ms) |
| For you to decide: a grouping line for yes/no charts, dark mode, median age still in the data | Median age is still in every `v/` file's groups (e.g. 12.2 years for "Under 2,000") and never shown | still open (O17, O18) |

---

## 5. The whole site, measured

### Visual system inventory

From computed styles on 32 states (16 views × 375 and 1440, `tools/inventory.mjs`; `measurements/inventory.txt`):

| | Count | Near-duplicates |
|---|---|---|
| Font sizes in the page | **22**: 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 17, 18, 19, 20, 21, 23, 25, 26, 28, 32, 37, 38, 44 | the half sizes beside each whole size (12.5/13, 13.5/14, 14.5/15, 15.5/16); 19/20/21; 25/26; 37/38 |
| Font sizes in charts | 5: 11.5, 12, 12.5, 13, 14 | 11.5 is only the "40–60: no clear difference" and "40–60: no clear change" labels (the site's smallest text, at every width) |
| Text styles (family, size, weight, line height) | **66** site-wide; 16 (Patterns) to 32 (One genre) per page | weights 400, 600, 650 and 700 in sans |
| Size and line-height pairs | 45 | 12.5 px alone has four line heights |
| Page headings (serif 600) | Explore and Genres 23–37 px; Patterns 28–38 px with a 21–28 px question under it; How it works 32–44 px | three heading scales for one role |
| Text colors | 4 inks (#1c1c22, #45454f, #6b6b75, accent #2b63c6), white on blue, warm #a9531d (Patterns' ↘), and the age box's #5b3a1e and #7a3f12 | none |
| Grays for marks and borders | #8f8a80 (controls), #857f75 (gray dots), #a5a29a, #d2cec5, #e7e4dd | #857f75 and #8f8a80 (3.8:1 and 3.3:1) do the same job |
| Radii | 999 px (pills), 6 px (boxes, inputs), 5 px (the key's capsule), 2 px (swatches) | 5 and 6 |
| Shadows | none | — |
| The median's dot | r 7 (Explore), r 6 (Genres, Trends), r 5 (One genre, All changes), r 3.5 (gray) | three sizes for one mark |
| The interquartile bar | 12 px (Explore), 10 px (Genres), 8 px (Genres' "with any") | three heights |
| Vertical gaps between blocks | 22 values, 4–540 px | most at 10 px (How it works) and 16 px |

The look is coherent to the eye (every stand-in who rated one page said 4 of 5, in the same words) but not in its tokens: each page was
built with its own sizes. That costs nothing a visitor names, and it makes every future page harder to get right.
Concept X proposes one scale.

### Words: the census

Every string a visitor can read in those 32 states, 1,195 distinct blocks (`tools/census.mjs`;
`measurements/census.txt`):

- **One idea, two names.**
  - "story length in words" (every question, the picker, Genres, Trends' one characteristic) and "Word count" (the
    question bar, "What 'Word count' measures", Trends' All changes row, Trends' axis title, the PNG, the glossary).
  - "story age" (sentences) and "Years online" (lists).
  - "In All genres" (Explore, Patterns) and "across all genres" (Trends).
  - The dot's score: "is the higher one" (One genre) and "comes out higher than" (Trends).
  - "n = 2,631" (Explore on phones) and "2,631 stories" (everywhere else).
  - "stand out" (One genre), "set apart" (its heading), "clearly differ" (Genres) and "clearly changed" (Trends):
    three verbs for one rule family. Each follows its own rule and reads naturally; leave them.
- **One name, two things.** None found.
- **Jargon a newcomer meets**, with the stand-ins' counts: interquartile range (30/30), median of an average (18/18),
  "in 100" (12/12 needed the note), Zipf scale (6/6), "Median story or share" (4/6), "with any", and row
  names without a definition on screen (Touch words, Build-up of sexual language, Pages on site: 6/6).
- **Arrows.** "→" on links that leave the page or change the view; "›" on rows that open a chart. Consistent.

### Real tap areas on phones

1,295 controls sampled with `elementFromPoint` every 2 px on 15 states at 320 and 375 px (`tools/taps.mjs`):

- **Under the site's 44 px bar**: the question's words, 33–35 px tall on every page (known); Patterns' two selects,
  32 px; **Patterns' characteristic rows, 36 px** (19 rows open at once). All pass WCAG 2.5.8 (24 px). (Genres'
  "A–Z / By median" is drawn 36 px tall but answers taps over 44 px.)
- **Overlaps**: no control steals a large share of another's box. At the edges a neighbor answers in 3–11% of a box
  (Trends' rows, the two halves of a switch, the question's measure slot next to the characteristic), and a
  characteristic that wraps onto two lines keeps 38–51% of its bounding box (the rest is the other words on those
  lines). The brand and "Skip to content" share a box only while the skip link is focused.

### Wayfinding

Every page reaches every other through the masthead on a desktop. On a phone the masthead drops How it works below
602 px and Explore below 414 px, so How it works is reached only through the footer or a link in the text, and
Explore through the site's name. The cross-links, page by page:

| From | To | Called |
|---|---|---|
| Explore | Patterns, Genres, Trends | "Every clear pattern with the average rating across all genres →", "How do genres differ in story length in words? →", "How has story length in words changed over time? →" (Keep exploring) |
| Explore | How it works | "8,987 stories", "strong", "Why no clear pattern?" |
| Genres (one characteristic) | Explore | "Open in Explore →" |
| One genre | Genres (one characteristic) | each row (›) |
| Trends, All changes | Trends, one characteristic | each row (›) |
| Trends, one characteristic | Trends, All changes; Genres | "See all changes →", "Compare genres →" |
| Patterns | Explore | each characteristic's name |
| Genres, Trends | How it works | "how this is decided" |

Three styles of link name: a question ("How has … changed over time? →"), an instruction ("Open in Explore →",
"Compare genres →") and a bare row. All work; idea I15 makes them one pattern.

### A screen reader, approximated

The Chrome accessibility tree (`tools/axname.mjs`, `tools/outline.mjs`): each page has one h1, the answer as the h2,
landmarks for the header, main, the page's section and the footer, and complete names on every chart row and list
row. Two inconsistencies: on Explore and Genres the h1 is the kicker (on Explore that is the site's headline, by
decision; on Genres it is "How do the genres' stories differ? · about 9,000 stories · 30 genres"), while on Trends
the h1 is the question, by decision; and Chrome passes the kickers' CSS uppercase to the tree as uppercase text
("WHAT DO POPULAR …", `axname.txt`; Playwright's own snapshot shows them in mixed case).

---

## 6. Findings

Ordered by the bar for this round: misreading first, then friction, then consistency, then polish. "(Needs your
approval)" marks a change of wording or meaning; "(revisits a decision)" names the decision it challenges.

### F97. 1,146 chart titles are ungrammatical: "tend to are added to more reading lists"

- **Evidence.** `#/explore?metric=pop_reading_lists_per_1k_views&var=story_words` at any width:
  "Longer stories tend to are added to more reading lists per 1,000 views"
  ([b13](design-review-4/b13-reading-lists.png)). The title is built as "{subject} tend to {metric.more}", and the
  reading-list measure's `more` and `less` in `litcorr/stage2/wording.py` (lines 30–31) start with "are". It reads
  wrong on every chart with a clear reading-list pattern: 64 charts with All genres chosen, and 1,146 counting each
  genre's charts as well, with all stories included (`patterns.json`; `measurements/readinglists.txt`); the "Only
  include" options add more.
- **Why it matters.** It is the chart's answer, set in the largest type on the page; it makes the site look broken.
  Goal: easy to understand.
- **Fix.** `"more": "get added to more reading lists per 1,000 views"`, `"less": "get added to fewer reading lists
  per 1,000 views"`, then `python -m litcorr site-data`. Add a test that every measure's `more` and `less` follow
  "tend to" as a base verb (no "are", "is", "has"). (Needs your approval: `wording.py` and a data rebuild.)
- **Impact** high. **Effort** small.

### F98. One idea, two names: "story length in words" is also "Word count"

- **Evidence.** The question says "story length in words"; the phone's question bar, "What 'Word count' measures",
  Trends' row and axis title, the PNG and the glossary say "Word count" ([b14](design-review-4/b14-names.png)). All
  three phone stand-ins on Explore asked whether the two are the same. In task 4 the row a reader looks for, story
  length, is the sixth row of Trends' "Rose" list, called "Word count". "Years online" and "story age" are the same
  split. Separately, "In All genres, how does …" (Explore, Patterns: a capital mid-sentence) against "across all
  genres" (Trends) was noticed by 4 of 6 in the side-by-side test.
- **Why it matters.** "One idea has one name everywhere" is the first goal's test. Goal: easy to understand.
- **Fix.** Label the characteristic "Story length in words" and "Story age (years online)" in `wording.py` (the
  `label` fields; the nouns stay); the question bar becomes "Story length in words · Average rating · All genres"
  (keep it short on phones: the L1 mock-up showed that a longer bar is cut off, 3 of 3). Show the genre option as
  "all genres" inside Explore's and Patterns' sentences, as Trends does. (Needs your approval: labels.)
- **Impact** high. **Effort** small.

### F99. Explore doesn't say what its marks and scale are

- **Evidence.** V2: 0 of 6 knew what the pale bar is; 6 of 6 weren't sure the rating is out of 5; 12 of 12 (V1, V2)
  saw "4.19" sitting on the dashed line; on phones "n = 2,631" puzzled 3 of 3. With L1 (the key glosses the marks,
  the axis gives its scale, the label clears the line, "2,631 stories"): the bar 6 of 6, the scale 0 of 6 unsure,
  the label 1 of 6, ease 3.8 → 4.0 ([m01](design-review-4/m01-L-explore.png)).
- **Why it matters.** The interquartile range is the chart's "sense of the spread" the brief asks for; unread, the
  chart shows only medians. Goal: easy to understand.
- **Fix.** Concept L1 (section 8). (Revisits a decision: P3:99–102, "median" and "interquartile range" used without
  explanation; the term stays, as O1 decided, and gains a five-word gloss. Also DR2:1150, the axis titled just
  "Average rating".) (Needs your approval.)
- **Impact** high. **Effort** small.

### F100. The comparison rows explain their dot late, in two dialects, and don't say what a row opens

- **Evidence.**
  - Trends' All changes, "what would you tap to see paragraph length period by period": 3 of 6 (all six hedged
    between the row's › and the switch; none was sure); ease 3.0, the site's lowest.
  - One genre: the note talks about gray dots while the topics are closed (6 of 6), and sits after the first list
    (5 of 6 met the dot before its explanation); "Higher: where the first sex scene starts" (6 of 6).
  - One genre's axis says "is the higher one"; Trends' says "comes out higher than".
  - With W1 (each note above the first list, in Trends' words, ending with what a tap does; "▲ Later"; the same
    decimals in a row): gray dots 0 of 6 (0 of 12 with W2), Trends' "what to tap" **6 of 6**, Trends' ease **3.8**, "Later" misread
    2 of 6 ([m03](design-review-4/m03-W-comparisons.png)).
- **Why it matters.** These two views carry most of the site's findings, and they are where readers work hardest.
  Goals: easy to understand, user friendly.
- **Fix.** Concept W1 (section 8). (Revisits a decision: Trends review 10.1, the note "exactly … with no link and no
  final period"; W1 adds a second sentence, "Tap a row for its chart over time.") (Needs your approval.)
- **Impact** high. **Effort** small.

### F101. Trends: why only the ends, and where 2010–2019 went

- **Evidence.** V6: 4 of 6 asked where 2010–2019 went (5 of 6 in the W1 run, three of whom noticed that 2,561 +
  3,346 is not "about 9,000"). V7: 5 of 6 asked why the middle periods aren't compared (12 of 12 in the U runs); 4 of 6 couldn't find "median 2,810" in either 2000s
  column. "Median story or share" over "Average paragraph length": 4 of 6 today, 6 of 6 in the W1 run.
- **Why it matters.** A reader who thinks a decade of stories was dropped starts to doubt the comparison. Goal: easy
  to understand.
- **Fix.** (Needs your approval: copy.)
  - Under All changes' heading: "2,561 stories from 2000–2009 and 3,346 from 2020 or later across all genres; the
    3,089 from 2010–2019 are shown on each characteristic's chart."
  - The brackets on the one-characteristic chart: "2000–2009 together · median 2,810".
  - The column head: "Median, or share of stories" in place of "Median story or share".
- **Impact** medium. **Effort** small.

### F102. Where am I, and what are these stories?

- **Evidence.** On a phone below 414 px the masthead hides "Explore", so the first page names no page (3 of 3).
  Only Explore's kicker names Literotica; on Patterns, One genre and Trends' two views 17 of 24 noted
  that only the footer says so. Genres' kicker
  repeats its question (6 of 6). U1 (phones keep the page being read in the masthead; each kicker names its page and
  the source) took those to 3 of 3 naming the page, 0 of 12 asking about the source, 1 of 6 (the doubled "genres")
  ([m02](design-review-4/m02-U-masthead-kicker.png)).
- **Why it matters.** Wayfinding, and the context that makes "less sexual language in Romance" make sense. Goals: easy
  to understand, user friendly.
- **Fix.** Concept U1 (section 8): on phones the masthead keeps the current page and drops the one after it; the
  kickers read "Genres · about 9,000 Literotica stories · 30 genres", "Trends · about 9,000 Literotica stories ·
  2000–2026", "Patterns · …" (Explore's headline stays). On Genres, make the question the h1 and the kicker a `p`, as
  on Trends. (Needs your approval: the kickers' words.)
- **Impact** high. **Effort** small.

### F103. Trends' word count: "Length options don't apply to word count"

- **Evidence.** V7, 6 of 6: it reads as a leftover developer's note, and "Only include" is the only one on the site
  that isn't a menu. U1 (a menu like every other, its Length options turned off inside it, as Explore does): 0 of 6
  (and 0 of 6 in U2).
- **Fix.** Render `IncludeSelect` with the Length options disabled and Explore's sentence under it ("Options that
  would leave only one group … are turned off"), instead of plain text.
- **Impact** medium. **Effort** small.

### F104. Trends' key looks like a form

- **Evidence.** V7: 3 of 3 phones took the blue dot for a radio button and the bracket for an empty checkbox; in the
  U1 and U2 runs 6 of 6 phones said so again and 6 of 6 desktops called the marks "tiny" and "misaligned"
  ([b08](design-review-4/b08-trend1.png)).
- **Fix.** Draw each key mark as the chart draws it: a 10 × 18 px capsule with its dot (blue, then gray, without the
  outline that makes it look like a pill button), and the bracket as a 16 px line with 4 px ticks, each aligned to
  the first line of its text (`align-items: start`, 2 px down).
- **Impact** medium. **Effort** small.

### F105. Why is a genre marked when a bigger-looking one isn't?

- **Evidence.** V4: 6 of 6 asked why Anal (2,580, about 1,000 below 3,610) gets ▼ and Mind Control (4,640, about
  1,000 above) doesn't. Two sentences in the key were tried: "comparing every story, not only the medians" (U1: 6 of
  6 still asked; 4 of 6 said the sentence went over their heads) and the rule in full, "against a story from all
  genres, the genre's story is the higher one at least 60 times in 100" (U2: 6 of 6 asked; 6 of 6 called the
  sentence hard; ease fell from 4.0 to 3.5). One genre's "Everyday vocabulary 5.86 vs 5.79" standing out is the same
  puzzle seen from the other side (6 of 6, three runs).
- **Why it matters.** The marks are the page's answer; a reader who can't see why one genre is marked suspects the
  marks. Goal: easy to understand.
- **Fix.** No sentence fixed it, so this goes to you as a question (O13): show each genre's "in 100" score, the
  number the mark comes from, in its details (one line: "A How To story is the longer one 21 times in 100"), or
  leave it. Untested.
- **Impact** medium. **Effort** medium.

### F106. One genre's units and words

- **Evidence.** Units are on their own line in most rows, in the name in "Sex scenes per 10,000 words", and missing
  in "Sentences with sexual language" and "Words before first explicit term" (5 of 6 today; 5 and 6 of 6 in the W
  runs). "Zipf scale (higher = more common)": 6 of 6 didn't know it. Decimals within a row differ ("10 vs 3.79",
  "5.9 vs 2.96"): 6 of 6.
- **Fix.** Every row gets a unit line ("words", "% of sentences", "per 10,000 words"); "Zipf scale (higher = more
  common)" becomes "word commonness, 1–7 (higher = more common)" (needs your approval); both values in a row take
  the same decimals (W1 does this).
- **Impact** medium. **Effort** small.

### F107. On desktops the question's last word is left alone on a line

- **Evidence.** "story length in / words ⌄?", "What stands out about stories in / Romance ⌄?": 11 of 24 desktop
  stand-ins today, 19 of 30 in the mock-up runs. The question is capped at 34 characters at 37 px. With X2 (balanced
  lines, up to 44 characters from 760 px): 3 of 3 desktops noticed and preferred it. On phones today's wrapping splits
  the blue phrase ("vary with story" / "length in words"); with balanced lines it stays whole, and the phone stand-ins
  named that as a difference in X's favor (2 of 3)
  ([m04](design-review-4/m04-X-desktop.png), [m05](design-review-4/m05-X-phone.png)).
- **Fix.** `.sentence { text-wrap: balance; }` at every width, and `@media (min-width: 760px) { .sentence { max-width:
  44ch; } }`.
- **Impact** medium. **Effort** small.

### F108. Patterns is built differently from every other page

- **Evidence.** It has no kicker, an h1 "Patterns" over a smaller question (21–28 px against 23–37 px elsewhere), and
  its count line isn't in the takeaway box. 6 of 6 in the side-by-side test named Patterns' header as the odd one
  out. "Explore" and "Patterns" sound alike: 4 of 6 hedged on V1, and 3 of 3 desktops again in the U1 run.
- **Fix.** X2: the kicker "Patterns · about 9,000 Literotica stories · 30 genres", the question at the page size as
  the h1, the count line in the takeaway's blue-ruled box. (O19 asks about the page's name.)
- **Impact** medium. **Effort** small.

### F109. How it works on a phone

- **Evidence.** The masthead drops How it works below 602 px, so on a phone it is reached from the footer (616 px
  down from Patterns), and back to Explore through the footer is 9,870 px. At the top of the page its bar reads "How
  it works › Contents" with "Contents" again as the button (3 of 3); 1.5 of 3 phones found "Changes over time".
- **Fix.** At the top, the bar shows "How it works" and a "Contents ▾" button; once a section is reached,
  "How it works › Where the stories come from". (The masthead keeps five pages and no menu, by decision.)
- **Impact** medium. **Effort** small.

### F110. Taps under 44 px on Patterns

- **Evidence.** Patterns' characteristic rows are 36 px tall and its two selects 32 px at 320 and 375 px; the
  question's words are 33–35 px on every page (known).
- **Fix.** `.pattern-row a { min-height: 44px }` (+8 px a row; a 19-row topic grows by 152 px); give Patterns'
  selects the enlarged transparent hit area the question's selects use elsewhere.
- **Impact** medium. **Effort** small.

### F111. A downloaded image doesn't say where its data come from

- **Evidence.** Task 8. Each PNG has the title, key, chart and "Chart by Nathan Nguyen, @NathanDNguyen", but not
  "Literotica" or the sample ([b11](design-review-4/b11-pngs.png)). A friend sees a chart about "stories".
- **Fix.** One gray line before the credit: "About 9,000 Literotica stories, collected October 2026 · Story Patterns".
  (Needs your approval: the image's content, SP:39.)
- **Impact** medium. **Effort** small.

### F112. One sideways scroll at 400% zoom

- **Evidence.** `#/trends?genre=chain-stories` at 320 CSS px (400%): 40 px of sideways scroll; the other 99 runs
  have none.
- **Fix.** Let the too-few state's period labels wrap (find the 40 px with the overflow script in `tools/`).
- **Impact** low. **Effort** small.

### F113. Big topics open slowly on a slow phone

- **Evidence.** At 4× CPU, Word choice & style (62 rows) takes 203–233 ms to open on One genre and Trends; the other
  topics 67–119 ms.
- **Fix.** `content-visibility: auto; contain-intrinsic-size: auto 58px` on rows inside open topics, or render the
  first 20 rows and the rest a frame later.
- **Impact** low. **Effort** medium.

### F114. The tokens: 22 font sizes, 66 text styles, three dot sizes

- **Evidence.** Section 5. Nobody named it; X1 + X2 were preferred side by side (6 of 6 "more like one site").
- **Fix.** Concept X1 (section 8).
- **Impact** low. **Effort** medium.

### F115. Back after a view switch lands at the top

- **Evidence.** Genres scrolled to 400 px, switched to One genre, then Back: the page is at 0 (`tools/backcheck.mjs`).
  Back from a row restores the scroll; Back from a switch doesn't.
- **Fix.** Store `scrollY` in the history entry the switch replaces, and restore it on `popstate`, as the rows do.
- **Impact** low. **Effort** small.

### F116. "Download PNG" reads as technical

- **Evidence.** 18 of 36 stand-ins today, and 3 to 6 of 6 in each mock-up run of V5–V7, called it techy, orphaned or
  out of place.
- **Fix.** "Download image" (the file stays a PNG). (Revisits a decision: the actions are named "Download PNG" in
  SP:115–116 and TRI:403–412; the places stay.)
- **Impact** low. **Effort** small.

### F117. "8,996 are used" of 9,000

- **Evidence.** V8, 6 of 6 asked why. The reasons are in "Missing data and excluded stories", far below.
- **Fix.** In "In short": "8,996 are used in the charts (3 may not be in English and 1 was too short)", from
  `meta.counts.excluded_reasons` (the 4 sampled stories with no text were replaced, so they don't count against the
  9,000). (Needs your approval: copy.)
- **Impact** low. **Effort** small.

### F118. Trends' summary names fewer changes than its list

- **Evidence.** "▼ Fell: average paragraph length, median paragraph length, very long paragraphs" names 3; the Fell
  list shows 5 (3 of 6 in the W1 run).
- **Fix.** End the line with "and 2 more" when the list is longer than the line.
- **Impact** low. **Effort** small.

---

## 7. Quick wins

Small, safe changes I would make straight away, none of which changes a chart's meaning:

1. F97, the reading-list verbs, with its test (once you approve the `wording.py` edit).
2. F103, Trends' "Only include" as a menu.
3. F104, Trends' key drawn as the chart's marks.
4. F107, balanced questions, up to 44 characters wide from 760 px.
5. F110, 44 px rows and selects on Patterns.
6. F112, the 400% overflow.
7. F109, How it works' phone bar.
8. From L1: "2,631 stories" on phones, and the value label clear of the dashed line (both form, not wording).
9. From W1: the same decimals in a row, units on their own line, the note above the first list, and "Later".
10. F118, "and 2 more".
11. From U1: the phone masthead keeps the page being read.

---

## 8. Concepts

Four concepts, each with its alternatives tried on fresh eyes. The mock-ups were injected into the frozen build
(`mocks.js`); the data drawn is the site's own.

### Concept L: Explore says what its numbers are

| | L0 · today | **L1 · glosses and a scale** | L2 · L1, and "star rating" |
|---|---|---|---|
| What changes | — | Key: "Median: the middle story's value", "Interquartile range: where the middle 50% of stories fall"; axis: "Average rating (1 to 5 stars)"; phones: "2,631 stories"; the value label starts clear of the dashed line; the bar and notes say "Story length in words" | L1, with "average rating" renamed "star rating" ("Star rating (readers' average, 1 to 5)") |
| V2 Q2 (4.42, with its unit) | 6/6; 6/6 unsure of the scale | 6/6; **0/6 unsure** | 6/6; 0/6 unsure |
| V2 Q3 (the marks) | 5/6 (bar: 0/6) | **6/6** | 6/6 |
| "4.19" on the line | 12/12 | 1/6 | 0/6 |
| "Median of an average?" | 6/6 | 6/6 | 6/6 ("readers' average" makes it explicit, not easier) |
| Ease | 3.8 | 4.0 | 4.0 |
| Pros | — | Fixes three stumbles with 19 words | as L1 |
| Cons | — | The longer bar is cut off on phones (3/3): keep the bar's text short | renames a measure for no gain |

**Recommendation: L1**, with the question bar kept to "Story length in words · Average rating · All genres".
([m01](design-review-4/m01-L-explore.png))

### Concept U: where am I, and what is this page?

| | U0 · today | **U1 · the page in the masthead and kicker** | U2 · U1, a relabeled switch and the rule spelled out |
|---|---|---|---|
| What changes | — | Phones keep the page being read in the masthead; kickers name the page and the source; Trends' word count keeps "Only include" a menu; Genres' key adds "comparing every story, not only the medians" | U1, and the switches read "Every genre, one characteristic · One genre, every characteristic" and "Every characteristic · One characteristic over time"; Genres' key states the 60-in-100 rule |
| Phones name the page they are on | 0/3 (nothing shown) | 3/3 | — |
| Only the footer says what the stories are (V4, V7) | 4/12 | 0/12 | 0/12 |
| The developer's note | 6/6 | 0/6 | 0/6 |
| The switch unclear | 18/18 | 12/12 | **12/12**, and it wraps on phones (2/3) |
| Why Mind Control isn't marked | 6/6 | 6/6 | 6/6; the rule "hard to follow" 6/6 |
| Ease | V1 3.5, V4 4.0, V7 3.7 | V1 3.8, V4 3.8, V7 4.0 | V4 **3.5**, V7 4.0 |
| Pros | — | Settles "where am I" and "what stories" with no new controls | none beyond U1 |
| Cons | — | Its Genres key sentence didn't help: drop it | longer labels, no clearer; costs ease |

**Recommendation: U1 without its Genres key sentence**, and without "in 30 genres" doubling up ("Genres · about
9,000 Literotica stories · 30 genres"). Leave the switches as they are (O4 stands): relabeling didn't help.
([m02](design-review-4/m02-U-masthead-kicker.png))

### Concept W: one grammar for the two comparisons

| | W0 · today | **W1 · the notes first, in one dialect** | W2 · W1, values first on One genre |
|---|---|---|---|
| What changes | — | One genre: the note above the first list, in Trends' words, ending "Tap a row for every genre's numbers."; the axis "How often a story in Romance comes out higher than a story from all genres, out of 100"; "▲ Later: where the first sex scene starts"; the same decimals in a row; units on their own line. Trends: the note adds "Tap a row for its chart over time." | W1, and One genre shows "7.8 vs 19.3" beside each name under "Median, Romance vs all genres", the plot after it, as on Trends |
| V5: gray dots | 6/6 | 0/6 | 0/6 |
| V5: medians named | 0/6 with confidence | 0/6 (4/6 guess from the note) | **6/6** (from the head) |
| V5: "Later" read as "Higher" | 6/6 | 2/6 | 1/6 |
| V6: what to tap | 3/6 | **6/6** | — |
| Ease | V5 3.2, V6 3.0 | V5 3.0, **V6 3.8** | V5 3.2 |
| Pros | — | Small; Trends' worst score fixed | names the medians |
| Cons | — | One genre's ease unchanged: the 0–100 idea stays the hardest on the site | a layout change for no gain in ease; "two kinds of number" still 5/6 |

One capture artifact: W1's One genre screens lost the takeaway's bold labels (5 of 6 noticed); W2 was captured
without it. **Recommendation: W1.** W2 only if naming the medians matters more to you than a quieter row.
([m03](design-review-4/m03-W-comparisons.png))

### Concept X: one visual system

The look already reads as one site; what differs from page to page is the tokens and the header. X proposes one
system, in two parts that can be taken separately.

**X1, the tokens.**
- **Type scale.** Sans: 12 (chart ticks, small labels), 13 (notes, units), 14 (secondary text, keys), 15 (controls,
  body on Explore), 16 (rows, lists, How it works' body), 18 (lede). Serif 600: 18 (masthead, sub-sections), 20–26
  (chart and list headings), 23–37 (the page's question). The half sizes go to the next whole size; 19 and 21 go to
  20; 25 to 26; Patterns' 28–38 and How it works' 32–44 to 23–37.
- **Color roles.** Ink #1c1c22 (text), ink-2 #45454f (secondary), ink-3 #6b6b75 (notes); accent #4a89f3 and ink
  #2b63c6 (the data and the links); warm #e8894a and ink #a9531d (story-age warnings; ↘ on Patterns); one gray for
  marks and controls, #857f75 (3.8:1); rules #e7e4dd and #d2cec5.
- **Spacing.** 4, 8, 12, 16, 24, 32, 48 px.
- **Chart grammar.** The median is a dot of radius 6 with a white 2 px ring on every range chart; the interquartile
  range a 10 px capsule in #c9dcfb with a 1 px #4a89f3 edge; "all stories" a dashed 1 px ink-2 line; a comparison's
  score a radius 5 dot on its line, blue when clear and gray (#857f75) when not; "not compared" gray capsules; ▲▼≠
  in ink; values printed in 13 px semibold ink.

**X2, the page frame.** Every page opens the same way: the kicker (page · source; Explore's headline stays), the
question as the h1 at 23–37 px with balanced lines (up to 44 characters wide on desktops), the controls, then the answer in
the takeaway's blue-ruled box. Patterns gets the kicker, the page-size question and the box; How it works' h1 drops to
23–37 px.

| | X0 · today | X1 only | **X1 + X2** |
|---|---|---|---|
| Font sizes (page · chart) | 22 · 5 | 11 · 3 | 11 · 3 |
| Text styles | 66 | — | 53 |
| Side-by-side, desktops: one coherent site | — | not tested alone | **3/3** |
| … more polished | — | — | 3/3 |
| … look, 1–5 | 3, 3, 3 | — | 4, 4, 4 |
| Side-by-side, phones: one coherent site | — | — | 3/3 ("by a small margin") |
| … more polished | — | — | 2/3 (the third preferred today for the mock's kicker, which wrapped "· 30 GENRES" onto a line of its own: a mock artifact) |
| … look, 1–5 | 3, 4, 4 | — | 3, 4, 3 |
| Pros | — | invisible to readers; every new page starts from the same scale | the differences readers named were X2's: Patterns' header, the kickers, the line breaks |
| Cons | — | touches most of the CSS; the fingerprint tests move | the kicker must keep its pieces together on phones (the mock didn't) |

**Recommendation: X1 + X2** (balanced lines at every width; the wider measure from 760 px). X1 can wait for a quiet week; X2 is small.
([m04](design-review-4/m04-X-desktop.png), [m05](design-review-4/m05-X-phone.png))

### Ideas

- **I15. One way across.** Under every chart, the same three links for the same characteristic, named the same way:
  "By genre →", "Over time →", "With popularity →" (the ones that exist for that characteristic; the page you are on
  drops out). Today the cross-links are a question on Explore, "Open in Explore →" on Genres, "Compare genres →" on
  Trends.
- **I16. Definitions in place.** Tapping a row's name on One genre and Trends shows its one-line description from
  `meta.json` (already loaded) under the row, so "Touch words" and "Pages on site" explain themselves (6 of 6 asked).
  No new data.
- **I17. Say the dot in words.** A row's details start with its score as a sentence: "In 26 of 100 pairs, the Romance
  story had more sexual language." The sentence already exists for screen readers.

None of these encourages fishing for patterns: each shows the same characteristic another way, or explains one.

---

## 9. Questions for you

- **O8.** May I change the reading-list measure's `more` and `less` in `wording.py` and rebuild the data (F97)?
- **O9.** One name for each idea: "Story length in words" and "Story age (years online)" as the labels, and "all
  genres" lowercase inside sentences (F98)?
- **O10.** Concept L1: gloss "median" and "interquartile range" in Explore's key, and give the axis its scale "(1 to
  5 stars)"? This revisits P3:99–102 and DR2:1150; the term "interquartile range" stays (O1).
- **O11.** Concept W1, including a second sentence in Trends' note ("Tap a row for its chart over time."), which
  revisits the Trends review's 10.1, and One genre taking Trends' words for its axis?
- **O12.** Concept U1: kickers that name the page and the source, the phone masthead keeping the current page, and
  Genres' question as its h1?
- **O13.** Genres' marks (F105): show each genre's "in 100" score in its details, or leave it?
- **O14.** A source line on the PNG images (F111)?
- **O15.** "Download image" in place of "Download PNG" (F116)?
- **O16.** Dark mode now? I would say not yet: no stand-in asked for it, forced colors already work, and X1 should come
  first so that dark mode has one set of tokens to invert.
- **O17.** A share image for link previews, or a second font weight? Neither has evidence this round: links open the
  right view (task 8), and no stand-in found the hierarchy flat. I'd leave both.
- **O18.** Median age is still in every `v/` file, never shown. Remove it from `site_data.py` (smaller files, no
  visible change)?
- **O19.** "Explore" and "Patterns" sound alike to newcomers (F108). X2's Patterns kicker may be enough; if not,
  would you consider renaming Patterns (for example "All patterns")? Untested.

**I'll stop here and wait for your approval.** Nothing in `site/`, `litcorr/` or `tests/` has changed.

---

## 10. Files

- This review: `docs/stage2/DESIGN_REVIEW_4.md`; screenshots in `docs/stage2/design-review-4/` (b01–b16 today,
  m01–m05 mock-ups; palette-compressed).
- Fresh eyes: `Claude outputs/design-review-4/fresh-eyes/` (`questions/`, `base/` and `scores.md`, `mock/` and
  `scores.md`, `x/` and `scores.md`).
- Mock-ups: `Claude outputs/design-review-4-mockups/` (`mocks.js`, the screenshot jobs, `shot.mjs`, `fresh.mjs`).
- Measuring scripts and their outputs: `Claude outputs/design-review-4/tools/` (with `README.txt`) and
  `Claude outputs/design-review-4/measurements/`.
