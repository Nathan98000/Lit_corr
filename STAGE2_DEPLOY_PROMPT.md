# Stage 2: put the site on Vercel at literotica-data.vercel.app

You are working in the `Literotica_Correlations` project. Its Stage 2 website (`site/`) is a static React + Vite build:
relative paths, hash addresses (`#/explore?…`, `#/genres?…`, `#/trends?…`, `#/patterns?…`, `#/methodology/…`), no
server. `site/README.md` ("Deploying") says how to host it on Vercel, and `site/vercel.json` is ready. It has never
been deployed.

The owner wants it live at **`https://literotica-data.vercel.app/`**, served by Vercel from the GitHub repository
`Nathan98000/Lit_corr`, with each push to `main` deploying again. A `*.vercel.app` address needs no DNS and gets
HTTPS from Vercel, so nothing here involves a domain registrar or DuckDNS.

The owner does the steps that need their Vercel and GitHub accounts; they have the same list as in "The owner's
steps" below. You check everything from outside, make the small repository changes, and say exactly what to do when
something needs the owner.

## The owner's decisions

### D1. Vercel, from GitHub

* The Hobby plan, under the owner's personal account (Hobby can't use repositories owned by a GitHub organization;
  this one is personal).
* Project name `literotica-data`, so the production address is `literotica-data.vercel.app`.
  * On October 13, 2026 that address answered `DEPLOYMENT_NOT_FOUND`, so the name looked free.
  * If Vercel gives the project another address, the owner can change it in Settings → Domains (Edit). If
    `literotica-data` is taken, ask the owner which name to use instead.
* Root Directory `site`. The framework is Vite, and the build command and output come from `site/vercel.json`. Node.js
  22.x, as in `site/.nvmrc` and `netlify.toml`.
* The production branch is `main`: every push to `main` deploys. Other branches pushed to GitHub get preview
  deployments, which Vercel's default Standard Protection keeps behind a Vercel login. Leave that.
* The production address must be public. If Deployment Protection is set to "All Deployments", stop and ask.

### D2. One small change to the site (approved)

* `index.html` gets `<link rel="canonical" href="https://literotica-data.vercel.app/" />` and
  `<meta property="og:url" content="https://literotica-data.vercel.app/" />`, with the address the project actually
  has. Search engines then treat the production address as the site's address, rather than the per-deployment ones.
* Add a test that both are present and give the same address.
* Nothing else in `site/` changes: no base path, no routes, no headers, no `vercel.json` change.

### D3. Documentation

* `site/README.md`'s "Deploying" section gains "The live site":
  * the address, the Vercel project and its settings (D1);
  * that a push to `main` deploys, and that other branches get protected previews;
  * how to check a deployment (the commands you used in Phase 1);
  * how to roll back: Deployments → an earlier production deployment → "…" → Promote to Production (or Instant
    Rollback).
* The root `README.md`'s section 7 gets one line with the address.

### D4. Pushing

* You may merge your branch into `main` and push `main` to GitHub only after the owner says yes, in this session, to
  that exact step. Pushing deploys the site.
* Never force-push, and never push other branches.

## Rules that still hold

* **No network access to Literotica.** Never open literotica.com with any tool. The `vercel.app` address is the
  owner's site: open it freely.
* **The data stays private and aggregated.** The deployment serves `site/dist` and nothing else. Check that
  `/README.md`, `/src/main.jsx`, `/package.json` and `/vercel.json` return 404.
* **No new dependencies.** Checking tools (Playwright, axe-core) run from a temporary directory outside the repository,
  as in earlier rounds; never add them to `package.json`. You don't need the Vercel CLI. If the owner wants you to use
  it, run it with `npx --yes vercel@<version>` and keep `site/.vercel/` out of git.
* **The accounts are the owner's.** Don't create accounts, projects or tokens, and don't change Vercel settings
  yourself.
* **Git.**
  * Work on the branch `deploy-vercel`, made from `main`.
  * Commit in the repository's style ("Stage 2 deploy: …"). Push only as D4 says.
  * Never commit `.claude/`, `Claude outputs/`, anything under `data/`, or any secret.
* **Tests and build pass at every commit:** `npm test` and `npm run build` in `site/`, and `.venv/bin/python -m pytest`
  at the root.

## Phase 0: before the owner deploys (no changes)

1. **Git.**
   * Run `git status`, and compare `main` with `origin/main`: Vercel builds what is on GitHub's `main`.
   * Report whether local `main` is ahead, and any unmerged branch that could matter (a `data-update-*` branch, say).
   * What goes live is the owner's decision.
