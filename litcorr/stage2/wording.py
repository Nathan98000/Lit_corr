"""Plain-English wording for the website: popularity measures, the "stories included" filter, and phrases
for every story characteristic. The site builds chart titles from these pieces, e.g.

    neutral:  "How favorites per 1,000 views vary with story length in Romance"
    pattern:  "In Romance, longer stories tend to get more favorites per 1,000 views"

Only descriptive verbs are used ("tend to", "vary with"); never "cause", "drive" or "make readers".
"""

from __future__ import annotations

# ----------------------------------------------------------------------------------------------- measures
# Popularity measures offered on the site. ``age`` marks totals that grow with time online.
METRICS = [
    {"id": "pop_fav_per_1k_views", "label": "Favorites per 1,000 views", "group": "Per 1,000 views",
     "noun": "favorites per 1,000 views", "plural": True, "more": "get more favorites per 1,000 views",
     "less": "get fewer favorites per 1,000 views", "format": "rate", "age": False,
     "help": "How often readers who opened the story added it to their favorites. Dividing by views makes "
             "stories that have been read a lot comparable with stories that have been read a little."},
    {"id": "pop_comments_per_1k_views", "label": "Comments per 1,000 views", "group": "Per 1,000 views",
     "noun": "comments per 1,000 views", "plural": True, "more": "get more comments per 1,000 views",
     "less": "get fewer comments per 1,000 views", "format": "rate", "age": False,
     "help": "Public comments left on the story, per 1,000 views."},
    {"id": "pop_ratings_per_1k_views", "label": "Ratings per 1,000 views", "group": "Per 1,000 views",
     "noun": "ratings per 1,000 views", "plural": True, "more": "get more ratings per 1,000 views",
     "less": "get fewer ratings per 1,000 views", "format": "rate", "age": False,
     "help": "How many readers gave the story a star rating, per 1,000 views."},
    {"id": "pop_reading_lists_per_1k_views", "label": "Reading-list adds per 1,000 views",
     "group": "Per 1,000 views", "noun": "reading-list adds per 1,000 views", "plural": True,
     "more": "are added to more reading lists per 1,000 views",
     "less": "are added to fewer reading lists per 1,000 views", "format": "rate", "age": False,
     "help": "How often readers saved the story to one of their reading lists, per 1,000 views."},
    {"id": "pop_views_per_month", "label": "Views per month", "group": "Per month online",
     "noun": "views per month", "plural": True, "more": "receive more views per month",
     "less": "receive fewer views per month", "format": "count", "age": False,
     "help": "Total views divided by the number of months the story has been online. A simple way to "
             "compare old and new stories, since older stories have had longer to collect views."},
    {"id": "pop_views", "label": "Views", "group": "Totals so far", "noun": "views", "plural": True,
     "more": "receive more views", "less": "receive fewer views", "format": "count", "age": True,
     "help": "Total views shown on the story page when it was collected."},
    {"id": "pop_favorites", "label": "Favorites", "group": "Totals so far", "noun": "favorites",
     "plural": True, "more": "collect more favorites", "less": "collect fewer favorites", "format": "count",
     "age": True, "help": "Total number of readers who added the story to their favorites."},
    {"id": "pop_comments", "label": "Comments", "group": "Totals so far", "noun": "comments", "plural": True,
     "more": "receive more comments", "less": "receive fewer comments", "format": "count", "age": True,
     "help": "Total number of public comments."},
    {"id": "pop_rating_count", "label": "Ratings (number of)", "group": "Totals so far",
     "noun": "ratings", "plural": True, "more": "receive more ratings", "less": "receive fewer ratings",
     "format": "count", "age": True, "help": "How many readers gave the story a star rating."},
    {"id": "pop_rating", "label": "Average rating", "group": "Rating", "noun": "average rating",
     "plural": False, "more": "have higher average ratings", "less": "have lower average ratings",
     "format": "rating", "age": False,
     "help": "The average star rating (1 to 5) shown on the story page. Most stories score between 4 and "
             "5, so small differences can matter."},
]
# The order of the measure menu's groups (Rating first) and the measure a chart opens with. METRICS keeps its own
# order: the aggregate files hold the measures by their position in it.
METRIC_GROUPS = ["Rating", "Per 1,000 views", "Per month online", "Totals so far"]
DEFAULT_METRIC = "pop_rating"
MIN_METRIC_COVERAGE = 0.9  # a measure is offered only if at least this share of stories has it

