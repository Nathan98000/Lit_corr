# Literotica's rules and how the collector follows them

*Checked 1 October 2026. Re-check before every collection campaign: the
collector re-reads robots.txt automatically, but terms of use are not
machine-readable.*

## robots.txt (www.literotica.com)

**AI agents.** A dedicated group disallows the entire site (`Disallow: /`) for
`anthropic-ai`, `CCBot`, `ChatGPT-User`, `Claude-Web`, `ClaudeBot`, `GPTBot`,
`Google-Extended` and `PerplexityBot`. Literotica does not want AI crawlers or
AI assistants browsing the site. In keeping with that, apart from reading
robots.txt itself, **no page of Literotica was opened by an AI tool while this
pipeline was built.** The page structure was learned from public open-source
projects that read Literotica (FanFicFare, WebToEpub, LitKeeper,
LiteroticaApi), and the parsers were tested against a local synthetic
imitation of the site.

**Everyone else (`User-agent: *`).** 85 `Disallow` lines. The relevant ones:

| Disallowed | What it is |
|---|---|
| `/api/` | the JSON API the site's own pages use |
| `/tags/` | tag pages |
| `/*?dialog=`, `/*&dialog=` | login/vote/other dialogs |
| `/authenticate/`, `/my/`, `/mail/` | accounts and messages |
| `/beta/`, `/css/`, `/cssv2/`, `/js/`, `/jsv2/`, `/sc/`, `/xsltest/`, `/ubb/`, `/x3top3/` | site internals |
| `/stories/*.php` endpoints (vote, add to favourites, comments, reports, e-mail story …) | interactive actions |
| `/s/<category>-c` (one line per category, e.g. `/s/adult-romance-c`) and `/p/<poetry category>-c` | category-like addresses under `/s/` and `/p/` |
| `/stories/showstory.php?id=494486` (and page 2) | one specific old story |

Not disallowed: story pages (`/s/<story-slug>`), category listings
(`/c/<category>`), series pages (`/series/se/<id>`) and author pages. There is
**no `Crawl-delay`** and **no `Sitemap`**.

## Terms of use

The terms of use could not be reviewed for this project, because AI agents are
disallowed from the site and the terms did not appear in search results.
**Please read Literotica's Terms of Use (linked in the site footer) before
running `collect`.** If they prohibit automated collection or
the use you intend, do not run the collector without Literotica's written
permission. A short, polite e-mail explaining the project (non-commercial,
aggregate statistics only, no text republished, slow collection) is often
enough.

## What the collector does

* **Honest identity.** It sends a descriptive User-Agent (`LitCorrResearch/0.1
  (...; contact: ...)`, which you set in `config.toml`) and is therefore subject
  to the `User-agent: *` rules. It never pretends to be a web browser.
* **robots.txt first, every time.** Each URL is checked against the live
  robots.txt (re-read at most every 24 hours) before it is requested. Redirects
  of robots.txt are followed (up to five, as RFC 9309 says). If robots.txt
  cannot be read, comes back as a web page instead of rules, or answers with
  anything other than 200/404/410, nothing else is requested. Stories skipped
  because robots.txt disallowed them are re-checked against later versions of
  robots.txt and collected only if it then allows them.
* **A built-in denylist on top.** `/api/`, `/tags/`, `/my/`, login, voting,
  favourite and comment endpoints and `dialog=` URLs are never requested even if
  robots.txt changed to allow them, and only `www.literotica.com` is contacted.
* **Slow, one at a time.** Concurrency is always 1: a lock per website per
  computer (in `~/.litcorr/`) prevents two collectors running at once, even
  from different project folders or config files. Defaults: at least 8 s
  between requests plus 0–4 s random jitter; at most 6 per minute, 300 per
  hour, 3,000 per rolling 24 hours and 1,500 per session. Each request is
  written to the request log *before* it is sent, so even an interrupted
  request counts toward the caps. The delay cannot be set below 3 s nor the
  rate above 15 per minute from the config file, and the protective settings
  below can be made stricter but not switched off. If robots.txt ever sets a
  Crawl-delay, the collector always waits at least that long.
* **Every page once.** Pages are cached on disk; nothing that was fetched
  successfully is fetched again, and listing pages are not polled for updates.
  A page that does not contain what a story or listing page should contain
  (an interstitial, maintenance or error page served as "200 OK") is never
  cached as content; several in a row end the session.
* **Retries only when sensible.** Only timeouts, dropped connections and HTTP
  500/502/503/504 are retried, at most 3 times with waits of about 1, 2 and 4
  minutes (honouring `Retry-After`). 404/410 are recorded as "gone" and not
  retried; other 4xx answers are not retried. A story that fails is not tried
  again in the same session; it waits for a later one (at most 3 sessions).
* **Backs off when asked.** HTTP 429 doubles all delays (for 24 hours, even
  across restarts) and pauses 30 minutes, or as long as `Retry-After` says.
  The pause is recorded *before* waiting, so stopping and restarting during it
  does not skip it. A second 429 within 24 hours ends the session and blocks
  new sessions for 6 hours.
* **Stops when refused.** HTTP 401/403/451, a bot-check or CAPTCHA page with
  any status code (e.g. Cloudflare "Just a moment…", or the `cf-mitigated:
  challenge` header), an "access denied" page, an age-verification gate, a
  redirect to a login/verification/consent page or to another website, a
  server that refuses or drops connections, or eight "missing" pages in a row
  (real deletions are not that clustered; this looks like a soft block, and
  those pages are retried later instead of being written off) end the session
  immediately and block new sessions for 24 hours. The collector does not
  solve CAPTCHAs, change identity, rotate IP addresses, use proxies or VPNs,
  load cookies from a browser, log in, or use browser automation. Failures on
  the collector's own side (no internet, a DNS lookup that fails, a Wi-Fi login
  page intercepting secure connections) never reach the site and are not read
  as refusals: the session stops without a cooldown.
* **No browser automation.** Story pages are server-rendered HTML, so plain
  HTTP requests are enough. Browser automation is not implemented.

## If the site blocks the collector

While this project was being built, a plain command-line request (`curl`) for
robots.txt was refused at the connection level (an HTTP/2 `ENHANCE_YOUR_CALM`
reset, then an empty reply over HTTP/1.1). That suggests Literotica's edge
network may refuse some non-browser clients. Some open-source tools get around
this by disguising themselves as Chrome. **This collector deliberately does
not.**

If `probe` stops with "refusing connections", "HTTP 403" or a challenge page:

1. Do not loosen the settings, change the User-Agent to look like a browser,
   or use a VPN or proxy. That would be exactly the evasion this project rules
   out.
2. Wait for the cooldown, then try `probe` once more (temporary network
   problems happen).
3. If it is still refused, the site does not want this kind of automated
   access from you. Contact Literotica to ask for permission or a data
   arrangement, or narrow the project to data you can obtain with permission.

## Use of the data

The collected text stays on your machine (`data/`, which git ignores). The
handoff for the website contains only per-story numbers (no text, titles,
URLs, slugs or author identifiers). Story keys in it are keyed hashes whose
secret stays on your machine, rare tags are dropped, author counts are
banded, raw totals are rounded and exact dates are removed, so rows are hard
to match back to individual stories or authors. The public website will show
only aggregates. Respect the site's wishes regarding AI: do not use the
collected text to train AI models.
