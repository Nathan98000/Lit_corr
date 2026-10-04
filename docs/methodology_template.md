# Methodology

This page explains, in plain English, where the data come from and how every
measure is calculated. The full machine-readable list of columns is in
`data_dictionary.json` and [DATA_DICTIONARY.md](DATA_DICTIONARY.md).

> **What the numbers mean.** The visualizations show descriptive associations
> in stories on Literotica. They do not establish causation, and the stories
> and users represented on Literotica should not be assumed to represent all
> erotic fiction, readers, or human sexuality.

A story "with more dialogue" that "tends to get more favorites" might simply be
written by more experienced authors, published in a busier year, or belong to
a sub-genre with a loyal audience. Nothing here says that changing a story
would change its popularity.

---

## 1. Where the data come from

### Pages that were read

The collector reads only ordinary public web pages that a logged-out visitor
can open, and only those that Literotica's `robots.txt` allows for general
crawlers:

* `robots.txt` itself (re-read at most once a day);
* the home page, once, to read the list of story categories;
* category listing pages (`/c/<category>`), to see which stories exist;
* story pages (`/s/<story>` and `/s/<story>?page=N`), to read the text and the
  statistics shown on the page.

It never uses Literotica's JSON API (`/api/`, disallowed by robots.txt), tag
pages (`/tags/`, disallowed), search, account pages, comments, voting or
favourite buttons, or anything that requires logging in. It never stores
private profile information: from the author information embedded in a story
page it keeps only the public username and numeric id and the public counts of
the author's stories and followers. In the processed data and the handoff to
the website, authors are not identified at all.

### How politely

One request at a time, by default at least 8 seconds apart plus a random
0–4 seconds, with hard caps of 6 per minute, 300 per hour and 3,000 per day
(counted from a persistent log, so restarting does not reset them). Every page
is cached and never downloaded twice. Retries happen only for temporary server
errors, with exponentially growing waits. A "too many requests" answer slows
everything down and pauses for 30 minutes; a second one within 24 hours ends
the session for six hours. An "access refused" answer, a bot-check/CAPTCHA
page, an age gate, a redirect to a login page or to another site, a server that
refuses connections, or a long run of "missing" pages ends the session
immediately and blocks new sessions for a day. The collector identifies itself
honestly and never imitates a web browser or tries to get around any
restriction. See [SITE_RULES.md](SITE_RULES.md).

### When

Each story's statistics are a snapshot taken when its first page was fetched
(`stats_observed_at` in the raw data). The first and last collection sessions
and the range of snapshot dates are recorded in `collection_manifest.json`.
Because collection is slow, snapshots are spread over days or weeks; story
ages are always measured from each story's own snapshot date.

### Which stories (sampling)

Literotica has far too many stories to read them all politely, so the
collector reads a sample:

1. **Categories.** Literotica's own categories as listed on the site. Audio,
   illustrated and non-English categories are skipped by default because the
   text measures need English prose.
2. **Listing pages.** A category's main page on Literotica is a showcase of
   "hot" and "new" stories, so it is never used to choose stories; that would
   favour popular or recent stories from the start. Instead the collector uses
   the category's browse-by-title index (stories starting with A, with B, …,
   and with other characters), which lists every story in the category whatever
   its popularity. A letter's later pages have addresses like `…/S-2`. The
   collector reads only the first page of each letter and takes the page counts
   from the site's own page bar there: the "previous" link on the first S page
   points to the last R page (e.g. `R-8`, so R has 8 pages), and the "last" link
   marks the end of the sequence. Only if a page shows no page bar does it check
   which page numbers exist. Together the letters form one long sequence of
   listing pages, and the collector then reads a *systematic sample* of at least
   20 of these pages, spread evenly along the whole sequence with a random
   starting point. Every listing page, and so every story, has the same chance
   of being chosen, without reading every page.
3. **Stories.** From the stories seen on those listing pages, a fixed-seed
   random sample (by default 300 per category) is drawn and collected
   round-robin across categories, so the sample stays balanced across
   categories if collection stops early.

Because every category gets a similar number of stories regardless of its
size, "All categories" summaries should use `sampling_weight` (category size ÷
analysed stories in that category) so that big categories count in proportion
to their size. Category sizes are the site's own counts, embedded in its
category pages.

### How stories are identified

A story's identity is its address on the site: `/s/<slug>` → `<slug>`. The
slug deduplicates stories across listing pages and reruns. Literotica's
numeric submission id (embedded in the page) is kept in the raw data as a
cross-check. Processed files use `story_key`, a keyed hash of the slug whose
secret never leaves the collecting computer, so a key cannot be traced back to
a story. The website never shows any identifier.

