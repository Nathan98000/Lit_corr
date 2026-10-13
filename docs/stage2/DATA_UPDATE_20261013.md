# Stage 2 data update: litcorr_stage2_handoff_20261013.zip

The site's aggregates, rebuilt from the collection as it stood on October 13, 2026, with the text, tests and READMEs
brought in line (STAGE2_DATA_UPDATE_PROMPT.md). Branch `data-update-20261013`, made from `main` at `6145524` (main had
not moved). Aggregate numbers only: no story text, titles, authors or story-level rows.

## 1. The data

**The handoff.** `python -m litcorr process` (once, 1 min 22 s, offline) wrote `litcorr_stage2_handoff_20261013.zip`,
processed 2026-10-13 16:40 UTC. Collection sessions ran from October 1 to October 12, 2026; the popularity snapshots
were taken over the same days. The old zip, `litcorr_stage2_handoff_20261008.zip`, stays in `data/handoff/`.
`process` left `docs/METHODOLOGY.md`, `docs/DATA_DICTIONARY.md` and `docs/data_dictionary.json` unchanged.

**The collection's progress.** `max_stories_per_category` is 600 in `config.toml`, so the collection is partial:

| | 20261008 | 20261013 |
|---|---|---|
| Sampled (the queue, replacements included) | 9,004 | 17,977: 600 in most genres, 601 in four with a replacement, 573 in Chain Stories (its whole listing) |
| Collected | 9,000 | 12,573 (70%), 417–420 per genre |
| Still waiting in the queue | 0 | 5,400 |
| Could not be collected | 4 | 4 (the same four) |
| With text / included in the charts | 9,000 / 8,996 | 12,573 / 12,568 |
| Per genre in the charts | 299–300 | 417–420 |

**What "partial" means here.** The queue is shuffled within each genre and alternates between genres, so the 417–420
stories collected so far in a genre are the first ones of its random order: a random sample of that genre, and the site
describes them as one. The quality report's "Collection progress: PARTIAL" table and the manifest's
`sampling_weights_provisional: true` say so. The weights (each genre's size on Literotica over its stories in the
charts) will change a little as the rest arrive, but with every genre at 417–420 stories their proportions barely move.
The site says nothing about the 600-story plan, the continuing collection or provisional weights (D3).

