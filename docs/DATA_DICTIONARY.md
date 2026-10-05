# Data dictionary

Generated from `litcorr/schema.py` by `python -m litcorr dictionary`. One row per column of `data/processed/stories_features.parquet`. *Explorer* marks the variables that make sense as story characteristics on the website.

## Identifiers & category

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `story_key` | Story key |  | Stable key for the story: a keyed hash (HMAC) of its URL slug, using a secret that stays on the collecting computer. Records match across reruns, but the key cannot be traced back to a story URL. |  |  |
| `queue_category_slug` | Sampling category |  | The category listing the story was sampled from (its sampling stratum). Almost always equal to category_slug. |  |  |
| `category_slug` | Category (slug) |  | Literotica's own category for the story, as given on the story page (URL form, e.g. adult-romance). | Falls back to the category of the listing page the story was found on if the story page does not name one. |  |
| `category_name` | Category |  | Literotica's own name for the story's category (e.g. Romance), taken from the site's category list for category_slug, so every story in a category has the same name. |  |  |
| `category_source` | Category source |  | Where the category came from: 'page' (the story page) or 'listing' (the category listing it was found on). |  |  |
| `sampling_weight` | Sampling weight | weight | Estimated number of stories in the category divided by the number of analysed stories from that category. Use it to weight 'All categories' summaries so large categories count in proportion to their size. | Blank when the category's size could not be estimated from its listing pages. |  |

