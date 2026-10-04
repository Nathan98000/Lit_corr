"""Developer tools for validating the text pipeline (not part of the pipeline itself).

Every tool here is offline and writes only to ``data/dev/`` (or prints to the console). None of them prints
story text, titles, descriptions, author names, URLs or slugs, except ``inspect_text --reveal-sentence``, which
prints exactly one sentence (capped) with a warning, for confirming a specific suspected bug.

  python -m litcorr.dev.inspect_text STORY_KEY [--paras 0:40] [--overlay] [--lex] [--reveal-sentence N]
  python -m litcorr.dev.char_inventory [--out data/dev/char_inventory]
  python -m litcorr.dev.measure_profile save NAME   |   diff OLD NEW
  python -m litcorr.dev.review_sample NAME [--n-per-category 2] [--exclude-sample OTHER] [--only-new-since F]
"""