The file handed over to build the website leaves out story text, titles,
descriptions, URLs and author names, and coarsens anything that could point to
one story or author. Only tags used by at least 20 stories are kept. Author
story and follower counts become bands. Raw totals are rounded to three
significant figures. The exact publication date is dropped, keeping year,
month and weekday.

Literotica publishes long works as several separate stories (chapters, "Ch.
02"), each with its own page and statistics. Here **each chapter is one
story**, exactly as on the site. Series membership and part number are
recorded so later parts can be compared with first parts.

### How the statistics were read

Story pages contain the page's own data in machine-readable form (exact
numbers such as `view_count: 12345`). The collector reads those first. If they
are missing it falls back to schema.org metadata, then to the numbers visible
on the page, which can be abbreviated ("12.3k"). Abbreviated values are kept,
rounded, and flagged (`pop_views_approx`). The quality report lists how many
values came from each source.

The page data also includes the *number* of ratings, which the site does not
always show on screen. That makes "ratings per 1,000 views" possible: how often
a reader who opened the story bothered to rate it.

---

## 2. Popularity measures

{{table:Popularity (raw)}}

### Engagement per reader

Raw totals mostly reflect how many people opened a story. Dividing by views
asks a different question: of the people who opened it, how many favorited or
commented? These ratios are only computed for stories with at least 100 views
(configurable), because 1 favorite out of 12 views is not a meaningful rate.

{{table:Popularity (ratios)}}

### Story age

A ten-year-old story has had ten years to collect views; a story published
last month has not. To make old and new stories easier to compare, totals are
also divided by the number of months the story had been online when its
statistics were recorded (with a minimum of one month, so brand-new stories
do not get absurd rates). This is a simple descriptive adjustment, not a
statistical correction: real stories get most of their views soon after
publication.

{{table:Popularity (age-normalised)}}

{{table:Site badges}}

---

## 3. How text is processed

All text measures are simple counts and ratios that anyone could check by
hand. No machine-learning model is used.

* **Words.** Runs of letters or digits; contractions ("don't") and possessives
  count as one word. Story length = number of such words.
* **Paragraphs.** As laid out on the page: every paragraph, list item, heading or
  other block of text in the story body, in order. Lines with no letters or digits
  (`* * *`, `-----`, `......`, `o0o`) are scene breaks, not paragraphs.