## Publication

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `date_published` | Publication date | date | Date the story was published (Literotica's approval date). | Not included in the Stage 2 handoff (year, month and weekday are). |  |
| `pub_year` | Publication year | year | Year the story was published. |  | ✓ |
| `pub_month` | Publication month | month (1–12) | Month the story was published. |  | ✓ |
| `pub_weekday` | Publication weekday | 0 = Monday … 6 = Sunday | Day of the week the story was published. |  | ✓ |
| `pub_is_weekend` | Published on a weekend | yes/no | Whether the story was published on a Saturday or Sunday. |  | ✓ |
| `age_days` | Days online | days | Days between publication and the moment its statistics were recorded by the collector. | Measured at collection time; stories collected on different days have slightly different reference dates. | ✓ |
| `age_years` | Years online | years | age_days divided by 365.25. |  | ✓ |

## Popularity (raw)

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `pop_views` | Views | views | Number of views shown for the story. | A running total as displayed by Literotica when the story was collected. Older stories have had more time to accumulate it; compare with the per-month version. Rounded to 3 significant figures in the Stage 2 handoff. |  |
| `pop_views_approx` | Views abbreviated | yes/no | True when only an abbreviated count (e.g. '12.3k') was available, so views are rounded. |  |  |
| `pop_favorites` | Favorites | favorites | Number of readers who added the story to their favorites. | A running total as displayed by Literotica when the story was collected. Older stories have had more time to accumulate it; compare with the per-month version. Rounded to 3 significant figures in the Stage 2 handoff. |  |
| `pop_comments` | Comments | comments | Number of public comments on the story. | A running total as displayed by Literotica when the story was collected. Older stories have had more time to accumulate it; compare with the per-month version. Rounded to 3 significant figures in the Stage 2 handoff. |  |
| `pop_rating` | Average rating | 1–5 stars | Average star rating (1–5) shown for the story. | Blank when the story had no ratings yet. Readers who vote are a small, self-selected group. |  |
| `pop_rating_count` | Number of ratings | ratings | Number of readers who rated the story, from the story page's own data (not always shown on screen). | A running total as displayed by Literotica when the story was collected. Older stories have had more time to accumulate it; compare with the per-month version. Readers who vote are a small, self-selected group. Rounded to 3 significant figures in the Stage 2 handoff. |  |
| `pop_reading_lists` | Reading-list adds | reading lists | Number of times the story was added to readers' reading lists, when shown. | A running total as displayed by Literotica when the story was collected. Older stories have had more time to accumulate it; compare with the per-month version. Rounded to 3 significant figures in the Stage 2 handoff. |  |
| `pop_log10_views` | Views (log scale) | log10(views + 1) | Base-10 logarithm of views + 1; useful because view counts span several orders of magnitude. |  |  |

## Popularity (ratios)

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `pop_fav_per_1k_views` | Favorites per 1,000 views | per 1,000 views | Favorites divided by views, times 1,000: how often a reader who opened the story favorited it. | Only computed when the story has at least the configured minimum number of views (default 100). |  |
| `pop_comments_per_1k_views` | Comments per 1,000 views | per 1,000 views | Comments divided by views, times 1,000. | Only computed when the story has at least the configured minimum number of views (default 100). |  |
| `pop_ratings_per_1k_views` | Ratings per 1,000 views | per 1,000 views | Number of ratings divided by views, times 1,000 (only when the number of ratings is available). | Only computed when the story has at least the configured minimum number of views (default 100). |  |
| `pop_reading_lists_per_1k_views` | Reading-list adds per 1,000 views | per 1,000 views | Reading-list adds divided by views, times 1,000. | Only computed when the story has at least the configured minimum number of views (default 100). |  |

## Popularity (age-normalised)

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `pop_views_per_month` | Views per month | views per month | Views divided by the number of months the story had been online when collected. | Total divided by months online (minimum one month). A simple descriptive adjustment, not a statistical correction: views are not spread evenly over a story's life. |  |
| `pop_favorites_per_month` | Favorites per month | favorites per month | Favorites divided by months online. | Total divided by months online (minimum one month). A simple descriptive adjustment, not a statistical correction: views are not spread evenly over a story's life. |  |
| `pop_comments_per_month` | Comments per month | comments per month | Comments divided by months online. | Total divided by months online (minimum one month). A simple descriptive adjustment, not a statistical correction: views are not spread evenly over a story's life. |  |

## Site badges

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `pop_is_hot` | 'Hot' badge | yes/no | Literotica's 'H' (hot) badge, shown for highly rated stories. |  |  |
| `pop_writers_pick` | Writer's pick | yes/no | Literotica's Writer's Pick badge. |  |  |
| `pop_contest_winner` | Contest winner | yes/no | Story won a Literotica contest. |  |  |

## Site metadata

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `site_words_count` | Word count (site) | words | Literotica's own word count for the story, when shown. |  |  |
| `story_pages` | Pages on site | pages | Number of web pages the story is split into. |  | ✓ |
| `meta_tag_count` | Number of tags | tags | Number of tags the author attached. |  | ✓ |
| `author_stories_count` | Author's story count | stories | Number of stories the author had published (public profile count) when collected. | Measured at collection time, not at publication time. In the Stage 2 handoff rounded down to bands (1, 2, 6, 21, 51, 101, 201+). | ✓ |
| `author_followers_count` | Author's followers | followers | Number of followers the author had (public profile count) when collected. | Measured at collection time, so it partly reflects the author's later success. In the Stage 2 handoff rounded down to bands (0, 10, 100, 1,000, 10,000+). |  |

## Story basics

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `story_words` | Word count | words | Number of words in the story text (letters/digits, contractions count as one word). Author's notes, headings and other paratext are not counted (see Methodology). | Counted on the collected pages; long stories beyond the page cap are flagged as truncated. Blank when the collected text is incomplete (text_truncated). Use site_words_count for length then. | ✓ |
| `story_chars` | Character count | characters | Number of characters in the story text (paratext excluded). | Blank when the collected text is incomplete (text_truncated). | ✓ |
| `story_sentences` | Sentence count | sentences | Number of sentences (see Methodology). | Blank when the collected text is incomplete (text_truncated). | ✓ |
| `story_paragraphs` | Paragraph count | paragraphs | Number of non-empty story paragraphs (paratext excluded). | Blank when the collected text is incomplete (text_truncated). | ✓ |
| `story_mean_sentence_words` | Average sentence length | words | Average number of words per sentence. |  | ✓ |
| `story_median_sentence_words` | Median sentence length | words | Median number of words per sentence. |  | ✓ |
| `story_mean_paragraph_words` | Average paragraph length | words | Average number of words per paragraph. |  | ✓ |
| `story_median_paragraph_words` | Median paragraph length | words | Median number of words per paragraph. |  | ✓ |
| `story_one_sentence_paragraph_share` | One-sentence paragraphs | share (0–1) | Share of paragraphs that consist of a single sentence. |  | ✓ |
| `story_long_paragraph_share` | Very long paragraphs ('walls of text') | share (0–1) | Share of paragraphs longer than 150 words. |  | ✓ |
| `story_scene_breaks` | Scene breaks | breaks | Number of scene-break lines inside the story: paragraphs with no letters or digits ('* * *', '-----', '......', 'o0o'). Lines that open or close the story are not counted. | Blank when the collected text is incomplete (text_truncated). |  |
| `story_scene_breaks_per_1k` | Scene breaks per 1,000 words | per 1,000 words | Scene-break lines per 1,000 words. |  | ✓ |
| `story_has_author_note` | Has an author's note | yes/no | Whether the story opens or closes with an author's or editor's note, disclaimer, dedication, copyright line or words to readers, or has a paragraph labelled as an author's note (see Methodology, 'Paratext'). | Rule-based; misses notes that use no recognisable wording (about 1 in 3 in a hand check). Blank when the collected text is incomplete (text_truncated). | ✓ |
| `story_requests_feedback` | Asks readers to vote or comment | yes/no | Whether the author's notes, or the first or last three story paragraphs, ask readers to vote, rate, comment or give feedback. | Blank when the collected text is incomplete (text_truncated). | ✓ |

## Title & description

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `title_chars` | Title length | characters | Number of characters in the title. |  | ✓ |
| `title_words` | Title word count | words | Number of words in the title. |  | ✓ |
| `title_has_chapter_marker` | Title marks a chapter/part | yes/no | Whether the title contains a chapter or part marker such as 'Ch. 02', 'Pt. 3' or ends with a number. |  | ✓ |
| `desc_chars` | Description length | characters | Number of characters in the author's short description. |  | ✓ |
| `desc_words` | Description word count | words | Number of words in the description. |  | ✓ |

## Series

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `series_is_part` | Part of a series | yes/no | Whether the story belongs to a series (series link on the page, a series of 2+ parts, or a chapter marker in the title). |  | ✓ |
| `series_part_number` | Part number | part | Which part of its series the story is (1 = first), from the series list or the title. |  | ✓ |
| `series_parts_count` | Parts in series | parts | Number of parts in the series, when shown. |  |  |
| `series_is_later_part` | Later part of a series | yes/no | Whether the story is part 2 or later of a series. |  | ✓ |

## Narration

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `pov_first_singular_per_1k` | I / me / my | per 1,000 words | First-person singular pronouns (I, me, my, mine, myself, I'm …) per 1,000 words, dialogue included. |  | ✓ |
| `pov_first_plural_per_1k` | We / us / our | per 1,000 words | First-person plural pronouns per 1,000 words. |  | ✓ |
| `pov_second_per_1k` | You / your | per 1,000 words | Second-person pronouns per 1,000 words. |  | ✓ |
| `pov_third_per_1k` | He / she / they | per 1,000 words | Third-person personal pronouns (he, she, they and their forms) per 1,000 words. |  | ✓ |
| `pov_first_singular_narr_per_1k` | I / me / my in narration | per 1,000 narration words | First-person singular pronouns per 1,000 words of narration (outside quotation marks). |  | ✓ |
| `pov_second_narr_per_1k` | You / your in narration | per 1,000 narration words | Second-person pronouns per 1,000 narration words. |  | ✓ |
| `pov_third_narr_per_1k` | He / she / they in narration | per 1,000 narration words | Third-person pronouns per 1,000 narration words. |  | ✓ |
| `pov_first_person_share` | First-person share of pronouns | share (0–1) | In narration, first-person pronouns as a share of first- plus third-person pronouns. | A word-counting heuristic, not true narrative analysis; see Methodology for how it was validated. | ✓ |
| `pov_class` | Narrative perspective | first / second / third / mixed / unknown | Estimated narrative perspective from narration pronouns: first if ≥15 I/me/my per 1,000 narration words; second if 'you' forms are ≥15 and more frequent; third if under 5, or if I/me/my are under 8% of the I/me/my plus he/she/they forms (reported thoughts or a letter inside a third-person story); otherwise mixed; unknown if under 200 narration words. | A word-counting heuristic, not true narrative analysis; see Methodology for how it was validated. | ✓ |
| `pov_is_first_person` | First-person narration | 1 = first, 0 = third | 1 for stories classified as first person, 0 for third person, blank otherwise. | A word-counting heuristic, not true narrative analysis; see Methodology for how it was validated. | ✓ |
| `narr_present_tense_share` | Present-tense share | share (0–1) | In narration, present-tense forms of ~70 common verbs as a share of present plus past forms. | Blank if fewer than 20 such verbs occur. A heuristic. | ✓ |
| `narr_tense_class` | Narration tense | present / past / mixed / unknown | Present if the present-tense share is ≥ 0.6, past if ≤ 0.4, otherwise mixed. |  | ✓ |
| `narr_is_present_tense` | Present-tense narration | 1 = present, 0 = past | 1 for present-tense narration, 0 for past tense, blank otherwise. |  | ✓ |

## Dialogue

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `dlg_word_share` | Dialogue share | share (0–1) | Share of words inside quotation marks. | Depends on consistent quotation marks; stories using none score 0 even if they contain speech. | ✓ |
| `dlg_segments` | Dialogue segments | segments | Number of separate quoted passages. | Blank when the collected text is incomplete (text_truncated). |  |
| `dlg_segments_per_1k` | Dialogue segments per 1,000 words | per 1,000 words | Number of separate quoted passages per 1,000 words. |  | ✓ |
| `dlg_mean_segment_words` | Average speech length | words | Average number of words per quoted passage. |  | ✓ |
| `dlg_question_share` | Questions asked in dialogue | share (0–1) | Share of all question marks that occur inside quotation marks. |  | ✓ |
| `dlg_exclamation_share` | Exclamations in dialogue | share (0–1) | Share of all exclamation marks that occur inside quotation marks. |  | ✓ |
| `dlg_paragraph_share` | Paragraphs with dialogue | share (0–1) | Share of paragraphs that contain at least one quoted passage. |  | ✓ |
| `dlg_has_dialogue` | Has dialogue | yes/no | Whether the story has any quoted speech. |  | ✓ |

## Characters

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `char_recurring_names` | Recurring names | names | Number of distinct capitalised names that appear at least 3 times mid-sentence (mostly characters, sometimes places). | Heuristic: first names and surnames count separately. Common titles, places, nationalities, organisations and brands are left out (lexicons/not_names.txt), as is a word that mostly follows 'the' or 'in', but rarer ones can still count (about 9 in 10 detected names were characters in a Stage 1B hand-check); names that only ever start a sentence are missed. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `char_name_mentions_per_1k` | Name mentions per 1,000 words | per 1,000 words | Mentions of those recurring names per 1,000 words. | Lower in short stories, where fewer names reach the three mentions needed to count. | ✓ |
| `char_top_name_share` | Focus on main name | share (0–1) | Share of all name mentions taken by the most-mentioned name. |  | ✓ |

## Gendered language

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `gender_masculine_per_1k` | He / him / his | per 1,000 words | Masculine pronouns per 1,000 words. | Pronouns describe the characters on the page, not the author; first-person narrators' gender is invisible to this measure. | ✓ |
| `gender_feminine_per_1k` | She / her / hers | per 1,000 words | Feminine pronouns per 1,000 words. | Pronouns describe the characters on the page, not the author; first-person narrators' gender is invisible to this measure. | ✓ |
| `gender_neutral_plural_per_1k` | They / them / their | per 1,000 words | They/them/their pronouns per 1,000 words (plural or singular). | Pronouns describe the characters on the page, not the author; first-person narrators' gender is invisible to this measure. | ✓ |
| `gender_feminine_share` | Feminine share of he/she pronouns | share (0–1) | Feminine pronouns as a share of feminine plus masculine pronouns. | Pronouns describe the characters on the page, not the author; first-person narrators' gender is invisible to this measure. | ✓ |
| `gender_composition` | Pronoun composition | mostly_feminine / mixed / mostly_masculine / few_gendered_pronouns | Mostly feminine if the feminine share is ≥ 0.65, mostly masculine if ≤ 0.35, few if under 5 gendered pronouns per 1,000 words. | Pronouns describe the characters on the page, not the author; first-person narrators' gender is invisible to this measure. | ✓ |

## Punctuation

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `punct_exclamation_per_1k` | Exclamation marks | per 1,000 words | Exclamation marks per 1,000 words. |  | ✓ |
| `punct_question_per_1k` | Question marks | per 1,000 words | Question marks per 1,000 words. |  | ✓ |
| `punct_ellipsis_per_1k` | Ellipses | per 1,000 words | Ellipses ('…' or '...') per 1,000 words. Lines made only of dots are scene breaks, not ellipses. |  | ✓ |
| `punct_dash_per_1k` | Dashes | per 1,000 words | Dashes per 1,000 words: em dashes ('—'), runs of hyphens ('--'), and a hyphen or en dash with a space on each side used as a dash ('she paused - then left'). Hyphens inside words are not dashes. |  | ✓ |
| `punct_semicolon_per_1k` | Semicolons | per 1,000 words | Semicolons per 1,000 words. |  | ✓ |
| `punct_colon_per_1k` | Colons | per 1,000 words | Colons per 1,000 words. |  | ✓ |
| `punct_comma_per_1k` | Commas | per 1,000 words | Commas per 1,000 words. |  | ✓ |
| `punct_quote_marks_per_1k` | Quotation marks | per 1,000 words | Double quotation marks per 1,000 words. |  | ✓ |
| `punct_parentheses_per_1k` | Parentheses | per 1,000 words | Opening parentheses per 1,000 words. |  | ✓ |
| `punct_repeated_per_1k` | Repeated punctuation (!!, ?!) | per 1,000 words | Runs of two or more ! or ? marks (e.g. '!!', '?!') per 1,000 words. |  | ✓ |

## Questions & exclamations

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `qe_question_sentence_share` | Question sentences | share (0–1) | Share of sentences that end with a question mark. |  | ✓ |
| `qe_exclamation_sentence_share` | Exclamation sentences | share (0–1) | Share of sentences that end with an exclamation mark. |  | ✓ |
| `qe_question_sentences_per_1k` | Questions per 1,000 words | per 1,000 words | Sentences ending in a question mark per 1,000 words. |  | ✓ |
| `qe_exclamation_sentences_per_1k` | Exclamations per 1,000 words | per 1,000 words | Sentences ending in an exclamation mark per 1,000 words. |  | ✓ |
| `qe_question_to_statement_ratio` | Questions per statement | ratio | Question sentences divided by statements (sentences not ending in ? or !). |  | ✓ |

## Readability & sentence complexity

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `read_mean_word_chars` | Average word length | letters | Average number of letters per word. |  | ✓ |
| `read_mean_syllables_per_word` | Syllables per word | syllables | Average estimated syllables per word. | Syllables are estimated with a spelling rule (~85–90% exact per word). | ✓ |
| `read_polysyllable_share` | Long (3+ syllable) words | share (0–1) | Share of words with three or more syllables. |  | ✓ |
| `read_flesch_reading_ease` | Reading ease (Flesch) | score (higher = easier) | Flesch Reading Ease: 206.835 − 1.015 × words/sentence − 84.6 × syllables/word. Higher is easier. | Dialogue-heavy text has short sentences and scores as easy. | ✓ |
| `read_flesch_kincaid_grade` | Grade level (Flesch–Kincaid) | US school grade | Flesch–Kincaid grade: 0.39 × words/sentence + 11.8 × syllables/word − 15.59. |  | ✓ |
| `read_ari` | Grade level (ARI) | US school grade | Automated Readability Index: 4.71 × letters/word + 0.5 × words/sentence − 21.43. |  | ✓ |
| `read_coleman_liau` | Grade level (Coleman–Liau) | US school grade | Coleman–Liau index from letters per 100 words and sentences per 100 words. |  | ✓ |
| `read_gunning_fog` | Fog index | US school grade | Gunning Fog index: 0.4 × (words/sentence + 100 × share of 3+ syllable words). |  | ✓ |
| `read_grade_composite` | Reading difficulty (grade) | US school grade | Average of the Flesch–Kincaid, ARI and Coleman–Liau grade levels: a single 'estimated school grade'. |  | ✓ |
| `syn_commas_per_sentence` | Commas per sentence | commas | Average number of commas per sentence (a rough sign of longer, multi-part sentences). |  | ✓ |
| `syn_subordinators_per_sentence` | Subordinate clauses per sentence | words | Words that usually start a dependent clause (because, although, which, when…) per sentence. |  | ✓ |
| `syn_long_sentence_share` | Long sentences (>30 words) | share (0–1) | Share of sentences longer than 30 words. |  | ✓ |
| `syn_short_sentence_share` | Short sentences (≤5 words) | share (0–1) | Share of sentences of five words or fewer. |  | ✓ |
| `syn_sentence_length_sd` | Sentence-length variety | words | Standard deviation of sentence length: how much sentence lengths vary. |  | ✓ |

## Vocabulary

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `lex_unique_words` | Unique words | words | Number of different words used. | Grows with story length; compare stories of similar length or use the moving-average measure. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `lex_ttr` | Type–token ratio | share (0–1) | Unique words divided by total words. | Strongly depends on length (longer texts always score lower); prefer lex_mattr. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `lex_mattr` | Vocabulary variety (moving average) | share (0–1) | Moving-average type–token ratio: the share of different words in every 500-word window, averaged. | Needs at least 500 words (window size); blank for shorter stories. | ✓ |
| `lex_segment_ttr` | Vocabulary variety (per 1,000 words) | share (0–1) | Average share of different words within consecutive 1,000-word segments. | Blank for stories under 1,000 words. | ✓ |
| `lex_mean_word_zipf` | Everyday vocabulary | Zipf scale (higher = more common) | Average commonness of the words used, on the Zipf scale from the wordfreq English word-frequency list (about 7 = 'the', 3 = rare). |  | ✓ |
| `lex_rare_word_share` | Rare words | share (0–1) | Share of words that are rare in English (Zipf below 3, under ~1 per million words). |  | ✓ |
| `lex_unrecognized_word_share` | Unrecognised words | share (0–1) | Share of words not in the English frequency list: names, invented words, typos or non-English words. | Not a spelling-error rate: names and slang count too. | ✓ |
| `lex_long_word_share` | Long words (7+ letters) | share (0–1) | Share of words with seven or more letters. |  | ✓ |

## Repetition

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `rep_top10_content_share` | Focus on a few words | share (0–1) | Within each 500-word window, the share of content words (not function words) taken by the 10 most frequent ones, averaged. | Needs at least 500 words (window size); blank for shorter stories. | ✓ |
| `rep_bigram_repeat_share` | Repeated word pairs | share (0–1) | Within each 500-word window, the share of two-word sequences that occur more than once (ignoring pairs of function words), averaged. | Needs at least 500 words (window size); blank for shorter stories. | ✓ |
| `rep_trigram_repeat_share` | Repeated three-word phrases | share (0–1) | As above for three-word sequences. | Needs at least 500 words (window size); blank for shorter stories. | ✓ |
| `rep_adjacent_sentence_overlap` | Overlap between neighbouring sentences | share (0–1) | Average share of content words that consecutive sentences have in common (Jaccard overlap). |  | ✓ |
| `rep_same_start_share` | Sentences starting the same way | share (0–1) | Share of sentences that start with the same word as the sentence before ('She… She… She…'). |  | ✓ |
| `rep_immediate_word_repeats_per_1k` | Doubled words | per 1,000 words | Words immediately repeated ('yes, yes', 'oh oh') per 1,000 words. |  | ✓ |
| `rep_repeated_5gram_per_1k` | Repeated five-word phrases | per 1,000 words | Extra occurrences of any five-word sequence that appears more than once, per 1,000 words. | Rises with story length (a longer text has more chances to repeat a phrase); compare stories of similar length. | ✓ |

## Style

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `style_profanity_per_1k` | Profanity | per 1,000 words | Swear words per 1,000 words (lexicon). | Overlaps with the sexual-action list for 'fuck'. | ✓ |
| `style_all_caps_words_per_1k` | ALL-CAPS words | per 1,000 words | Words written entirely in capitals (2+ letters, common acronyms excluded) per 1,000 words. |  | ✓ |
| `style_ly_adverbs_per_1k` | -ly adverbs | per 1,000 words | Words ending in -ly (excluding common non-adverbs like 'only', 'family', 'lovely') per 1,000 words. |  | ✓ |
| `style_said_share` | Plain 'said' in dialogue tags | share (0–1) | 'said'/'says' as a share of all speech verbs (said, asked, whispered, moaned…). | Blank when fewer than 5 speech verbs occur. | ✓ |
| `style_action_verbs_per_1k` | Physical action verbs | per 1,000 words | Verbs of physical movement (grab, pull, turn, reach…) per 1,000 words. |  | ✓ |
| `style_descriptive_words_per_1k` | Descriptive words | per 1,000 words | Descriptive adjectives and material words (beautiful, tall, slender, satin…) per 1,000 words. |  | ✓ |
| `style_italics_per_1k` | Italics | per 1,000 words | Italicised passages per 1,000 words. | Italics are counted over the whole page body, author's notes included. | ✓ |

## Sexual content

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `sex_terms` | Sexual terms | terms | Number of sexual-language terms (all lists). | A keyword count from editable word lists; it does not measure how explicit a story feels to a reader. Blank when the collected text is incomplete (text_truncated). |  |
| `sex_terms_per_1k` | Sexual language | per 1,000 words | Sexual terms per 1,000 words. | A keyword count from editable word lists; it does not measure how explicit a story feels to a reader. | ✓ |
| `sex_anatomy_per_1k` | Anatomical terms | per 1,000 words | Explicit or clinical words for sexual body parts per 1,000 words. | A keyword count from editable word lists; it does not measure how explicit a story feels to a reader. | ✓ |
| `sex_action_per_1k` | Sexual-action terms | per 1,000 words | Words and phrases for sexual acts per 1,000 words. | A keyword count from editable word lists; it does not measure how explicit a story feels to a reader. | ✓ |
| `sex_other_per_1k` | Other sexual vocabulary | per 1,000 words | General sexual words (sex, naked, erotic, toys, lingerie) per 1,000 words. | A keyword count from editable word lists; it does not measure how explicit a story feels to a reader. | ✓ |
| `sex_sentence_share` | Sentences with sexual language | share (0–1) | Share of sentences containing at least one sexual term. | A keyword count from editable word lists; it does not measure how explicit a story feels to a reader. | ✓ |
| `sex_first_mention_position` | How far in before explicit language | position (0 = start, 1 = end) | Position of the first sexual term as a fraction of the story. | Blank if the story has none. Blank when the collected text is incomplete (text_truncated). Earlier in longer stories (a longer text has more chances of an early passing mention); compare stories of similar length. | ✓ |
| `sex_words_before_first` | Words before first explicit term | words | Number of words before the first sexual term ('slow burn'). | Blank if the story has none. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `sex_distinct_terms` | Variety of sexual vocabulary | terms | Number of different sexual-language words used. | Blank when the collected text is incomplete (text_truncated). | ✓ |
| `sex_has_explicit_terms` | Uses explicit terms | yes/no | Whether the story contains any term from the sexual word lists. |  | ✓ |

## Emotion

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `emo_overall_per_1k` | Emotional words (all) | per 1,000 words | Words from any emotion list per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. | ✓ |
| `emo_positive_per_1k` | Positive emotion | per 1,000 words | Positive-emotion and affection words per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. | ✓ |
| `emo_negative_per_1k` | Negative emotion | per 1,000 words | Negative-emotion, anxiety, anger, sadness, shame and jealousy words per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. | ✓ |
| `emo_affection_per_1k` | Affection & love | per 1,000 words | Words of love and fondness per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. | ✓ |
| `emo_anxiety_per_1k` | Anxiety & fear | per 1,000 words | Words of fear, worry and nervousness per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. Low split-half reliability (0.58): a single story's value is noisy (few hits per story), so compare groups of stories rather than single stories. | ✓ |
| `emo_anger_per_1k` | Anger | per 1,000 words | Words of anger and irritation per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. Low split-half reliability (0.55): a single story's value is noisy (few hits per story), so compare groups of stories rather than single stories. | ✓ |
| `emo_sadness_per_1k` | Sadness | per 1,000 words | Words of sadness, crying and loneliness per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. | ✓ |
| `emo_arousal_per_1k` | Excitement & arousal | per 1,000 words | Words of excitement, desire and arousal per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. | ✓ |
| `emo_shame_per_1k` | Shame & embarrassment | per 1,000 words | Words of shame, embarrassment, guilt and shyness per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. | ✓ |
| `emo_jealousy_per_1k` | Jealousy & envy | per 1,000 words | Words of jealousy and envy per 1,000 words. | Keyword counts: negation ('not happy') and sarcasm are not understood. Low split-half reliability (0.40): a single story's value is noisy (few hits per story), so compare groups of stories rather than single stories. | ✓ |
| `emo_balance` | Emotional tone | −1 (all negative) to +1 (all positive) | (positive − negative) ÷ (positive + negative) emotion words. | Keyword counts: negation ('not happy') and sarcasm are not understood. | ✓ |

## Distancing & immediacy

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `psy_mental_verbs_per_1k` | Thinking verbs | per 1,000 words | Mental-state verbs (think, know, realise, wonder…) per 1,000 words. |  | ✓ |
| `psy_perception_verbs_per_1k` | Perception verbs | per 1,000 words | Perception verbs (see, hear, feel, notice…) per 1,000 words. |  | ✓ |
| `psy_filter_words_per_1k` | 'Filter' words | per 1,000 words | Thinking plus perception verbs per 1,000 words: the 'she noticed / he felt' words writing guides call filters. |  | ✓ |
| `psy_distancing_per_1k` | Distancing phrases | per 1,000 words | Phrases like 'it seemed', 'as if', 'felt like' per 1,000 words. | Low split-half reliability (0.58): a single story's value is noisy (few hits per story), so compare groups of stories rather than single stories. | ✓ |
| `psy_immediacy_per_1k` | Immediacy words | per 1,000 words | Here-and-now words (now, here, suddenly, immediately) per 1,000 words. |  | ✓ |

## Hedging & certainty

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `hedge_count` | Hedges (count) | words | Number of hedging words and phrases. | Blank when the collected text is incomplete (text_truncated). |  |
| `hedge_per_1k` | Hedging | per 1,000 words | Hedges (maybe, perhaps, seemed, probably, kinda…) per 1,000 words. |  | ✓ |
| `hedge_modal_per_1k` | Modal verbs | per 1,000 words | Modal verbs (can, could, may, might, must, should, will, would…) per 1,000 words. |  | ✓ |
| `hedge_uncertainty_per_1k` | Uncertainty | per 1,000 words | Words of doubt and not knowing (unsure, confused, 'no idea'…) per 1,000 words. | Low split-half reliability (0.40): a single story's value is noisy (few hits per story), so compare groups of stories rather than single stories. | ✓ |
| `hedge_certainty_per_1k` | Certainty | per 1,000 words | Words of certainty and assertion (definitely, of course, always, never…) per 1,000 words. |  | ✓ |
| `hedge_certainty_balance` | Hedging ↔ certainty | −1 (all hedging) to +1 (all certainty) | (certainty − hedges) ÷ (certainty + hedges). | Low split-half reliability (0.43): a single story's value is noisy (few hits per story), so compare groups of stories rather than single stories. | ✓ |

## Sensory language

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `sense_touch_count` | Touch words (count) | words | Number of touch words. | Blank when the collected text is incomplete (text_truncated). |  |
| `sense_touch_per_1k` | Touch words | per 1,000 words | Touch words per 1,000 words. |  | ✓ |
| `sense_sight_count` | Sight words (count) | words | Number of sight words. | Blank when the collected text is incomplete (text_truncated). |  |
| `sense_sight_per_1k` | Sight words | per 1,000 words | Sight words per 1,000 words. |  | ✓ |
| `sense_sound_count` | Sound words (count) | words | Number of sound words. | Blank when the collected text is incomplete (text_truncated). |  |
| `sense_sound_per_1k` | Sound words | per 1,000 words | Sound words per 1,000 words. |  | ✓ |
| `sense_smell_count` | Smell words (count) | words | Number of smell words. | Blank when the collected text is incomplete (text_truncated). |  |
| `sense_smell_per_1k` | Smell words | per 1,000 words | Smell words per 1,000 words. |  | ✓ |
| `sense_taste_count` | Taste words (count) | words | Number of taste words. | Blank when the collected text is incomplete (text_truncated). |  |
| `sense_taste_per_1k` | Taste words | per 1,000 words | Taste words per 1,000 words. |  | ✓ |
| `sense_body_count` | Physical sensation words (count) | words | Number of physical sensation words. | Blank when the collected text is incomplete (text_truncated). |  |
| `sense_body_per_1k` | Physical sensation words | per 1,000 words | Physical sensation words per 1,000 words. |  | ✓ |
| `sense_total_per_1k` | Sensory language (all senses) | per 1,000 words | Words from any sensory list per 1,000 words. |  | ✓ |

## Intimacy & relationships

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `rel_romance_per_1k` | Romance | per 1,000 words | Courtship and romance vocabulary (falling in love, dates, weddings) per 1,000 words. |  | ✓ |
| `rel_intimacy_per_1k` | Intimacy | per 1,000 words | Affectionate physical closeness (kiss, hug, cuddle, gentle) per 1,000 words. |  | ✓ |
| `rel_terms_per_1k` | Relationship language | per 1,000 words | Relationship words (husband, wife, partner, marriage, affair) per 1,000 words. |  | ✓ |
| `rel_disclosure_per_1k` | Emotional disclosure | per 1,000 words | First-person feeling statements ('I feel', 'I'm scared') per 1,000 words. |  | ✓ |
| `rel_familiarity_per_1k` | Familiarity | per 1,000 words | Shared-history words (friend, as usual, for years) per 1,000 words. |  | ✓ |
| `rel_closeness_per_1k` | Interpersonal closeness | per 1,000 words | Togetherness words (together, each other, side by side) per 1,000 words. |  | ✓ |

## Agency & control

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `agency_passive_per_1k` | Passive constructions | per 1,000 words | 'be/get + past participle' constructions ('was taken', 'got tied') per 1,000 words. | Heuristic (about 9 in 10 counted matches were passives in a Stage 1B hand-check): common participles that describe a state or feeling ('was dressed in', 'was accustomed to', 'was fascinated by') are left out; rarer ones ('was unrequited') still count. | ✓ |
| `agency_passive_sentence_share` | Passive sentences | share (0–1) | Share of sentences containing a passive construction. |  | ✓ |
| `agency_active_sentence_share` | Active-voice sentences | share (0–1) | Share of sentences without a passive construction (1 − passive share). |  |  |
| `agency_volition_per_1k` | Agency (deciding & trying) | per 1,000 words | Words for deciding, choosing, planning and trying per 1,000 words. | Describes the language of the text, not the psychology of its author. Low split-half reliability (0.56): a single story's value is noisy (few hits per story), so compare groups of stories rather than single stories. | ✓ |
| `agency_control_per_1k` | Control & restraint | per 1,000 words | Words about control, restraint, permission and force per 1,000 words. | Describes the language of the text, not the psychology of its author. | ✓ |
| `agency_dominance_per_1k` | Dominance language | per 1,000 words | Words associated with commanding and domination per 1,000 words. | Describes the language of the text, not the psychology of its author. | ✓ |
| `agency_submission_per_1k` | Submission language | per 1,000 words | Words associated with obeying, kneeling and begging per 1,000 words. | Describes the language of the text, not the psychology of its author. | ✓ |
| `agency_commands_per_1k` | Spoken commands | per 1,000 words | Quoted passages containing a command, i.e. a sentence that starts with a command verb, possibly after 'please', 'now' or a name ('Come here.', 'Kneel.', 'Sarah, don't stop.'), per 1,000 words. | Heuristic: question sentences, 'Do you…', 'Look, …' / 'Listen, …' as fillers and 'fuck' as an expletive are left out; commands whose verb is not on the list (lexicons/imperative_verbs.txt) are missed. | ✓ |
| `agency_command_share_of_speech` | Commands among speech | share (0–1) | Share of quoted passages that contain a command (see agency_commands_per_1k). | Low split-half reliability (0.47): a single story's value is noisy (few hits per story), so compare groups of stories rather than single stories. | ✓ |

## Pacing

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `pace_sex_early` | Sexual language in the first fifth | per 1,000 words | Density of sexual language in the first fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_sex_late` | Sexual language in the last fifth | per 1,000 words | Density of sexual language in the last fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_sex_shift` | Build-up of sexual language | per 1,000 words | Last fifth minus first fifth: positive means sexual language increases towards the end. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_sex_peak_position` | Where sexual language peaks | position (0.1 … 0.9) | Middle of the fifth with the most sexual language (0.1 = start, 0.9 = end). | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_emotion_early` | Emotional language in the first fifth | per 1,000 words | Density of emotional language in the first fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_emotion_late` | Emotional language in the last fifth | per 1,000 words | Density of emotional language in the last fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_emotion_shift` | Build-up of emotional language | per 1,000 words | Last fifth minus first fifth: positive means emotional language increases towards the end. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_emotion_peak_position` | Where emotional language peaks | position (0.1 … 0.9) | Middle of the fifth with the most emotional language (0.1 = start, 0.9 = end). | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_dialogue_early` | Dialogue in the first fifth | share (0–1) | Density of dialogue in the first fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_dialogue_late` | Dialogue in the last fifth | share (0–1) | Density of dialogue in the last fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_dialogue_shift` | Build-up of dialogue | share (0–1) | Last fifth minus first fifth: positive means dialogue increases towards the end. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_dialogue_peak_position` | Where dialogue peaks | position (0.1 … 0.9) | Middle of the fifth with the most dialogue (0.1 = start, 0.9 = end). | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_action_early` | Action verbs in the first fifth | per 1,000 words | Density of action verbs in the first fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_action_late` | Action verbs in the last fifth | per 1,000 words | Density of action verbs in the last fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_action_shift` | Build-up of action verbs | per 1,000 words | Last fifth minus first fifth: positive means action verbs increases towards the end. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_action_peak_position` | Where action verbs peaks | position (0.1 … 0.9) | Middle of the fifth with the most action verbs (0.1 = start, 0.9 = end). | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_descriptive_early` | Descriptive & sensory language in the first fifth | per 1,000 words | Density of descriptive & sensory language in the first fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_descriptive_late` | Descriptive & sensory language in the last fifth | per 1,000 words | Density of descriptive & sensory language in the last fifth of the story. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_descriptive_shift` | Build-up of descriptive & sensory language | per 1,000 words | Last fifth minus first fifth: positive means descriptive & sensory language increases towards the end. | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |
| `pace_descriptive_peak_position` | Where descriptive & sensory language peaks | position (0.1 … 0.9) | Middle of the fifth with the most descriptive & sensory language (0.1 = start, 0.9 = end). | Story split into 5 equal parts by word count; needs at least 1,000 words. Blank when the collected text is incomplete (text_truncated). | ✓ |

## Quality control

| Column | Label | Unit | Meaning | Caveat | Explorer |
|---|---|---|---|---|---|
| `has_text` | Text collected | yes/no | Whether story text was collected. |  |  |
| `text_truncated` | Text truncated | yes/no | Whether the story had more pages than were collected (page cap or missing pages). |  |  |
| `qc_text_too_short` | Text too short | yes/no | True when the text is shorter than the minimum for text measures (default 100 words). |  |  |
| `qc_english_function_word_share` | English function-word share | share (0–1) | Share of words that are common English function words; very low values suggest non-English text. |  |  |
| `qc_quote_style` | Quotation style | double / single / none | Which quotation marks were treated as dialogue. |  |  |
| `qc_dialogue_quotes_unbalanced` | Unbalanced quotes | yes/no | More than half of the paragraphs with quotes have unmatched straight quotes, so dialogue measures are less reliable. |  |  |
| `qc_flags` | Quality flags |  | List of data-quality flags for the story (see Methodology, 'Quality flags'). |  |  |
| `analysis_include` | Included in analysis | yes/no | True when the story has text (≥ minimum words), a category, a publication date and a view count, is not a duplicate and looks like English. |  |  |
| `exclusion_reasons` | Exclusion reasons |  | Why analysis_include is false (empty when included). |  |  |
| `tags` | Tags |  | Tags the author attached (lower-case). | In the Stage 2 handoff only tags used by at least 20 stories are kept (rare tags can contain names). |  |
