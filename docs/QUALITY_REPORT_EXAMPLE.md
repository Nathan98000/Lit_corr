> **Example only.** This report was produced by `python -m litcorr demo`, which runs the pipeline against a
> small *synthetic* imitation of the site on your own computer. The stories, numbers and failures below are
> invented. They show the format of the real report that `python -m litcorr report` writes after collection.

# Data-quality report

Generated 2026-10-01T14:12:18+00:00.

## Summary

| | |
|---|---|
| Stories in dataset (queued for full text) | 204 |
| Stories seen on listing pages (sampling frame) | 204 |
| With text | 200 (98%) |
| Included in analysis | 200 (98%) |
| With views | 200 (98%) |
| With average rating | 200 (98%) |
| With number of ratings | 184 (90%) |
| With favorites | 200 (98%) |
| With comments | 200 (98%) |
| Publication dates | 2007-09-24 to 2026-07-30 |
| Unique authors | 183 |
| Records with duplicated text | 0 |
| Records sharing a site id | 0 |
| Repeat sightings in listings | 0 |
| Bot/challenge/blocked pages | 0 |
| Word count: median (1st–99th percentile) | 1,686 (638–4,003) |

## Failures and collection status

Stories not fully collected, by status: gone 2, robots_disallowed 1, unavailable 1.

Network requests by outcome: http_200 469, http_302 1, http_404 1.

Sessions: 1; stop reasons: {"completed": 1}.

## By category

| Category | Stories | With text | With views | Included |
|---|---|---|---|---|
| Romance | 29 | 25 | 25 | 25 |
| BDSM | 25 | 25 | 25 | 25 |
| Erotic Couplings | 25 | 25 | 25 | 25 |
| Erotic Horror | 25 | 25 | 25 | 25 |
| Lesbian Sex | 25 | 25 | 25 | 25 |
| Loving Wives | 25 | 25 | 25 | 25 |
| Mature | 25 | 25 | 25 | 25 |
| Sci-Fi & Fantasy | 25 | 25 | 25 | 25 |

## Quality flags

| Flag | Stories | Meaning |
|---|---|---|
| `views_approximate` | 16 | Only an abbreviated view count (e.g. '12.3k') was available. |
| `no_text` | 4 | No story text was collected. |
| `status_gone` | 2 | Story page no longer exists (HTTP 404/410, or the site redirected to its home page). |
| `status_robots_disallowed` | 1 | Not fetched because robots.txt (or the built-in safety list) disallows it. |
| `status_unavailable` | 1 | Story exists but is not publicly readable (e.g. awaiting moderator approval). |

## Why stories are excluded from analysis

| Reason | Stories |
|---|---|
| `no_text` | 4 |

## Where key fields came from

`embedded` = exact values from the page's data; `dom` = visible page text (may be abbreviated); `jsonld`/`meta` = page metadata.

- **views**: embedded 184, dom 16
- **favorites**: embedded 184, dom 16
- **comments**: embedded 184, dom 16
- **rating**: embedded 184, dom 16
- **date_published**: embedded 184, jsonld 16
- **category_slug**: embedded 184, dom 16