# ------------------------------------------------------------------------------------------ stories included
# One lightweight filter: which stories the charts describe. (id, label, group, column, low, high); low is
# inclusive, high exclusive; None means open-ended.
SUBSETS = [
    ("all", "All stories", "", None, None, None),
    ("y2000", "Published 2000–2009", "Published", "pub_year", None, 2010),
    ("y2010", "Published 2010–2019", "Published", "pub_year", 2010, 2020),
    ("y2020", "Published 2020 or later", "Published", "pub_year", 2020, None),
    ("short", "Under 2,000 words", "Length", "story_words", None, 2000),
    ("medium", "2,000–5,000 words", "Length", "story_words", 2000, 5000),
    ("long", "5,000 words or more", "Length", "story_words", 5000, None),
    ("views10k", "At least 10,000 views", "Readership", "pop_views", 10000, None),
    ("ratings25", "At least 25 ratings", "Readership", "pop_rating_count", 25, None),
]

# ------------------------------------------------------------------------------------- characteristic topics
# The data dictionary's ui_group values that the site shows (anything else is left out).
GROUPS = ["Story", "Narration", "Language", "Sexual content", "Style", "Publication"]
# Eight plain topics for browsing, in the order the site shows them: (id, label, one-line blurb, the data
# dictionary's (ui_group, group) pairs that belong to it). Within a topic, characteristics follow the order of
# these pairs (a sub-group that appears under two ui_groups is merged), then the dictionary's order.
TOPICS = [
    ("length", "Length & structure", "Word count, paragraphs, series, titles",
     [("Story", "Story basics"), ("Style", "Story basics"), ("Story", "Site metadata"),
      ("Story", "Title & description"), ("Story", "Series"), ("Story", "Openings & endings")]),
    ("narration", "Narration", "First or third person, tense, talking to the reader",
     [("Narration", "Narration")]),
    ("dialogue", "Dialogue & characters", "How much speech, names, he/she",
     [("Narration", "Dialogue"), ("Narration", "Characters"), ("Narration", "Gendered language")]),
    ("sex", "Sexual content", "How much, how early, how varied",
     [("Sexual content", "Sexual content"), ("Sexual content", "Pacing")]),
    ("emotion", "Emotion & relationships", "Tone, affection, consent, control",
     [("Language", "Emotion"), ("Language", "Intimacy & relationships"), ("Language", "Agency & control")]),
    ("pacing", "Pacing & setting", "What builds up, what peaks where, where it happens",
     [("Story", "Pacing"), ("Story", "Settings")]),
    ("style", "Word choice & style", "Vocabulary, readability, punctuation",
     [("Story", "Vocabulary"), ("Story", "Readability & sentence complexity"),
      ("Style", "Readability & sentence complexity"), ("Language", "Repetition"),
      ("Language", "Hedging & certainty"), ("Language", "Distancing & immediacy"), ("Language", "Sensory language"),
      ("Style", "Style"), ("Style", "Punctuation"), ("Style", "Questions & exclamations"),
      ("Style", "Writing mechanics")]),
    ("published", "When published", "Year, month, weekday, years online", [("Publication", "Publication")]),
]
TOPIC_OF = {pair: (i, j, tid) for i, (tid, _, _, pairs) in enumerate(TOPICS) for j, pair in enumerate(pairs)}
# Characteristics that open their topic's list (the general ones before the detailed counts).
TOPIC_LEAD = ["pov_class", "pov_is_first_person", "narr_tense_class", "narr_is_present_tense",
              "narr_present_tense_share", "reader_address_per_1k", "pov_first_person_share"]
SUBGROUP_LABEL = {"Sexual content": "Amount & variety"}  # sub-heading names on the site, where they differ
# A short list to start from (shown first in the picker). Not chosen by any result.
POPULAR = ["story_words", "pov_is_first_person", "narr_is_present_tense", "dlg_word_share", "sex_terms_per_1k",
           "sex_words_before_first", "emo_balance", "series_is_part", "story_has_author_note",
           "read_flesch_reading_ease", "reader_address_per_1k", "pub_year"]
