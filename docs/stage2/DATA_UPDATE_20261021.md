# Stage 2 data update: litcorr_stage2_handoff_20261021.zip

The site's aggregates, rebuilt from the finished collection, with the tests and READMEs brought in line, the same way
as the 20261013 update (`docs/stage2/DATA_UPDATE_20261013.md`, section 8). Branch `data-update-20261021`, made from
`site-changes-20261020` at `3313676` (the owner's changes of 2026-10-20, not yet on `main`). Aggregate numbers only: no
story text, titles, authors or story-level rows.

## 1. The data

**The handoff.** `python -m litcorr process` (once, offline, about 3½ minutes: 5,400 stories parsed and measured, the
12,573 earlier ones taken from the cache) wrote `litcorr_stage2_handoff_20261021.zip`, processed 2026-10-21 12:36 UTC.
The collection ran from October 1 to October 20, 2026; the popularity snapshots from October 1 to 21. The older zips
stay in `data/handoff/`. `process` left `docs/METHODOLOGY.md`, `docs/DATA_DICTIONARY.md` and
`docs/data_dictionary.json` unchanged; `docs/word_lists.html` changed only its "processed on" date.

**The collection is complete.**

| | 20261013 | 20261021 |
|---|---|---|
| Sampled (the queue, replacements included) | 17,977 | 17,982 |
| Collected | 12,573 (70%) | 17,973 |
| Still waiting in the queue | 5,400 | 0 |
| Could not be collected | 4 | 9 (5 failed, 4 gone; each replaced by the next story in its genre's order) |
| Included in the charts | 12,568 | 17,964 |
| Per genre in the charts | 417–420 | 572–600 (Chain Stories 572 of its whole listing of 573; How To 596; Reviews & Essays 598) |

The quality report no longer says "PARTIAL", and `collection_manifest.json` has `sampling_weights_provisional: false`.
With nothing left in the queue, `site-data`'s step that drops queued stories (D3 of the last update) drops nothing.

**From the quality report** (against the 20261013 one, as a share of the stories with text):

* **Exclusions:** 18 in all, the same four kinds as before: no text 9, not English 5 (3 before), under 100 words 3
  (1 before), duplicate text 1.
* **Flags at about the same rates:** missing ratings 2.29% → 2.22%, script-style dialogue 0.82% → 0.89%, unbalanced
  quotation marks 0.20% → 0.22%, truncated text 0.09% → 0.10%, parse warnings 3 → 5, title differs from the listing
  1 → 3, one story whose page names another category than the listing it was found on (the site counts it in the
  genre it was sampled from).
* **One blocked page:** the story refused with HTTP 403 on 2026-10-16/17 (the collector fix 752b25c); it is one of the
  5 that could not be collected. No bot or challenge page.
* **The same dictionary:** 187 characteristics and 10 measures, none new or gone; the measures' coverage moved by at
  most 0.1 point.

## 2. What visitors will see differently

The appendix (section 6) has every number; the biggest changes:

* **The counts.** "About 18,000 stories" in the kicker (and before `meta.json` arrives) and in `index.html`'s
  descriptions; How it works says "about 600 stories in each of 30 genres", "17,964 are used in the charts", and its
  missing-data line "Of the 17,982 sampled stories, 17,964 are used in the charts. 18 were left out".
* **Popularity's "tend to" titles:** no reversal. In all genres 43 of the 1,870 characteristic × measure pairs changed:
  14 new patterns and 29 gone, every one at the rule's edge (rank correlations of 0.08 to 0.11 against the rule's 0.1). Each genre has
  more stories, so between 113 and 232 of its pairs changed. Every featured question and Popular characteristic keeps
  its verdict.
* **The Genres page:** 91 of its All-stories verdicts changed, all near the rule's 0.2 (Non-Erotic's later first sex
  scene the clearest new one, r 0.24 → 0.31; Reviews & Essays' fewer adverbs in speech tags is now compared and lower).
  Romance stands out on 24 characteristics (28 before). No genre is too few to compare with All stories any more; with
  a year-published option a few still are for some characteristics (Chain Stories' 22 stories of 2020 or later with a
  sex scene).
* **The Trends page:** every genre is compared now: Chain Stories, too few before, has 30 stories from 2020 or later,
  the rule's minimum, and 2 clear changes. All genres still has 25 of 180 clear changes; commas no longer clearly rose
  and word variety now clearly fell. Most genres show more clear changes (Mind Control 15 → 42).
* **Groups:** 16 characteristics' group edges moved a little (paragraphs over 150 words: "Under 2%" for "Under 2.5%").
  No characteristic changed its kind.

## 3. Tests changed

Each new value was checked by a second route (a Python script over the aggregate files, not the line the failing test
printed) before it went in. No rule test was loosened and no real-data test deleted.

| Test | Old | New | Checked by |
|---|---|---|---|
| `dataUpdate`, `genresLinks`, `howItWorksReadable`, `words`, `quickWins` | about 13,000; about 420; 12,568 / 12,573 | about 18,000; about 600; 17,964 / 17,973 | `meta.json` counts; the genres' median n |
| `genresChart` story length | 6 of 30; no Longer list; 3,630 (2,030–6,420), 1,270–4,930; first person 57%, 25–98%, 9 genres | 7 of 30; ▲ Novels and Novellas; 3,620 (2,030–6,400), 1,260–5,080; 58%, 23–98%, 8 | `genres/all.json` f, r and q |
| `genresChart` a tie goes A–Z | sentences, Anal and Humor & Satire at −0.22 | unique words, How To and Letters & Transcripts at −0.56 | every tie in `genres/all.json` |
| `genresChart` too few (F63) | Chain Stories (19) of 2020+; Reviews & Essays' adverbs (29) with All stories | Transgender (12); Chain Stories (22), Non-Erotic (13); How To (16), Reviews & Essays (15); four of 2020+; none with All stories | counts under 30 in each file |
| `genresChart` F66 formats | rare words 1.7%–3.4%, 1.6–3.7%; paragraph 31.7–62.2, 36.4–65.3; dialogue build-up −6.6% to 11.2%, −2.8–5.9% | 1.8%–3.4%, 1.7–3.6%; 31.8–62.0, 36.2–66.2; −6.9% to 11.2%, −2.0–4.0% | `genres/all.json` q |
| `genresForms` | Earlier: Non-Erotic, Reviews & Essays; How To 80%, 2.530; perspective 55/0.1/2/42/0.8%; romance language 44%, 0.418, Romance 72%, 0.743 | Reviews & Essays, Non-Erotic; 78% (466 of 596), 2.450; 56/0.2/2/41/0.8%; 43%, 0.417, 70%, 0.703 | `genres/all.json` r, z, q |
| `genresProfile` | Romance 28/18/10; ties at 0.27 and −0.35; How To 112, Reviews 113, Couplings 8; edges 136; columns 8.0, 1.72, 72%/44%, 80%·2.53 | 24/16/8; ties at −0.42, 0.25 and 0.34; 111, 117, 5; 139; 8.1, 1.66, 70%/43%, 78%·2.45 | flags, r and medians per genre |
| `genresProfile` F60 | Chain Stories' 19 stories of 2020+ too few | its 30 compared (7 stand out, 167 of 183 compared) | `genres/y2020.json` n and r |
| `oneGenre` named groups too few | Chain Stories, 2020+, real (19) | the same page with its count made 12 (`fewStoriesFetch` over the real files) | no genre under 30 in any option now |
| `review4Data` reading-list titles | 1,418 | 1,804 | `patterns.json` decoded |
| `review4QuickWins` Fell line | "and 1 more" | "and 2 more" (word variety joins) | `trends/all/all.json` f |
| `trends` rule's edge | all genres' action verbs at −0.2 | Mature's title length at 0.2 | every flagged |r| = 0.2 |
| `trendsChanges` | 3,571 / 4,647; Chain Stories uncompared; author's note 57, 19%; action verbs −0.2 | 5,109 / 6,700; every genre compared; 56, 20%; −0.201 | periods' n, t and q |
| `trendsReview` | 51.6 → 39.1 (−24%); 2,770 → 4,150 (+50%); 58% → 41%; 19% → 33%; Chain Stories null | 51.2 → 39.3 (−23%); 2,750 → 4,180 (+52%); 58% → 42%; 20% → 33%; its 2 changes (Tiny Genre keeps null) | `trends/all/*.json` |
| `exploreLayoutGuard` real digest | 03357ab4c6dda450 | cad91fdb07078923 (14,960 layouts, the same count) | no code change |
| `__fingerprints__/one-genre/` | | regenerated: the new numbers, rows and lists | no code change |
| `test_real_too_few_genres` (pytest) | `{"all": ["chain-stories"]}` | `{"all": []}` | `meta.json` |

Cases the new data lost and where they are kept: a genre with fewer than 10 stories with a characteristic ("fewer than
10") in the test data's Tiny Genre; a genre too few to compare on the Trends page in Tiny Genre; One genre's small-sample
state with made-up counts (`fewStoriesFetch`, added on 2026-10-20). The fixture digests did not change.

## 4. Checks

| | 20261013 | 20261021 | Limit |
|---|---|---|---|
| Tests | 675 Vitest, 229 pytest | 675 Vitest, 229 pytest; build passes | all pass |
| `meta.json` and the first chart file, gzipped | 20,239 + 17,985 B | 20,228 + 17,977 B | first load 155 KiB |
| Largest `genres/` file, gzipped | 55.7 KB | 56.2 KB | 60 KB |
| Largest `trends/` file, gzipped | 12.4 KB | 12.4 KB | 16 KB |
| `patterns.json`, gzipped | 12.2 KB | 13.3 KB | 40 KB |
| Aggregates | 1,720 files, 69.8 MB, 26.9 MB gzipped | 1,720 files, 71.9 MB, 27.7 MB gzipped | |

In a browser (the dev server): the kicker, Popularity's default chart, the Trends page for Chain Stories, How it
works' sample and missing-data sections; no console errors. Not re-run this time: round 4's glyph-box and layout-shift
scripts (the rule tests that check every real chart's labels and cards passed).

## 5. Doing this again

`docs/stage2/DATA_UPDATE_20261013.md`, section 8, still holds. The placeholder count is a literal in `App.jsx` and
`index.html` (three places); `dataUpdate.test.jsx` names the value to use.

## 6. Appendix: the comparison script's output

`python scripts/compare_aggregates.py <20261013 build> site/public/aggregates`:

### Aggregates: litcorr_stage2_handoff_20261013.zip → litcorr_stage2_handoff_20261021.zip

#### 1. Source and counts

|  | Before | After |
|---|---|---|
| Handoff | litcorr_stage2_handoff_20261013.zip | litcorr_stage2_handoff_20261021.zip |
| Processed | 2026-10-13 | 2026-10-21 |
| Collected | 2026-10-01 to 2026-10-12 | 2026-10-01 to 2026-10-20 |
| Popularity snapshots | 2026-10-01 to 2026-10-12 | 2026-10-01 to 2026-10-21 |
| Sampled | 12,577 | 17,982 |
| With text | 12,573 | 17,973 |
| Included (in the charts) | 12,568 | 17,964 |
| Excluded: duplicate_of_another_story | 1 | 1 |
| Excluded: no_text | 4 | 9 |
| Excluded: possibly_not_english | 3 | 5 |
| Excluded: text_too_short | 1 | 3 |

Stories per genre: 417–420 before, 572–600 after.

| Genre | Stories |
|---|---|
| Anal | 419 → 600 |
| BDSM | 420 → 600 |
| Chain Stories | 417 → 572 |
| Crossdressing | 420 → 600 |
| Erotic Couplings | 420 → 600 |
| Erotic Horror | 418 → 600 |
| Exhibitionist & Voyeur | 419 → 600 |
| Fan Fiction & Celebrities | 419 → 600 |
| Fetish | 417 → 600 |
| First Time | 419 → 600 |
| Gay Male | 419 → 600 |
| Group Sex | 419 → 600 |
| How To | 419 → 596 |
| Humor & Satire | 420 → 600 |
| Interracial Love | 417 → 600 |
| Lesbian Sex | 420 → 600 |
| Letters & Transcripts | 419 → 599 |
| Loving Wives | 420 → 600 |
| Mature | 419 → 600 |
| Mind Control | 419 → 600 |
| Non-Erotic | 418 → 600 |
| NonHuman | 419 → 600 |
| Novels and Novellas | 419 → 600 |
| Reluctance/NonConsent | 419 → 600 |
| Reviews & Essays | 418 → 598 |
| Romance | 420 → 600 |
| Sci-Fi & Fantasy | 419 → 600 |
| Taboo/Incest | 419 → 600 |
| Toys & Masturbation | 419 → 599 |
| Transgender | 419 → 600 |

Each “Only include” option's stories:

| Option | Stories |
|---|---|
| All stories | 12,568 → 17,964 |
| Published 2000–2009 | 3,571 → 5,109 |
| Published 2010–2019 | 4,350 → 6,155 |
| Published 2020 or later | 4,647 → 6,700 |
| Under 2,000 words | 3,806 → 5,443 |
| 2,000–5,000 words | 4,903 → 7,065 |
| 5,000 words or more | 3,848 → 5,438 |
| At least 10,000 views | 9,571 → 13,639 |
| At least 25 ratings | 10,319 → 14,732 |

#### 2. What the site offers

Measures and their coverage:

| Measure | Before | After |
|---|---|---|
| Favorites per 1,000 views | 1.0 | 1.0 |
| Comments per 1,000 views | 1.0 | 1.0 |
| Ratings per 1,000 views | 0.978 | 0.979 |
| Reading-list adds per 1,000 views | 1.0 | 1.0 |
| Views per month | 1.0 | 1.0 |
| Views | 1.0 | 1.0 |
| Favorites | 1.0 | 1.0 |
| Comments | 1.0 | 1.0 |
| Ratings (number of) | 0.978 | 0.979 |
| Average rating | 0.977 | 0.978 |

Characteristics: 187 before, 187 after. Added: none. Removed: none.

Changed kinds (the chart's, then the Genres and Trends pages' form):

None.

Changed groups (16 characteristics):

| Characteristic | Before | After |
|---|---|---|
| Very long paragraphs (‘walls of text’) | None · Under 2.5% · 2.5–8% · 8%+ | None · Under 2% · 2–8% · 8%+ |
| I / me / my in narration | None · Under 4 · 4–80 · 80–100 · 100+ | None · Under 5 · 5–80 · 80–100 · 100+ |
| She / her / hers | Under 10 · 10–40 · 40–50 · 50–70 · 70+ | Under 9 · 9–40 · 40–50 · 50–70 · 70+ |
| Dashes | None · Under 0.7 · 0.7–2.5 · 2.5+ | None · Under 0.8 · 0.8–2.5 · 2.5+ |
| Syllables per word | Under 1.26 · 1.26–1.3 · 1.3–1.32 · 1.32–1.36 · 1.36+ | Under 1.26 · 1.26–1.3 · 1.3–1.32 · 1.32–1.34 · 1.34+ |
| Unique words | Under 600 · 600–800 · 800–1,200 · 1,200–1,500 · 1,500+ | Under 600 · 600–800 · 800–1,000 · 1,000–1,500 · 1,500+ |
| Doubled words | None · Under 0.5 · 0.5–0.8 · 0.8–1.5 · 1.5+ | None · Under 0.5 · 0.5–0.9 · 0.9–1.5 · 1.5+ |
| Profanity | Under 0.6 · 0.6–1.5 · 1.5–3 · 3–5 · 5+ | Under 0.7 · 0.7–1.5 · 1.5–3 · 3–5 · 5+ |
| Physical action verbs | Under 10 · 10–12 · 12–16 · 16–20 · 20+ | Under 10 · 10–12 · 12–16 · 16–18 · 18+ |
| Italics | None · Under 0.6 · 0.6+ | None · Under 0.5 · 0.5+ |
| General sexual words | Under 0.8 · 0.8–1.5 · 1.5–2.5 · 2.5–4 · 4+ | Under 0.9 · 0.9–1.5 · 1.5–2.5 · 2.5–4 · 4+ |
| Where the first sex scene starts | Under 3% · 3–15% · 15–30% · 30–50% · 50%+ | Under 4% · 4–15% · 15–30% · 30–50% · 50%+ |
| Emotional tone | Under 0.2 · 0.2–0.4 · 0.4–0.5 · 0.5–0.7 · 0.7+ | Under 0.2 · 0.2–0.4 · 0.4–0.6 · 0.6–0.7 · 0.7+ |
| Sexual language in the first fifth | Under 2 · 2–5 · 5–12 · 12–20 · 20+ | Under 2 · 2–6 · 6–12 · 12–20 · 20+ |
| Sexual language in the last fifth | Under 8 · 8–20 · 20–30 · 30–50 · 50+ | Under 9 · 9–20 · 20–30 · 30–50 · 50+ |
| Build-up of descriptive & sensory language | Under −10 · −10 to 0 · 0 to 5 · 5 to 10 · 10 or more | Under −10 · −10 to 0 · 0 to 5 · 5 to 15 · 15 or more |

#### 3. Popularity (Explore): “tend to” results

All genres' “tend to” results per measure (of the characteristics in both builds):

| Measure | Tend to |
|---|---|
| Favorites per 1,000 views | 77 → 70 |
| Comments per 1,000 views | 70 → 67 |
| Ratings per 1,000 views | 83 |
| Reading-list adds per 1,000 views | 61 → 60 |
| Views per month | 39 → 38 |
| Views | 40 → 39 |
| Favorites | 45 → 43 |
| Comments | 47 → 50 |
| Ratings (number of) | 50 → 47 |
| Average rating | 69 |

All genres: 43 changes (0 reversed, 14 new, 29 gone). Each gives the direction (+, − or 0 for no clear pattern) and the effect (the rank correlation, or for yes/no characteristics the rank-biserial correlation).

**Reversed (the direction flipped)** (0)

None.

**New** (14)

| Characteristic | Measure | Before | After |
|---|---|---|---|
| Everyday vocabulary | Average rating | 0 -0.10 | − -0.10 |
| Anxiety & fear | Comments | 0 +0.10 | + +0.11 |
| Jealousy & envy | Comments | 0 +0.10 | + +0.10 |
| Sex scenes per 10,000 words | Comments | 0 -0.10 | − -0.11 |
| One-sentence paragraphs | Comments per 1,000 views | 0 +0.10 | + +0.10 |
| Certainty | Favorites | 0 +0.10 | + +0.10 |
| Dialogue in the first fifth | Ratings (number of) | 0 +0.10 | + +0.10 |
| Touch words | Ratings (number of) | 0 -0.09 | − -0.10 |
| Control & restraint | Ratings per 1,000 views | 0 -0.10 | − -0.11 |
| Rare words | Ratings per 1,000 views | 0 -0.09 | − -0.10 |
| Reading ease (Flesch) | Ratings per 1,000 views | 0 +0.10 | + +0.10 |
| Present-tense narration | Reading-list adds per 1,000 views | 0 -0.08 | − -0.10 |
| Average paragraph length | Views | 0 +0.10 | + +0.10 |
| Time jumps | Views per month | 0 +0.09 | + +0.10 |

**Gone** (29)

| Characteristic | Measure | Before | After |
|---|---|---|---|
| Sexual-action terms | Average rating | − -0.10 | 0 -0.10 |
| Commands among speech | Comments per 1,000 views | − -0.10 | 0 -0.10 |
| Descriptive words | Comments per 1,000 views | − -0.10 | 0 -0.09 |
| She / her / hers | Comments per 1,000 views | − -0.10 | 0 -0.10 |
| We / us / our | Comments per 1,000 views | + +0.10 | 0 +0.09 |
| Average paragraph length | Favorites | − -0.11 | 0 -0.10 |
| Consent and check-in language | Favorites | + +0.10 | 0 +0.10 |
| Where the first sex scene starts | Favorites | − -0.10 | 0 -0.10 |
| Anatomical terms | Favorites per 1,000 views | − -0.10 | 0 -0.09 |
| Colons | Favorites per 1,000 views | + +0.10 | 0 +0.09 |
| Dashes | Favorites per 1,000 views | + +0.10 | 0 +0.09 |
| Emotional tone | Favorites per 1,000 views | − -0.11 | 0 -0.10 |
| Exclamation sentences | Favorites per 1,000 views | + +0.11 | 0 +0.10 |
| Repeated punctuation (!!, ?!) | Favorites per 1,000 views | + +0.11 | 0 +0.10 |
| Repeated word pairs | Favorites per 1,000 views | − -0.11 | 0 -0.10 |
| Average paragraph length | Ratings (number of) | − -0.10 | 0 -0.10 |
| Emotional disclosure | Ratings (number of) | + +0.11 | 0 +0.10 |
| I / me / my in narration | Ratings (number of) | + +0.10 | 0 +0.10 |
| Present-tense share | Ratings (number of) | − -0.10 | 0 -0.09 |
| Profanity | Ratings (number of) | + +0.11 | 0 +0.10 |
| Exclamations in dialogue | Ratings per 1,000 views | + +0.10 | 0 +0.10 |
| Familiarity | Ratings per 1,000 views | + +0.11 | 0 +0.10 |
| Untagged speech lines | Ratings per 1,000 views | + +0.10 | 0 +0.10 |
| Action verbs in the last fifth | Reading-list adds per 1,000 views | − -0.10 | 0 -0.10 |
| Unrecognized words | Reading-list adds per 1,000 views | + +0.10 | 0 +0.09 |
| Focus on one main name | Views | + +0.10 | 0 +0.08 |
| Short sentences (≤5 words) | Views | − -0.10 | 0 -0.10 |
| I / me / my in narration | Views per month | + +0.10 | 0 +0.09 |
| Words before first explicit term | Views per month | − -0.10 | 0 -0.09 |

Changes per genre (characteristic × measure pairs whose direction changed):

| Genre | Changes |
|---|---|
| All genres | 43 |
| Anal | 179 |
| BDSM | 150 |
| Chain Stories | 132 |
| Crossdressing | 137 |
| Erotic Couplings | 175 |
| Erotic Horror | 145 |
| Exhibitionist & Voyeur | 157 |
| Fan Fiction & Celebrities | 113 |
| Fetish | 130 |
| First Time | 164 |
| Gay Male | 156 |
| Group Sex | 170 |
| How To | 164 |
| Humor & Satire | 122 |
| Interracial Love | 177 |
| Lesbian Sex | 172 |
| Letters & Transcripts | 160 |
| Loving Wives | 140 |
| Mature | 171 |
| Mind Control | 164 |
| Non-Erotic | 160 |
| NonHuman | 208 |
| Novels and Novellas | 179 |
| Reluctance/NonConsent | 156 |
| Reviews & Essays | 167 |
| Romance | 132 |
| Sci-Fi & Fantasy | 160 |
| Taboo/Incest | 138 |
| Toys & Masturbation | 208 |
| Transgender | 232 |

#### 4. The Genres page

(Characteristic, genre) pairs that clearly differ from all genres, per option:

| Option | Clearly differ |
|---|---|
| All stories | 897 → 872 |
| Published 2000–2009 | 883 → 885 |
| Published 2010–2019 | 1,046 → 976 |
| Published 2020 or later | 885 → 862 |

All stories: 91 pairs changed (▲ higher, ▼ lower, ≠ a different mix, · no clear difference; r is the rank-biserial correlation, or for named groups the total variation distance).

| Characteristic | Genre | Before | After |
|---|---|---|---|
| Adverbs in speech tags | Reviews & Essays | · – | ▼ -0.42 |
| Affection & love | Sci-Fi & Fantasy | ▼ -0.20 | · -0.19 |
| Agency (deciding & trying) | Reluctance/NonConsent | · +0.20 | ▲ +0.23 |
| Anatomical terms | Mind Control | ▼ -0.20 | · -0.18 |
| Anxiety & fear | Reviews & Essays | · -0.18 | ▼ -0.20 |
| Author’s story count | Fan Fiction & Celebrities | ▲ +0.21 | · +0.20 |
| Average sentence length | Toys & Masturbation | ▲ +0.21 | · +0.18 |
| Average word length | Loving Wives | ▼ -0.21 | · -0.20 |
| Blurb word count | Novels and Novellas | ▼ -0.21 | · -0.18 |
| Build-up of sexual language | Erotic Couplings | ▲ +0.21 | · +0.20 |
| Colons | Humor & Satire | ▲ +0.22 | · +0.17 |
| Colons | Letters & Transcripts | ▲ +0.22 | · +0.18 |
| Commands among speech | Toys & Masturbation | ▼ -0.22 | · -0.19 |
| Descriptive & sensory language in the first fifth | NonHuman | · +0.20 | ▲ +0.22 |
| Dialogue in the last fifth | Anal | ▼ -0.21 | · -0.20 |
| Dialogue in the last fifth | Novels and Novellas | · +0.19 | ▲ +0.23 |
| Dialogue/narration alternation | BDSM | ▲ +0.21 | · +0.20 |
| Distancing phrases | Letters & Transcripts | ▼ -0.21 | · -0.19 |
| Distancing phrases | NonHuman | ▲ +0.22 | · +0.20 |
| Dominance language | Exhibitionist & Voyeur | ▼ -0.21 | · -0.20 |
| Dominance language | Romance | ▼ -0.21 | · -0.19 |
| Doubled words | Mind Control | · +0.19 | ▲ +0.21 |
| Ellipses | Fan Fiction & Celebrities | · +0.20 | ▲ +0.20 |
| Emotional tone | Letters & Transcripts | · +0.19 | ▲ +0.20 |
| Emotional tone | Reviews & Essays | · -0.17 | ▼ -0.20 |
| Exclamations in dialogue | Toys & Masturbation | ▼ -0.21 | · -0.20 |
| First-person narration | Crossdressing | ▲ +0.22 | · +0.19 |
| First-person share of pronouns | Erotic Horror | ▼ -0.20 | · -0.20 |
| First-person share of pronouns | Toys & Masturbation | ▲ +0.21 | · +0.16 |
| Focus on one main name | Non-Erotic | ▼ -0.21 | · -0.18 |
| He / she / they in narration | NonHuman | · +0.19 | ▲ +0.23 |
| He / she / they in narration | Toys & Masturbation | ▼ -0.24 | · -0.19 |
| Interpersonal closeness | Erotic Horror | · -0.19 | ▼ -0.20 |
| Interpersonal closeness | Lesbian Sex | · +0.20 | ▲ +0.21 |
| Intimacy | Sci-Fi & Fantasy | · -0.20 | ▼ -0.20 |
| Later part of a series | Chain Stories | · +0.20 | ▲ +0.20 |
| Later part of a series | Toys & Masturbation | ▼ -0.20 | · -0.20 |
| Median sentence length | Mind Control | · -0.18 | ▼ -0.20 |
| Median sentence length | Toys & Masturbation | ▲ +0.22 | · +0.19 |
| Modal verbs | Reviews & Essays | · +0.19 | ▲ +0.21 |
| Narrative perspective | Crossdressing | ▲ +0.23 | · +0.20 |
| Number of tags | Romance | ▼ -0.21 | · -0.19 |
| One-sentence paragraphs | Toys & Masturbation | ▼ -0.22 | · -0.20 |
| Outdoor settings | Romance | ▲ +0.21 | · +0.19 |
| Outdoor settings | Toys & Masturbation | ▼ -0.21 | · -0.18 |
| Paragraph count | Mind Control | ▲ +0.20 | · +0.20 |
| Paragraph count | Sci-Fi & Fantasy | ▲ +0.20 | · +0.18 |
| Part of a series | Toys & Masturbation | ▼ -0.20 | · -0.20 |
| Passive constructions | Erotic Couplings | · -0.20 | ▼ -0.20 |
| Passive constructions | NonHuman | ▲ +0.22 | · +0.19 |
| Passive sentences | Erotic Horror | · +0.19 | ▲ +0.21 |
| Passive sentences | NonHuman | ▲ +0.21 | · +0.19 |
| Physical action verbs | Erotic Couplings | ▲ +0.21 | · +0.20 |
| Plain ‘said’ in dialogue tags | Chain Stories | ▼ -0.22 | · -0.19 |
| Plain ‘said’ in dialogue tags | Reviews & Essays | · +0.20 | ▲ +0.21 |
| Positive emotion | Erotic Horror | · -0.17 | ▼ -0.20 |
| Positive emotion | Romance | ▲ +0.21 | · +0.19 |
| Present-tense share | Humor & Satire | ▲ +0.23 | · +0.18 |
| Pronoun composition | Chain Stories | · +0.20 | ▲ +0.20 |
| Public settings | Exhibitionist & Voyeur | ▲ +0.21 | · +0.20 |
| Question sentences | Non-Erotic | ▲ +0.21 | · +0.20 |
| Questions per 1,000 words | Mind Control | · +0.20 | ▲ +0.20 |
| Recurring names | Erotic Couplings | ▼ -0.21 | · -0.18 |
| Recurring names | Mind Control | ▲ +0.21 | · +0.19 |
| Recurring names | Non-Erotic | ▲ +0.21 | · +0.18 |
| Repeated three-word phrases | Erotic Horror | · -0.19 | ▼ -0.21 |
| Repeated word pairs | Erotic Horror | · -0.19 | ▼ -0.22 |
| Sadness | Group Sex | · -0.19 | ▼ -0.20 |
| Scene breaks per 1,000 words | Chain Stories | · +0.19 | ▲ +0.21 |
| Sentence count | Humor & Satire | ▼ -0.22 | · -0.20 |
| Sentence count | Sci-Fi & Fantasy | ▲ +0.21 | · +0.19 |
| Sentences starting the same way | Toys & Masturbation | ▲ +0.21 | · +0.20 |
| Sexual language in the first fifth | Novels and Novellas | ▼ -0.22 | · -0.19 |
| Shame & embarrassment | Reviews & Essays | ▼ -0.20 | · -0.20 |
| Shame & embarrassment | Toys & Masturbation | ▼ -0.22 | · -0.18 |
| Sound words | Sci-Fi & Fantasy | ▲ +0.21 | · +0.19 |
| Title length | Chain Stories | · +0.20 | ▲ +0.20 |
| Title length | Non-Erotic | · -0.18 | ▼ -0.20 |
| Title word count | Toys & Masturbation | ▼ -0.20 | · -0.20 |
| Touch words | Erotic Couplings | ▲ +0.21 | · +0.19 |
| Unique words | Crossdressing | ▼ -0.20 | · -0.20 |
| Unrecognized words | Mind Control | ▲ +0.20 | · +0.17 |
| Unrecognized words | Toys & Masturbation | ▼ -0.20 | · -0.16 |
| We / us / our | How To | ▼ -0.20 | · -0.20 |
| We / us / our | NonHuman | · -0.18 | ▼ -0.20 |
| Where the first sex scene starts | Erotic Horror | · +0.20 | ▲ +0.20 |
| Where the first sex scene starts | Group Sex | ▼ -0.21 | · -0.19 |
| Where the first sex scene starts | Non-Erotic | · +0.24 | ▲ +0.31 |
| Word count | Novels and Novellas | · +0.19 | ▲ +0.21 |
| Words before first explicit term | Anal | · -0.20 | ▼ -0.21 |
| You / your in narration | Humor & Satire | ▲ +0.20 | · +0.17 |

#### 5. The Trends page

Characteristics that clearly changed from the first window to the last, per genre and option:

| Genre | All stories |
|---|---|
| All genres | 25 |
| Anal | 17 → 36 |
| BDSM | 6 → 19 |
| Chain Stories | 0 → 2 |
| Crossdressing | 26 → 30 |
| Erotic Couplings | 23 → 41 |
| Erotic Horror | 15 → 23 |
| Exhibitionist & Voyeur | 19 → 39 |
| Fan Fiction & Celebrities | 12 → 13 |
| Fetish | 36 → 49 |
| First Time | 4 → 11 |
| Gay Male | 5 → 11 |
| Group Sex | 25 → 37 |
| How To | 17 → 18 |
| Humor & Satire | 9 → 18 |
| Interracial Love | 5 → 6 |
| Lesbian Sex | 27 → 35 |
| Letters & Transcripts | 11 → 17 |
| Loving Wives | 20 → 30 |
| Mature | 15 → 18 |
| Mind Control | 15 → 42 |
| Non-Erotic | 13 → 27 |
| NonHuman | 9 → 20 |
| Novels and Novellas | 18 → 37 |
| Reluctance/NonConsent | 29 → 42 |
| Reviews & Essays | 19 → 23 |
| Romance | 22 → 29 |
| Sci-Fi & Fantasy | 14 → 21 |
| Taboo/Incest | 36 → 43 |
| Toys & Masturbation | 13 → 19 |
| Transgender | 7 → 8 |

All genres, All stories: 2 characteristics changed their verdict (▲ rose, ▼ fell, ≠ changed, · no clear change; r as on the Genres page).

| Characteristic | Before | After |
|---|---|---|
| Commas | ▲ +0.21 | · +0.20 |
| Word variety (type–token ratio) | · -0.19 | ▼ -0.20 |

Genres too few to compare (`meta.trend.too_few`):

| Option | Genres | Now too few | Now comparable |
|---|---|---|---|
| All stories | 1 → 0 | – | Chain Stories |

#### 6. The featured questions and the Popular list

| Featured question | Verdict |
|---|---|
| Do readers favorite first-person stories more often? | no clear pattern (-0.04) |
| Do longer Romance stories get more views per month? | tend to more (+0.42) → tend to more (+0.45) |
| Do stories with more dialogue get more comments per 1,000 views? | tend to more (+0.18) |
| Is more sexual language linked to more favorites per 1,000 views? | no clear pattern (-0.08) |
| Do older stories have more views? | tend to more (+0.57) → tend to more (+0.59) |

The Popular list, with the average rating in all genres:

| Characteristic | Verdict |
|---|---|
| Word count | tend to more (+0.50) |
| First-person narration | no clear pattern (-0.07) → no clear pattern (-0.08) |
| Present-tense narration | tend to less (-0.19) |
| Dialogue share | tend to more (+0.29) |
| Sexual language | tend to less (-0.15) → tend to less (-0.14) |
| Words before first explicit term | no clear pattern (+0.06) |
| Emotional tone | no clear pattern (-0.04) |
| Part of a series | tend to more (+0.40) → tend to more (+0.39) |
| Has an author’s note | tend to more (+0.22) |
| Reading ease (Flesch) | no clear pattern (-0.01) |
| Talking to the reader | no clear pattern (+0.01) → no clear pattern (+0.00) |
| Publication year | tend to more (+0.22) |

#### 7. Files

Gzip at level 9, as a host compresses them. KB = 1,000 bytes.

|  | Before | After |
|---|---|---|
| Files | 1,720 | 1,720 |
| Total, raw | 69.80 MB | 71.86 MB |
| Total, gzipped | 26.94 MB | 27.69 MB |
| Largest genres/ file (limit 60 KB) | genres/y2020.json 55.7 KB | genres/y2020.json 56.2 KB |
| Largest trends/ file (limit 16 KB) | trends/all/all.json 12.4 KB | trends/all/all.json 12.4 KB |
| meta.json, gzipped | 20.2 KB | 20.2 KB |
| patterns.json, gzipped | 12.2 KB | 13.3 KB |

Files over their limit after: none.