2. **Tests and build.** Run the three test commands and `npm run build` from a clean `npm ci`, as Vercel will. Record
   the results.
3. **The address.** Check that `https://literotica-data.vercel.app/` still answers `DEPLOYMENT_NOT_FOUND`.
4. **Hand over.** Tell the owner the site is ready to import, and to follow "The owner's steps" 1–7. Then wait for
   them to send the address.

## Phase 1: check the live site

When the owner sends the address, check it as a visitor's browser gets it.

1. **Public.** Use a fresh browser profile with no cookies. The page must load without a Vercel login, and the
   response must carry no `x-robots-tag: noindex`.
2. **Pages.** Open every page's address in headless Chromium at 375 and 1440 px:
   * no console errors;
   * the heading font loads;
   * "Download image" works on a Popularity chart.
3. **Files.**
   * `meta.json` is the one on `main`: compare `generated_at`.
   * The aggregates return 200, compressed, with `Cache-Control: public, max-age=3600`.
   * The main script and CSS are cached as Vercel does by default.
   * `/README.md`, `/src/main.jsx`, `/package.json` and `/vercel.json` return 404.
4. **Speed.** Measure the first load's bytes with a copy of `firstbodies.mjs` adapted to a URL, and compare it with
   the README's 150.7 KiB. Vercel may send Brotli where the README measured gzip: say which.
5. **If something fails** (the build, a page or a file), get the build log from the owner (Deployments → the
   deployment → Building) and stop with a diagnosis.

## Phase 2: the repository

1. Make the branch `deploy-vercel`. The first commit adds this prompt.
2. **D2,** with its test. Commit.
3. **D3.** Commit.
4. **Ask the owner** whether to merge `deploy-vercel` into `main` and push (D4).
   * If they say yes, do it. Then wait for the deployment, and check that the live `index.html` has the canonical
     link.
   * If they say no, give them the commands.
5. **In your final message, give:**
   * the live address, and what it serves (the commit, and `meta.json`'s `generated_at`);
   * the results of Phase 1's checks;
   * what deploys from now on (a push to `main`), and how to roll back;
   * anything the owner still has to do.

## Checkpoints: stop and ask before

* using a name other than `literotica-data`;
* changing any Vercel setting, or anything in `site/` beyond D2;
* pushing anything (D4);
* going on when the production address isn't public, or the build fails;
* going on when a plan limit is hit (deployments per day, bandwidth).

## The owner's steps

The owner has this list too. Refer to it by number.

1. **Create a Vercel account.** Go to https://vercel.com/signup, choose "Hobby", give your name, then "Continue with
   GitHub". Sign in to GitHub as Nathan98000 and authorize Vercel.
2. **Start a project.** In the Vercel dashboard, click "Add New…", then "Project".
3. **Let Vercel see the repository.** Under "Import Git Repository", find `Lit_corr`.
   * If it isn't listed, click "Install" or "Adjust GitHub App Permissions".
   * On GitHub, choose "Only select repositories", pick `Lit_corr`, and click "Install" (or "Save").
   * Back in Vercel, click "Import" next to `Lit_corr`.
4. **Configure the project:**
   * Project Name: `literotica-data`;
   * Framework Preset: Vite (it should be detected);
   * Root Directory: click "Edit", choose `site`, then "Continue";
   * Build and Output Settings and Environment Variables: leave them as they are.

   Then click "Deploy" and wait for the build (a few minutes).
5. **Set Node.js 22.**
   * In the project, go to Settings → Build and Deployment → Node.js Version, choose 22.x, and click "Save".
   * Then go to Deployments, open the newest one, click "…" → "Redeploy", and confirm.
6. **Check the address and who can see it.**
   * In Settings → Domains, the production domain should be `literotica-data.vercel.app`. If it is something else,
     click "Edit" next to it, type `literotica-data.vercel.app`, and save. If that name is taken, tell Claude Code.
   * In Settings → Deployment Protection, leave "Vercel Authentication" on with "Standard Protection". That keeps
     previews private and the production address public. Don't choose "All Deployments".
7. **Check it yourself.** Open https://literotica-data.vercel.app in a private browser window. If it loads, send the
   address to Claude Code.
8. **Approve the push.** When Claude Code asks to merge `deploy-vercel` into `main` and push it, say yes. Vercel then
   deploys the site again with the canonical link.
9. **Optional: delete the DuckDNS name.** Log in at https://www.duckdns.org and delete `literotica-data`, since it
   isn't used.

From then on, the site updates whenever `main` is pushed to GitHub. A merged data update, for example, appears on
the live site within a few minutes.
