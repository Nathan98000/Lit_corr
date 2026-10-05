"""The variable registry: one entry per column of the processed dataset.

This is the single source of truth for the data dictionary
(docs/DATA_DICTIONARY.md and data/processed/data_dictionary.json) and for the
per-variable tables in docs/METHODOLOGY.md. Tests check that every column the
pipeline produces is documented here and vice versa.

Fields:
  name        column name
  group       detailed family (used for documentation sections)
  ui_group    suggested explorer group: Story | Narration | Language | Sexual content | Style |
              Popularity | Publication | Identifiers | Quality
  kind        continuous | count | share | binary | categorical | date | id | list
  unit        plain-English unit
  label       short label for charts
  description plain-English definition
  caveat      known limitation ('' if none)
  explorer    True = sensible to offer as a story characteristic in the explorer
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, replace
from pathlib import Path


@dataclass(frozen=True)
class Var:
    name: str
    group: str
    ui_group: str
    kind: str
    unit: str
    label: str
    description: str
    caveat: str = ""
    explorer: bool = True


P1K = "per 1,000 words"
SHARE = "share (0–1)"
REG: list[Var] = []


def v(name, group, ui, kind, unit, label, desc, caveat="", explorer=True):
    REG.append(Var(name, group, ui, kind, unit, label, desc, caveat, explorer))


# ----------------------------------------------------------------- identifiers
G = "Identifiers & category"
v("story_key", G, "Identifiers", "id", "", "Story key",
  "Stable key for the story: a keyed hash (HMAC) of its URL slug, using a secret that stays on the collecting "
  "computer. Records match across reruns, but the key cannot be traced back to a story URL.", explorer=False)
v("queue_category_slug", G, "Identifiers", "categorical", "", "Sampling category",
  "The category listing the story was sampled from (its sampling stratum). Almost always equal to category_slug.",
  explorer=False)
v("category_slug", G, "Identifiers", "categorical", "", "Category (slug)",
  "Literotica's own category for the story, as given on the story page (URL form, e.g. adult-romance).",
  "Falls back to the category of the listing page the story was found on if the story page does not name one.",
  explorer=False)
v("category_name", G, "Identifiers", "categorical", "", "Category",
  "Literotica's own name for the story's category (e.g. Romance), taken from the site's category list for "
  "category_slug, so every story in a category has the same name.", explorer=False)
v("category_source", G, "Identifiers", "categorical", "", "Category source",
  "Where the category came from: 'page' (the story page) or 'listing' (the category listing it was found on).",
  explorer=False)
v("sampling_weight", G, "Identifiers", "continuous", "weight", "Sampling weight",
  "Estimated number of stories in the category divided by the number of analysed stories from that category. "
  "Use it to weight 'All categories' summaries so large categories count in proportion to their size.",
  "Blank when the category's size could not be estimated from its listing pages.", explorer=False)

# ----------------------------------------------------------------- publication
G = "Publication"
v("date_published", G, "Publication", "date", "date", "Publication date",
  "Date the story was published (Literotica's approval date).",
  "Not included in the Stage 2 handoff (year, month and weekday are).", explorer=False)
v("pub_year", G, "Publication", "count", "year", "Publication year", "Year the story was published.")
v("pub_month", G, "Publication", "count", "month (1–12)", "Publication month", "Month the story was published.")
v("pub_weekday", G, "Publication", "categorical", "0 = Monday … 6 = Sunday", "Publication weekday",
  "Day of the week the story was published.")
v("pub_is_weekend", G, "Publication", "binary", "yes/no", "Published on a weekend",
  "Whether the story was published on a Saturday or Sunday.")
v("age_days", G, "Publication", "count", "days", "Days online",
  "Days between publication and the moment its statistics were recorded by the collector.",
  "Measured at collection time; stories collected on different days have slightly different reference dates.")
v("age_years", G, "Publication", "continuous", "years", "Years online", "age_days divided by 365.25.")

# ------------------------------------------------------------------ popularity
G = "Popularity (raw)"
RAW_NOTE = ("A running total as displayed by Literotica when the story was collected. Older stories have had more time "
            "to accumulate it; compare with the per-month version.")
v("pop_views", G, "Popularity", "count", "views", "Views", "Number of views shown for the story.", RAW_NOTE, False)
v("pop_views_approx", G, "Quality", "binary", "yes/no", "Views abbreviated",
  "True when only an abbreviated count (e.g. '12.3k') was available, so views are rounded.", explorer=False)
v("pop_favorites", G, "Popularity", "count", "favorites", "Favorites",
  "Number of readers who added the story to their favorites.", RAW_NOTE, False)
v("pop_comments", G, "Popularity", "count", "comments", "Comments", "Number of public comments on the story.",
  RAW_NOTE, False)
v("pop_rating", G, "Popularity", "continuous", "1–5 stars", "Average rating",
  "Average star rating (1–5) shown for the story.",
  "Blank when the story had no ratings yet. Readers who vote are a small, self-selected group.", False)
v("pop_rating_count", G, "Popularity", "count", "ratings", "Number of ratings",
  "Number of readers who rated the story, from the story page's own data (not always shown on screen).",
  RAW_NOTE + " Readers who vote are a small, self-selected group.", False)
v("pop_reading_lists", G, "Popularity", "count", "reading lists", "Reading-list adds",
  "Number of times the story was added to readers' reading lists, when shown.", RAW_NOTE, False)
v("pop_log10_views", G, "Popularity", "continuous", "log10(views + 1)", "Views (log scale)",
  "Base-10 logarithm of views + 1; useful because view counts span several orders of magnitude.", explorer=False)
G = "Popularity (ratios)"
RATIO_NOTE = "Only computed when the story has at least the configured minimum number of views (default 100)."
v("pop_fav_per_1k_views", G, "Popularity", "continuous", "per 1,000 views", "Favorites per 1,000 views",
  "Favorites divided by views, times 1,000: how often a reader who opened the story favorited it.", RATIO_NOTE, False)
v("pop_comments_per_1k_views", G, "Popularity", "continuous", "per 1,000 views", "Comments per 1,000 views",
  "Comments divided by views, times 1,000.", RATIO_NOTE, False)
v("pop_ratings_per_1k_views", G, "Popularity", "continuous", "per 1,000 views", "Ratings per 1,000 views",
  "Number of ratings divided by views, times 1,000 (only when the number of ratings is available).", RATIO_NOTE, False)
v("pop_reading_lists_per_1k_views", G, "Popularity", "continuous", "per 1,000 views",
  "Reading-list adds per 1,000 views", "Reading-list adds divided by views, times 1,000.", RATIO_NOTE, False)
G = "Popularity (age-normalised)"
AGE_NOTE = ("Total divided by months online (minimum one month). A simple descriptive adjustment, not a statistical "
            "correction: views are not spread evenly over a story's life.")
v("pop_views_per_month", G, "Popularity", "continuous", "views per month", "Views per month",
  "Views divided by the number of months the story had been online when collected.", AGE_NOTE, False)
v("pop_favorites_per_month", G, "Popularity", "continuous", "favorites per month", "Favorites per month",
  "Favorites divided by months online.", AGE_NOTE, False)
v("pop_comments_per_month", G, "Popularity", "continuous", "comments per month", "Comments per month",
  "Comments divided by months online.", AGE_NOTE, False)
G = "Site badges"
v("pop_is_hot", G, "Popularity", "binary", "yes/no", "'Hot' badge",
  "Literotica's 'H' (hot) badge, shown for highly rated stories.", explorer=False)
v("pop_writers_pick", G, "Popularity", "binary", "yes/no", "Writer's pick", "Literotica's Writer's Pick badge.",
  explorer=False)
v("pop_contest_winner", G, "Popularity", "binary", "yes/no", "Contest winner", "Story won a Literotica contest.",
  explorer=False)

# ------------------------------------------------------------------ site metadata
G = "Site metadata"
v("site_words_count", G, "Story", "count", "words", "Word count (site)",
  "Literotica's own word count for the story, when shown.", explorer=False)
v("story_pages", G, "Story", "count", "pages", "Pages on site", "Number of web pages the story is split into.")
v("meta_tag_count", G, "Story", "count", "tags", "Number of tags", "Number of tags the author attached.")
v("author_stories_count", G, "Story", "count", "stories", "Author's story count",
  "Number of stories the author had published (public profile count) when collected.",
  "Measured at collection time, not at publication time. In the Stage 2 handoff rounded down to bands "
  "(1, 2, 6, 21, 51, 101, 201+).")
v("author_followers_count", G, "Story", "count", "followers", "Author's followers",
  "Number of followers the author had (public profile count) when collected.",
  "Measured at collection time, so it partly reflects the author's later success. In the Stage 2 handoff "
  "rounded down to bands (0, 10, 100, 1,000, 10,000+).", explorer=False)

# ------------------------------------------------------------------ story basics
G = "Story basics"
v("story_words", G, "Story", "count", "words", "Word count",
  "Number of words in the story text (letters/digits, contractions count as one word). Author's notes, headings "
  "and other paratext are not counted (see Methodology).",
  "Counted on the collected pages; long stories beyond the page cap are flagged as truncated.")
v("story_chars", G, "Story", "count", "characters", "Character count",
  "Number of characters in the story text (paratext excluded).")
v("story_sentences", G, "Story", "count", "sentences", "Sentence count", "Number of sentences (see Methodology).")
v("story_paragraphs", G, "Story", "count", "paragraphs", "Paragraph count",
  "Number of non-empty story paragraphs (paratext excluded).")
v("story_mean_sentence_words", G, "Style", "continuous", "words", "Average sentence length",
  "Average number of words per sentence.")
v("story_median_sentence_words", G, "Style", "continuous", "words", "Median sentence length",
  "Median number of words per sentence.")
v("story_mean_paragraph_words", G, "Style", "continuous", "words", "Average paragraph length",
  "Average number of words per paragraph.")
v("story_median_paragraph_words", G, "Style", "continuous", "words", "Median paragraph length",
  "Median number of words per paragraph.")
v("story_one_sentence_paragraph_share", G, "Style", "share", SHARE, "One-sentence paragraphs",
  "Share of paragraphs that consist of a single sentence.")
v("story_long_paragraph_share", G, "Style", "share", SHARE, "Very long paragraphs ('walls of text')",
  "Share of paragraphs longer than 150 words.")
v("story_scene_breaks", G, "Story", "count", "breaks", "Scene breaks",
  "Number of scene-break lines inside the story: paragraphs with no letters or digits ('* * *', '-----', "
  "'......', 'o0o'). Lines that open or close the story are not counted.", explorer=False)
v("story_scene_breaks_per_1k", G, "Story", "continuous", P1K, "Scene breaks per 1,000 words",
  "Scene-break lines per 1,000 words.")
v("story_has_author_note", G, "Story", "binary", "yes/no", "Has an author's note",
  "Whether the story opens or closes with an author's or editor's note, disclaimer, dedication, copyright line "
  "or words to readers, or has a paragraph labelled as an author's note (see Methodology, 'Paratext').",
  "Rule-based; misses notes that use no recognisable wording (about 1 in 3 in a hand check).")
v("story_requests_feedback", G, "Story", "binary", "yes/no", "Asks readers to vote or comment",
  "Whether the author's notes, or the first or last three story paragraphs, ask readers to vote, rate, comment "
  "or give feedback.")
G = "Title & description"
v("title_chars", G, "Story", "count", "characters", "Title length", "Number of characters in the title.")
v("title_words", G, "Story", "count", "words", "Title word count", "Number of words in the title.")
v("title_has_chapter_marker", G, "Story", "binary", "yes/no", "Title marks a chapter/part",
  "Whether the title contains a chapter or part marker such as 'Ch. 02', 'Pt. 3' or ends with a number.")
v("desc_chars", G, "Story", "count", "characters", "Description length",
  "Number of characters in the author's short description.")
v("desc_words", G, "Story", "count", "words", "Description word count", "Number of words in the description.")
G = "Series"
v("series_is_part", G, "Story", "binary", "yes/no", "Part of a series",
  "Whether the story belongs to a series (series link on the page, a series of 2+ parts, or a chapter marker in "
  "the title).")
v("series_part_number", G, "Story", "count", "part", "Part number",
  "Which part of its series the story is (1 = first), from the series list or the title.")
v("series_parts_count", G, "Story", "count", "parts", "Parts in series", "Number of parts in the series, when shown.",
  explorer=False)
v("series_is_later_part", G, "Story", "binary", "yes/no", "Later part of a series",
  "Whether the story is part 2 or later of a series.")

# ------------------------------------------------------------------ narration
G = "Narration"
POV_NOTE = "A word-counting heuristic, not true narrative analysis; see Methodology for how it was validated."
v("pov_first_singular_per_1k", G, "Narration", "continuous", P1K, "I / me / my",
  "First-person singular pronouns (I, me, my, mine, myself, I'm …) per 1,000 words, dialogue included.")
v("pov_first_plural_per_1k", G, "Narration", "continuous", P1K, "We / us / our",
  "First-person plural pronouns per 1,000 words.")
v("pov_second_per_1k", G, "Narration", "continuous", P1K, "You / your", "Second-person pronouns per 1,000 words.")
v("pov_third_per_1k", G, "Narration", "continuous", P1K, "He / she / they",
  "Third-person personal pronouns (he, she, they and their forms) per 1,000 words.")
v("pov_first_singular_narr_per_1k", G, "Narration", "continuous", "per 1,000 narration words",
  "I / me / my in narration", "First-person singular pronouns per 1,000 words of narration (outside quotation marks).")
v("pov_second_narr_per_1k", G, "Narration", "continuous", "per 1,000 narration words", "You / your in narration",
  "Second-person pronouns per 1,000 narration words.")
v("pov_third_narr_per_1k", G, "Narration", "continuous", "per 1,000 narration words", "He / she / they in narration",
  "Third-person pronouns per 1,000 narration words.")
v("pov_first_person_share", G, "Narration", "share", SHARE, "First-person share of pronouns",
  "In narration, first-person pronouns as a share of first- plus third-person pronouns.", POV_NOTE)
v("pov_class", G, "Narration", "categorical", "first / second / third / mixed / unknown", "Narrative perspective",
  "Estimated narrative perspective from narration pronouns: first if ≥15 I/me/my per 1,000 narration words; "
  "second if 'you' forms are ≥15 and more frequent; third if under 5, or if I/me/my are under 8% of the I/me/my "
  "plus he/she/they forms (reported thoughts or a letter inside a third-person story); otherwise mixed; unknown "
  "if under 200 narration words.", POV_NOTE)
v("pov_is_first_person", G, "Narration", "binary", "1 = first, 0 = third", "First-person narration",
  "1 for stories classified as first person, 0 for third person, blank otherwise.", POV_NOTE)
v("narr_present_tense_share", G, "Narration", "share", SHARE, "Present-tense share",
  "In narration, present-tense forms of ~70 common verbs as a share of present plus past forms.",
  "Blank if fewer than 20 such verbs occur. A heuristic.")
v("narr_tense_class", G, "Narration", "categorical", "present / past / mixed / unknown", "Narration tense",
  "Present if the present-tense share is ≥ 0.6, past if ≤ 0.4, otherwise mixed.")
v("narr_is_present_tense", G, "Narration", "binary", "1 = present, 0 = past", "Present-tense narration",
  "1 for present-tense narration, 0 for past tense, blank otherwise.")
G = "Dialogue"
v("dlg_word_share", G, "Narration", "share", SHARE, "Dialogue share",
  "Share of words inside quotation marks.",
  "Depends on consistent quotation marks; stories using none score 0 even if they contain speech.")
v("dlg_segments", G, "Narration", "count", "segments", "Dialogue segments", "Number of separate quoted passages.",
  explorer=False)
v("dlg_segments_per_1k", G, "Narration", "continuous", P1K, "Dialogue segments per 1,000 words",
  "Number of separate quoted passages per 1,000 words.")
v("dlg_mean_segment_words", G, "Narration", "continuous", "words", "Average speech length",
  "Average number of words per quoted passage.")
v("dlg_question_share", G, "Narration", "share", SHARE, "Questions asked in dialogue",
  "Share of all question marks that occur inside quotation marks.")
v("dlg_exclamation_share", G, "Narration", "share", SHARE, "Exclamations in dialogue",
  "Share of all exclamation marks that occur inside quotation marks.")
v("dlg_paragraph_share", G, "Narration", "share", SHARE, "Paragraphs with dialogue",
  "Share of paragraphs that contain at least one quoted passage.")
v("dlg_has_dialogue", G, "Narration", "binary", "yes/no", "Has dialogue", "Whether the story has any quoted speech.")
G = "Characters"
v("char_recurring_names", G, "Narration", "count", "names", "Recurring names",
  "Number of distinct capitalised names that appear at least 3 times mid-sentence (mostly characters, sometimes "
  "places).", "Heuristic: first names and surnames count separately. Common titles, places, nationalities, "
  "organisations and brands are left out (lexicons/not_names.txt), as is a word that mostly follows 'the' or "
  "'in', but rarer ones can still count (about 9 in 10 detected names were characters in a Stage 1B hand-check); "
  "names that only ever start a sentence are missed.")
v("char_name_mentions_per_1k", G, "Narration", "continuous", P1K, "Name mentions per 1,000 words",
  "Mentions of those recurring names per 1,000 words.")
v("char_top_name_share", G, "Narration", "share", SHARE, "Focus on main name",
  "Share of all name mentions taken by the most-mentioned name.")
G = "Gendered language"
GENDER_NOTE = ("Pronouns describe the characters on the page, not the author; first-person narrators' gender is "
               "invisible to this measure.")
v("gender_masculine_per_1k", G, "Narration", "continuous", P1K, "He / him / his",
  "Masculine pronouns per 1,000 words.", GENDER_NOTE)
v("gender_feminine_per_1k", G, "Narration", "continuous", P1K, "She / her / hers",
  "Feminine pronouns per 1,000 words.", GENDER_NOTE)
v("gender_neutral_plural_per_1k", G, "Narration", "continuous", P1K, "They / them / their",
  "They/them/their pronouns per 1,000 words (plural or singular).", GENDER_NOTE)
v("gender_feminine_share", G, "Narration", "share", SHARE, "Feminine share of he/she pronouns",
  "Feminine pronouns as a share of feminine plus masculine pronouns.", GENDER_NOTE)
v("gender_composition", G, "Narration", "categorical",
  "mostly_feminine / mixed / mostly_masculine / few_gendered_pronouns", "Pronoun composition",
  "Mostly feminine if the feminine share is ≥ 0.65, mostly masculine if ≤ 0.35, few if under 5 gendered "
  "pronouns per 1,000 words.", GENDER_NOTE)

# ------------------------------------------------------------------ style
G = "Punctuation"
v("punct_exclamation_per_1k", G, "Style", "continuous", P1K, "Exclamation marks", "Exclamation marks per 1,000 words.")
v("punct_question_per_1k", G, "Style", "continuous", P1K, "Question marks", "Question marks per 1,000 words.")
v("punct_ellipsis_per_1k", G, "Style", "continuous", P1K, "Ellipses",
  "Ellipses ('…' or '...') per 1,000 words. Lines made only of dots are scene breaks, not ellipses.")
v("punct_dash_per_1k", G, "Style", "continuous", P1K, "Dashes",
  "Dashes per 1,000 words: em dashes ('—'), runs of hyphens ('--'), and a hyphen or en dash with a space on each "
  "side used as a dash ('she paused - then left'). Hyphens inside words are not dashes.")
v("punct_semicolon_per_1k", G, "Style", "continuous", P1K, "Semicolons", "Semicolons per 1,000 words.")
v("punct_colon_per_1k", G, "Style", "continuous", P1K, "Colons", "Colons per 1,000 words.")
v("punct_comma_per_1k", G, "Style", "continuous", P1K, "Commas", "Commas per 1,000 words.")
v("punct_quote_marks_per_1k", G, "Style", "continuous", P1K, "Quotation marks", "Double quotation marks per 1,000 words.")
v("punct_parentheses_per_1k", G, "Style", "continuous", P1K, "Parentheses", "Opening parentheses per 1,000 words.")
v("punct_repeated_per_1k", G, "Style", "continuous", P1K, "Repeated punctuation (!!, ?!)",
  "Runs of two or more ! or ? marks (e.g. '!!', '?!') per 1,000 words.")
G = "Questions & exclamations"
v("qe_question_sentence_share", G, "Style", "share", SHARE, "Question sentences",
  "Share of sentences that end with a question mark.")
v("qe_exclamation_sentence_share", G, "Style", "share", SHARE, "Exclamation sentences",
  "Share of sentences that end with an exclamation mark.")
v("qe_question_sentences_per_1k", G, "Style", "continuous", P1K, "Questions per 1,000 words",
  "Sentences ending in a question mark per 1,000 words.")
v("qe_exclamation_sentences_per_1k", G, "Style", "continuous", P1K, "Exclamations per 1,000 words",
  "Sentences ending in an exclamation mark per 1,000 words.")
v("qe_question_to_statement_ratio", G, "Style", "continuous", "ratio", "Questions per statement",
  "Question sentences divided by statements (sentences not ending in ? or !).")
G = "Readability & sentence complexity"
v("read_mean_word_chars", G, "Story", "continuous", "letters", "Average word length",
  "Average number of letters per word.")
v("read_mean_syllables_per_word", G, "Story", "continuous", "syllables", "Syllables per word",
  "Average estimated syllables per word.", "Syllables are estimated with a spelling rule (~85–90% exact per word).")
v("read_polysyllable_share", G, "Story", "share", SHARE, "Long (3+ syllable) words",
  "Share of words with three or more syllables.")
v("read_flesch_reading_ease", G, "Story", "continuous", "score (higher = easier)", "Reading ease (Flesch)",
  "Flesch Reading Ease: 206.835 − 1.015 × words/sentence − 84.6 × syllables/word. Higher is easier.",
  "Dialogue-heavy text has short sentences and scores as easy.")
v("read_flesch_kincaid_grade", G, "Story", "continuous", "US school grade", "Grade level (Flesch–Kincaid)",
  "Flesch–Kincaid grade: 0.39 × words/sentence + 11.8 × syllables/word − 15.59.")
v("read_ari", G, "Story", "continuous", "US school grade", "Grade level (ARI)",
  "Automated Readability Index: 4.71 × letters/word + 0.5 × words/sentence − 21.43.")
v("read_coleman_liau", G, "Story", "continuous", "US school grade", "Grade level (Coleman–Liau)",
  "Coleman–Liau index from letters per 100 words and sentences per 100 words.")
v("read_gunning_fog", G, "Story", "continuous", "US school grade", "Fog index",
  "Gunning Fog index: 0.4 × (words/sentence + 100 × share of 3+ syllable words).")
v("read_grade_composite", G, "Story", "continuous", "US school grade", "Reading difficulty (grade)",
  "Average of the Flesch–Kincaid, ARI and Coleman–Liau grade levels: a single 'estimated school grade'.")
v("syn_commas_per_sentence", G, "Style", "continuous", "commas", "Commas per sentence",
  "Average number of commas per sentence (a rough sign of longer, multi-part sentences).")
v("syn_subordinators_per_sentence", G, "Style", "continuous", "words", "Subordinate clauses per sentence",
  "Words that usually start a dependent clause (because, although, which, when…) per sentence.")
v("syn_long_sentence_share", G, "Style", "share", SHARE, "Long sentences (>30 words)",
  "Share of sentences longer than 30 words.")
v("syn_short_sentence_share", G, "Style", "share", SHARE, "Short sentences (≤5 words)",
  "Share of sentences of five words or fewer.")
v("syn_sentence_length_sd", G, "Style", "continuous", "words", "Sentence-length variety",
  "Standard deviation of sentence length: how much sentence lengths vary.")
G = "Vocabulary"
WIN = "Needs at least 500 words (window size); blank for shorter stories."
v("lex_unique_words", G, "Story", "count", "words", "Unique words", "Number of different words used.",
  "Grows with story length; compare stories of similar length or use the moving-average measure.")
v("lex_ttr", G, "Story", "share", SHARE, "Type–token ratio", "Unique words divided by total words.",
  "Strongly depends on length (longer texts always score lower); prefer lex_mattr.")
v("lex_mattr", G, "Story", "share", SHARE, "Vocabulary variety (moving average)",
  "Moving-average type–token ratio: the share of different words in every 500-word window, averaged.", WIN)
v("lex_segment_ttr", G, "Story", "share", SHARE, "Vocabulary variety (per 1,000 words)",
  "Average share of different words within consecutive 1,000-word segments.",
  "Blank for stories under 1,000 words.")
v("lex_mean_word_zipf", G, "Story", "continuous", "Zipf scale (higher = more common)", "Everyday vocabulary",
  "Average commonness of the words used, on the Zipf scale from the wordfreq English word-frequency list "
  "(about 7 = 'the', 3 = rare).")
v("lex_rare_word_share", G, "Story", "share", SHARE, "Rare words",
  "Share of words that are rare in English (Zipf below 3, under ~1 per million words).")
v("lex_unrecognized_word_share", G, "Story", "share", SHARE, "Unrecognised words",
  "Share of words not in the English frequency list: names, invented words, typos or non-English words.",
  "Not a spelling-error rate: names and slang count too.")
v("lex_long_word_share", G, "Story", "share", SHARE, "Long words (7+ letters)",
  "Share of words with seven or more letters.")
G = "Repetition"
v("rep_top10_content_share", G, "Language", "share", SHARE, "Focus on a few words",
  "Within each 500-word window, the share of content words (not function words) taken by the 10 most "
  "frequent ones, averaged.", WIN)
v("rep_bigram_repeat_share", G, "Language", "share", SHARE, "Repeated word pairs",
  "Within each 500-word window, the share of two-word sequences that occur more than once (ignoring pairs of "
  "function words), averaged.", WIN)
v("rep_trigram_repeat_share", G, "Language", "share", SHARE, "Repeated three-word phrases",
  "As above for three-word sequences.", WIN)
v("rep_adjacent_sentence_overlap", G, "Language", "share", SHARE, "Overlap between neighbouring sentences",
  "Average share of content words that consecutive sentences have in common (Jaccard overlap).")
v("rep_same_start_share", G, "Language", "share", SHARE, "Sentences starting the same way",
  "Share of sentences that start with the same word as the sentence before ('She… She… She…').")
v("rep_immediate_word_repeats_per_1k", G, "Language", "continuous", P1K, "Doubled words",
  "Words immediately repeated ('yes, yes', 'oh oh') per 1,000 words.")
v("rep_repeated_5gram_per_1k", G, "Language", "continuous", P1K, "Repeated five-word phrases",
  "Extra occurrences of any five-word sequence that appears more than once, per 1,000 words.")
G = "Style"
v("style_profanity_per_1k", G, "Style", "continuous", P1K, "Profanity", "Swear words per 1,000 words (lexicon).",
  "Overlaps with the sexual-action list for 'fuck'.")
v("style_all_caps_words_per_1k", G, "Style", "continuous", P1K, "ALL-CAPS words",
  "Words written entirely in capitals (2+ letters, common acronyms excluded) per 1,000 words.")
v("style_ly_adverbs_per_1k", G, "Style", "continuous", P1K, "-ly adverbs",
  "Words ending in -ly (excluding common non-adverbs like 'only', 'family', 'lovely') per 1,000 words.")
v("style_said_share", G, "Style", "share", SHARE, "Plain 'said' in dialogue tags",
  "'said'/'says' as a share of all speech verbs (said, asked, whispered, moaned…).",
  "Blank when fewer than 5 speech verbs occur.")
v("style_action_verbs_per_1k", G, "Style", "continuous", P1K, "Physical action verbs",
  "Verbs of physical movement (grab, pull, turn, reach…) per 1,000 words.")
v("style_descriptive_words_per_1k", G, "Style", "continuous", P1K, "Descriptive words",
  "Descriptive adjectives and material words (beautiful, tall, slender, satin…) per 1,000 words.")
v("style_italics_per_1k", G, "Style", "continuous", P1K, "Italics", "Italicised passages per 1,000 words.",
  "Italics are counted over the whole page body, author's notes included.")

# ------------------------------------------------------------------ sexual content
G = "Sexual content"
SEX_NOTE = "A keyword count from editable word lists; it does not measure how explicit a story feels to a reader."
v("sex_terms", G, "Sexual content", "count", "terms", "Sexual terms", "Number of sexual-language terms (all lists).",
  SEX_NOTE, False)
v("sex_terms_per_1k", G, "Sexual content", "continuous", P1K, "Sexual language", "Sexual terms per 1,000 words.",
  SEX_NOTE)
v("sex_anatomy_per_1k", G, "Sexual content", "continuous", P1K, "Anatomical terms",
  "Explicit or clinical words for sexual body parts per 1,000 words.", SEX_NOTE)
v("sex_action_per_1k", G, "Sexual content", "continuous", P1K, "Sexual-action terms",
  "Words and phrases for sexual acts per 1,000 words.", SEX_NOTE)
v("sex_other_per_1k", G, "Sexual content", "continuous", P1K, "Other sexual vocabulary",
  "General sexual words (sex, naked, erotic, toys, lingerie) per 1,000 words.", SEX_NOTE)
v("sex_sentence_share", G, "Sexual content", "share", SHARE, "Sentences with sexual language",
  "Share of sentences containing at least one sexual term.", SEX_NOTE)
v("sex_first_mention_position", G, "Sexual content", "share", "position (0 = start, 1 = end)",
  "How far in before explicit language", "Position of the first sexual term as a fraction of the story.",
  "Blank if the story has none.")
v("sex_words_before_first", G, "Sexual content", "count", "words", "Words before first explicit term",
  "Number of words before the first sexual term ('slow burn').", "Blank if the story has none.")
v("sex_distinct_terms", G, "Sexual content", "count", "terms", "Variety of sexual vocabulary",
  "Number of different sexual-language words used.")
v("sex_has_explicit_terms", G, "Sexual content", "binary", "yes/no", "Uses explicit terms",
  "Whether the story contains any term from the sexual word lists.")

# ------------------------------------------------------------------ language: emotion
G = "Emotion"
EMO_NOTE = "Keyword counts: negation ('not happy') and sarcasm are not understood."
for key, label, desc in (
    ("overall", "Emotional words (all)", "Words from any emotion list per 1,000 words."),
    ("positive", "Positive emotion", "Positive-emotion and affection words per 1,000 words."),
    ("negative", "Negative emotion",
     "Negative-emotion, anxiety, anger, sadness, shame and jealousy words per 1,000 words."),
    ("affection", "Affection & love", "Words of love and fondness per 1,000 words."),
    ("anxiety", "Anxiety & fear", "Words of fear, worry and nervousness per 1,000 words."),
    ("anger", "Anger", "Words of anger and irritation per 1,000 words."),
    ("sadness", "Sadness", "Words of sadness, crying and loneliness per 1,000 words."),
    ("arousal", "Excitement & arousal", "Words of excitement, desire and arousal per 1,000 words."),
    ("shame", "Shame & embarrassment", "Words of shame, embarrassment, guilt and shyness per 1,000 words."),
    ("jealousy", "Jealousy & envy", "Words of jealousy and envy per 1,000 words."),
):
    v(f"emo_{key}_per_1k", G, "Language", "continuous", P1K, label, desc, EMO_NOTE)
v("emo_balance", G, "Language", "continuous", "−1 (all negative) to +1 (all positive)", "Emotional tone",
  "(positive − negative) ÷ (positive + negative) emotion words.", EMO_NOTE)
G = "Distancing & immediacy"
v("psy_mental_verbs_per_1k", G, "Language", "continuous", P1K, "Thinking verbs",
  "Mental-state verbs (think, know, realise, wonder…) per 1,000 words.")
v("psy_perception_verbs_per_1k", G, "Language", "continuous", P1K, "Perception verbs",
  "Perception verbs (see, hear, feel, notice…) per 1,000 words.")
v("psy_filter_words_per_1k", G, "Language", "continuous", P1K, "'Filter' words",
  "Thinking plus perception verbs per 1,000 words: the 'she noticed / he felt' words writing guides call filters.")
v("psy_distancing_per_1k", G, "Language", "continuous", P1K, "Distancing phrases",
  "Phrases like 'it seemed', 'as if', 'felt like' per 1,000 words.")
v("psy_immediacy_per_1k", G, "Language", "continuous", P1K, "Immediacy words",
  "Here-and-now words (now, here, suddenly, immediately) per 1,000 words.")
G = "Hedging & certainty"
v("hedge_count", G, "Language", "count", "words", "Hedges (count)", "Number of hedging words and phrases.",
  explorer=False)
v("hedge_per_1k", G, "Language", "continuous", P1K, "Hedging",
  "Hedges (maybe, perhaps, seemed, probably, kinda…) per 1,000 words.")
v("hedge_modal_per_1k", G, "Language", "continuous", P1K, "Modal verbs",
  "Modal verbs (can, could, may, might, must, should, will, would…) per 1,000 words.")
v("hedge_uncertainty_per_1k", G, "Language", "continuous", P1K, "Uncertainty",
  "Words of doubt and not knowing (unsure, confused, 'no idea'…) per 1,000 words.")
v("hedge_certainty_per_1k", G, "Language", "continuous", P1K, "Certainty",
  "Words of certainty and assertion (definitely, of course, always, never…) per 1,000 words.")
v("hedge_certainty_balance", G, "Language", "continuous", "−1 (all hedging) to +1 (all certainty)",
  "Hedging ↔ certainty", "(certainty − hedges) ÷ (certainty + hedges).")
G = "Sensory language"
for sense, label in (("touch", "Touch"), ("sight", "Sight"), ("sound", "Sound"), ("smell", "Smell"),
                     ("taste", "Taste"), ("body", "Physical sensation")):
    v(f"sense_{sense}_count", G, "Language", "count", "words", f"{label} words (count)",
      f"Number of {label.lower()} words.", explorer=False)
    v(f"sense_{sense}_per_1k", G, "Language", "continuous", P1K, f"{label} words",
      f"{label} words per 1,000 words.")
v("sense_total_per_1k", G, "Language", "continuous", P1K, "Sensory language (all senses)",
  "Words from any sensory list per 1,000 words.")
G = "Intimacy & relationships"
for key, label, desc in (
    ("romance", "Romance", "Courtship and romance vocabulary (falling in love, dates, weddings) per 1,000 words."),
    ("intimacy", "Intimacy", "Affectionate physical closeness (kiss, hug, cuddle, gentle) per 1,000 words."),
    ("terms", "Relationship language", "Relationship words (husband, wife, partner, marriage, affair) per 1,000 words."),
    ("disclosure", "Emotional disclosure", "First-person feeling statements ('I feel', 'I'm scared') per 1,000 words."),
    ("familiarity", "Familiarity", "Shared-history words (friend, as usual, for years) per 1,000 words."),
    ("closeness", "Interpersonal closeness", "Togetherness words (together, each other, side by side) per 1,000 words."),
):
    v(f"rel_{key}_per_1k", G, "Language", "continuous", P1K, label, desc)
G = "Agency & control"
AG_NOTE = "Describes the language of the text, not the psychology of its author."
v("agency_passive_per_1k", G, "Language", "continuous", P1K, "Passive constructions",
  "'be/get + past participle' constructions ('was taken', 'got tied') per 1,000 words.",
  "Heuristic (about 9 in 10 counted matches were passives in a Stage 1B hand-check): common participles that "
  "describe a state or feeling ('was dressed in', 'was accustomed to', 'was fascinated by') are left out; rarer "
  "ones ('was unrequited') still count.")
v("agency_passive_sentence_share", G, "Language", "share", SHARE, "Passive sentences",
  "Share of sentences containing a passive construction.")
v("agency_active_sentence_share", G, "Language", "share", SHARE, "Active-voice sentences",
  "Share of sentences without a passive construction (1 − passive share).", explorer=False)
v("agency_volition_per_1k", G, "Language", "continuous", P1K, "Agency (deciding & trying)",
  "Words for deciding, choosing, planning and trying per 1,000 words.", AG_NOTE)
v("agency_control_per_1k", G, "Language", "continuous", P1K, "Control & restraint",
  "Words about control, restraint, permission and force per 1,000 words.", AG_NOTE)
v("agency_dominance_per_1k", G, "Language", "continuous", P1K, "Dominance language",
  "Words associated with commanding and domination per 1,000 words.", AG_NOTE)
v("agency_submission_per_1k", G, "Language", "continuous", P1K, "Submission language",
  "Words associated with obeying, kneeling and begging per 1,000 words.", AG_NOTE)
v("agency_commands_per_1k", G, "Language", "continuous", P1K, "Spoken commands",
  "Quoted passages containing a command, i.e. a sentence that starts with a command verb, possibly after "
  "'please', 'now' or a name ('Come here.', 'Kneel.', 'Sarah, don't stop.'), per 1,000 words.",
  "Heuristic: question sentences, 'Do you…', 'Look, …' / 'Listen, …' as fillers and 'fuck' as an expletive "
  "are left out; commands whose verb is not on the list (lexicons/imperative_verbs.txt) are missed.")
v("agency_command_share_of_speech", G, "Language", "share", SHARE, "Commands among speech",
  "Share of quoted passages that contain a command (see agency_commands_per_1k).")

# ------------------------------------------------------------------ pacing
G = "Pacing"
PACE_NOTE = "Story split into 5 equal parts by word count; needs at least 1,000 words."
for key, label, unit in (("sex", "sexual language", P1K), ("emotion", "emotional language", P1K),
                         ("dialogue", "dialogue", SHARE), ("action", "action verbs", P1K),
                         ("descriptive", "descriptive & sensory language", P1K)):
    ui = "Sexual content" if key == "sex" else "Story"
    v(f"pace_{key}_early", G, ui, "continuous", unit, f"{label.capitalize()} in the first fifth",
      f"Density of {label} in the first fifth of the story.", PACE_NOTE)
    v(f"pace_{key}_late", G, ui, "continuous", unit, f"{label.capitalize()} in the last fifth",
      f"Density of {label} in the last fifth of the story.", PACE_NOTE)
    v(f"pace_{key}_shift", G, ui, "continuous", unit, f"Build-up of {label}",
      f"Last fifth minus first fifth: positive means {label} increases towards the end.", PACE_NOTE)
    v(f"pace_{key}_peak_position", G, ui, "share", "position (0.1 … 0.9)", f"Where {label} peaks",
      f"Middle of the fifth with the most {label} (0.1 = start, 0.9 = end).", PACE_NOTE)

# ------------------------------------------------------------------ quality control
G = "Quality control"
v("has_text", G, "Quality", "binary", "yes/no", "Text collected", "Whether story text was collected.", explorer=False)
v("text_truncated", G, "Quality", "binary", "yes/no", "Text truncated",
  "Whether the story had more pages than were collected (page cap or missing pages).", explorer=False)
v("qc_text_too_short", G, "Quality", "binary", "yes/no", "Text too short",
  "True when the text is shorter than the minimum for text measures (default 100 words).", explorer=False)
v("qc_english_function_word_share", G, "Quality", "share", SHARE, "English function-word share",
  "Share of words that are common English function words; very low values suggest non-English text.",
  explorer=False)
v("qc_quote_style", G, "Quality", "categorical", "double / single / none", "Quotation style",
  "Which quotation marks were treated as dialogue.", explorer=False)
v("qc_dialogue_quotes_unbalanced", G, "Quality", "binary", "yes/no", "Unbalanced quotes",
  "More than half of the paragraphs with quotes have unmatched straight quotes, so dialogue measures are less "
  "reliable.", explorer=False)
v("qc_flags", G, "Quality", "list", "", "Quality flags",
  "List of data-quality flags for the story (see Methodology, 'Quality flags').", explorer=False)
v("analysis_include", G, "Quality", "binary", "yes/no", "Included in analysis",
  "True when the story has text (≥ minimum words), a category, a publication date and a view count, is not a "
  "duplicate and looks like English.", explorer=False)
v("exclusion_reasons", G, "Quality", "list", "", "Exclusion reasons",
  "Why analysis_include is false (empty when included).", explorer=False)
v("tags", G, "Identifiers", "list", "", "Tags", "Tags the author attached (lower-case).",
  "In the Stage 2 handoff only tags used by at least 20 stories are kept (rare tags can contain names).",
  explorer=False)

# Measures that need the WHOLE story text. analyze.py blanks them when the collected text is incomplete.
NEEDS_FULL_TEXT = ("story_words", "story_chars", "story_sentences", "story_paragraphs", "story_scene_breaks",
                   "story_has_author_note", "story_requests_feedback", "dlg_segments", "sex_terms",
                   "sex_first_mention_position", "sex_words_before_first", "sex_distinct_terms", "hedge_count",
                   "sense_touch_count", "sense_sight_count", "sense_sound_count", "sense_smell_count",
                   "sense_taste_count", "sense_body_count", "lex_unique_words", "lex_ttr", "char_recurring_names")
_FULL_NOTE = "Blank when the collected text is incomplete (text_truncated)."
_HANDOFF_ROUNDED = ("pop_views", "pop_favorites", "pop_comments", "pop_reading_lists", "pop_rating_count")
# Stage 1B split-half reliability below 0.6 (odd vs even paragraphs of stories with 1,000+ words, correlated across
# stories, Spearman-Brown corrected; docs/stage1b/VALIDATION_REPORT.md).
LOW_RELIABILITY = {"emo_jealousy_per_1k": 0.40, "hedge_uncertainty_per_1k": 0.40, "hedge_certainty_balance": 0.43,
                   "agency_command_share_of_speech": 0.47, "emo_anger_per_1k": 0.55, "agency_volition_per_1k": 0.56,
                   "psy_distancing_per_1k": 0.58, "emo_anxiety_per_1k": 0.58}
# Stage 1B length check: measures that depend on story length for a mechanical reason.
LENGTH_NOTES = {
    "rep_repeated_5gram_per_1k": "Rises with story length (a longer text has more chances to repeat a phrase); "
                                 "compare stories of similar length.",
    "sex_first_mention_position": "Earlier in longer stories (a longer text has more chances of an early passing "
                                  "mention); compare stories of similar length.",
    "char_name_mentions_per_1k": "Lower in short stories, where fewer names reach the three mentions needed to "
                                 "count.",
}
for _i, _x in enumerate(REG):
    _extra = []
    if _x.name in NEEDS_FULL_TEXT or _x.name.startswith("pace_"):
        _extra.append(_FULL_NOTE + (" Use site_words_count for length then." if _x.name == "story_words" else ""))
    if _x.name in _HANDOFF_ROUNDED:
        _extra.append("Rounded to 3 significant figures in the Stage 2 handoff.")
    if _x.name in LOW_RELIABILITY:
        _extra.append(f"Low split-half reliability ({LOW_RELIABILITY[_x.name]:.2f}): a single story's value is "
                      "noisy (few hits per story), so compare groups of stories rather than single stories.")
    if _x.name in LENGTH_NOTES:
        _extra.append(LENGTH_NOTES[_x.name])
    if _extra:
        REG[_i] = replace(_x, caveat=" ".join(([_x.caveat] if _x.caveat else []) + _extra))


BY_NAME = {x.name: x for x in REG}
ORDER = [x.name for x in REG]


def dictionary_records() -> list[dict]:
    return [asdict(x) for x in REG]


def write_dictionary_json(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"variables": dictionary_records()}, indent=2, ensure_ascii=False), encoding="utf-8")


def dictionary_markdown() -> str:
    lines = ["# Data dictionary", "",
             "Generated from `litcorr/schema.py` by `python -m litcorr dictionary`. One row per column of "
             "`data/processed/stories_features.parquet`. *Explorer* marks the variables that make sense as "
             "story characteristics on the website.", ""]
    groups: dict[str, list[Var]] = {}
    for x in REG:
        groups.setdefault(x.group, []).append(x)
    for g, items in groups.items():
        lines += [f"## {g}", "", "| Column | Label | Unit | Meaning | Caveat | Explorer |", "|---|---|---|---|---|---|"]
        for x in items:
            lines.append(f"| `{x.name}` | {x.label} | {x.unit} | {x.description} | {x.caveat} | "
                         f"{'✓' if x.explorer else ''} |")
        lines.append("")
    return "\n".join(lines)


def group_table(group: str) -> str:
    items = [x for x in REG if x.group == group]
    rows = ["| Variable | What it measures | Caveat |", "|---|---|---|"]
    rows += [f"| **{x.label}** (`{x.name}`) | {x.description} | {x.caveat} |" for x in items]
    return "\n".join(rows)
