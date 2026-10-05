<!-- Generated from docs/methodology_template.md by `python -m litcorr docs`. Edit the template, not this file. -->

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

| Variable | What it measures | Caveat |
|---|---|---|
| **Views** (`pop_views`) | Number of views shown for the story. | A running total as displayed by Literotica when the story was collected. Older stories have had more time to accumulate it; compare with the per-month version. Rounded to 3 significant figures in the Stage 2 handoff. |
| **Views abbreviated** (`pop_views_approx`) | True when only an abbreviated count (e.g. '12.3k') was available, so views are rounded. |  |
| **Favorites** (`pop_favorites`) | Number of readers who added the story to their favorites. | A running total as displayed by Literotica when the story was collected. Older stories have had more time to accumulate it; compare with the per-month version. Rounded to 3 significant figures in the Stage 2 handoff. |
| **Comments** (`pop_comments`) | Number of public comments on the story. | A running total as displayed by Literotica when the story was collected. Older stories have had more time to accumulate it; compare with the per-month version. Rounded to 3 significant figures in the Stage 2 handoff. |
| **Average rating** (`pop_rating`) | Average star rating (1–5) shown for the story. | Blank when the story had no ratings yet. Readers who vote are a small, self-selected group. |
| **Number of ratings** (`pop_rating_count`) | Number of readers who rated the story, from the story page's own data (not always shown on screen). | A running total as displayed by Literotica when the story was collected. Older stories have had more time to accumulate it; compare with the per-month version. Readers who vote are a small, self-selected group. Rounded to 3 significant figures in the Stage 2 handoff. |
| **Reading-list adds** (`pop_reading_lists`) | Number of times the story was added to readers' reading lists, when shown. | A running total as displayed by Literotica when the story was collected. Older stories have had more time to accumulate it; compare with the per-month version. Rounded to 3 significant figures in the Stage 2 handoff. |
| **Views (log scale)** (`pop_log10_views`) | Base-10 logarithm of views + 1; useful because view counts span several orders of magnitude. |  |

### Engagement per reader

Raw totals mostly reflect how many people opened a story. Dividing by views
asks a different question: of the people who opened it, how many favorited or
commented? These ratios are only computed for stories with at least 100 views
(configurable), because 1 favorite out of 12 views is not a meaningful rate.

| Variable | What it measures | Caveat |
|---|---|---|
| **Favorites per 1,000 views** (`pop_fav_per_1k_views`) | Favorites divided by views, times 1,000: how often a reader who opened the story favorited it. | Only computed when the story has at least the configured minimum number of views (default 100). |
| **Comments per 1,000 views** (`pop_comments_per_1k_views`) | Comments divided by views, times 1,000. | Only computed when the story has at least the configured minimum number of views (default 100). |
| **Ratings per 1,000 views** (`pop_ratings_per_1k_views`) | Number of ratings divided by views, times 1,000 (only when the number of ratings is available). | Only computed when the story has at least the configured minimum number of views (default 100). |
| **Reading-list adds per 1,000 views** (`pop_reading_lists_per_1k_views`) | Reading-list adds divided by views, times 1,000. | Only computed when the story has at least the configured minimum number of views (default 100). |

### Story age

A ten-year-old story has had ten years to collect views; a story published
last month has not. To make old and new stories easier to compare, totals are
also divided by the number of months the story had been online when its
statistics were recorded (with a minimum of one month, so brand-new stories
do not get absurd rates). This is a simple descriptive adjustment, not a
statistical correction: real stories get most of their views soon after
publication.

| Variable | What it measures | Caveat |
|---|---|---|
| **Views per month** (`pop_views_per_month`) | Views divided by the number of months the story had been online when collected. | Total divided by months online (minimum one month). A simple descriptive adjustment, not a statistical correction: views are not spread evenly over a story's life. |
| **Favorites per month** (`pop_favorites_per_month`) | Favorites divided by months online. | Total divided by months online (minimum one month). A simple descriptive adjustment, not a statistical correction: views are not spread evenly over a story's life. |
| **Comments per month** (`pop_comments_per_month`) | Comments divided by months online. | Total divided by months online (minimum one month). A simple descriptive adjustment, not a statistical correction: views are not spread evenly over a story's life. |

| Variable | What it measures | Caveat |
|---|---|---|
| **'Hot' badge** (`pop_is_hot`) | Literotica's 'H' (hot) badge, shown for highly rated stories. |  |
| **Writer's pick** (`pop_writers_pick`) | Literotica's Writer's Pick badge. |  |
| **Contest winner** (`pop_contest_winner`) | Story won a Literotica contest. |  |

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

