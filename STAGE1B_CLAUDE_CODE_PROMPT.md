# Stage 1B: validate, harden and extend the text-analysis pipeline on the real (partial) corpus

You are working in the `Literotica_Correlations` project (Python package `litcorr`). Before changing anything, read `README.md`, `docs/methodology_template.md` (the source of `docs/METHODOLOGY.md`), `lexicons/README.md`, `litcorr/schema.py`, `litcorr/analyze.py`, `litcorr/build/` and everything in `litcorr/text/`.

## Where things stand

- **Stage 1A (collector)** is finished. I run it in daily sessions in another terminal, so it may be running while you work.
- **Stage 1B (text measures)** is already written. The code is in `litcorr/text/`, it produces about 195 measures registered in `litcorr/schema.py`, and `litcorr/analyze.py` computes them. So far it has only been tested on the synthetic demo site (`python -m litcorr demo`) and a narration check on public-domain novels (`scripts/validate_narration.py`). **It has never run on real Literotica text.**
- **Stage 2** (a static website) will be built later, using only the handoff zip.
- **Corpus as of 2026-10-04:**
  - 4,251 of the 9,000 sampled stories are collected: about 142 of 300 in each of 30 categories. Collection is round-robin, so the partial sample is balanced across categories.
  - 7,733 story pages are cached. 2,423 stories are one page long, and a few reach the 20-page cap.
  - `data/raw/` and `data/processed/` are empty, because `build-raw` and `analyze` have never run on real data.
- Collection will continue for about another week, so everything you build must re-run cheaply as stories arrive.

**Your job:**
1. Make Stage 1B trustworthy on real text.
2. Extend it with a vetted set of new measures.
3. Make re-runs incremental.

## Hard rules

1. **No network access to Literotica.**
   - Never run `probe`, `collect`, `process` (it also builds the handoff zip) or `export-handoff`.
   - Never run anything in `litcorr/net/` or `litcorr/collect/`.
   - Don't change the collection code, the sampling, or the `[scope]`/`[politeness]` sections of `config.toml`.
2. **`data/` is read-only to you**, with these exceptions: `data/raw/`, `data/processed/`, and new folders you create for derived or dev output (`data/derived/`, `data/dev/`).
   - Never modify, move or delete `data/state.sqlite3` or its `-wal`/`-shm` files, `data/cache/`, `data/logs/`, or the lock files (`data/.collector.lock`, `~/.litcorr/`).
3. **The first `build-raw` creates `data/.story_key_secret`.** Keep it. Never print it, copy it out of `data/`, or regenerate it, because story keys must stay stable across re-runs.
4. **The collector may be running.** Check whether the PID in `data/.collector.lock` is alive. Offline commands are designed to run safely alongside it; keep it that way.
5. **Story text never leaves `data/raw/`.** It must not appear in:
   - processed outputs or reports;
   - docs, tests or fixtures;
   - code comments, log messages or commit messages.

   The same applies to titles, descriptions, author names, URLs and slugs.
6. **Keep Stage 1B's founding principle:** measures must be transparent, deterministic, and based on rules or word lists, and must run offline.
   - No ML models, embeddings, or LLM calls on story text.
   - No downloads and no new dependencies without asking me first.
7. **No word list may contain words referring to age or youth** (see `lexicons/README.md`), and no measure may be about characters' ages.
8. **`python -m pytest -q` and `python -m litcorr demo` must pass** at every checkpoint.

## How you may look at story text

Everything you read is sent to Anthropic's API, so keep your exposure to story text to the minimum the work needs.

