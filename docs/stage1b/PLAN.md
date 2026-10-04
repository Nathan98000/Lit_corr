# Stage 1B plan: validate, harden and extend the text pipeline

Branch `stage1b`. One commit per phase. Everything here is aggregate-only: no story text, titles, descriptions,
names, URLs, slugs or story-level rows. Dev outputs that contain story keys (outliers, samples, hand-check
sheets) live under `data/dev/`, which git ignores.

## Ground rules I am working to

* Offline only. Nothing in `litcorr/net/` or `litcorr/collect/` is run or changed; no `probe`, `collect`,
  `process` or `export-handoff`. Writes under `data/` are limited to `data/raw/`, `data/processed/`,
  `data/derived/` and `data/dev/`. `state.sqlite3` is checksummed before and after every real-data run.
* Story text is seen only through aggregate statistics and the masked view (`litcorr/dev/inspect_text.py`).
  Unmasked excerpts (≤ 2 sentences, ≤ ~50 words) only to confirm a specific suspected bug, never stored.
  Regression tests use synthetic sentences written from scratch.
* Measures stay rule/lexicon based, deterministic and offline. No new dependencies (numpy/pandas only; no scipy,
  so CIs and correlations are implemented directly).
* Popularity is never used to choose, tune or prune text measures.
* `python -m pytest -q` and `python -m litcorr demo` pass at every commit.

## Phases

| Phase | What | Output |
|---|---|---|
| 0 | Baseline: tests, demo, `build-raw` / `analyze` / `report` on the real data; runtime, memory, cores; baseline profile | WORKLOG §0, `data/dev/profiles/baseline/` |
| 1 | Dev tools in `litcorr/dev/`: `inspect_text` (masked view + overlays + one-sentence reveal), `char_inventory`, `measure_profile` (save / diff / diff-features), `review_sample` (fixed seed, hold-out option); hand-check sheets and Wilson CIs | code + tests |
| 2 | Extraction audit (HTML → paragraphs): boilerplate, author notes / headings / "to be continued", page joins, paragraphing, encoding, word counts vs the site's | parser/cleaner fixes + tests, profile diff |
| 3 | Measure audit, every family: degeneracy, known groups (expectations written first), hand-checks of the rule-based classifiers (40–60 items each, 95% CI), lexicon audit, split-half reliability, redundancy, length dependence | WORKLOG §3, tables for the report |
| 4 | Fixes with synthetic regression tests; CHANGELOG entry per changed measure; `TEXT_PIPELINE_VERSION` + lexicon hash in the manifest; list of tuned thresholds | code + CHANGELOG |
| 6 | Incremental `analyze` (per-story cache keyed on text hash + pipeline version + lexicon hash + settings; `--full`), read-only state DB for offline commands, partial-collection labels, `refresh` command | code + tests + README |
| 5 | `NEW_MEASURES_PROPOSAL.md` (15–25 candidates with prototype correlations on the real data; retire/merge suggestions). **Then stop for approval.** | proposal |

Phase 6 is done before writing the Phase 5 proposal because it does not depend on the approval and makes every
later re-run cheap; the proposal is the last step before the approval checkpoint.

## Checkpoints (stop and ask)

* implementing new measures (after the proposal);
* removing or renaming any existing column;
* any change to the collection code, `[scope]` / `[politeness]`, or the state DB schema;
* downloading anything or adding a dependency;
* anything needing more story text than the masked-view policy allows.

## Hold-out discipline

The ~4,750 stories still to be collected are the hold-out. Every threshold or rule tuned on this batch is listed
in WORKLOG ("Tuned on batch 1"). Hand-check samples are saved with their seed and story keys under
`data/dev/samples/`, and `review_sample --exclude-sample ... --only-new-since ...` draws a fresh sample from
stories collected later, so every reported accuracy can be re-estimated on new stories only.