| Variable | What it measures | Caveat |
|---|---|---|
| **Word count** (`story_words`) | Number of words in the story text (letters/digits, contractions count as one word). Author's notes, headings and other paratext are not counted (see Methodology). | Counted on the collected pages; long stories beyond the page cap are flagged as truncated. Blank when the collected text is incomplete (text_truncated). Use site_words_count for length then. |
| **Character count** (`story_chars`) | Number of characters in the story text (paratext excluded). | Blank when the collected text is incomplete (text_truncated). |
| **Sentence count** (`story_sentences`) | Number of sentences (see Methodology). | Blank when the collected text is incomplete (text_truncated). |
| **Paragraph count** (`story_paragraphs`) | Number of non-empty story paragraphs (paratext excluded). | Blank when the collected text is incomplete (text_truncated). |
| **Average sentence length** (`story_mean_sentence_words`) | Average number of words per sentence. |  |
| **Median sentence length** (`story_median_sentence_words`) | Median number of words per sentence. |  |
| **Average paragraph length** (`story_mean_paragraph_words`) | Average number of words per paragraph. |  |
| **Median paragraph length** (`story_median_paragraph_words`) | Median number of words per paragraph. |  |
| **One-sentence paragraphs** (`story_one_sentence_paragraph_share`) | Share of paragraphs that consist of a single sentence. |  |
| **Very long paragraphs ('walls of text')** (`story_long_paragraph_share`) | Share of paragraphs longer than 150 words. |  |
| **Scene breaks** (`story_scene_breaks`) | Number of scene-break lines inside the story: paragraphs with no letters or digits ('* * *', '-----', '......', 'o0o'). Lines that open or close the story are not counted. | Blank when the collected text is incomplete (text_truncated). |
| **Scene breaks per 1,000 words** (`story_scene_breaks_per_1k`) | Scene-break lines per 1,000 words. |  |
| **Has an author's note** (`story_has_author_note`) | Whether the story opens or closes with an author's or editor's note, disclaimer, dedication, copyright line or words to readers, or has a paragraph labelled as an author's note (see Methodology, 'Paratext'). | Rule-based; misses notes that use no recognisable wording (about 1 in 3 in a hand check). Blank when the collected text is incomplete (text_truncated). |
| **Asks readers to vote or comment** (`story_requests_feedback`) | Whether the author's notes, or the first or last three story paragraphs, ask readers to vote, rate, comment or give feedback. | Blank when the collected text is incomplete (text_truncated). |

| Variable | What it measures | Caveat |
|---|---|---|
| **Title length** (`title_chars`) | Number of characters in the title. |  |
| **Title word count** (`title_words`) | Number of words in the title. |  |
| **Title marks a chapter/part** (`title_has_chapter_marker`) | Whether the title contains a chapter or part marker such as 'Ch. 02', 'Pt. 3' or ends with a number. |  |
| **Description length** (`desc_chars`) | Number of characters in the author's short description. |  |
| **Description word count** (`desc_words`) | Number of words in the description. |  |

| Variable | What it measures | Caveat |
|---|---|---|
| **Part of a series** (`series_is_part`) | Whether the story belongs to a series (series link on the page, a series of 2+ parts, or a chapter marker in the title). |  |
| **Part number** (`series_part_number`) | Which part of its series the story is (1 = first), from the series list or the title. |  |
| **Parts in series** (`series_parts_count`) | Number of parts in the series, when shown. |  |
| **Later part of a series** (`series_is_later_part`) | Whether the story is part 2 or later of a series. |  |

| Variable | What it measures | Caveat |
|---|---|---|
| **Word count (site)** (`site_words_count`) | Literotica's own word count for the story, when shown. |  |
| **Pages on site** (`story_pages`) | Number of web pages the story is split into. |  |
| **Number of tags** (`meta_tag_count`) | Number of tags the author attached. |  |
| **Author's story count** (`author_stories_count`) | Number of stories the author had published (public profile count) when collected. | Measured at collection time, not at publication time. In the Stage 2 handoff rounded down to bands (1, 2, 6, 21, 51, 101, 201+). |
| **Author's followers** (`author_followers_count`) | Number of followers the author had (public profile count) when collected. | Measured at collection time, so it partly reflects the author's later success. In the Stage 2 handoff rounded down to bands (0, 10, 100, 1,000, 10,000+). |