**The stories still waiting are not part of the data (D3).** `build-raw` keeps a row for every sampled story, so the
handoff has 5,400 rows for stories not yet read. `site-data` now drops the rows whose `qc_flags` hold `status_queued` or
`status_partial` as it loads the handoff, before anything is counted, and logs it ("Leaving out 5400 stories still
waiting to be collected"). So How it works says "Of the 12,577 sampled stories, 12,568 are used in the charts. 9 were
left out …" (12,577 = 12,573 collected + 4 that could not be), not "Of the 17,977 …, 5,409 were left out". With a
finished collection the step drops nothing: the 20261008 handoff still gives the committed aggregates exactly (every
file but `meta.json`'s `generated_at`), before and after the change.

**From the quality report** (`data/processed/quality_report.md`, against the 20261008 one):

* **One new kind of exclusion.** Two stories in Toys & Masturbation have identical text; the one already in the
  20261008 data stays, and the new one is excluded as `duplicate_of_another_story` (0 before). You approved going on
  (2026-10-13). How it works had words for it under the wrong key; fixed (section 4).
* **One story's page category differs from the genre it was sampled from** (0 before). The site counts a story in the
  genre it was sampled from (`queue_category_slug`), so nothing changes; only the report's "By category" table shows
  602 / 599.
* **Rates.** No flag runs at twice its old rate: unbalanced quotation marks 0.13% → 0.20% of stories with text (the
  highest rise), script-style dialogue 0.87% → 0.82%, missing ratings 2.3% → 2.3%, truncated text 0.10% → 0.09%; parse
  warnings 3 → 3, not English 3 → 3, too short 1 → 1. No bot, challenge or blocked page.
* **The same dictionary and coverage.** No characteristic, measure or genre is new or gone; every characteristic's
  coverage moved by less than 2 points (the ten under 0.9 were under 0.9 before: series numbers, some dialogue and
  pacing measures).
* **The last session** (October 12) stopped when the site refused connections; the collector is in a cooldown, as
  designed. Not part of this work.

## 2. What visitors will see differently

Biggest first. Section 9 has every number.

1. **The size of the sample.** About 13,000 stories instead of about 9,000 in every kicker ("Genres · about 13,000
   Literotica stories · 30 genres") and in link previews; "about 420 stories" per genre in How it works, which now says
   the collector put the stories in a random order and collected them in that order (D5). Every chart shows about 40%
   more stories behind each figure (the default chart's first row: 3,701 stories, 2,631 before).
2. **More "tend to" titles within a genre.** Popularity's charts for one genre say "tend to" 12,635 times across every
   characteristic, measure and genre, against 10,118 before (+25%). Most of the new ones are effects that were already
   past the rule's 0.1 but were not yet clear at the 99% level, or had an end group under 30 stories: **more stories
   passing the rule's significance part, not bigger differences.** (3,092 appeared that way, 289 because the effect
   crossed 0.1; 778 went with the effect still past 0.1, 86 because it fell below.)
3. **All genres on Popularity barely moves.** 581 "tend to" results across all measures (580 before). 61
   characteristic × measure pairs changed: 31 new, 30 gone, **none reversed**. No effect moved by more than 0.03, and
   all but one sat at 0.08–0.12, on the rule's 0.1 line: 27 flipped because the effect crossed 0.1, 34 because the
   significance or median-gap part now passed or failed. The one off the line is on the Popular list: **present-tense
   narration now "tends to" lower average ratings** (effect −0.17 → −0.19; it was "No clear pattern", its medians'
   gap or its significance short of the rule).
4. **The featured questions keep their answers.** All five verdicts are the same, with effects within 0.02 of before
   ("Do longer Romance stories get more views per month?": tend to more, +0.44 → +0.42). The Popular list's other
   eleven keep theirs.
5. **The Trends page compares more genres.** Transgender's two windows can now be compared (30 stories from 2000–2009,
   exactly the rule's minimum, and 260 from 2020 or later): "7 of 151 characteristics clearly changed …". With the
   Length options, 8, 7 and 4 more genres are comparable (too few: 24 → 16, 16 → 9, 29 → 25). Most genres show more
   clear changes (Crossdressing 8 → 26, Fetish 20 → 36, Taboo/Incest 22 → 36, Reluctance/NonConsent with 2,000–5,000
   words 0 → 14); of the 334 changes that became clear, 235 come from more stories passing the significance part.
   All genres: 26 → 25. Gone there: the build-up of sexual language, dialogue in the last fifth and touch words (|r|
   0.21 before, 0.18–0.20 now); new: physical action verbs (−0.20, the same r, now clear) and syllables per word
   (+0.18 → +0.20).
6. **The Genres page.** With All stories, 897 (characteristic, genre) pairs clearly differ from all genres (922
   before); 101 pairs changed, 96 of them with r within 0.03 of the 0.2 line before and after. Word count: "6 of 30 genres clearly differ"
   (8 before); Novels and Novellas (+0.20 → +0.19) and Crossdressing (−0.21 → −0.19) dropped out, so there is no
   "▲ Longer" line now. With other options the count rose (2000–2009: 810 → 883; under 2,000 words: 747 → 844) or fell
   a little. On "One genre", Romance still has 28 characteristics that set it apart; its Higher line reads "romance
   language, affection & love, intimacy" (everyday vocabulary was second). How To has 112 (116), Reviews & Essays 113
   (115).
7. **Relabeled groups.** 13 characteristics' groups moved their edges (`make_bins` works from the data), e.g.
   one-sentence paragraphs "9–20% · 20–25%" → "9–15% · 15–25%", where the first sex scene starts "3–12% · 12–30%" →
   "3–15% · 15–30%", emotional tone "0.4–0.6 · 0.6–0.7" → "0.4–0.5 · 0.5–0.7". No characteristic changed its kind.

## 3. Tests changed

Run on the new aggregates with no code change, 40 Vitest tests in 11 files and 1 pytest test failed. None was a rule
(overlaps, sizes, banned words, hidden groups, whole files): 16 were One genre's fingerprints, 1 Explore's real
digest, and 24 held snapshots of the old data; 8 of those had also pinned a case the new data lost. Each new value was
checked by a second route: short scripts over the aggregate files (`Claude outputs/data-update/tools/`:
`verify_snapshots.py`, `dump.py`, `spotcheck.py`), never the failing test's printout. Where a real case was lost, the
test now uses the new data's instance of it; where none is left, the case is kept with made-up rows. No real-data test
was deleted and no rule loosened. The fixture digests (`7fb18ef1ff7cdf3c` and the synthetic ones) did not change.

| Test (file › test) | Kind | Old value | New value | How checked |
|---|---|---|---|---|
| genresChart › match the acceptance numbers for story length | snapshot | "8 of 30 genres clearly differ"; ▲ Longer: Novels and Novellas; ▼ Shorter: 7 genres (Anal and Crossdressing tie at −0.21) | "6 of 30"; no ▲ line; ▼ Shorter: Reviews & Essays, How To, Letters & Transcripts, Toys & Masturbation, Humor & Satire, Anal | genres/all.json, story_words: `f` ≠ 0 for 6 genres, all −1, sorted by \|r\| (−0.63 … −0.21) |
| same | snapshot | median 3,610, IQR 2,050–6,320, genre medians 1,280–5,060 | 3,630, 2,030–6,420, 1,270–4,930 | genres/all.json story_words `q` (All genres row and the genres' medians' min/max) |
| same | snapshot | first person 57%, genres 27%–99% | 57%, 25%–98% | genres/all.json pov_is_first_person shares 0.572; min 0.248, max 0.979 |
| same | edge case lost → new real case | a tie in a list goes A–Z (word count: Anal, Crossdressing at −0.21) | sentence count: Anal and Humor & Satire tie at −0.22, A–Z (assertion added) | genres/all.json story_sentences r of the flagged genres |
| genresChart › F63 are left out of the heading's count … | snapshot | y2020 word count "8 of 29", Chain Stories (12); long sexual language "12 of 27", How To (13), Letters & Transcripts (29), Reviews & Essays (15); long adverbs Letters & Transcripts (14) | "10 of 29", Chain Stories (19); "13 of 28", How To (22), Reviews & Essays (22); Letters & Transcripts (22) | the files' `n` per genre (< 30 too few) and `f` count |
| same | edge case lost → new real case | "No genre clearly differs" beside genres too few (All stories' adverbs in speech tags) | "5,000 words or more", pages on site: "No genre clearly differs", How To (22), Reviews & Essays (22) (assertion added) | genres/long.json story_pages: 0 flagged of 28 compared; the two genres' `n` |
| genresChart › F63 change nothing with All stories, except … | snapshot | adverbs and first sex scene had genres under 30; adverbs 28 compared, none marked; How To (28), Reviews & Essays (20); first sex scene "6 of 29"; word count "8 of 30" | adverbs only; 29 compared, "1 of 29 genres clearly differs" (the singular, newly covered); Reviews & Essays (29); "6 of 30"; "6 of 30" | genres/all.json: every characteristic with a genre under 30 (adverbs only); its `n`, `f` |
| genresChart › print the real data's numbers as one chart (F66) | snapshot | rare words 2.4%, …, 1.6%–3.8%; paragraph length 43.0, 36.3–64.0; dialogue build-up −6.7% to 11.1%, −3.6% to 5.2%; word count as above | 2.5%, 1.7%–3.4%, 1.6%–3.7%; 43.1, 31.7–62.2, 36.4–65.3; −6.6% to 11.2%, −2.8% to 5.9% | genres/all.json `q` of each (0.0245, 0.0174–0.0337, 0.0164–0.0372; 43.1 …; −0.066–0.112, −0.028–0.0593) |
| genresForms › say where a characteristic peaks with Later / Earlier (F72) | snapshot + edge case moved | ▼ Earlier: Non-Erotic, Reviews & Essays, How To; How To's details "clearly earlier" | ▼ Earlier: Non-Erotic, Reviews & Essays; Non-Erotic's details | genres/all.json pace_sex_peak_position: flagged −0.32, −0.30 |
| genresForms › How To's ▲ for repeated five-word phrases (F61) | snapshot | 76%, 2.570 (all genres' quartiles 0.641, 1.19, 2.17) | 80%, 2.530 (0.652, 1.18, 2.15) | genres/all.json `z`: How To 334 of 419 with any, median 2.53; still f = 1 |
| genresForms › the All genres line of narrative perspective | snapshot | romance language 43%, 0.422, 0.227–0.768; Romance 73%, 0.709 | 44%, 0.418, 0.228–0.787; 72%, 0.743 | `z`: 5,320 of 12,568 (0.435), 301 of 420 |
| genresLinks › says "about 420 stories" from the data | snapshot (title too) | typicalSample 300 | 420 | meta.genres: the median of the 30 genres' n is 419 |
| genresProfile › prints no clear difference as 40 or 60 | snapshot | 264 rows on the zone's edge | 288 | every genres/ file: flagged non-group rows with round(50·\|r\|) = 10 (the same script gives 264 on BEFORE) |
| genresProfile › reproduces the acceptance numbers | snapshot | Romance r −0.48, −0.45, −0.43, −0.43; How To 116, Reviews & Essays 115, Erotic Couplings 10, Anal 28 flagged; Higher: romance language, everyday vocabulary, affection & love | −0.46, −0.43, −0.42, −0.41; 112, 113, 8, 25; romance language, affection & love, intimacy | genres/all.json flagged per genre, sorted by \|r\| |
| same | edge case lost → new real case | a tie keeps the topic's order (Romance's sexual-action and anatomical terms at −0.43) | Romance's intimacy and everyday vocabulary at 0.27; Erotic Horror's three at −0.35 (assertions added) | the same, with meta's topics |
| genresProfile › Chain Stories' 19 stories of 2020 or later (F60) | snapshot (title too) | 12 | 19 (still under 30) | genres/y2020.json n |
| same | edge case moved | How To compared on fewer characteristics than it has (28 stories with adverbs) | Reviews & Essays (29 with adverbs) | genres/all.json adverbs `q` n: How To 41, Reviews & Essays 29 |
| genresProfile › skips story age in the takeaway (F78) | snapshot | Higher: italics, author's story count, vocabulary variety (moving average) | italics, vocabulary variety (moving average), author's story count | chain-stories' flagged: 0.37, 0.35, 0.34 (author's story count ties 0.34 with word length: topic order) |
| same | edge case lost → fixture | "5,000 words or more": Fetish's only lower item is story age, so that line goes | no genre or option has such a line now: kept by oneGenre.test.jsx's made-up rows ("a line left with nothing goes"); the real test now checks every genre and option (no empty line, no story age when publication year is shown) | the search over every genres/ file (none found) |
| genresProfile › writes the columns as the copy does (F85) | snapshot | sexual language 7.8 vs 19.3, 26 in 100; affection 1.05; romance language 73% vs 43%, 70 in 100; How To second person 55%; five-word phrases 76%, 2.57, 1.19, 61 in 100 | 8.0 vs 19.2, 27; 1.04; 72% vs 44%, 69; 56%; 80%, 2.53, 1.18, 63 | genres/all.json `q`/`z`, and 50 ± round(50·\|r\|) for r −0.46, 0.38, 0.26 |
| review4Data › reading-list titles (O8) | snapshot | 1,146 titles | 1,418 | every v/<characteristic>/all.json: genres with a reading-list direction ≠ 0 |
| review4QuickWins › F118 "and 2 more" … on the real data | snapshot | ▼ Fell: … and 2 more | … and 1 more | trends/all/all.json: 4 characteristics fell |
| trends › finds no fixed-mix check: only r and f | edge case moved | touch words r −0.213, f −1 | physical action verbs r −0.2, f −1 (touch words now −0.195, no clear change) | trends/all/all.json |
| trendsChanges › counts 3,571 and 4,647 stories …, leaves Chain Stories uncompared | snapshot (title too) | 2,561 and 3,346; Chain Stories and Transgender | 3,571 and 4,647; Chain Stories | trends/all/all.json n by period; meta.trend.too_few |
| trendsChanges › named by their content … | snapshot | paragraph count 102 (+82%); author's note 18% | 104 (+86%); 19% | trends/all/all.json `t` and the last period's `q` |
| same | edge case moved | a clear change on the zone's edge: build-up of sexual language, r −0.206 | physical action verbs, r −0.2 (build-up now −0.187, no clear change); the made-up case in genresProfile.test.jsx stays | trends/all/all.json |
| trendsChanges › the seven topics | snapshot | 26 flagged | 25 | trends/all/all.json `f` |
| trendsReview › counts the characteristics compared | snapshot (title too) | 26 of 180, medium 16 of 179 | 25 of 180, 13 of 179 | trends/<option>/all.json `f` and `r` |
| trendsReview › says how long stories got first | snapshot | 2,810 → 4,100 | 2,770 → 4,150 | trends/all/all.json story_words |
| trendsReview › prints the values first | snapshot | 51.6 → 38.8 (−25%), 56 → 102 (+82%), 2,810 → 4,100 (+46%), 57% → 40%, 18% → 33% | 51.6 → 39.1 (−24%), 56 → 104 (+86%), 2,770 → 4,150 (+50%), 58% → 41%, 19% → 33% | trends/all/all.json `t` and last `q` |
| trendsReview › lists what clearly changed | snapshot | 26; third blurb length; medium 16 | 25; third sentence count; 13 | trends files' flagged, by \|r\| |
| tests/test_stage2_site_data.py › test_real_too_few_genres | snapshot | all: chain-stories, transgender; counts 2, 24, 16, 29 | chain-stories; 1, 16, 9, 25 | meta.trend.too_few |
| exploreLayoutGuard › on the real data | fingerprint | b026d24a6ef5724a, 14,960 layouts | 4c2d87eddc236323, 14,960 | regenerated in the aggregates commit, no code change; the fixture digest 7fb18ef1ff7cdf3c unchanged |
| oneGenreFingerprint › 16 views | fingerprint | the 20261008 markup | regenerated | the same |

## 4. Code and copy changes

| Commit | Change |
|---|---|
| `82c9efd` | The prompt and the before screenshots. |
| `ef9e4a5` | **D3.** `site_data.py` drops the rows of stories still waiting to be collected (`status_queued`, `status_partial`) as the handoff is loaded, and logs how many. New pytest: a synthetic handoff with queued and partial rows gives the same aggregates as without them, and a story that could not be collected still counts. |
| `6c041d2` | **D8.** `scripts/compare_aggregates.py BEFORE AFTER` (standard library, the two folders' JSON only): the Markdown in section 9. |
| `a4ccfeb` | **The aggregates** from the new zip, the snapshot and fingerprint updates of section 3, nothing else. |
| `93a9364` | **The duplicate's words** (approved 2026-10-13): How it works keyed "had the same text as another story" by `duplicate_text`, a quality flag; Stage 1's exclusion reason is `duplicate_of_another_story`, so the page would have said "1 left out (duplicate of another story)". Two new tests. |
| `93dd36c` | **D5.** "Where the stories come from" and "In short" as approved, with `typicalSample(meta)` (the genres' median to the nearest 10: 420). One more literal from the old data, made to come from the data: Limitations' "300 random stories per genre" → "About {typicalSample} random stories per genre". The kicker's placeholder and `index.html`'s description and og:description say "about 13,000"; a test fails when any of them differs from `aboutCount(meta.counts.included)` of the real `meta.json` (checked: it fails with "about 9,000" in either place). |
| `df03cd7` | **D7.** `vite.config.js` reads `meta.json`'s `generated_at` at build time (`dataStamp`, `src/lib/dataStamp.js`: `20261013T164459Z`) and defines `__DATA_BUILD__`; `aggregatesUrl()` adds `?v=<stamp>` to every aggregates address. Paths, the in-memory cache's keys and the bytes of the first load are unchanged. The tests run without a stamp (vitest's mode), and a new test sets one. `npm run dev` and `npm run preview` checked in a browser: every aggregates request carries the stamp. |
| (last) | This write-up, the after screenshots, `site/README.md`. |

Literals from the old data left as they are: examples in code comments (`trends.js`'s "2,810 → 4,100", `wording.js`'s
"about 9,000", `genres.js`'s "300 stories in Romance."), which nobody visiting sees. `site/README.md`'s numbers are
updated (the first load, the visits, the files' sizes, the "about 13,000" kickers, "3,701 stories", "25 of 180",
"51.6 → 39.1 (−24%)", "median 2,770"), and it now describes D3, D7 and the comparison script. The root `README.md`
had nothing wrong (its "300 × ~28 categories" is the code's default, which `config.toml` overrides), so it is
unchanged.

## 5. Checks and budgets

| | Before (20261008) | After (20261013) | Limit |
|---|---|---|---|
| Tests | 616 Vitest, 220 pytest | 623 Vitest, 221 pytest; build passes | all pass at every commit |
| First load (gzip bodies, 6 requests) | 150.8 KiB | 151.2 KiB | 155 KiB |
| Visit starting on the Genres page (One genre, Romance) | 210.7 KiB in 9 | 211.8 KiB in 9 | |
| Visit starting on the Trends page (either view) | 177.3 KiB in 9 | 177.4 KiB in 9 | |
| Visit starting on How it works | 142.5 KiB in 7 | 142.6 KiB in 7 | |
| Largest `genres/` file, gzipped | 56.6 KB (views10k) | 56.9 KB (ratings25) | 60 KB |
| Largest `trends/` file, gzipped | 12.4 KB (all/all) | 12.4 KB (all/all) | 16 KB |
| `patterns.json`, gzipped | 11.0 KB | 12.2 KB | 40 KB |
| `meta.json`, gzipped | 20,094 B | 20,129 B (+35 B) | +2 KB |
| Aggregates | 1,818 files, 70.3 MB, 26.7 MB gzipped | 1,818 files, 73.7 MB, 28.1 MB gzipped | |
| Addresses in `site/README.md`, every How it works section, Transgender's Trends page | open | 39 of 39 open their view | |

**Glyph boxes** (the built site served with gzip; the earlier rounds' scripts, round 4's copies; the wide font is
Verdana on this Mac, as in round 4):

| Page | Checked | Site font | Verdana |
|---|---|---|---|
| Popularity (Explore): every characteristic × measure in three genres, 320 and 375 px | 11,220 charts | 0 | 978 (995 with the old data, round 4's baseline: the same kinds, chiefly "All stories" past the plot at 320 px) |
| Genres page, one characteristic: every characteristic, All stories and 2020 or later, 320, 375, 1440 px | 1,104 charts | 0 | 0 |
| Genres page, One genre: every genre, three options, every list and topic open, 320, 375, 1440 px | 270 pages, 57,558 rows | 0 | 0 |
| Trends page, All changes: every genre and Length option, 320, 375, 1440 px | 372 pages, 41,385 rows | 0 | 0 |
| Trends page, one characteristic: every characteristic, option and six genres (Transgender among them), 320, 375, 1440 px | 12,906 charts | 0 at rest (10 in passing) | 0 at rest (10 in passing) |
| Kickers, every page, 300–800 px and 200% zoom ("about 13,000 Literotica stories") | | 0 | |

The 10 "in passing" are Chain Stories' pages on site, caught 30 ms after the script switched to it from How To: the
axis is still gliding from How To's ticks (0.96–1.04) to its own (0–3). With 600 ms to settle, How To and Chain
Stories give 0 problems on every option and width. The old data never showed it because Chain Stories' charts there
were all "too few to compare". Not changed: How To's and 40 other constant charts (every period's quartiles the
same, as with pages on site in short stories) draw an axis of 0.96–1.04 pages; the old data had 41 such charts too
(section 7).

**Layout shift** on slow 4G (round 4's `clsall.mjs`: every page and switch, visits that start on each page, the way
across, 375 and 1440 px, 44 runs): worst 0.000 more than 500 ms after an action, before and after (the same 0.325
within 500 ms, One genre's own reflow on another genre, as in round 4), and no "Loading" frame after the first chart.

## 6. Screenshots

`docs/stage2/data-update-20261013/`: `b01`–`b10` before (375 px, and 1440 px at half size), `a01`–`a11` before and
after side by side (375 px above, 1440 px at half size below). a01 Popularity's default chart; a02 the featured "Do
longer Romance stories get more views per month?"; a03 the Genres page's default; a04 One genre for Romance; a05 the
Trends page's one characteristic (word count); a06 All changes for all genres; a07 Patterns; a08–a10 How it works' In
short, Where the stories come from, and Missing data and excluded stories; a11 the Trends page for Transgender, too few
to compare before.

## 7. Judgment calls and open items

* **The duplicate's words** were a key mismatch, fixed with your approval in its own commit.
* **Limitations' "300 random stories per genre"** was not in D5's list, but it is a number from the old data: it now
  says "About {typicalSample} random stories per genre" (D5's item 4). "About" because the genres hold 417–420.
* **The placeholder count is a literal** ("about 13,000" in `App.jsx` and `index.html`), as D5 asks, guarded by a
  test. It could instead be written at build time from `meta.json` (the D7 define, and a small `transformIndexHtml`
  plugin for `index.html`, no new dependency), so the next update needs no edit; not done, since D5 chose the literal.
* **D7's stamp in the tests.** The tests' fetch stubs read plain paths, so the tests run without a stamp and one test
  sets it. `vite.config.js` reads `public/aggregates/meta.json` from the working directory, where npm runs the scripts
  (`site/`).
* **Transgender is compared with exactly 30 stories from 2000–2009**, the rule's minimum. That is the rule at work; its
  7 clear changes rest on few early stories, as the rule allows.
* **Real cases the tests had pinned and the data lost** are listed in section 3. Only one has no real instance left (a
  takeaway line holding only story age); it stays covered by `oneGenre.test.jsx`'s made-up rows.
* **Constant charts' axes** (not new): where every period's quartiles are equal, the Trends page's one-characteristic
  chart draws ticks 0.96–1.04 (How To's pages on site: "1.00" between "0.98" and "1.02" pages). 41 charts before and
  after, mostly pages on site with "Under 2,000 words". Worth a look in a design round; not changed here (D4 and the
  checkpoints: it is not a data change).
* **Not checked here:** real phones and Safari, as in earlier rounds; the "?" past its column at 320 px in Verdana
  (design review 4's open item) was not looked at again.

## 8. Doing this again

For the next handoff (when the collection reaches 600 per genre, say):

```bash
.venv/bin/python -m litcorr status
.venv/bin/python -m litcorr site-data --handoff data/handoff/litcorr_stage2_handoff_20261013.zip --out /tmp/before   # must match site/public/aggregates (but generated_at)
.venv/bin/python -m litcorr process
.venv/bin/python -m litcorr site-data
.venv/bin/python scripts/compare_aggregates.py /tmp/before site/public/aggregates > /tmp/comparison.md
cd site && npm test && npm run build && cd .. && .venv/bin/python -m pytest
```

Then: update the failing snapshots after checking each new value by a second route, regenerate the two fingerprints
(`exploreLayoutGuard.test.js`'s real digest; `npx vitest run src/test/oneGenreFingerprint.test.jsx -u`, then `git
status`), set the kicker's placeholder and `index.html`'s two descriptions to `aboutCount(meta.counts.included)` (the
test in `dataUpdate.test.jsx` names the value), and update `site/README.md`'s measured numbers. With a finished
collection D3 drops nothing, and the D7 stamp follows the new `meta.json` by itself.

## 9. Appendix: the comparison script's output

`python scripts/compare_aggregates.py <aggregates from the 20261008 handoff> site/public/aggregates`

### 1. Source and counts

|  | Before | After |
|---|---|---|
| Handoff | litcorr_stage2_handoff_20261008.zip | litcorr_stage2_handoff_20261013.zip |
| Processed | 2026-10-08 | 2026-10-13 |
| Collected | 2026-10-01 to 2026-10-08 | 2026-10-01 to 2026-10-12 |
| Popularity snapshots | 2026-10-01 to 2026-10-08 | 2026-10-01 to 2026-10-12 |
| Sampled | 9,004 | 12,577 |
| With text | 9,000 | 12,573 |
| Included (in the charts) | 8,996 | 12,568 |
| Excluded: duplicate_of_another_story | 0 | 1 |
| Excluded: no_text | 4 | 4 |
| Excluded: possibly_not_english | 3 | 3 |
| Excluded: text_too_short | 1 | 1 |

Stories per genre: 299–300 before, 417–420 after.

| Genre | Stories |
|---|---|
| Anal | 300 → 419 |
| BDSM | 300 → 420 |
| Chain Stories | 299 → 417 |
| Crossdressing | 300 → 420 |
| Erotic Couplings | 300 → 420 |
| Erotic Horror | 300 → 418 |
| Exhibitionist & Voyeur | 300 → 419 |
| Fan Fiction & Celebrities | 300 → 419 |
| Fetish | 300 → 417 |
| First Time | 300 → 419 |
| Gay Male | 300 → 419 |
| Group Sex | 300 → 419 |
| How To | 299 → 419 |
| Humor & Satire | 300 → 420 |
| Interracial Love | 300 → 417 |
| Lesbian Sex | 300 → 420 |
| Letters & Transcripts | 299 → 419 |
| Loving Wives | 300 → 420 |
| Mature | 300 → 419 |
| Mind Control | 300 → 419 |
| Non-Erotic | 300 → 418 |
| NonHuman | 300 → 419 |
| Novels and Novellas | 300 → 419 |
| Reluctance/NonConsent | 300 → 419 |
| Reviews & Essays | 299 → 418 |
| Romance | 300 → 420 |
| Sci-Fi & Fantasy | 300 → 419 |
| Taboo/Incest | 300 → 419 |
| Toys & Masturbation | 300 → 419 |
| Transgender | 300 → 419 |

Each “Only include” option's stories:

| Option | Stories |
|---|---|
| All stories | 8,996 → 12,568 |
| Published 2000–2009 | 2,561 → 3,571 |
| Published 2010–2019 | 3,089 → 4,350 |
| Published 2020 or later | 3,346 → 4,647 |
| Under 2,000 words | 2,708 → 3,806 |
| 2,000–5,000 words | 3,540 → 4,903 |
| 5,000 words or more | 2,739 → 3,848 |
| At least 10,000 views | 6,861 → 9,571 |
| At least 25 ratings | 7,410 → 10,319 |

### 2. What the site offers

Measures and their coverage:

| Measure | Before | After |
|---|---|---|
| Favorites per 1,000 views | 1.0 | 1.0 |
| Comments per 1,000 views | 1.0 | 1.0 |
| Ratings per 1,000 views | 0.978 | 0.978 |
| Reading-list adds per 1,000 views | 1.0 | 1.0 |
| Views per month | 1.0 | 1.0 |
| Views | 1.0 | 1.0 |
| Favorites | 1.0 | 1.0 |
| Comments | 1.0 | 1.0 |
| Ratings (number of) | 0.978 | 0.978 |
| Average rating | 0.977 | 0.977 |

Characteristics: 187 before, 187 after. Added: none. Removed: none.

Changed kinds (the chart's, then the Genres and Trends pages' form):

None.

Changed groups (13 characteristics):

| Characteristic | Before | After |
|---|---|---|
| One-sentence paragraphs | Under 9% · 9–20% · 20–25% · 25–40% · 40%+ | Under 9% · 9–15% · 15–25% · 25–40% · 40%+ |
| Very long paragraphs (‘walls of text’) | None · Under 2% · 2–8% · 8%+ | None · Under 2.5% · 2.5–8% · 8%+ |
| Blurb length | 5–29 · 30–39 · 40–49 · 50–54 · 55+ | 4–29 · 30–39 · 40–49 · 50–54 · 55+ |
| Exclamation sentences | None · Under 1.2% · 1.2–3% · 3–6% · 6%+ | None · Under 1.2% · 1.2–3% · 3–7% · 7%+ |
| Subordinate clauses per sentence | Under 0.15 · 0.15–0.2 · 0.2–0.3 · 0.3+ | Under 0.12 · 0.12–0.2 · 0.2–0.3 · 0.3+ |
| Repeated five-word phrases | None · Under 0.6 · 0.6–1.2 · 1.2–2 · 2+ | None · Under 0.7 · 0.7–1.2 · 1.2–2 · 2+ |
| Physical action verbs | Under 10 · 10–12 · 12–16 · 16–18 · 18+ | Under 10 · 10–12 · 12–16 · 16–20 · 20+ |
| Italics | None · Under 0.5 · 0.5+ | None · Under 0.6 · 0.6+ |
| Where the first sex scene starts | Under 3% · 3–12% · 12–30% · 30–50% · 50%+ | Under 3% · 3–15% · 15–30% · 30–50% · 50%+ |
| Emotional tone | Under 0.2 · 0.2–0.4 · 0.4–0.6 · 0.6–0.7 · 0.7+ | Under 0.2 · 0.2–0.4 · 0.4–0.5 · 0.5–0.7 · 0.7+ |
| ‘Filter’ words | Under 16 · 16–20 · 20–24 · 24–26 · 26+ | Under 16 · 16–20 · 20–24 · 24–28 · 28+ |
| Distancing phrases | Under 0.3 · 0.3–0.7 · 0.7–1 · 1–1.5 · 1.5+ | Under 0.3 · 0.3–0.7 · 0.7–1.2 · 1.2–1.5 · 1.5+ |
| Dialogue in the last fifth | Under 3% · 3–12% · 12–20% · 20–30% · 30%+ | Under 4% · 4–12% · 12–20% · 20–30% · 30%+ |

### 3. Popularity (Explore): “tend to” results

All genres' “tend to” results per measure (of the characteristics in both builds):

| Measure | Tend to |
|---|---|
| Favorites per 1,000 views | 71 → 77 |
| Comments per 1,000 views | 69 → 70 |
| Ratings per 1,000 views | 86 → 83 |
| Reading-list adds per 1,000 views | 64 → 61 |
| Views per month | 39 |
| Views | 41 → 40 |
| Favorites | 43 → 45 |
| Comments | 50 → 47 |
| Ratings (number of) | 52 → 50 |
| Average rating | 65 → 69 |

All genres: 61 changes (0 reversed, 31 new, 30 gone). Each gives the direction (+, − or 0 for no clear pattern) and the effect (the rank correlation, or for yes/no characteristics the rank-biserial correlation).

**Reversed (the direction flipped)** (0)

None.

**New** (31)

| Characteristic | Measure | Before | After |
|---|---|---|---|
| Adverbs in speech tags | Average rating | 0 +0.10 | + +0.11 |
| Average speech length | Average rating | 0 +0.10 | + +0.10 |
| Exclamations per 1,000 words | Average rating | 0 +0.10 | + +0.10 |
| Long (3+ syllable) words | Average rating | 0 +0.10 | + +0.11 |
| Present-tense narration | Average rating | 0 -0.17 | − -0.19 |
| Sexual-action terms | Average rating | 0 -0.09 | − -0.10 |
| Syllables per word | Average rating | 0 +0.09 | + +0.11 |
| Physical action verbs | Comments | 0 -0.10 | − -0.10 |
| Variety of sexual vocabulary | Comments | 0 +0.09 | + +0.12 |
| Commas | Comments per 1,000 views | 0 +0.09 | + +0.11 |
| Ellipses | Comments per 1,000 views | 0 +0.09 | + +0.11 |
| Explicit blurb | Comments per 1,000 views | 0 -0.10 | − -0.10 |
| Jealousy & envy | Comments per 1,000 views | 0 +0.09 | + +0.10 |
| Consent and check-in language | Favorites | 0 +0.09 | + +0.10 |
| Jealousy & envy | Favorites | 0 +0.10 | + +0.10 |
| Question sentences | Favorites | 0 +0.09 | + +0.10 |
| Questions per 1,000 words | Favorites | 0 +0.10 | + +0.10 |
| Sentences with sexual language | Favorites | 0 +0.10 | + +0.10 |
| Where the first sex scene starts | Favorites | 0 -0.09 | − -0.10 |
| Certainty | Favorites per 1,000 views | 0 +0.10 | + +0.10 |
| Colons | Favorites per 1,000 views | 0 +0.09 | + +0.10 |
| Dashes | Favorites per 1,000 views | 0 +0.09 | + +0.10 |
| Doubled words | Favorites per 1,000 views | 0 +0.10 | + +0.10 |
| Relationship language | Favorites per 1,000 views | 0 +0.10 | + +0.11 |
| Repeated punctuation (!!, ?!) | Favorites per 1,000 views | 0 +0.10 | + +0.11 |
| Repeated word pairs | Favorites per 1,000 views | 0 -0.10 | − -0.11 |
| Profanity | Ratings (number of) | 0 +0.08 | + +0.11 |
| Unrecognized words | Reading-list adds per 1,000 views | 0 +0.09 | + +0.10 |
| Everyday vocabulary | Views | 0 +0.10 | + +0.10 |
| Word variety (type–token ratio) | Views | 0 -0.09 | − -0.10 |
| Words before first explicit term | Views per month | 0 -0.09 | − -0.10 |

**Gone** (30)

| Characteristic | Measure | Before | After |
|---|---|---|---|
| Everyday vocabulary | Average rating | − -0.10 | 0 -0.10 |
| One-sentence paragraphs | Average rating | + +0.10 | 0 +0.09 |
| Positive emotion | Average rating | + +0.11 | 0 +0.10 |
| Anxiety & fear | Comments | + +0.11 | 0 +0.10 |
| Dialogue/narration alternation | Comments | − -0.10 | 0 -0.10 |
| Excitement & arousal | Comments | − -0.10 | 0 -0.09 |
| Median sentence length | Comments | − -0.10 | 0 -0.09 |
| Rare words | Comments | − -0.10 | 0 -0.09 |
| Paragraphs with dialogue | Comments per 1,000 views | + +0.11 | 0 +0.10 |
| Time jumps | Comments per 1,000 views | + +0.10 | 0 +0.09 |
| Words before first explicit term | Comments per 1,000 views | + +0.10 | 0 +0.09 |
| Emotional disclosure | Favorites | + +0.10 | 0 +0.10 |
| Median paragraph length | Favorites | − -0.10 | 0 -0.10 |
| Negative emotion | Favorites | + +0.10 | 0 +0.09 |
| Present-tense share | Favorites | − -0.11 | 0 -0.10 |
| Dominance language | Favorites per 1,000 views | + +0.10 | 0 +0.10 |
| Descriptive & sensory language in the first fifth | Ratings (number of) | − -0.10 | 0 -0.09 |
| Dominance language | Ratings (number of) | − -0.11 | 0 -0.10 |
| Median paragraph length | Ratings (number of) | − -0.10 | 0 -0.10 |
| Interpersonal closeness | Ratings per 1,000 views | + +0.10 | 0 +0.10 |
| Rare words | Ratings per 1,000 views | − -0.10 | 0 -0.09 |
| Reading ease (Flesch) | Ratings per 1,000 views | + +0.10 | 0 +0.10 |
| Emotional disclosure | Reading-list adds per 1,000 views | + +0.10 | 0 +0.10 |
| Exclamations per 1,000 words | Reading-list adds per 1,000 views | + +0.10 | 0 +0.10 |
| Physical sensation words | Reading-list adds per 1,000 views | − -0.10 | 0 -0.08 |
| You / your | Reading-list adds per 1,000 views | + +0.11 | 0 +0.09 |
| Average paragraph length | Views | + +0.10 | 0 +0.10 |
| Dominance language | Views | − -0.10 | 0 -0.09 |
| Where sexual language peaks | Views | + +0.11 | 0 +0.10 |
| Focus on a few words | Views per month | + +0.10 | 0 +0.10 |

Changes per genre (characteristic × measure pairs whose direction changed):

| Genre | Changes |
|---|---|
| All genres | 61 |
| Anal | 154 |
| BDSM | 128 |
| Chain Stories | 118 |
| Crossdressing | 158 |
| Erotic Couplings | 149 |
| Erotic Horror | 107 |
| Exhibitionist & Voyeur | 154 |
| Fan Fiction & Celebrities | 103 |
| Fetish | 149 |
| First Time | 104 |
| Gay Male | 157 |
| Group Sex | 176 |
| How To | 164 |
| Humor & Satire | 97 |
| Interracial Love | 159 |
| Lesbian Sex | 138 |
| Letters & Transcripts | 130 |
| Loving Wives | 142 |
| Mature | 155 |
| Mind Control | 161 |
| Non-Erotic | 115 |
| NonHuman | 157 |
| Novels and Novellas | 136 |
| Reluctance/NonConsent | 127 |
| Reviews & Essays | 141 |
| Romance | 180 |
| Sci-Fi & Fantasy | 140 |
| Taboo/Incest | 149 |
| Toys & Masturbation | 137 |
| Transgender | 160 |

### 4. The Genres page

(Characteristic, genre) pairs that clearly differ from all genres, per option:

| Option | Clearly differ |
|---|---|
| All stories | 922 → 897 |
| Published 2000–2009 | 810 → 883 |
| Published 2010–2019 | 1,095 → 1,046 |
| Published 2020 or later | 853 → 885 |
| Under 2,000 words | 747 → 844 |
| 2,000–5,000 words | 895 → 878 |
| 5,000 words or more | 693 → 765 |
| At least 10,000 views | 963 → 946 |
| At least 25 ratings | 955 → 936 |

All stories: 101 pairs changed (▲ higher, ▼ lower, ≠ a different mix, · no clear difference; r is the rank-biserial correlation, or for named groups the total variation distance).

| Characteristic | Genre | Before | After |
|---|---|---|---|
| Adverbs in speech tags | Letters & Transcripts | · -0.26 | ▼ -0.25 |
| Affection & love | Erotic Horror | ▼ -0.21 | · -0.19 |
| Affection & love | Humor & Satire | ▼ -0.21 | · -0.17 |
| Affection & love | Sci-Fi & Fantasy | · -0.20 | ▼ -0.20 |
| Agency (deciding & trying) | Reluctance/NonConsent | ▲ +0.23 | · +0.20 |
| Anatomical terms | Mind Control | · -0.19 | ▼ -0.20 |
| Anxiety & fear | Sci-Fi & Fantasy | · +0.19 | ▲ +0.21 |
| Author’s story count | Mind Control | · +0.20 | ▲ +0.22 |
| Average speech length | Anal | ▼ -0.20 | · -0.16 |
| Average word length | Loving Wives | · -0.20 | ▼ -0.21 |
| Build-up of sexual language | Erotic Horror | ▼ -0.20 | · -0.18 |
| Build-up of sexual language | Fan Fiction & Celebrities | ▲ +0.23 | · +0.19 |
| Commands among speech | Romance | ▼ -0.20 | · -0.20 |
| Descriptive & sensory language in the first fifth | Novels and Novellas | ▼ -0.23 | · -0.19 |
| Distancing phrases | NonHuman | · +0.20 | ▲ +0.22 |
| Dominance language | Loving Wives | ▼ -0.21 | · -0.20 |
| Dominance language | Romance | · -0.19 | ▼ -0.21 |
| Ellipses | Fan Fiction & Celebrities | ▲ +0.21 | · +0.20 |
| Everyday vocabulary | Non-Erotic | ▲ +0.20 | · +0.20 |
| Excitement & arousal | Erotic Couplings | ▲ +0.20 | · +0.18 |
| Excitement & arousal | Fan Fiction & Celebrities | ▲ +0.21 | · +0.20 |
| Exclamation sentences | Humor & Satire | · +0.19 | ▲ +0.20 |
| Exclamations in dialogue | Toys & Masturbation | · -0.17 | ▼ -0.21 |
| Exclamations per 1,000 words | Fan Fiction & Celebrities | ▲ +0.20 | · +0.19 |
| Exclamations per 1,000 words | Humor & Satire | · +0.20 | ▲ +0.21 |
| Explicit title | How To | · +0.19 | ▲ +0.21 |
| Familiarity | Non-Erotic | ▲ +0.20 | · +0.19 |
| Feminine share of he/she pronouns | Toys & Masturbation | ▲ +0.21 | · +0.17 |
| First-person share of pronouns | Toys & Masturbation | · +0.19 | ▲ +0.21 |
| General sexual words | Novels and Novellas | · -0.19 | ▼ -0.22 |
| He / she / they in narration | Chain Stories | ▲ +0.21 | · +0.18 |
| Home settings | Mature | ▲ +0.21 | · +0.19 |
| Interpersonal closeness | Crossdressing | ▼ -0.22 | · -0.19 |
| Interpersonal closeness | Erotic Horror | ▼ -0.23 | · -0.19 |
| Interpersonal closeness | How To | ▼ -0.20 | · -0.17 |
| Intimacy | Mind Control | · -0.20 | ▼ -0.22 |
| Long (3+ syllable) words | Gay Male | ▼ -0.20 | · -0.19 |
| Long words (7+ letters) | Humor & Satire | ▲ +0.22 | · +0.19 |
| Negative emotion | Anal | ▼ -0.20 | · -0.17 |
| One-sentence paragraphs | Humor & Satire | ▲ +0.22 | · +0.20 |
| Outdoor settings | Chain Stories | · +0.19 | ▲ +0.20 |
| Outdoor settings | Reviews & Essays | ▼ -0.21 | · -0.17 |
| Paragraph count | Crossdressing | ▼ -0.23 | · -0.20 |
| Paragraph count | Sci-Fi & Fantasy | · +0.19 | ▲ +0.20 |
| Part number | First Time | · -0.20 | ▼ -0.22 |
| Passive constructions | Sci-Fi & Fantasy | · +0.19 | ▲ +0.22 |
| Passive sentences | Erotic Horror | ▲ +0.22 | · +0.19 |
| Passive sentences | Letters & Transcripts | ▼ -0.20 | · -0.18 |
| Physical sensation words | Anal | ▲ +0.20 | · +0.17 |
| Physical sensation words | Erotic Couplings | ▲ +0.21 | · +0.20 |
| Physical sensation words | Novels and Novellas | · -0.20 | ▼ -0.23 |
| Plain ‘said’ in dialogue tags | How To | ▲ +0.22 | · +0.20 |
| Plain ‘said’ in dialogue tags | Reviews & Essays | ▲ +0.25 | · +0.20 |
| Positive emotion | Romance | · +0.20 | ▲ +0.21 |
| Profanity | Novels and Novellas | · -0.19 | ▼ -0.21 |
| Pronoun composition | Toys & Masturbation | ▲ +0.23 | · +0.19 |
| Public settings | Exhibitionist & Voyeur | · +0.18 | ▲ +0.21 |
| Publication year | Novels and Novellas | ▼ -0.22 | · -0.20 |
| Question sentences | How To | · -0.18 | ▼ -0.21 |
| Question sentences | Novels and Novellas | ▲ +0.23 | · +0.20 |
| Reading ease (Flesch) | Sci-Fi & Fantasy | ▼ -0.21 | · -0.20 |
| Repeated word pairs | How To | · +0.20 | ▲ +0.21 |
| Repeated word pairs | Novels and Novellas | ▼ -0.21 | · -0.20 |
| Scene breaks per 1,000 words | Sci-Fi & Fantasy | · +0.20 | ▲ +0.21 |
| Sentence count | Crossdressing | ▼ -0.22 | · -0.19 |
| Sentences starting the same way | Toys & Masturbation | · +0.18 | ▲ +0.21 |
| Sentences with sexual language | Mind Control | · -0.19 | ▼ -0.22 |
| Sex scenes | Group Sex | ▲ +0.21 | · +0.19 |
| Sex scenes | Sci-Fi & Fantasy | ▼ -0.22 | · -0.19 |
| Sex scenes per 10,000 words | Exhibitionist & Voyeur | ▲ +0.21 | · +0.19 |
| Sexual language in the first fifth | Novels and Novellas | · -0.19 | ▼ -0.22 |
| Sexual language in the last fifth | How To | ▼ -0.21 | · -0.17 |
| Shame & embarrassment | Non-Erotic | · -0.19 | ▼ -0.21 |
| Shame & embarrassment | Reluctance/NonConsent | · +0.17 | ▲ +0.22 |
| Short sentences (≤5 words) | Non-Erotic | ▲ +0.21 | · +0.19 |
| Sight words | Chain Stories | ▲ +0.21 | · +0.19 |
| Smell words | Erotic Horror | ▲ +0.20 | · +0.19 |
| Sound words | Chain Stories | · +0.19 | ▲ +0.20 |
| Story age (years online) | Novels and Novellas | ▲ +0.22 | · +0.20 |
| Submission language | How To | ▼ -0.21 | · -0.18 |
| Submission language | Humor & Satire | · -0.20 | ▼ -0.21 |
| Thinking verbs | Novels and Novellas | ▲ +0.20 | · +0.19 |
| Thinking verbs | Romance | ▲ +0.22 | · +0.19 |
| Time jumps | Loving Wives | · +0.19 | ▲ +0.21 |
| Title length | How To | ▲ +0.22 | · +0.20 |
| Title marks a chapter/part | First Time | ▼ -0.20 | · -0.18 |
| Title word count | Fan Fiction & Celebrities | ▲ +0.21 | · +0.20 |
| Title word count | How To | ▲ +0.20 | · +0.17 |
| Title word count | Toys & Masturbation | · -0.19 | ▼ -0.20 |
| Unique words | Mind Control | ▲ +0.21 | · +0.20 |
| Untagged speech lines | Non-Erotic | ▲ +0.25 | · +0.20 |
| Variety of sexual vocabulary | Erotic Horror | · -0.19 | ▼ -0.22 |
| Very long paragraphs (‘walls of text’) | Chain Stories | ▼ -0.22 | · -0.19 |
| We / us / our | Chain Stories | ▼ -0.22 | · -0.16 |
| We / us / our in narration | Group Sex | · +0.19 | ▲ +0.20 |
| Where sexual language peaks | How To | ▼ -0.20 | · -0.20 |
| Word count | Crossdressing | ▼ -0.21 | · -0.19 |
| Word count | Novels and Novellas | ▲ +0.20 | · +0.19 |
| Words before first explicit term | Sci-Fi & Fantasy | ▲ +0.21 | · +0.17 |
| You / your in narration | Humor & Satire | · +0.18 | ▲ +0.20 |
| You / your in narration | Non-Erotic | ▲ +0.23 | · +0.19 |

### 5. The Trends page

Characteristics that clearly changed from the first window to the last, per genre and option:

| Genre | All stories | Under 2,000 words | 2,000–5,000 words | 5,000 words or more |
|---|---|---|---|---|
| All genres | 26 → 25 | 8 | 16 → 13 | 15 |
| Anal | 10 → 17 | 0 | 4 → 8 | 0 |
| BDSM | 2 → 6 | 0 → 1 | 0 | 0 |
| Chain Stories | 0 | 0 | 0 | 0 |
| Crossdressing | 8 → 26 | 0 | 0 | 0 |
| Erotic Couplings | 22 → 23 | 0 → 4 | 2 → 3 | 0 |
| Erotic Horror | 6 → 15 | 0 | 3 → 5 | 0 |
| Exhibitionist & Voyeur | 15 → 19 | 0 → 4 | 1 | 0 |
| Fan Fiction & Celebrities | 9 → 12 | 0 | 0 | 0 |
| Fetish | 20 → 36 | 0 | 0 | 0 |
| First Time | 2 → 4 | 0 | 1 | 0 |
| Gay Male | 2 → 5 | 0 | 0 → 3 | 0 |
| Group Sex | 17 → 25 | 0 | 6 → 5 | 0 |
| How To | 11 → 17 | 3 → 6 | 0 → 3 | 0 |
| Humor & Satire | 2 → 9 | 0 | 0 → 2 | 0 |
| Interracial Love | 3 → 5 | 0 | 2 → 1 | 0 |
| Lesbian Sex | 18 → 27 | 0 → 3 | 0 | 0 |
| Letters & Transcripts | 5 → 11 | 1 → 9 | 0 | 0 |
| Loving Wives | 19 → 20 | 0 | 5 → 7 | 0 |
| Mature | 14 → 15 | 0 | 0 → 2 | 0 |
| Mind Control | 7 → 15 | 0 | 0 | 0 |
| Non-Erotic | 4 → 13 | 8 → 10 | 0 → 4 | 0 → 4 |
| NonHuman | 7 → 9 | 0 | 0 | 0 |
| Novels and Novellas | 13 → 18 | 0 | 0 → 10 | 3 → 6 |
| Reluctance/NonConsent | 23 → 29 | 0 | 0 → 14 | 0 |
| Reviews & Essays | 11 → 19 | 7 → 10 | 0 | 0 |
| Romance | 14 → 22 | 0 | 0 → 1 | 0 |
| Sci-Fi & Fantasy | 8 → 14 | 0 | 0 | 0 |
| Taboo/Incest | 22 → 36 | 0 | 1 | 0 → 19 |
| Toys & Masturbation | 8 → 13 | 0 → 3 | 0 | 0 |
| Transgender | 0 → 7 | 0 | 0 | 0 |

All genres, All stories: 5 characteristics changed their verdict (▲ rose, ▼ fell, ≠ changed, · no clear change; r as on the Genres page).

| Characteristic | Before | After |
|---|---|---|
| Build-up of sexual language | ▼ -0.21 | · -0.19 |
| Dialogue in the last fifth | ▲ +0.21 | · +0.18 |
| Physical action verbs | · -0.20 | ▼ -0.20 |
| Syllables per word | · +0.18 | ▲ +0.20 |
| Touch words | ▼ -0.21 | · -0.20 |

Genres too few to compare (`meta.trend.too_few`):

| Option | Genres | Now too few | Now comparable |
|---|---|---|---|
| All stories | 2 → 1 | – | Transgender |
| Under 2,000 words | 24 → 16 | – | Anal, BDSM, Erotic Couplings, Exhibitionist & Voyeur, Fetish, Lesbian Sex, Loving Wives, Mature |
| 2,000–5,000 words | 16 → 9 | – | BDSM, Gay Male, How To, Non-Erotic, Novels and Novellas, Reluctance/NonConsent, Toys & Masturbation |
| 5,000 words or more | 29 → 25 | – | Group Sex, Loving Wives, Non-Erotic, Taboo/Incest |

### 6. The featured questions and the Popular list

| Featured question | Verdict |
|---|---|
| Do readers favorite first-person stories more often? | no clear pattern (-0.03) → no clear pattern (-0.04) |
| Do longer Romance stories get more views per month? | tend to more (+0.44) → tend to more (+0.42) |
| Do stories with more dialogue get more comments per 1,000 views? | tend to more (+0.19) → tend to more (+0.18) |
| Is more sexual language linked to more favorites per 1,000 views? | no clear pattern (-0.08) |
| Do older stories have more views? | tend to more (+0.58) → tend to more (+0.57) |

The Popular list, with the average rating in all genres:

| Characteristic | Verdict |
|---|---|
| Word count | tend to more (+0.49) → tend to more (+0.50) |
| First-person narration | no clear pattern (-0.07) |
| Present-tense narration | no clear pattern (-0.17) → tend to less (-0.19) |
| Dialogue share | tend to more (+0.29) |
| Sexual language | tend to less (-0.14) → tend to less (-0.15) |
| Words before first explicit term | no clear pattern (+0.05) → no clear pattern (+0.06) |
| Emotional tone | no clear pattern (-0.02) → no clear pattern (-0.04) |
| Part of a series | tend to more (+0.40) |
| Has an author’s note | tend to more (+0.22) |
| Reading ease (Flesch) | no clear pattern (-0.00) → no clear pattern (-0.01) |
| Talking to the reader | no clear pattern (-0.00) → no clear pattern (+0.01) |
| Publication year | tend to more (+0.21) → tend to more (+0.22) |

### 7. Files

Gzip at level 9, as a host compresses them. KB = 1,000 bytes.

|  | Before | After |
|---|---|---|
| Files | 1,818 | 1,818 |
| Total, raw | 70.28 MB | 73.71 MB |
| Total, gzipped | 26.69 MB | 28.05 MB |
| Largest genres/ file (limit 60 KB) | genres/views10k.json 56.6 KB | genres/ratings25.json 56.9 KB |
| Largest trends/ file (limit 16 KB) | trends/all/all.json 12.4 KB | trends/all/all.json 12.4 KB |
| meta.json, gzipped | 20.1 KB | 20.1 KB |
| patterns.json, gzipped | 11.0 KB | 12.2 KB |

Files over their limit after: none.