- **Default: aggregate statistics and a masked view** produced by a tool you build in Phase 1.
  - The masked view replaces every letter with `x`/`X` (keeping the case pattern) and every digit with `9`.
  - It keeps punctuation, quote characters, whitespace and line/paragraph breaks exactly as they are.
  - It may leave closed-class function words visible: `lexicons/stopwords.txt`, pronouns, auxiliaries and modals.
  - It may also leave inflectional endings visible (`xxxxed`, `xxxxing`, `xxxxs`) so you can check tense.
  - A lexicon match may appear as its lexicon name in brackets (e.g. `[sensory_touch]`) instead of the word.
  - Overlay the pipeline's own decisions: sentence boundaries, quote spans, scene breaks, paragraph numbers, and detected author notes or chapter headings.
- **Corpus-level frequency lists are fine.** Words or phrases with counts, not tied to any story, are needed for the lexicon audit.
- **Unmasked excerpts are allowed only to confirm a specific suspected bug.**
  - At most two sentences (about 50 words) at a time.
  - Never titles, descriptions, author names, URLs or slugs.
  - Never copy an excerpt into a file. For regression tests, write synthetic sentences from scratch that reproduce the pattern.
- **Never print whole stories**, and never dump the `text` column of `data/raw/stories.parquet`.
- **If an excerpt appears to involve a minor in sexual content:** stop reading it, don't reproduce it, and list its `story_key` in the report for me to review.

## Working setup

- Activate the environment: `source .venv/bin/activate`.
- Use git. The project is a git repo whose `origin` is the **public** GitHub repo `Nathan98000/Lit_corr`:
  - Work on a branch (e.g. `stage1b`), commit at the end of each phase, and don't push unless I ask.
  - `.gitignore` excludes `data/`, `data_demo/` and `config.toml` (it holds my contact address; `config.example.toml` is the tracked template). Keep it that way.
  - Before every commit, run `git status` and confirm nothing under `data/`, no `config.toml`, and no story text, titles, names, slugs or URLs of stories are staged. Everything committed becomes public.
- Keep three documents in `docs/stage1b/` (all aggregate-only):
  - `PLAN.md`: your plan.
  - `WORKLOG.md`: running findings and decisions.
  - `CHANGELOG.md`: every change to a measure's values.

## Phase 0: Baseline

1. Run the tests and the demo, and record the results.
2. Run `python -m litcorr build-raw`, `analyze` and `report` on the real data.
3. Record the runtime per step, peak memory, the number of CPU cores used, and anything odd in the logs or the quality report.
4. Save a baseline profile (see Phase 1) to `data/dev/profiles/baseline/` so you can diff later changes against it.

## Phase 1: Inspection tooling (dev-only; put it in `scripts/` or `litcorr/dev/`, not the pipeline)

- **`inspect_text`**: the masked view of one `story_key`.
  - Options to choose a paragraph range and to overlay pipeline decisions.
  - A `--reveal-sentence N` option that prints exactly one sentence unmasked, with a warning.
- **`char_inventory`**: corpus-wide counts of:
  - every non-ASCII character;
  - quote, apostrophe, dash and ellipsis variants;
  - leftover HTML tags and entities;
  - mojibake (e.g. `â€™`);
  - zero-width and non-breaking spaces.
- **`measure_profile`**: for every measure, overall and by category, report N, % missing, % zero, min/p1/median/p99/max and outlier `story_key`s. Make the output diffable between runs.
- **`review_sample`**: a reproducible stratified sample (fixed seed) for hand-checks. Include an option to draw only from stories that were not in an earlier sample, so the stories collected later can serve as a hold-out.

## Phase 2: Text extraction audit (cached HTML → paragraphs)

Make sure the text the measures see is the story and only the story. Check for:

- **Boilerplate leaking in:** page navigation, "Page X of Y", series links, copyright lines, rating or comment prompts, tag lists.
- **Author notes, dedications and disclaimers** at the start or end, plus chapter headings and "to be continued". Estimate how often detection misses or misfires.
- **Multi-page joins:** paragraphs duplicated or split at page boundaries.
- **Paragraphing:** stories that arrive as one giant paragraph (`<br>` vs `<p>`), or as one line per paragraph (hard-wrapped or poem-like text).
- **Encoding and character problems** found by `char_inventory`.
- **Word counts:** compare `story_words` with `site_words_count`. Look at the distribution of the ratio, investigate both tails, and explain the `site_word_count_mismatch` rate.