| Variable | What it measures | Caveat |
|---|---|---|
| **Publication date** (`date_published`) | Date the story was published (Literotica's approval date). | Not included in the Stage 2 handoff (year, month and weekday are). |
| **Publication year** (`pub_year`) | Year the story was published. |  |
| **Publication month** (`pub_month`) | Month the story was published. |  |
| **Publication weekday** (`pub_weekday`) | Day of the week the story was published. |  |
| **Published on a weekend** (`pub_is_weekend`) | Whether the story was published on a Saturday or Sunday. |  |
| **Days online** (`age_days`) | Days between publication and the moment its statistics were recorded by the collector. | Measured at collection time; stories collected on different days have slightly different reference dates. |
| **Years online** (`age_years`) | age_days divided by 365.25. |  |

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
* **third person** if there are fewer than 5 first-person pronouns, or if
  first-person pronouns are fewer than 8% of the first-person and third-person
  (he, she, they…) pronouns together: a third-person story in which a character's
  thoughts or a letter are reported in the first person;
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
understanding of the story. (The novel check above was run before the 8% rule for
third person was added in Stage 1B.)

**On this corpus** (Stage 1B), 48 stories drawn about evenly from the classes (12
first, 11 second, 11 third, 12 mixed, 2 unknown) were checked by hand: 39 were
labelled correctly by the original rule, almost all errors being third-person
stories labelled mixed. The 8% rule was designed on that sample (46 of 48 correct
with it; the two left: a story narrated as "we", labelled mixed, and a chat
transcript labelled second person). On 15 further stories that it moved from
"mixed" to "third", all 15 were indeed third person. Because the classes are very
unequal in size (first 53%, third 40%, second 5%, mixed 1.5%), accuracy over the
whole corpus is higher than on the balanced sample: about 97% already before the
change.

### Tense

Present versus past tense is estimated from about 70 very common verbs
(is/was, says/said, looks/looked, walk after "I/we/you/they" …) in the
narration: present if at least 60% of those forms are present tense, past if
40% or fewer, otherwise mixed. All 14 validation novels came out as past tense,
and on this corpus a hand-check of 45 stories found every label right (one story
could not be judged).

| Variable | What it measures | Caveat |
|---|---|---|
| **I / me / my** (`pov_first_singular_per_1k`) | First-person singular pronouns (I, me, my, mine, myself, I'm …) per 1,000 words, dialogue included. |  |
| **We / us / our** (`pov_first_plural_per_1k`) | First-person plural pronouns per 1,000 words. |  |
| **You / your** (`pov_second_per_1k`) | Second-person pronouns per 1,000 words. |  |
| **He / she / they** (`pov_third_per_1k`) | Third-person personal pronouns (he, she, they and their forms) per 1,000 words. |  |
| **I / me / my in narration** (`pov_first_singular_narr_per_1k`) | First-person singular pronouns per 1,000 words of narration (outside quotation marks). |  |
| **You / your in narration** (`pov_second_narr_per_1k`) | Second-person pronouns per 1,000 narration words. |  |
| **He / she / they in narration** (`pov_third_narr_per_1k`) | Third-person pronouns per 1,000 narration words. |  |
| **First-person share of pronouns** (`pov_first_person_share`) | In narration, first-person pronouns as a share of first- plus third-person pronouns. | A word-counting heuristic, not true narrative analysis; see Methodology for how it was validated. |
| **Narrative perspective** (`pov_class`) | Estimated narrative perspective from narration pronouns: first if ≥15 I/me/my per 1,000 narration words; second if 'you' forms are ≥15 and more frequent; third if under 5, or if I/me/my are under 8% of the I/me/my plus he/she/they forms (reported thoughts or a letter inside a third-person story); otherwise mixed; unknown if under 200 narration words. | A word-counting heuristic, not true narrative analysis; see Methodology for how it was validated. |
| **First-person narration** (`pov_is_first_person`) | 1 for stories classified as first person, 0 for third person, blank otherwise. | A word-counting heuristic, not true narrative analysis; see Methodology for how it was validated. |
| **Present-tense share** (`narr_present_tense_share`) | In narration, present-tense forms of ~70 common verbs as a share of present plus past forms. | Blank if fewer than 20 such verbs occur. A heuristic. |
| **Narration tense** (`narr_tense_class`) | Present if the present-tense share is ≥ 0.6, past if ≤ 0.4, otherwise mixed. |  |
| **Present-tense narration** (`narr_is_present_tense`) | 1 for present-tense narration, 0 for past tense, blank otherwise. |  |

| Variable | What it measures | Caveat |
|---|---|---|
| **Dialogue share** (`dlg_word_share`) | Share of words inside quotation marks. | Depends on consistent quotation marks; stories using none score 0 even if they contain speech. |
| **Dialogue segments** (`dlg_segments`) | Number of separate quoted passages. | Blank when the collected text is incomplete (text_truncated). |
| **Dialogue segments per 1,000 words** (`dlg_segments_per_1k`) | Number of separate quoted passages per 1,000 words. |  |
| **Average speech length** (`dlg_mean_segment_words`) | Average number of words per quoted passage. |  |
| **Questions asked in dialogue** (`dlg_question_share`) | Share of all question marks that occur inside quotation marks. |  |
| **Exclamations in dialogue** (`dlg_exclamation_share`) | Share of all exclamation marks that occur inside quotation marks. |  |
| **Paragraphs with dialogue** (`dlg_paragraph_share`) | Share of paragraphs that contain at least one quoted passage. |  |
| **Has dialogue** (`dlg_has_dialogue`) | Whether the story has any quoted speech. |  |

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

| Variable | What it measures | Caveat |
|---|---|---|
| **Recurring names** (`char_recurring_names`) | Number of distinct capitalised names that appear at least 3 times mid-sentence (mostly characters, sometimes places). | Heuristic: first names and surnames count separately. Common titles, places, nationalities, organisations and brands are left out (lexicons/not_names.txt), as is a word that mostly follows 'the' or 'in', but rarer ones can still count (about 9 in 10 detected names were characters in a Stage 1B hand-check); names that only ever start a sentence are missed. Blank when the collected text is incomplete (text_truncated). |
| **Name mentions per 1,000 words** (`char_name_mentions_per_1k`) | Mentions of those recurring names per 1,000 words. | Lower in short stories, where fewer names reach the three mentions needed to count. |
| **Focus on main name** (`char_top_name_share`) | Share of all name mentions taken by the most-mentioned name. |  |

### Gendered language

Pronoun counts describe who is on the page, not who wrote the story. In
first-person stories the narrator's gender is invisible to these counts. Treat
these as rough descriptions of the text, not as statements about authors,
characters' identities or readers.

| Variable | What it measures | Caveat |
|---|---|---|
| **He / him / his** (`gender_masculine_per_1k`) | Masculine pronouns per 1,000 words. | Pronouns describe the characters on the page, not the author; first-person narrators' gender is invisible to this measure. |
| **She / her / hers** (`gender_feminine_per_1k`) | Feminine pronouns per 1,000 words. | Pronouns describe the characters on the page, not the author; first-person narrators' gender is invisible to this measure. |
| **They / them / their** (`gender_neutral_plural_per_1k`) | They/them/their pronouns per 1,000 words (plural or singular). | Pronouns describe the characters on the page, not the author; first-person narrators' gender is invisible to this measure. |
| **Feminine share of he/she pronouns** (`gender_feminine_share`) | Feminine pronouns as a share of feminine plus masculine pronouns. | Pronouns describe the characters on the page, not the author; first-person narrators' gender is invisible to this measure. |
| **Pronoun composition** (`gender_composition`) | Mostly feminine if the feminine share is ≥ 0.65, mostly masculine if ≤ 0.35, few if under 5 gendered pronouns per 1,000 words. | Pronouns describe the characters on the page, not the author; first-person narrators' gender is invisible to this measure. |

---

## 6. Style

| Variable | What it measures | Caveat |
|---|---|---|
| **Exclamation marks** (`punct_exclamation_per_1k`) | Exclamation marks per 1,000 words. |  |
| **Question marks** (`punct_question_per_1k`) | Question marks per 1,000 words. |  |
| **Ellipses** (`punct_ellipsis_per_1k`) | Ellipses ('…' or '...') per 1,000 words. Lines made only of dots are scene breaks, not ellipses. |  |
| **Dashes** (`punct_dash_per_1k`) | Dashes per 1,000 words: em dashes ('—'), runs of hyphens ('--'), and a hyphen or en dash with a space on each side used as a dash ('she paused - then left'). Hyphens inside words are not dashes. |  |
| **Semicolons** (`punct_semicolon_per_1k`) | Semicolons per 1,000 words. |  |
| **Colons** (`punct_colon_per_1k`) | Colons per 1,000 words. |  |
| **Commas** (`punct_comma_per_1k`) | Commas per 1,000 words. |  |
| **Quotation marks** (`punct_quote_marks_per_1k`) | Double quotation marks per 1,000 words. |  |
| **Parentheses** (`punct_parentheses_per_1k`) | Opening parentheses per 1,000 words. |  |
| **Repeated punctuation (!!, ?!)** (`punct_repeated_per_1k`) | Runs of two or more ! or ? marks (e.g. '!!', '?!') per 1,000 words. |  |

| Variable | What it measures | Caveat |
|---|---|---|
| **Question sentences** (`qe_question_sentence_share`) | Share of sentences that end with a question mark. |  |
| **Exclamation sentences** (`qe_exclamation_sentence_share`) | Share of sentences that end with an exclamation mark. |  |
| **Questions per 1,000 words** (`qe_question_sentences_per_1k`) | Sentences ending in a question mark per 1,000 words. |  |
| **Exclamations per 1,000 words** (`qe_exclamation_sentences_per_1k`) | Sentences ending in an exclamation mark per 1,000 words. |  |
| **Questions per statement** (`qe_question_to_statement_ratio`) | Question sentences divided by statements (sentences not ending in ? or !). |  |

### Readability

Readability formulas combine sentence length with word length (letters or
syllables). Syllables are estimated with a spelling rule (vowel groups minus
silent endings), which is right for roughly 85–90% of words; averaged over a
whole story the error is small. Fiction with a lot of short dialogue scores as
"easy" by these formulas. That is what they measure, not a judgement of
quality.

| Variable | What it measures | Caveat |
|---|---|---|
| **Average word length** (`read_mean_word_chars`) | Average number of letters per word. |  |
| **Syllables per word** (`read_mean_syllables_per_word`) | Average estimated syllables per word. | Syllables are estimated with a spelling rule (~85–90% exact per word). |
| **Long (3+ syllable) words** (`read_polysyllable_share`) | Share of words with three or more syllables. |  |
| **Reading ease (Flesch)** (`read_flesch_reading_ease`) | Flesch Reading Ease: 206.835 − 1.015 × words/sentence − 84.6 × syllables/word. Higher is easier. | Dialogue-heavy text has short sentences and scores as easy. |
| **Grade level (Flesch–Kincaid)** (`read_flesch_kincaid_grade`) | Flesch–Kincaid grade: 0.39 × words/sentence + 11.8 × syllables/word − 15.59. |  |
| **Grade level (ARI)** (`read_ari`) | Automated Readability Index: 4.71 × letters/word + 0.5 × words/sentence − 21.43. |  |
| **Grade level (Coleman–Liau)** (`read_coleman_liau`) | Coleman–Liau index from letters per 100 words and sentences per 100 words. |  |
| **Fog index** (`read_gunning_fog`) | Gunning Fog index: 0.4 × (words/sentence + 100 × share of 3+ syllable words). |  |
| **Reading difficulty (grade)** (`read_grade_composite`) | Average of the Flesch–Kincaid, ARI and Coleman–Liau grade levels: a single 'estimated school grade'. |  |
| **Commas per sentence** (`syn_commas_per_sentence`) | Average number of commas per sentence (a rough sign of longer, multi-part sentences). |  |
| **Subordinate clauses per sentence** (`syn_subordinators_per_sentence`) | Words that usually start a dependent clause (because, although, which, when…) per sentence. |  |
| **Long sentences (>30 words)** (`syn_long_sentence_share`) | Share of sentences longer than 30 words. |  |
| **Short sentences (≤5 words)** (`syn_short_sentence_share`) | Share of sentences of five words or fewer. |  |
| **Sentence-length variety** (`syn_sentence_length_sd`) | Standard deviation of sentence length: how much sentence lengths vary. |  |

### Vocabulary

The simple type–token ratio (different words ÷ all words) always falls as a
text gets longer, so it cannot fairly compare a 1,000-word story with a
20,000-word one. The moving-average version (MATTR) fixes this by computing the
ratio in every 500-word window and averaging. The segment version does the
same in consecutive 1,000-word blocks. Word commonness uses the open
*wordfreq* English frequency list (Zipf scale: 7 ≈ "the", 3 ≈ about one
occurrence per million words).

| Variable | What it measures | Caveat |
|---|---|---|
| **Unique words** (`lex_unique_words`) | Number of different words used. | Grows with story length; compare stories of similar length or use the moving-average measure. Blank when the collected text is incomplete (text_truncated). |
| **Type–token ratio** (`lex_ttr`) | Unique words divided by total words. | Strongly depends on length (longer texts always score lower); prefer lex_mattr. Blank when the collected text is incomplete (text_truncated). |
| **Vocabulary variety (moving average)** (`lex_mattr`) | Moving-average type–token ratio: the share of different words in every 500-word window, averaged. | Needs at least 500 words (window size); blank for shorter stories. |
| **Vocabulary variety (per 1,000 words)** (`lex_segment_ttr`) | Average share of different words within consecutive 1,000-word segments. | Blank for stories under 1,000 words. |
| **Everyday vocabulary** (`lex_mean_word_zipf`) | Average commonness of the words used, on the Zipf scale from the wordfreq English word-frequency list (about 7 = 'the', 3 = rare). |  |
| **Rare words** (`lex_rare_word_share`) | Share of words that are rare in English (Zipf below 3, under ~1 per million words). |  |
| **Unrecognised words** (`lex_unrecognized_word_share`) | Share of words not in the English frequency list: names, invented words, typos or non-English words. | Not a spelling-error rate: names and slang count too. |
| **Long words (7+ letters)** (`lex_long_word_share`) | Share of words with seven or more letters. |  |

### Repetition

Repetition is measured inside fixed 500-word windows (again so that long
stories are not penalised for length): how much of the content vocabulary is
taken up by the ten most frequent words, and how often two- and three-word
sequences recur. Sentence-level measures compare each sentence with the one
before it.

| Variable | What it measures | Caveat |
|---|---|---|
| **Focus on a few words** (`rep_top10_content_share`) | Within each 500-word window, the share of content words (not function words) taken by the 10 most frequent ones, averaged. | Needs at least 500 words (window size); blank for shorter stories. |
| **Repeated word pairs** (`rep_bigram_repeat_share`) | Within each 500-word window, the share of two-word sequences that occur more than once (ignoring pairs of function words), averaged. | Needs at least 500 words (window size); blank for shorter stories. |
| **Repeated three-word phrases** (`rep_trigram_repeat_share`) | As above for three-word sequences. | Needs at least 500 words (window size); blank for shorter stories. |
| **Overlap between neighbouring sentences** (`rep_adjacent_sentence_overlap`) | Average share of content words that consecutive sentences have in common (Jaccard overlap). |  |
| **Sentences starting the same way** (`rep_same_start_share`) | Share of sentences that start with the same word as the sentence before ('She… She… She…'). |  |
| **Doubled words** (`rep_immediate_word_repeats_per_1k`) | Words immediately repeated ('yes, yes', 'oh oh') per 1,000 words. |  |
| **Repeated five-word phrases** (`rep_repeated_5gram_per_1k`) | Extra occurrences of any five-word sequence that appears more than once, per 1,000 words. | Rises with story length (a longer text has more chances to repeat a phrase); compare stories of similar length. |

| Variable | What it measures | Caveat |
|---|---|---|
| **Profanity** (`style_profanity_per_1k`) | Swear words per 1,000 words (lexicon). | Overlaps with the sexual-action list for 'fuck'. |
| **ALL-CAPS words** (`style_all_caps_words_per_1k`) | Words written entirely in capitals (2+ letters, common acronyms excluded) per 1,000 words. |  |
| **-ly adverbs** (`style_ly_adverbs_per_1k`) | Words ending in -ly (excluding common non-adverbs like 'only', 'family', 'lovely') per 1,000 words. |  |
| **Plain 'said' in dialogue tags** (`style_said_share`) | 'said'/'says' as a share of all speech verbs (said, asked, whispered, moaned…). | Blank when fewer than 5 speech verbs occur. |
| **Physical action verbs** (`style_action_verbs_per_1k`) | Verbs of physical movement (grab, pull, turn, reach…) per 1,000 words. |  |
| **Descriptive words** (`style_descriptive_words_per_1k`) | Descriptive adjectives and material words (beautiful, tall, slender, satin…) per 1,000 words. |  |
| **Italics** (`style_italics_per_1k`) | Italicised passages per 1,000 words. | Italics are counted over the whole page body, author's notes included. |

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

| Variable | What it measures | Caveat |
|---|---|---|
| **Sexual terms** (`sex_terms`) | Number of sexual-language terms (all lists). | A keyword count from editable word lists; it does not measure how explicit a story feels to a reader. Blank when the collected text is incomplete (text_truncated). |
| **Sexual language** (`sex_terms_per_1k`) | Sexual terms per 1,000 words. | A keyword count from editable word lists; it does not measure how explicit a story feels to a reader. |
| **Anatomical terms** (`sex_anatomy_per_1k`) | Explicit or clinical words for sexual body parts per 1,000 words. | A keyword count from editable word lists; it does not measure how explicit a story feels to a reader. |
| **Sexual-action terms** (`sex_action_per_1k`) | Words and phrases for sexual acts per 1,000 words. | A keyword count from editable word lists; it does not measure how explicit a story feels to a reader. |
| **Other sexual vocabulary** (`sex_other_per_1k`) | General sexual words (sex, naked, erotic, toys, lingerie) per 1,000 words. | A keyword count from editable word lists; it does not measure how explicit a story feels to a reader. |
| **Sentences with sexual language** (`sex_sentence_share`) | Share of sentences containing at least one sexual term. | A keyword count from editable word lists; it does not measure how explicit a story feels to a reader. |
| **How far in before explicit language** (`sex_first_mention_position`) | Position of the first sexual term as a fraction of the story. | Blank if the story has none. Blank when the collected text is incomplete (text_truncated). Earlier in longer stories (a longer text has more chances of an early passing mention); compare stories of similar length. |
| **Words before first explicit term** (`sex_words_before_first`) | Number of words before the first sexual term ('slow burn'). | Blank if the story has none. Blank when the collected text is incomplete (text_truncated). |
| **Variety of sexual vocabulary** (`sex_distinct_terms`) | Number of different sexual-language words used. | Blank when the collected text is incomplete (text_truncated). |
| **Uses explicit terms** (`sex_has_explicit_terms`) | Whether the story contains any term from the sexual word lists. |  |

---

## 8. Language

### Emotion

Ten small, hand-checked word lists: positive, negative, affection/love,
anxiety/fear, anger, sadness, excitement/arousal, shame/embarrassment and
jealousy, plus a combined "any emotion" count. "Positive" combines the positive
and affection lists; "negative" combines the negative, anxiety, anger, sadness,
shame and jealousy lists. Emotional tone is (positive − negative) ÷ (positive +
negative).

| Variable | What it measures | Caveat |
|---|---|---|
| **Emotional words (all)** (`emo_overall_per_1k`) | Words from any emotion list per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. |
| **Positive emotion** (`emo_positive_per_1k`) | Positive-emotion and affection words per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. |
| **Negative emotion** (`emo_negative_per_1k`) | Negative-emotion, anxiety, anger, sadness, shame and jealousy words per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. |
| **Affection & love** (`emo_affection_per_1k`) | Words of love and fondness per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. |
| **Anxiety & fear** (`emo_anxiety_per_1k`) | Words of fear, worry and nervousness per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. Low split-half reliability (0.58): a single story's value is noisy (few hits per story), so compare groups of stories rather than single stories. |
| **Anger** (`emo_anger_per_1k`) | Words of anger and irritation per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. Low split-half reliability (0.55): a single story's value is noisy (few hits per story), so compare groups of stories rather than single stories. |
| **Sadness** (`emo_sadness_per_1k`) | Words of sadness, crying and loneliness per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. |
| **Excitement & arousal** (`emo_arousal_per_1k`) | Words of excitement, desire and arousal per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. |
| **Shame & embarrassment** (`emo_shame_per_1k`) | Words of shame, embarrassment, guilt and shyness per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. |
| **Jealousy & envy** (`emo_jealousy_per_1k`) | Words of jealousy and envy per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. Low split-half reliability (0.40): a single story's value is noisy (few hits per story), so compare groups of stories rather than single stories. |
| **Emotional tone** (`emo_balance`) | (positive − negative) ÷ (positive + negative) emotion words. | Keyword counts: negation ('not happy') and sarcasm are not understood. |

### Psychological distancing and immediacy

Writing guides call verbs such as *noticed, realised, felt, saw, wondered*
"filter words": they report experience through a character's perception
instead of showing it directly. Distancing phrases ("it seemed", "as if") do
something similar. Immediacy words ("now", "here", "suddenly") and
present-tense narration (above) do the opposite.

| Variable | What it measures | Caveat |
|---|---|---|
| **Thinking verbs** (`psy_mental_verbs_per_1k`) | Mental-state verbs (think, know, realise, wonder…) per 1,000 words. |  |
| **Perception verbs** (`psy_perception_verbs_per_1k`) | Perception verbs (see, hear, feel, notice…) per 1,000 words. |  |
| **'Filter' words** (`psy_filter_words_per_1k`) | Thinking plus perception verbs per 1,000 words: the 'she noticed / he felt' words writing guides call filters. |  |
| **Distancing phrases** (`psy_distancing_per_1k`) | Phrases like 'it seemed', 'as if', 'felt like' per 1,000 words. | Low split-half reliability (0.58): a single story's value is noisy (few hits per story), so compare groups of stories rather than single stories. |
| **Immediacy words** (`psy_immediacy_per_1k`) | Here-and-now words (now, here, suddenly, immediately) per 1,000 words. |  |

### Hedging and certainty

Hedges soften statements ("maybe", "kinda", "seemed"); certainty words
assert them ("definitely", "of course", "always", "never"). The balance
measure places each story on a single hedging ↔ certainty scale.

| Variable | What it measures | Caveat |
|---|---|---|
| **Hedges (count)** (`hedge_count`) | Number of hedging words and phrases. | Blank when the collected text is incomplete (text_truncated). |
| **Hedging** (`hedge_per_1k`) | Hedges (maybe, perhaps, seemed, probably, kinda…) per 1,000 words. |  |
| **Modal verbs** (`hedge_modal_per_1k`) | Modal verbs (can, could, may, might, must, should, will, would…) per 1,000 words. |  |
| **Uncertainty** (`hedge_uncertainty_per_1k`) | Words of doubt and not knowing (unsure, confused, 'no idea'…) per 1,000 words. | Low split-half reliability (0.40): a single story's value is noisy (few hits per story), so compare groups of stories rather than single stories. |
| **Certainty** (`hedge_certainty_per_1k`) | Words of certainty and assertion (definitely, of course, always, never…) per 1,000 words. |  |
| **Hedging ↔ certainty** (`hedge_certainty_balance`) | (certainty − hedges) ÷ (certainty + hedges). | Low split-half reliability (0.43): a single story's value is noisy (few hits per story), so compare groups of stories rather than single stories. |

| Variable | What it measures | Caveat |
|---|---|---|
| **Touch words (count)** (`sense_touch_count`) | Number of touch words. | Blank when the collected text is incomplete (text_truncated). |
| **Touch words** (`sense_touch_per_1k`) | Touch words per 1,000 words. |  |
| **Sight words (count)** (`sense_sight_count`) | Number of sight words. | Blank when the collected text is incomplete (text_truncated). |
| **Sight words** (`sense_sight_per_1k`) | Sight words per 1,000 words. |  |
| **Sound words (count)** (`sense_sound_count`) | Number of sound words. | Blank when the collected text is incomplete (text_truncated). |
| **Sound words** (`sense_sound_per_1k`) | Sound words per 1,000 words. |  |
| **Smell words (count)** (`sense_smell_count`) | Number of smell words. | Blank when the collected text is incomplete (text_truncated). |
| **Smell words** (`sense_smell_per_1k`) | Smell words per 1,000 words. |  |
| **Taste words (count)** (`sense_taste_count`) | Number of taste words. | Blank when the collected text is incomplete (text_truncated). |
| **Taste words** (`sense_taste_per_1k`) | Taste words per 1,000 words. |  |
| **Physical sensation words (count)** (`sense_body_count`) | Number of physical sensation words. | Blank when the collected text is incomplete (text_truncated). |
| **Physical sensation words** (`sense_body_per_1k`) | Physical sensation words per 1,000 words. |  |
| **Sensory language (all senses)** (`sense_total_per_1k`) | Words from any sensory list per 1,000 words. |  |

| Variable | What it measures | Caveat |
|---|---|---|
| **Romance** (`rel_romance_per_1k`) | Courtship and romance vocabulary (falling in love, dates, weddings) per 1,000 words. |  |
| **Intimacy** (`rel_intimacy_per_1k`) | Affectionate physical closeness (kiss, hug, cuddle, gentle) per 1,000 words. |  |
| **Relationship language** (`rel_terms_per_1k`) | Relationship words (husband, wife, partner, marriage, affair) per 1,000 words. |  |
| **Emotional disclosure** (`rel_disclosure_per_1k`) | First-person feeling statements ('I feel', 'I'm scared') per 1,000 words. |  |
| **Familiarity** (`rel_familiarity_per_1k`) | Shared-history words (friend, as usual, for years) per 1,000 words. |  |
| **Interpersonal closeness** (`rel_closeness_per_1k`) | Togetherness words (together, each other, side by side) per 1,000 words. |  |

### Agency and control

These describe the language on the page. They are not psychological
assessments of anyone. Passive constructions are found with a simple pattern
("be/get" + past participle, e.g. "was taken", "got tied"). Very common
adjective-like cases ("was tired", "was excited") are excluded, but some remain.
A spoken command is a quoted passage that begins with a verb such as "come",
"kneel", "look" or "don't …" and is not a question.

| Variable | What it measures | Caveat |
|---|---|---|
| **Passive constructions** (`agency_passive_per_1k`) | 'be/get + past participle' constructions ('was taken', 'got tied') per 1,000 words. | Heuristic (about 9 in 10 counted matches were passives in a Stage 1B hand-check): common participles that describe a state or feeling ('was dressed in', 'was accustomed to', 'was fascinated by') are left out; rarer ones ('was unrequited') still count. |
| **Passive sentences** (`agency_passive_sentence_share`) | Share of sentences containing a passive construction. |  |
| **Active-voice sentences** (`agency_active_sentence_share`) | Share of sentences without a passive construction (1 − passive share). |  |
| **Agency (deciding & trying)** (`agency_volition_per_1k`) | Words for deciding, choosing, planning and trying per 1,000 words. | Describes the language of the text, not the psychology of its author. Low split-half reliability (0.56): a single story's value is noisy (few hits per story), so compare groups of stories rather than single stories. |
| **Control & restraint** (`agency_control_per_1k`) | Words about control, restraint, permission and force per 1,000 words. | Describes the language of the text, not the psychology of its author. |
| **Dominance language** (`agency_dominance_per_1k`) | Words associated with commanding and domination per 1,000 words. | Describes the language of the text, not the psychology of its author. |
| **Submission language** (`agency_submission_per_1k`) | Words associated with obeying, kneeling and begging per 1,000 words. | Describes the language of the text, not the psychology of its author. |
| **Spoken commands** (`agency_commands_per_1k`) | Quoted passages containing a command, i.e. a sentence that starts with a command verb, possibly after 'please', 'now' or a name ('Come here.', 'Kneel.', 'Sarah, don't stop.'), per 1,000 words. | Heuristic: question sentences, 'Do you…', 'Look, …' / 'Listen, …' as fillers and 'fuck' as an expletive are left out; commands whose verb is not on the list (lexicons/imperative_verbs.txt) are missed. |
| **Commands among speech** (`agency_command_share_of_speech`) | Share of quoted passages that contain a command (see agency_commands_per_1k). | Low split-half reliability (0.47): a single story's value is noisy (few hits per story), so compare groups of stories rather than single stories. |

---

## 9. Pacing

To get simple "story trajectory" measures, each story of at least 1,000
words is cut into five equal parts by word count, and five densities are
computed in each part: sexual language, emotional language, dialogue, physical
action verbs, and descriptive/sensory language. For each one the dataset
keeps the value in the first fifth, the value in the last fifth, the
difference (positive = builds towards the end) and the position of the peak.

| Variable | What it measures | Caveat |
|---|---|---|
| **Sexual language in the first fifth** (`pace_sex_early`) | Density of sexual language in the first fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Sexual language in the last fifth** (`pace_sex_late`) | Density of sexual language in the last fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Build-up of sexual language** (`pace_sex_shift`) | Last fifth minus first fifth: positive means sexual language increases towards the end. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Where sexual language peaks** (`pace_sex_peak_position`) | Middle of the fifth with the most sexual language (0.1 = start, 0.9 = end). | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Emotional language in the first fifth** (`pace_emotion_early`) | Density of emotional language in the first fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Emotional language in the last fifth** (`pace_emotion_late`) | Density of emotional language in the last fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Build-up of emotional language** (`pace_emotion_shift`) | Last fifth minus first fifth: positive means emotional language increases towards the end. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Where emotional language peaks** (`pace_emotion_peak_position`) | Middle of the fifth with the most emotional language (0.1 = start, 0.9 = end). | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Dialogue in the first fifth** (`pace_dialogue_early`) | Density of dialogue in the first fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Dialogue in the last fifth** (`pace_dialogue_late`) | Density of dialogue in the last fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Build-up of dialogue** (`pace_dialogue_shift`) | Last fifth minus first fifth: positive means dialogue increases towards the end. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Where dialogue peaks** (`pace_dialogue_peak_position`) | Middle of the fifth with the most dialogue (0.1 = start, 0.9 = end). | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Action verbs in the first fifth** (`pace_action_early`) | Density of action verbs in the first fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Action verbs in the last fifth** (`pace_action_late`) | Density of action verbs in the last fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Build-up of action verbs** (`pace_action_shift`) | Last fifth minus first fifth: positive means action verbs increases towards the end. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Where action verbs peaks** (`pace_action_peak_position`) | Middle of the fifth with the most action verbs (0.1 = start, 0.9 = end). | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Descriptive & sensory language in the first fifth** (`pace_descriptive_early`) | Density of descriptive & sensory language in the first fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Descriptive & sensory language in the last fifth** (`pace_descriptive_late`) | Density of descriptive & sensory language in the last fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Build-up of descriptive & sensory language** (`pace_descriptive_shift`) | Last fifth minus first fifth: positive means descriptive & sensory language increases towards the end. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |
| **Where descriptive & sensory language peaks** (`pace_descriptive_peak_position`) | Middle of the fifth with the most descriptive & sensory language (0.1 = start, 0.9 = end). | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). |

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

| Variable | What it measures | Caveat |
|---|---|---|
| **Text collected** (`has_text`) | Whether story text was collected. |  |
| **Text truncated** (`text_truncated`) | Whether the story had more pages than were collected (page cap or missing pages). |  |
| **Text too short** (`qc_text_too_short`) | True when the text is shorter than the minimum for text measures (default 100 words). |  |
| **English function-word share** (`qc_english_function_word_share`) | Share of words that are common English function words; very low values suggest non-English text. |  |
| **Quotation style** (`qc_quote_style`) | Which quotation marks were treated as dialogue. |  |
| **Unbalanced quotes** (`qc_dialogue_quotes_unbalanced`) | More than half of the paragraphs with quotes have unmatched straight quotes, so dialogue measures are less reliable. |  |
| **Quality flags** (`qc_flags`) | List of data-quality flags for the story (see Methodology, 'Quality flags'). |  |
| **Included in analysis** (`analysis_include`) | True when the story has text (≥ minimum words), a category, a publication date and a view count, is not a duplicate and looks like English. |  |
| **Exclusion reasons** (`exclusion_reasons`) | Why analysis_include is false (empty when included). |  |
| **Tags** (`tags`) | Tags the author attached (lower-case). | In the Stage 2 handoff only tags used by at least 20 stories are kept (rare tags can contain names). |

| Variable | What it measures | Caveat |
|---|---|---|
| **Story key** (`story_key`) | Stable key for the story: a keyed hash (HMAC) of its URL slug, using a secret that stays on the collecting computer. Records match across reruns, but the key cannot be traced back to a story URL. |  |
| **Sampling category** (`queue_category_slug`) | The category listing the story was sampled from (its sampling stratum). Almost always equal to category_slug. |  |
| **Category (slug)** (`category_slug`) | Literotica's own category for the story, as given on the story page (URL form, e.g. adult-romance). | Falls back to the category of the listing page the story was found on if the story page does not name one. |
| **Category** (`category_name`) | Literotica's own name for the story's category (e.g. Romance), taken from the site's category list for category_slug, so every story in a category has the same name. |  |
| **Category source** (`category_source`) | Where the category came from: 'page' (the story page) or 'listing' (the category listing it was found on). |  |
| **Sampling weight** (`sampling_weight`) | Estimated number of stories in the category divided by the number of analysed stories from that category. Use it to weight 'All categories' summaries so large categories count in proportion to their size. | Blank when the category's size could not be estimated from its listing pages. |

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
