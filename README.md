# Literotica Correlations — Stage 1: data pipeline

A slow, polite collector for public Literotica story pages, and an offline
pipeline that turns the collected stories into about 215 transparent, explainable
story measures plus popularity figures. Its output feeds Stage 2: a static
website that lets visitors explore which story characteristics are
*associated with* popularity, overall and within Literotica's categories.

**Stage 1 (this repository, now):** you run the collector on your own machine,
then the offline processing, then send back one zip file.
**Stage 2:** the website in [`site/`](site/README.md), built from that zip only. No
scraping, no live connection, no raw text: it ships summaries of groups of stories.

> Before collecting, read **[docs/SITE_RULES.md](docs/SITE_RULES.md)**. In
> short: Literotica's robots.txt blocks AI crawlers entirely and blocks the API
> and tag pages for everyone; story and category pages are allowed for general
> crawlers. Please also read Literotica's Terms of Use yourself (linked in the
> site footer); they could not be reviewed for you.

---

## 1. Install

Python 3.10 or newer.

```bash
cd Literotica_Correlations
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

(With `uv`: `uv venv --python 3.12 && uv pip install -r requirements.txt`.)

Check everything works, offline, in under a minute:

```bash
python -m pytest -q
python -m litcorr demo
```

`demo` runs the *entire* pipeline against a small made-up imitation of the site
served from your own computer (`data_demo/`). It never contacts Literotica.
Its numbers are invented.

## 2. Configure

Everything you may want to change is in **`config.toml`**, with the
politeness settings at the top. It is kept out of git because it holds your contact address; on a fresh
checkout, create it from the tracked template first:

```bash
cp config.example.toml config.toml   # then put your e-mail or project URL in user_agent
```

Without a `config.toml` the built-in defaults (the same as the template) are used.

| Setting | Default | Meaning |
|---|---|---|
| `base_delay_seconds` / `jitter_seconds` | 8 / 4 | wait 8–12 s between requests (floor: 3 s) |
| `max_requests_per_minute` / `_hour` / `_day` | 6 / 300 / 3000 | hard caps, counted across restarts |
| `max_requests_per_session` | 1500 | one `collect` run stops after this many requests |
| `timeout_*`, `max_retries` | 10 s / 30 s / 3 | retries only for timeouts and 5xx errors |
| `pause_after_429_seconds`, `stop_after_*`, `cooldown_*` | 1800 s, …, 6 h / 24 h | how hard to back off; can be made stricter, not switched off |
| `user_agent` | `LitCorrResearch/0.1 (… contact: …)` | **put your e-mail or project URL here** |
| `categories` / `exclude_categories` | all story categories except audio, illustrated, non-English | which categories |
| `max_stories_per_category` | 300 | full-text sample size per category |
| `listing_strategy` | `spread` | sample listing pages spread across each category's browse-by-title index (`all` = every page) |
| `text_mode` / `max_pages_per_story` | `full` / 20 | `first_page` is ~2.5× cheaper but loses length and pacing measures |

## 3. Probe (≈ 6 requests; pages already read are not downloaded again)

```bash
python -m litcorr probe
```

This reads robots.txt, the category list, one category's landing page, pages 1
and 2 of one letter in that category's browse-by-title index (e.g. `…/S` and
`…/S-2`) and one story page, then writes `data/logs/probe_report.md` showing
which fields were found and where each came from. Check two things:

1. **"Sampling frame"**: the layout line should contain
   `"page": "{base}/c/{slug}/{letter}-{n}"`, and **"Page 2 vs page 1"** should
   say **0 repeated**.
2. The bottom line, **"Missing important fields"**, should say `none`.

If both hold, go on to `collect`. Otherwise:

* Something is missing or wrong, or the probe found no stories → send me
  `data/logs/probe_report.md` and `data/logs/probe_skeleton_*.html`. The
  skeletons contain only page *structure* (tags, CSS classes, data key names),
  with all story text, titles and names removed. I will adjust the parsers. The
  pages are already cached, so nothing needs to be downloaded again.
* The probe **stops** with "refusing connections", "HTTP 403" or a challenge
  page → see [If the site blocks the collector](#if-the-site-blocks-the-collector).

## 4. Collect (slow; resumable)

```bash
python -m litcorr collect
```

One run:
1. reads the category list (once),
2. reads listing pages for every selected category from its browse-by-title
   index (page 1 of each letter, then a sample of pages spread across all
   letters; about 50 requests per category, ~1,500 in total),
3. draws the random sample of stories,
4. fetches story pages, every page of each story, one request at a time.

It stops by itself after `max_requests_per_session` requests or when the daily
cap is reached. **Just run the same command again later**; it continues exactly
where it stopped and never downloads a page twice. You can also stop it at any
time with **Ctrl-C**, or by creating an empty file named `STOP` in the project
folder (delete it before the next run).

```bash
python -m litcorr status        # offline progress report
python -m litcorr categories    # which categories are selected
```

**How long?** At the defaults (~10 s per request, ≤ 3,000 requests per 24 h):

| Stories | Requests (≈) | Time |
|---|---|---|
| 1,000 (e.g. 35 per category) | ~3,000 | about 1 day |
| 8,400 (default: 300 × ~28 categories) | ~22,000 | about 7–8 days of running ~8 h/day |
| 8,400 with `text_mode = "first_page"` | ~9,000 | about 3 days |

A practical rhythm is to run `collect` once or twice a day (each run stops by
itself after 1,500 requests, about 4 hours) until `status` shows no queued
stories. Stopping early is fine: the sample is collected round-robin across
categories, so whatever you have is balanced.

### Starting and stopping during the day

Start whenever you like with `python -m litcorr collect` (add
`--max-requests 300` for a shorter run of about 50 minutes). Stop whenever you
like:

* press **Ctrl-C** in its window (closing the window also works), or
* create a file named `STOP` in the project folder (`touch STOP`); the
  collector stops within a few seconds. Delete it (`rm STOP`) before the next
  run, or that run stops straight away.

Nothing can end up half-saved, even after a crash, a power cut or the Mac going
to sleep mid-run. A page is written to disk completely before it is recorded as
downloaded, the progress database saves each change entirely or not at all, and
only one collector can run at a time (a second one is refused). The next run
continues exactly where the last one stopped, and pages already downloaded are
never downloaded again. All runs share the limits (at most 3,000 requests in
any 24 hours); when the limit is used up, `collect` says when it can continue.

* **No internet?** The collector stops with "No working internet connection"
  and no cooldown. Run it again when you're back online. (If Wi-Fi drops in the
  middle of a run, it waits and retries a few times first.)
* **Keep the Mac awake** during a long run:
  `caffeinate -i python -m litcorr collect`.
* **Don't delete or edit anything in `data/`**, especially `state.sqlite3`, the
  `state.sqlite3-wal` / `state.sqlite3-shm` files next to it, and
  `.story_key_secret`. To make a backup, stop the collector first, then copy
  the whole `data/` folder.
* **Don't change the sample once collection has started**: leave
  `categories`, `random_seed` and `text_mode` in `config.toml` as they are.
  Raising `max_stories_per_category` is fine (it only adds stories), and the
  delays and caps can be changed between runs, within their limits.
* `status` is safe to run at any time, even while `collect` runs. So are
  `refresh` and `process`, which simply use whatever has been collected so
  far. The offline commands only ever read `state.sqlite3` (from an in-memory
  copy), so they cannot disturb the collector.
* If a run says a **cooldown** is active, wait until the time it gives.
* **A few stories keep failing with HTTP 500?** That is the site failing on
  those particular pages, not a block. Such a story is tried again in later
  runs, after all the other stories and with a single request per run, and is
  given up (`failed` in `status`) after `max_attempts_per_url` runs. Like a
  story that has gone from the site, it is then replaced by the next story in
  its category's shuffled order, so each category still ends up with
  `max_stories_per_category` stories.

## 5. Process (offline)

```bash
python -m litcorr process
```

This runs, in order (each step can also be run on its own):

| Step | Command | Output |
|---|---|---|
| parse cached pages | `build-raw` | `data/raw/*.parquet` (includes story text) |
| text + popularity measures | `analyze` | `data/processed/stories_features.parquet` / `.csv` |
| quality report | `report` | `data/processed/quality_report.md` / `.json` |
| documentation | `docs` | `docs/METHODOLOGY.md`, `docs/DATA_DICTIONARY.md`, `docs/word_lists.html` |
| handoff zip | `export-handoff` | `data/handoff/litcorr_stage2_handoff_YYYYMMDD.zip` |

None of these touch the network. If you edit a lexicon or I fix a parser,
just run `process` again.

### Refreshing while the collection continues

```bash
python -m litcorr refresh
```

`refresh` brings the processed data up to date with everything collected so
far: `build-raw`, `analyze` and `report`, then a comparison with the previous
refresh. It does **not** build the handoff zip. It is quick because both steps
are incremental:

* `build-raw` re-parses only stories whose saved pages changed (new pages, a
  re-fetch) and reuses the rest from `data/raw/parse_cache.parquet`;
* `analyze` re-measures only stories whose text or metadata changed, and takes
  the others from `data/derived/text_measures.parquet`.

Any change that could alter a value invalidates the reuse automatically: an
edit to the parser or the measure code, a word list, the text pipeline version
or a measure setting in `[analysis]`. `--full` (on `refresh`, `build-raw` and
`analyze`) redoes everything anyway; it gives exactly the same result. On the
first batch (4,251 stories with text) a full refresh took about 3.5 minutes,
and a refresh with nothing new about 13 seconds.

While stories are still queued, the data are **partial**:
`collection_manifest.json` has `collection_progress` (per category: sampled,
collected, still queued, not collectable) and `sampling_weights_provisional`,
and the quality report starts with a "Collection progress: PARTIAL" table.
Each refresh also saves a statistical profile of every measure in
`data/derived/profiles/` and writes what changed since the previous refresh to
`data/derived/profiles/latest_diff.md` (aggregate numbers only).

## 6. What to send back for Stage 2

**`data/handoff/litcorr_stage2_handoff_YYYYMMDD.zip`.** It contains the
processed per-story numbers (no story text, titles, descriptions, URLs, slugs
or author names/ids), the category table, the data dictionary, the quality
report, the collection manifest, the methodology and the lexicons. To keep rows
from being matched back to particular stories or authors, the zip also:
- uses story keys that are keyed hashes (the secret,
  `data/.story_key_secret`, stays on your computer);
- keeps only tags used by at least 20 stories;
- bands the author story and follower counts;
- rounds raw totals to 3 significant figures;
- leaves out exact publication dates.

Please also mention anything unusual from `quality_report.md`.

## 7. Stage 2: the website

```bash
python -m litcorr site-data        # handoff zip -> site/public/aggregates/ (offline, under a minute)
cd site && npm install && npm run dev
```

`site-data` reads only the newest handoff zip and writes the small summaries the website needs (no story-level
data), including `patterns.json`, the existing pattern verdicts collected for the site's Patterns page;
`genres/<included>.json`, one file per "Only include" option of the Genres page (All stories and the three Published
ones): each genre's quartiles or shares
for every characteristic, and whether the genre clearly differs from all genres (a rank-biserial correlation of at
least 0.2, or for named groups a total variation distance of at least 0.2, clear at the 99.9% level); and
`trends/all/<genre>.json`, one file per genre for the Trends page (which compares all stories): each five-year period's
quartiles or shares for every characteristic on that page, and whether it clearly changed from 2000–2009 to 2020 or
later by the same rule. `meta.json` gives the
Trends page's periods, windows, rule, options and left-out characteristics as `trend`. The website,
*Story Patterns* ("What do popular Literotica stories have in common?"), is a static React + Vite app: see [site/README.md](site/README.md) for development,
tests and deployment to Vercel or Netlify.
It is live at **https://literotica-data.vercel.app/**, deployed by Vercel from `main`: every push to `main` updates it.

---

## Generated files

```
~/.litcorr/            one lock file per website: only one collector can run on this computer
data/
  state.sqlite3          progress: pages fetched, sample queue, request log, cooldowns
  .story_key_secret      secret for the story keys (keep it; never share it)
  cache/pages/           every downloaded page, gzip-compressed (never fetched twice)
  raw/
    stories.parquet      one row per sampled story: all parsed metadata + full text +
                         collection status + parse warnings + where each field came from
    story_pages.parquet  one row per story page parsed
    listing_items.parquet the sampling frame: every story seen on a listing page
    categories.parquet   categories and how their listing pages were read
    pages.parquet        every URL requested: status, HTTP code, fetch time
    parse_cache.parquet  parsed pages reused by the next build-raw (contains text)
  derived/
    text_measures.parquet per-story measures reused by the next analyze (no text)
    profiles/            one statistical profile per refresh + latest_diff.md
  processed/
    stories_features.parquet  analysis-ready table: category, dates, popularity,
                              ~215 story measures, quality flags, sampling weight (no text)
    stories_features.csv      the same as CSV (lists joined with "|")
    category_frame.parquet    per-category size estimates and sample counts
    quality_report.md/.json   data-quality summary
    data_dictionary.json      machine-readable schema
    collection_manifest.json  dates, settings, versions, lexicon sizes, collection progress
  logs/
    collector.log        human-readable log
    requests.jsonl       one line per network request (time, URL, status, bytes, duration)
    errors.jsonl         one line per problem
    probe_report.md, probe_skeleton_*.html
  handoff/               the zip for Stage 2
```

* **Raw vs processed.** Raw data keep everything needed to redo every
  downstream step (including the original HTML in the cache). Processed data
  are derived, contain no story text, and can be regenerated at any time.
* **Story identity.** A story is identified by its URL slug (`/s/<slug>`);
  processed files use `story_key`, a hash of the slug. Literotica's numeric
  submission id is kept in raw data as a cross-check for duplicates.
* **Nothing is silently dropped.** Every sampled story stays in the processed
  table with `qc_flags`; `analysis_include` and `exclusion_reasons` say whether
  it is used for analyses and why not.

## Documentation

* [docs/METHODOLOGY.md](docs/METHODOLOGY.md): how the data were collected and
  every measure explained in plain English, including how the first/third-person
  classifier was validated on public-domain novels.
* [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md) /
  [docs/data_dictionary.json](docs/data_dictionary.json): every column.
* [docs/SITE_RULES.md](docs/SITE_RULES.md): robots.txt findings and exactly
  what the collector will and will not do.
* [docs/QUALITY_REPORT_EXAMPLE.md](docs/QUALITY_REPORT_EXAMPLE.md): what the
  quality report looks like (from the synthetic demo, not real data).
* [lexicons/README.md](lexicons/README.md): the editable word lists.
* [docs/word_lists.html](docs/word_lists.html): a page for reading the word
  lists. Open it in a browser, tick the lists you want, or search for a word to
  see which lists count it. `python -m litcorr word-lists --open` rebuilds and
  opens it.

## If the site blocks the collector

The collector stops immediately, records a cooldown, and tells you why if it
gets HTTP 403, a bot-check/CAPTCHA page, an age gate, or refused connections.
It also stops for repeated 429s. (Having no internet on your side is not
treated as a block: it says so and stops without a cooldown.) **Do not work around this**: no browser
User-Agent, VPN, proxy, cookies or browser automation. Wait for the cooldown
and try `probe` once more; if it is still refused, ask Literotica for
permission. If a 403 was for a single story page, that story is marked as
failed before the stop, so the next run starts elsewhere and the story is
replaced by the next one in its category. Details in [docs/SITE_RULES.md](docs/SITE_RULES.md).

## After a parser fix

```bash
python -m litcorr collect --recheck   # re-reads cached pages; fetches only pages that were missed
python -m litcorr process
```

## Project layout

```
config.example.toml    settings template (copy to config.toml, which git ignores)
litcorr/
  settings.py          config loading + hard safety limits
  state.py             SQLite progress store
  net/                 fetcher (pacing, caps, retries, backoff, cooldowns), cache, robots, block detection
  site/                URLs, categories, embedded-data reader, listing and story parsers
  collect/             session/lock, category + listing discovery, sampling, story fetching, probe
  build/               raw corpus from cache, quality flags and report
  text/                tokens/sentences/dialogue, lexicon matching, all text measures
  popularity.py        raw / per-view / per-month popularity
  analyze.py           processed dataset (with the per-story measure cache)
  refresh.py           incremental build-raw + analyze + report + profile comparison
  dev/                 developer tools for checking the text measures (masked views, hand-checks, audits)
  schema.py            the variable registry (source of the data dictionary)
  word_lists.py        docs/word_lists.html, the page for reading the word lists
  export.py            Stage 2 handoff
  demo.py              local synthetic site used by `demo` and the tests
lexicons/              editable word lists
docs/                  methodology, data dictionary, word-list page, site rules
scripts/validate_narration.py   reproduces the narration-classifier check
tests/                 pytest suite (runs offline against the local mock site)
```