* **Paratext.** Authors often open or close a story with notes to the reader
  (an author's or editor's note, a disclaimer such as "all characters are
  fictional", a dedication, thanks to an editor, "please vote", "thanks for
  reading"), and put chapter headings or "To be continued" in the text. These
  are recognised with plain rules (labels such as "Author's note:", typical
  phrases, header lines such as "Tags:", the story's title repeated at the top,
  a byline, and the scene-break line that usually closes an opening note) and
  set aside: the text measures see only the story. They still count for "Has an
  author's note" and "Asks readers to vote or comment", and for comparing our
  word count with Literotica's. The rules only look at a run of paragraphs at
  the start and end of the story (at most 15 paragraphs and 40% / 30% of the
  words); inside the text, only headings, short end markers and paragraphs
  labelled as an author's note are set aside. In hand checks of the opening and
  closing paragraphs of stories not used to write the rules, 93% of story
  openings and endings were handled correctly (95% CI 84–97%); every error was a
  note that was missed, and no story text was set aside. Notes written without
  any recognisable wording are the usual miss.
* **Sentences.** A sentence ends at `.`, `!`, `?` or `…` followed by a space
  when the next word starts with a capital letter, a digit or an opening quote,
  so that `"Stop!" she said.` stays one sentence. That sentence still counts as
  an exclamation, and `"Why?" she asked.` as a question. Common abbreviations
  (Mr., Dr., St.) and initials do not end sentences; numbers such as 6.2 do not
  either; every paragraph break does.
* **Dialogue.** Words between quotation marks. Straight and curly double
  quotes are recognised; stories that use single quotes for speech are
  detected and handled (apostrophes inside words such as "don't" are never
  treated as quotes). A quote left open at the end of a paragraph is closed
  there, matching the usual convention for speech that runs over several
  paragraphs. Stories with no quotation marks count as having no dialogue.
* **Narration** means the words outside quotation marks.
* **Word lists (lexicons).** Most "language" measures count words from plain
  text files in the `lexicons/` folder, which anyone can open and edit.
  Matching is whole-word and case-insensitive; `kiss*` covers kisses, kissed,
  kissing; multi-word phrases ("of course") are matched as consecutive words
  and their words are not counted again in the same measure. Lexicon counts
  do not understand negation ("not happy" counts as happy), sarcasm or context.
* **Rates.** Most measures are expressed per 1,000 words so that long and short
  stories can be compared. Measures that need a minimum amount of text
  (500-word windows, 1,000 words for pacing) are left blank for shorter
  stories rather than filled with unreliable numbers. Texts under 100 words get
  no text measures at all.

---

## 4. Story measures

{{table:Story basics}}

{{table:Title & description}}

{{table:Series}}

{{table:Site metadata}}

{{table:Publication}}

---

## 5. Narration

### First person or third person?

Narrative perspective is estimated from pronouns **in the narration only**
(dialogue is removed first, because characters say "I" and "you" whatever the
narration does). For every 1,000 narration words the collector counts
first-person singular pronouns (I, me, my, mine, myself, I'm…) and
second-person pronouns (you, your…):

* **first person** if there are at least 15 first-person pronouns per 1,000
  narration words;
* **second person** if there are at least 15 second-person pronouns and more
  of them than first-person ones;
* **third person** if there are fewer than 5 first-person pronouns;
* **mixed** in between, and **unknown** if there are fewer than 200 narration
  words.

**How well does this work?** It was checked on 284 passages of about 5,000
words each, taken from 14 public-domain novels whose narration is known
(first person: *Jane Eyre*, *Great Expectations*, *Treasure Island*,
*Huckleberry Finn*, *The Adventures of Sherlock Holmes*, *The Great Gatsby*;
third person: three Austen novels, *Alice in Wonderland*, three Chesterton
books, Edgeworth's *The Parent's Assistant*). **93.7% of passages were
labelled correctly, 2.8% were confidently wrong, and the rest were labelled
"mixed" or "unknown".** Most errors are passages with long letters or
stories-within-stories. *Moby-Dick*, whose narrator drifts between first
person, essay and stage drama, is a good example of genuinely mixed narration:
only a quarter of its passages count as clearly first person. The script is
in `scripts/validate_narration.py`. This is a word-counting heuristic, not an
understanding of the story.

### Tense

Present versus past tense is estimated from about 70 very common verbs
(is/was, says/said, looks/looked, walk after "I/we/you/they" …) in the
narration: present if at least 60% of those forms are present tense, past if
40% or fewer, otherwise mixed. All 14 validation novels came out as past tense.

{{table:Narration}}

{{table:Dialogue}}

### Characters

The number of recurring names is estimated from capitalised words that are
not at the start of a sentence, appear at least three times, and are not
usually ordinary words (a word like "Rose" is ignored if "rose" also appears
in lower case), not titles (Mr, Sir), not terms of address (Mom, Master), not
days, months or nationalities. This mostly counts characters but can also
count place or brand names; a first name and a surname count as two names;
and it misses names that only ever start a sentence. On a 5,000-word passage
of *Emma* it found Harriet, Emma, Martin, Knightley, Elton, Woodhouse,
Goddard, Robert, Smith and Nash, plus four place names (Hartfield, Highbury,
Abbey, Mill). Treat it as "how many proper names keep coming up", a rough
indicator of cast size.

{{table:Characters}}

### Gendered language

Pronoun counts describe who is on the page, not who wrote the story. In
first-person stories the narrator's gender is invisible to these counts. Treat
these as rough descriptions of the text, not as statements about authors,
characters' identities or readers.

{{table:Gendered language}}

---

## 6. Style

{{table:Punctuation}}

{{table:Questions & exclamations}}

### Readability

Readability formulas combine sentence length with word length (letters or
syllables). Syllables are estimated with a spelling rule (vowel groups minus
silent endings), which is right for roughly 85–90% of words; averaged over a
whole story the error is small. Fiction with a lot of short dialogue scores as
"easy" by these formulas. That is what they measure, not a judgement of
quality.

{{table:Readability & sentence complexity}}

### Vocabulary

The simple type–token ratio (different words ÷ all words) always falls as a
text gets longer, so it cannot fairly compare a 1,000-word story with a
20,000-word one. The moving-average version (MATTR) fixes this by computing the
ratio in every 500-word window and averaging. The segment version does the
same in consecutive 1,000-word blocks. Word commonness uses the open
*wordfreq* English frequency list (Zipf scale: 7 ≈ "the", 3 ≈ about one
occurrence per million words).

{{table:Vocabulary}}

### Repetition

Repetition is measured inside fixed 500-word windows (again so that long
stories are not penalised for length): how much of the content vocabulary is
taken up by the ten most frequent words, and how often two- and three-word
sequences recur. Sentence-level measures compare each sentence with the one
before it.

{{table:Repetition}}

{{table:Style}}

---

## 7. Sexual content (explicitness)

Explicitness is estimated by counting words from three editable lists:
anatomical terms, sexual-action terms, and other sexual vocabulary
(`lexicons/sexual_*.txt`). Ambiguous everyday words (head, lips, mouth,
tongue, came, ride, stroke …) are deliberately left out, so the measure
undercounts euphemistic writing and slightly overcounts stories that use
"fuck" as an intensifier. **A keyword score is not a measure of how explicit a
story feels to a reader.** The position of the first sexual term gives a
simple "slow burn" indicator.

{{table:Sexual content}}

---

## 8. Language

### Emotion

Ten small, hand-checked word lists: positive, negative, affection/love,
anxiety/fear, anger, sadness, excitement/arousal, shame/embarrassment and
jealousy, plus a combined "any emotion" count. "Positive" combines the positive
and affection lists; "negative" combines the negative, anxiety, anger, sadness,
shame and jealousy lists. Emotional tone is (positive − negative) ÷ (positive +
negative).

{{table:Emotion}}

### Psychological distancing and immediacy

Writing guides call verbs such as *noticed, realised, felt, saw, wondered*
"filter words": they report experience through a character's perception
instead of showing it directly. Distancing phrases ("it seemed", "as if") do
something similar. Immediacy words ("now", "here", "suddenly") and
present-tense narration (above) do the opposite.

{{table:Distancing & immediacy}}

### Hedging and certainty

Hedges soften statements ("maybe", "kinda", "seemed"); certainty words
assert them ("definitely", "of course", "always", "never"). The balance
measure places each story on a single hedging ↔ certainty scale.

{{table:Hedging & certainty}}

{{table:Sensory language}}

{{table:Intimacy & relationships}}

### Agency and control

These describe the language on the page. They are not psychological
assessments of anyone. Passive constructions are found with a simple pattern
("be/get" + past participle, e.g. "was taken", "got tied"). Very common
adjective-like cases ("was tired", "was excited") are excluded, but some remain.
A spoken command is a quoted passage that begins with a verb such as "come",
"kneel", "look" or "don't …" and is not a question.

{{table:Agency & control}}

---

## 9. Pacing

To get simple "story trajectory" measures, each story of at least 1,000
words is cut into five equal parts by word count, and five densities are
computed in each part: sexual language, emotional language, dialogue, physical
action verbs, and descriptive/sensory language. For each one the dataset
keeps the value in the first fifth, the value in the last fifth, the
difference (positive = builds towards the end) and the position of the peak.

{{table:Pacing}}

---

## 10. Missing data, quality flags and exclusions

Nothing is silently dropped. Every story selected for the sample stays in the
dataset, including those that could not be collected, with a list of quality
flags (`qc_flags`). The flags are explained in the quality report. Examples
are a story that no longer exists, missing metadata, more favorites than views,
text that does not look like English, identical text to another story, our
word count disagreeing with Literotica's by more than 25%, and a story longer
than the page cap.

A story is **included in analyses** (`analysis_include`) when it has text of at
least 100 words, a category, a publication date and a view count, has a
plausible date, looks like English, and is not a second copy of identical
text. `exclusion_reasons` lists why a story is not included. Individual
measures can still be blank for included stories (for example, the
favorites-per-view ratio for a story with fewer than 100 views, or pacing for a
story under 1,000 words). Charts should report how many stories each number is
based on.

**Incomplete text.** When not every page of a story was collected (stories
longer than the page cap, pages that could not be fetched, or the cheaper
"first page only" mode), measures that need the whole story are left blank:
word and sentence totals, counts, where things first happen, endings
(author's notes, requests for votes), recurring names and all pacing measures.
Rates per 1,000 words and shares are kept as estimates from the pages that were
collected, and Literotica's own word count (`site_words_count`) still gives the
length. A story with no text at all gets no text measures (blank, never zero).

{{table:Quality control}}

{{table:Identifiers & category}}

---

## 11. Limitations

* **Descriptive only.** Associations can be produced by other factors
  (author experience, sub-genre, publication year, how the site promotes
  stories). They are not causes.
* **A sample.** The stories are a random sample of the listing pages that were
  read, not every story on the site. Small categories and rare characteristics
  give small samples; charts should show sample sizes.
* **Snapshots.** Views and favorites keep growing. Each story's numbers were
  recorded once, on its own collection date.
* **Site counting rules are unknown.** How Literotica counts views (for example
  per page or per visit) is not public.
* **Selection on the site itself.** Literotica's readers, voters and
  commenters are self-selected, and the site's front-page features and "hot"
  badges affect what gets read.
* **Heuristics, not understanding.** Narration, tense, dialogue, passive voice,
  commands and names are estimated with transparent rules that are usually but
  not always right. Word-list measures cannot see context, negation or irony.
* **English only.** Non-English text is flagged and excluded.
* **Not representative.** Literotica's stories, authors and readers should not
  be taken to represent erotic fiction, readers, or human sexuality in general.