Fix problems in the parser or cleaner, with tests. Then re-profile and diff against the baseline.

## Phase 3: Measure audit (every family in `schema.py`)

Families to cover: narration/POV, tense, dialogue, punctuation and style, readability, vocabulary, repetition, every lexicon family, sexual content, pacing, characters, gendered language, and title/series metadata. For each family, run the checks below.

**a. Degeneracy.** Look for:
- measures that are all missing or nearly constant;
- extreme tails;
- impossible values (shares outside 0–1, negative counts, rates that are impossible given the word count).

**b. Known-groups checks.** Write your expectations in `WORKLOG.md` *before* you compute anything. Examples:
- `erotic-letters` and `adult-how-to` should be high on second person;
- `non-erotic-stories` and `reviews-and-essays` should be low on sexual terms;
- `reviews-and-essays` and `adult-how-to` should be low on dialogue.

Record pass or fail for each expectation, and explain every failure.

**c. Hand-check the rule-based classifiers** on a stratified sample using the masked view, with about 40–60 items per classifier:
- quote-style detection and dialogue spans;
- sentence splitting;
- scene breaks;
- author-note detection;
- POV class and tense class;
- passive voice and commands;
- character-name detection (aggregate lists of detected names are fine);
- chapter/series parsing (check through aggregate title patterns only).

Report accuracy with a 95% CI and the main error types.

**d. Lexicons.**
- For each lexicon, list its top ~40 matched entries by corpus frequency and each one's share of all hits.
- Look for false positives from words with other meanings (e.g. *hard, come, head, member, box, balls, wood*, and animal or everyday senses of slang terms).
- Find likely omissions: frequent words that co-occur with a lexicon's hits but aren't in it.
- When you edit a lexicon, explain the change on the file's `# notes:` line and report each lexicon's change in hit count.

**e. Split-half reliability.** For every per-1,000-word and share measure, compute it on odd paragraphs and on even paragraphs, and report the correlation across stories of 1,000+ words. A low-reliability measure gets a caveat in `schema.py`; don't delete it silently.

**f. Redundancy.** List measure pairs with |r| ≥ 0.9 and recommend which one to keep.

**g. Length dependence.** Correlate every measure with log(`story_words`). Some measures, such as TTR-type ones, are expected to depend on length. Flag the ones that do so unexpectedly.

**Do not use popularity to choose, tune or prune text measures.** Measures are defined by what they capture, not by what predicts popularity. Checking that the popularity fields parse correctly is fine.

## Phase 4: Fixes

- Every bug fix comes with a regression test that uses synthetic text.
- Every change to a measure's values gets a `CHANGELOG.md` entry: the measure, what changed, why, and the effect on its median, mean and missing rate.
- Add a `TEXT_PIPELINE_VERSION` constant. Record it, plus a hash of the `lexicons/` folder, in `collection_manifest.json`.
- **Don't overfit to this batch.** The ~4,750 stories still to come are a natural hold-out.
  - Keep a list in `WORKLOG.md` of every threshold or rule you tuned.
  - Make it possible to re-estimate the hand-check accuracies later on new stories only.

## Phase 5: New measures (propose first; implement only after I approve)

Write `docs/stage1b/NEW_MEASURES_PROPOSAL.md`. For each candidate, give:
- name and plain-English definition;
- how it is computed;
- the construct it captures;
- expected known-group behavior;
- evidence from a prototype on the real data that it isn't redundant with an existing measure (correlations);
- cost.

Aim for about 15–25 strong candidates; quality matters more than count. In the same file, propose any existing measures to retire or merge, but don't remove or rename anything yet, because Stage 2 depends on the column list. **Then stop and wait for my approval.**