# Extra words the picker's search matches (people search for "POV", "explicit", "typos" ...), per topic and
# per characteristic id or id prefix. They are search-only text, never shown, so they keep the spellings people type
# ("humour") and are left out of us_english() and of the US-spelling checks.
TOPIC_SYNONYMS = {
    "length": "long short size words pages",
    "narration": "pov point of view person narrator tense voice",
    "dialogue": "dialog speech talking conversation quotes characters names pronouns gender",
    "sex": "explicit sex sexual smut erotic steamy spicy heat",
    "emotion": "feelings mood sentiment love romance relationship consent",
    "pacing": "pace build-up structure setting location place",
    "style": "writing style vocabulary readability grammar punctuation",
    "published": "date time when age old new",
}
SYNONYMS = {
    "story_words": "length long short size",
    "pov_": "pov point of view person narrator 1st person first person",
    "narr_": "tense present past",
    "reader_address_per_1k": "second person addressing the reader",
    "dlg_": "dialog speech talking conversation",
    "sex_": "explicit",
    "style_profanity_per_1k": "swearing cursing swear words curse words bad language",
    "mech_errors_per_1k": "typos spelling mistakes errors grammar",
    "lex_unrecognized_word_share": "typos spelling",
    "read_": "readability difficulty easy hard",
    "series_": "chapters parts sequel",
    "age_years": "old new age",
    "author_stories_count": "prolific writer author",
    "emo_": "feelings mood sentiment",
    "rel_romance_per_1k": "love",
    "humor_per_1k": "humour",
    "rel_intimacy_per_1k": "kiss kissing",  # not Affection & love: its list leaves physical affection to intimacy
    "sex_action_per_1k": "orgasm climax",
}
EXCLUDED = {"age_days"}  # same information as age_years