Directions worth considering (add your own based on what the real data shows):
- **Openings and endings:** opens with dialogue, action or sex; sexual-term density in the first 500 words; ends on dialogue; a cliffhanger or "to be continued" ending; an epilogue.
- **Sex-scene structure:** the number of distinct sex-dense stretches (a windowed density above a threshold), the length of the build-up before the first one, and the share of the story inside such stretches.
- **Writing mechanics and polish (per 1,000 words):** lowercase "i" used as a pronoun, sentences that start in lowercase, missing spaces after punctuation, doubled words, its/it's and your/you're confusions.
- **Dialogue craft:** variety of speech tags, adverbial tags ("said softly"), the share of unattributed lines, and how often paragraphs switch between dialogue and narration.
- **Consent and check-in language** (asking permission, safewords), as a lexicon measure with a careful caveat.
- **Other markers:** humor or levity, types of setting or place, time jumps ("the next morning", "weeks later"), and direct address to the reader.
- **Title and description:** sexual terms, question-form titles, and the description's point of view.

Once I approve, implement each measure with:
- a `schema.py` entry (label, description, caveat, `ui_group`, `kind`, `explorer`);
- tests;
- a `CHANGELOG.md` entry;
- regenerated docs via `python -m litcorr docs`. Edit `docs/methodology_template.md`, never `METHODOLOGY.md`.

## Phase 6: Incremental re-runs and safe concurrency

- **Cache the per-story text measures**, e.g. in `data/derived/text_measures.parquet`.
  - Key the cache on `story_key`, a hash of the text, `TEXT_PIPELINE_VERSION`, the lexicon-folder hash, and the relevant `[analysis]` settings.
  - `analyze` should recompute only new or invalidated stories. Add a `--full` flag to force a complete rebuild.
  - Write a test proving that incremental output is identical to a full rebuild.
- **Make `build-raw` incremental too** if it is slow, by caching parsed pages by content hash.
- **Open the state DB read-only in offline commands.** Today `build-raw`, `analyze`, `report` and `status` open `data/state.sqlite3` read-write, and opening it runs `PRAGMA journal_mode=WAL` and `CREATE TABLE IF NOT EXISTS`.
  - Give these offline readers a read-only connection, keeping SQLite's WAL read-only pitfalls in mind.
  - Don't touch the collector's write path.
  - Add a test that offline commands leave the DB unchanged.
- **Label results as partial.** The manifest and the quality report should show collection progress: stories done and queued per category, and the share complete. While stories are still queued, mark the sampling weights as provisional.
- **Add one refresh command for me**, e.g. `python -m litcorr refresh` = `build-raw` + `analyze` + `report` + a profile diff against the previous run, with no export. Document it in `README.md`.

## Deliverables

1. **`docs/stage1b/VALIDATION_REPORT.md`.** Aggregate-only: no text, titles, names, slugs or story-level rows. It should cover:
   - what was checked and the results for each family;
   - classifier accuracies with CIs;
   - reliability, redundancy and length-dependence tables;
   - lexicon changes;
   - known limitations;
   - what to re-check once collection finishes.
2. **The code, lexicon, schema and doc changes**, with tests, committed phase by phase.
3. **`docs/stage1b/`**: `PLAN.md`, `WORKLOG.md`, `CHANGELOG.md` and `NEW_MEASURES_PROPOSAL.md`.
4. **The refresh instructions** in `README.md`.
5. **A short list of decisions I need to make.**

## Checkpoints: stop and ask me before

- implementing new measures (after the proposal);
- removing or renaming any existing column;
- any change to the collection code, the `[scope]`/`[politeness]` config, or the state DB schema;
- downloading anything or adding a dependency;
- anything that would need more story text than the policy above allows.

Otherwise, work through the phases without waiting for me. At each checkpoint and at the end of each phase, give me a summary of at most 15 bullets.

**Start with Phase 0 and report the baseline.**