# Ordered levels for categorical characteristics (values not listed, e.g. "unknown", are left out).
LEVELS = {
    "pov_class": [("first", "First person (I)"), ("first_plural", "First person plural (we)"),
                  ("second", "Second person (you)"), ("third", "Third person"), ("mixed", "Mixed")],
    "narr_tense_class": [("past", "Past tense"), ("present", "Present tense"), ("mixed", "Mixed")],
    "gender_composition": [("mostly_feminine", "Mostly she/her"), ("mixed", "Both he and she"),
                           ("mostly_masculine", "Mostly he/him"), ("few_gendered_pronouns", "Few he/she")],
    "desc_pov": [("first", "First person"), ("second", "Second person"), ("third", "Third person"),
                 ("none", "No clear person")],
    "pub_weekday": [(0, "Mon"), (1, "Tue"), (2, "Wed"), (3, "Thu"), (4, "Fri"), (5, "Sat"), (6, "Sun")],
    "pub_month": [(m, n) for m, n in zip(range(1, 13), "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())],
}
# Discrete values that are ordered (a pattern can be read from them).
ORDINAL_LEVELS = {
    "author_stories_count": [(1, "1 story"), (2, "2–5"), (6, "6–20"), (21, "21–50"), (51, "51–100"),
                             (101, "101–200"), (201, "201+")],
}
for _part in ("sex", "emotion", "dialogue", "action", "descriptive"):
    ORDINAL_LEVELS[f"pace_{_part}_peak_position"] = [(0.1, "1st fifth"), (0.3, "2nd fifth"), (0.5, "Middle"),
                                                      (0.7, "4th fifth"), (0.9, "Last fifth")]

# Binary characteristics: (yes label, no label, yes subject, no subject). Subjects complete
# "<yes subject> tend to get more ... than <no subject>".
BINARY = {
    "pub_is_weekend": ("Weekend", "Weekday", "Stories published on the weekend", "stories published on weekdays"),
    "story_has_author_note": ("Author's note", "No author's note", "Stories with an author's note",
                              "stories without one"),
    "title_has_chapter_marker": ("Chapter or part in title", "No marker", "Stories whose title marks a chapter "
                                 "or part", "other stories"),
    "title_sexual": ("Explicit title", "Non-explicit title", "Stories with explicit titles",
                     "stories with non-explicit titles"),
    "desc_sexual": ("Explicit description", "Non-explicit description", "Stories with explicit descriptions",
                    "stories with non-explicit descriptions"),
    "series_is_part": ("Part of a series", "Stand-alone", "Stories in a series", "stand-alone stories"),
    "series_is_later_part": ("Later part of a series", "First part or stand-alone", "Later parts of a series",
                             "first parts or stand-alone stories"),
    "open_dialogue": ("Opens with speech", "Opens with narration", "Stories that open with speech",
                      "stories that open with narration"),
    "end_dialogue": ("Ends with speech", "Ends with narration", "Stories that end with speech",
                     "stories that end with narration"),
    "end_to_be_continued": ("Announces more to come", "No announcement", "Stories that announce a continuation",
                            "other stories"),
    "pov_is_first_person": ("First person", "Third person", "First-person stories", "third-person stories"),
    "narr_is_present_tense": ("Present tense", "Past tense", "Present-tense stories", "past-tense stories"),
    "dlg_has_dialogue": ("Has dialogue", "No dialogue", "Stories with dialogue", "stories without dialogue"),
}

# Nouns (for neutral titles) and subjects for stories with HIGH values (for pattern titles). Characteristics
# not listed use the label: noun = label with a lower-case first letter, subject = "Stories with more <noun>".
NOUN = {
    "pub_year": "publication year", "pub_month": "publication month", "pub_weekday": "publication weekday",
    "age_years": "story age", "story_pages": "the number of pages", "meta_tag_count": "the number of tags",
    "author_stories_count": "the author's number of stories", "story_words": "story length",
    "story_sentences": "the number of sentences", "story_paragraphs": "the number of paragraphs",
    "story_one_sentence_paragraph_share": "one-sentence paragraphs",
    "story_long_paragraph_share": "very long paragraphs",
    "title_chars": "title length", "title_words": "title word count", "desc_chars": "description length",
    "desc_words": "description word count", "desc_pov": "the person used in the description",
    "series_part_number": "part number in a series", "pov_class": "narrative perspective",
    "narr_tense_class": "narration tense", "gender_composition": "pronoun composition",
    "pov_first_plural_per_1k": "the use of ‘we / us / our’", "pov_second_per_1k": "the use of ‘you / your’",
    "pov_first_singular_narr_per_1k": "the use of ‘I / me / my’ in the narration",
    "pov_first_plural_narr_per_1k": "the use of ‘we / us / our’ in the narration",
    "pov_second_narr_per_1k": "the use of ‘you / your’ in the narration",
    "pov_third_narr_per_1k": "the use of ‘he / she / they’ in the narration",
    "gender_masculine_per_1k": "the use of ‘he / him / his’", "gender_feminine_per_1k": "the use of ‘she / her / hers’",
    "gender_neutral_plural_per_1k": "the use of ‘they / them / their’",
    "read_flesch_reading_ease": "reading ease", "read_grade_composite": "reading difficulty",
    "lex_mean_word_zipf": "everyday vocabulary", "lex_ttr": "word variety (type–token ratio)",
    "lex_mattr": "vocabulary variety",
    "emo_balance": "emotional tone", "hedge_certainty_balance": "the balance of certainty and hedging",
    "style_all_caps_words_per_1k": "ALL-CAPS words", "style_elongated_per_1k": "stretched words (like ‘sooo’)",
    "char_recurring_names": "the number of recurring names", "char_top_name_share": "focus on one main name",
    "reader_address_per_1k": "how often the narration talks to the reader",
    "dlg_question_share": "questions in dialogue",
    "dlg_paragraph_share": "the share of dialogue paragraphs",
    "dlg_alternation_index": "how often dialogue and narration alternate",
    "psy_filter_words_per_1k": "‘filter’ words", "style_said_share": "plain ‘said’ in dialogue tags",
    "rep_top10_content_share": "reliance on a few words",
    "rep_adjacent_sentence_overlap": "overlap between neighboring sentences",
    "agency_volition_per_1k": "words for deciding and trying",
    "rel_romance_per_1k": "romance language", "rel_familiarity_per_1k": "familiarity language",
    "sex_other_per_1k": "general sexual words",
    "sex_words_before_first": "words before the first explicit term",
    "emo_overall_per_1k": "emotional words", "sense_total_per_1k": "sensory language",
    "humor_per_1k": "humor and laughter",
    "sex_sentence_share": "the share of sentences with sexual language",
    "agency_command_share_of_speech": "the share of speech that is commands",
    "sex_distinct_terms": "the variety of sexual vocabulary",
    "narr_present_tense_share": "the present-tense share of the narration",
    "pov_first_person_share": "the first-person share of pronouns",
    "gender_feminine_share": "the feminine share of he/she pronouns",
}
MORE = {
    "pub_year": "Newer stories", "age_years": "Older stories", "story_pages": "Stories spread over more pages",
    "meta_tag_count": "Stories with more tags", "story_sentences": "Stories with more sentences",
    "story_paragraphs": "Stories with more paragraphs",
    "pov_first_plural_per_1k": "Stories that use ‘we / us / our’ more",
    "pov_second_per_1k": "Stories that use ‘you / your’ more",
    "pov_first_singular_narr_per_1k": "Stories whose narration uses ‘I / me / my’ more",
    "pov_first_plural_narr_per_1k": "Stories whose narration uses ‘we / us / our’ more",
    "pov_second_narr_per_1k": "Stories whose narration uses ‘you / your’ more",
    "pov_third_narr_per_1k": "Stories whose narration uses ‘he / she / they’ more",
    "gender_masculine_per_1k": "Stories that use ‘he / him / his’ more",
    "gender_feminine_per_1k": "Stories that use ‘she / her / hers’ more",
    "gender_neutral_plural_per_1k": "Stories that use ‘they / them / their’ more",
    "psy_filter_words_per_1k": "Stories with more ‘filter’ words",
    "agency_volition_per_1k": "Stories with more words for deciding and trying",
    "rel_romance_per_1k": "Stories with more romance language",
    "rel_familiarity_per_1k": "Stories with more familiarity language",
    "sex_other_per_1k": "Stories with more general sexual words",
    "emo_overall_per_1k": "Stories with more emotional words",
    "sense_total_per_1k": "Stories with more sensory language",
    "emo_affection_per_1k": "Stories with more affection and love",
    "emo_anxiety_per_1k": "Stories with more anxiety and fear",
    "emo_arousal_per_1k": "Stories with more excitement and arousal",
    "emo_shame_per_1k": "Stories with more shame and embarrassment",
    "emo_jealousy_per_1k": "Stories with more jealousy and envy",
    "humor_per_1k": "Stories with more humor and laughter",
    "author_stories_count": "Stories by more prolific authors", "story_words": "Longer stories",
    "story_mean_sentence_words": "Stories with longer sentences",
    "story_median_sentence_words": "Stories with longer typical sentences",
    "story_mean_paragraph_words": "Stories with longer paragraphs",
    "story_median_paragraph_words": "Stories with longer typical paragraphs",
    "story_long_paragraph_share": "Stories with more ‘walls of text’",
    "title_chars": "Stories with longer titles", "title_words": "Stories with wordier titles",
    "desc_chars": "Stories with longer descriptions", "desc_words": "Stories with wordier descriptions",
    "series_part_number": "Later parts of a series",
    "pov_first_person_share": "Stories with a larger first-person share of pronouns",
    "narr_present_tense_share": "Stories told more in the present tense",
    "reader_address_per_1k": "Stories that talk to the reader more",
    "dlg_word_share": "Stories with more dialogue", "dlg_mean_segment_words": "Stories with longer speeches",
    "dlg_question_share": "Stories with more questions in their dialogue",
    "dlg_exclamation_share": "Stories with more exclamations in their dialogue",
    "dlg_paragraph_share": "Stories with more paragraphs of dialogue",
    "dlg_alternation_index": "Stories that switch more between dialogue and narration",
    "char_recurring_names": "Stories with more recurring named characters",
    "char_name_mentions_per_1k": "Stories that mention names more often",
    "char_top_name_share": "Stories focused more on one main name",
    "gender_feminine_share": "Stories with a larger share of she/her among he/she pronouns",
    "qe_question_sentence_share": "Stories with a larger share of questions",
    "qe_exclamation_sentence_share": "Stories with a larger share of exclamations",
    "read_mean_word_chars": "Stories with longer words",
    "read_mean_syllables_per_word": "Stories with more syllables per word",
    "read_flesch_reading_ease": "Easier-to-read stories", "read_grade_composite": "Harder-to-read stories",
    "syn_subordinators_per_sentence": "Stories with more complex sentences",
    "syn_sentence_length_sd": "Stories with more varied sentence lengths",
    "lex_unique_words": "Stories with more unique words", "lex_ttr": "Stories with a higher type–token ratio (more varied words)",
    "lex_mattr": "Stories with more varied vocabulary", "lex_mean_word_zipf": "Stories with more everyday words",
    "rep_top10_content_share": "Stories that lean more on a few favorite words",
    "rep_adjacent_sentence_overlap": "Stories whose neighboring sentences overlap more",
    "rep_same_start_share": "Stories with more sentences that start the same way",
    "style_said_share": "Stories that use plain ‘said’ more in speech tags",
    "emo_balance": "Stories with a more positive emotional tone",
    "hedge_certainty_balance": "Stories that lean more toward certainty than hedging",
    "agency_command_share_of_speech": "Stories in which more of the speech is commands",
    "sex_sentence_share": "Stories in which more sentences contain sexual language",
    "sex_words_before_first": "Stories that take longer to reach explicit language",
    "sex_distinct_terms": "Stories with more varied sexual vocabulary",
    "sex_scenes_per_10k": "Stories with more sex scenes for their length",
    "sex_first_scene_position": "Stories whose first sex scene starts later",
    "story_one_sentence_paragraph_share": "Stories with more one-sentence paragraphs",
    "syn_long_sentence_share": "Stories with more long sentences",
    "syn_short_sentence_share": "Stories with more short sentences",
    "agency_passive_sentence_share": "Stories with more passive sentences",
    "lex_rare_word_share": "Stories with more rare words", "lex_long_word_share": "Stories with more long words",
    "lex_unrecognized_word_share": "Stories with more unrecognized words",
    "read_polysyllable_share": "Stories with more long (3+ syllable) words",
    "rep_bigram_repeat_share": "Stories with more repeated word pairs",
    "rep_trigram_repeat_share": "Stories with more repeated three-word phrases",
    "dlg_bare_line_share": "Stories with more untagged speech lines",
    "dlg_adverb_tag_share": "Stories with more adverbs in speech tags",
}
# What each pacing measure follows, and whether the noun is plural ("action verbs peak", "dialogue peaks").
_PACE_NOUNS = {"sex": ("sexual language", False), "emotion": ("emotional language", False),
               "dialogue": ("dialogue", False), "action": ("action verbs", True),
               "descriptive": ("descriptive and sensory language", False)}
for _part, (_noun, _plural) in _PACE_NOUNS.items():
    _peaks, _builds = ("peak", "build") if _plural else ("peaks", "builds")
    NOUN[f"pace_{_part}_early"] = f"{_noun} in the first fifth"
    NOUN[f"pace_{_part}_late"] = f"{_noun} in the last fifth"
    NOUN[f"pace_{_part}_shift"] = f"the build-up of {_noun}"
    NOUN[f"pace_{_part}_peak_position"] = f"where {_noun} {_peaks}"
    MORE[f"pace_{_part}_early"] = f"Stories with more {_noun} early on"
    MORE[f"pace_{_part}_late"] = f"Stories with more {_noun} near the end"
    MORE[f"pace_{_part}_shift"] = f"Stories in which {_noun} {_builds} up more"
    MORE[f"pace_{_part}_peak_position"] = f"Stories in which {_noun} {_peaks} later"

FEATURED = [  # example questions under the chart: (question, settings). Each opens the measure it names; none
    # was chosen for its result.
    ("Do readers favorite first-person stories more often?", {"var": "pov_is_first_person",
                                                               "metric": "pop_fav_per_1k_views"}),
    ("Do longer Romance stories get more views per month?", {"var": "story_words", "metric": "pop_views_per_month",
                                                              "genre": "adult-romance"}),
    ("Do stories with more dialogue get more comments per 1,000 views?", {"var": "dlg_word_share",
                                                                          "metric": "pop_comments_per_1k_views"}),
    ("Is more sexual language linked to more favorites per 1,000 views?", {"var": "sex_terms_per_1k",
                                                                           "metric": "pop_fav_per_1k_views"}),
    ("Do older stories have more views?", {"var": "age_years", "metric": "pop_views"}),
    ("Does present-tense narration look the same in every genre?", {"var": "narr_is_present_tense",
                                                                    "metric": "pop_fav_per_1k_views",
                                                                    "mode": "compare"}),
]


# Labels shown on the site where the data dictionary's label is unclear, clashes with a genre name ("Romance")
# or reads badly. Everything else uses the dictionary's label (in US spelling, with typographic quotes).
SITE_LABEL = {
    "pace_action_peak_position": "Where action verbs peak",
    "rel_romance_per_1k": "Romance language",
    "lex_ttr": "Word variety (type–token ratio)",
    "sex_other_per_1k": "General sexual words",
    "char_top_name_share": "Focus on one main name",
}

# The site is written in US English; the data dictionary partly uses UK spelling.
US_SPELLING = {
    "humour": "humor", "neighbouring": "neighboring", "neighbour": "neighbor", "unrecognised": "unrecognized",
    "favourite": "favorite", "favourites": "favorites", "labelled": "labeled", "signalled": "signaled",
    "recognisable": "recognizable", "realise": "realize", "realised": "realized", "organisations": "organizations",
    "organisation": "organization", "capitalised": "capitalized", "italicised": "italicized",
    "summarise": "summarize", "summarised": "summarized", "colour": "color", "colours": "colors",
    "behaviour": "behavior", "centre": "center", "analyse": "analyze", "analysed": "analyzed", "grey": "gray",
    "modelling": "modeling", "travelling": "traveling", "practise": "practice", "towards": "toward",
    "emphasise": "emphasize", "recognise": "recognize", "recognised": "recognized", "characterise": "characterize",
}
UK_PHRASES = {"at the weekend": "on the weekend", "at weekends": "on weekends"}


def us_english(text: str) -> str:
    """US spelling and typographic quotes and apostrophes ('said' → ‘said’, author's → author’s)."""
    import re

    if not text:
        return text
    for uk, us in UK_PHRASES.items():
        text = text.replace(uk, us)

    def swap(m: re.Match) -> str:
        word = m.group(0)
        us = US_SPELLING.get(word.lower())
        if us is None:
            return word
        return us[:1].upper() + us[1:] if word[:1].isupper() else us

    text = re.sub(r"[A-Za-z]+", swap, text)
    text = re.sub(r"(?<=\w)'(?=\w)", "’", text)
    text = re.sub(r"(?<![\w’])'([^'\n]+?)'(?!\w)", r"‘\1’", text)
    return re.sub(r"(?<=s)'(?=[\s,.;:)]|$)", "’", text)  # plural possessive: narrators' → narrators’


def label_for(name: str, label: str) -> str:
    return us_english(SITE_LABEL.get(name, label))


def noun_for(name: str, label: str) -> str:
    """The characteristic as a noun phrase ("how do favorites vary with <noun>"). `label` is the site label."""
    if name in NOUN:
        return NOUN[name]
    label = label.replace(" & ", " and ")
    first = label.split(" ")[0]
    keep = first.isupper() or first in ("I",) or first.startswith(("'", "‘", "-"))
    return label if keep else label[:1].lower() + label[1:]


def more_for(name: str, label: str) -> str:
    return MORE.get(name) or f"Stories with more {noun_for(name, label)}"


# The data dictionary is written for analysts; the website shows the same text with internal column names,
# file paths and pipeline jargon removed or reworded.
_SITE_TEXT = [
    (r"\s*Blank when the collected text is incomplete \(text_truncated\)\.", ""),
    (r"\s*Use site_words_count for length then\.", ""),
    (r"\s*Counted on the collected pages; long stories beyond the page cap are flagged as truncated\.", ""),
    (r"In the Stage 2 handoff rounded down to bands \(1, 2, 6, 21, 51, 101, 201\+\)\.",
     "Shown in bands (1, 2–5, 6–20, 21–50, 51–100, 101–200, 201+) so that authors stay anonymous."),
    (r"Low split-half reliability \([0-9.]+\): a single story's value is noisy \(few hits per story\), so compare "
     r"groups of stories rather than single stories\.",
     "One story's value rests on only a few instances and is noisy; summaries of groups, as shown here, are "
     "steadier."),
    (r" in a Stage 1B hand-check", " in a hand check"),
    (r"\s*\(lexicons/[a-z_]+\.txt\)", ""),
    # every chart links to the right section of "How it works", so the pointer is not repeated in the text
    (r"\s*\(see Methodology, '[^']+'\)", ""),
    (r"\s*\(see Methodology\)", ""),
    (r"see Methodology", "see How it works"),
    (r"other paratext", "similar notes around the story"),
    (r"A word-counting heuristic, not true narrative analysis", "A word-counting rule, not a reading of the story"),
    (r"\bA heuristic\.", "A rule-based estimate."),
    (r"\bHeuristic\b", "A rule-based estimate"),
    (r"'first_plural'|\bfirst_plural\b", "first person plural"),
    (r"\bBlank\b", "Not measured"),
    (r"\s*\(lexicon\)", ""),
    (r"action verbs increases", "action verbs increase"),
]
SITE_DESCRIPTION = {  # plain-language versions where the dictionary text uses data codes or formulas
    "age_years": "How long the story had been online when its numbers were recorded, in years.",
    "pov_is_first_person": "Compares stories narrated in the first person (I, or we) with stories narrated in the "
                           "third person. Second-person and mixed stories are left out here; “Narrative "
                           "perspective” shows them all.",
    "narr_is_present_tense": "Compares stories narrated mostly in the present tense with stories narrated mostly in "
                             "the past tense. Mixed stories are left out here; “Narration tense” shows them all.",
    "narr_tense_class": "Present tense if at least 60% of the narration's verbs are in the present tense, past "
                        "tense if 40% or fewer, mixed in between.",
    "gender_composition": "Mostly she/her if at least 65% of the he/she pronouns are feminine, mostly he/him if "
                          "35% or fewer, and “few he/she” when there are fewer than 5 such pronouns per 1,000 words.",
    "pov_class": "Estimated from the pronouns in the narration, leaving dialogue out: plenty of I/me/my means first "
                 "person; ‘we’ narration and ‘you’ narration have their own groups; very few I/me/my compared with "
                 "he/she/they means third person; anything in between is mixed. Stories with under 200 words of "
                 "narration are left out.",
    "dlg_alternation_index": "How often the story switches between dialogue and narration paragraphs, compared "
                             "with a random order: below 1 means dialogue comes in blocks (scenes), above 1 means "
                             "dialogue and narration alternate.",
    "read_flesch_reading_ease": "How easy the text is to read: higher scores mean shorter sentences and shorter "
                                "words. Calculated with the Flesch Reading Ease formula (206.835 − 1.015 × words "
                                "per sentence − 84.6 × syllables per word).",
    "lex_mean_word_zipf": "How common the story's words are on average, on a scale where about 7 is as common as "
                          "‘the’ and 3 is rare (the Zipf scale of a standard English word-frequency list).",
    "lex_rare_word_share": "Share of words that are rare in English (fewer than about one in a million words).",
    "lex_ttr": "Different words divided by all words: how varied the vocabulary is (the type–token ratio).",
    "lex_mattr": "The share of different words in each 500-word stretch, averaged over the story, so that long and "
                 "short stories can be compared (a moving-average type–token ratio).",
}
for _part, (_noun, _) in _PACE_NOUNS.items():
    SITE_DESCRIPTION[f"pace_{_part}_peak_position"] = (
        f"Which fifth of the story has the most {_noun}, with the story cut into five equal parts by word count.")


def site_text(text: str, labels: dict[str, str]) -> str:
    """Dictionary text as shown on the website; any column name left is replaced by its label."""
    import re

    out = text or ""
    for pattern, repl in _SITE_TEXT:
        out = re.sub(pattern, repl, out)
    out = re.sub(r"\b[a-z]+(?:_[a-z0-9]+)+\b", lambda m: f"“{labels[m.group(0)]}”" if m.group(0) in labels
                 else m.group(0), out)
    return us_english(re.sub(r"\s{2,}", " ", out).strip())


def synonyms_for(name: str) -> str:
    """Extra search words for a characteristic: its own entry plus any matching id prefix (e.g. "dlg_")."""
    parts = [words for key, words in SYNONYMS.items() if name == key or (key.endswith("_") and name.startswith(key))]
    return " ".join(parts)
