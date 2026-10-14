import { useEffect, useId, useRef, useState } from "react";
import { formatCount, formatDate } from "../lib/format.js";
import { scrollBehavior } from "../lib/motion.js";
import { searchCharacteristics } from "../lib/search.js";
import { defaultMetric, toHash } from "../lib/urlState.js";
import { STRENGTH, typicalSample } from "../lib/wording.js";
import "../methodology.css";
import {
  ChartKey,
  ComparisonScale,
  ExamplePassage,
  GenreSizes,
  SampleSteps,
  StrengthScale,
  TrendWindows,
} from "./HowFigures.jsx";
import useMediaQuery from "./useMediaQuery.js";

// the words for Stage 1's exclusion reasons (their codes: litcorr/build/quality.py)
const REASONS = {
  no_text: "had no story text that could be collected",
  text_too_short: "had fewer than 100 words of text",
  possibly_not_english: "did not look like English",
  missing_date: "had no publication date",
  missing_views: "had no view count",
  duplicate_of_another_story: "had the same text as another story",
};

export const SECTIONS = [
  ["data", "Where the stories come from"],
  ["popularity", "How popularity was recorded"],
  ["age", "Story age"],
  ["measures", "How the characteristics were measured"],
  ["charts", "How the charts summarize stories"],
  ["tend-to", "When a title says “tend to”"],
  ["genres", "Comparing genres"],
  ["trends", "Changes over time"],
  ["missing-data", "Missing data and excluded stories"],
  ["limits", "Limitations"],
  ["privacy", "What this site does not contain"],
  ["glossary", "Every characteristic"],
];

/** Four bullets built from the data's own numbers. */
function InShort({ meta }) {
  const { counts, source } = meta;
  const genres = meta.genres.length - 1;
  return (
    <aside className="in-short" aria-labelledby="in-short-title">
      <h2 id="in-short-title">In short</h2>
      <ul>
        <li>
          A random sample: about {formatCount(typicalSample(meta))} stories in each of {genres} genres, collected{" "}
          {formatDate(source.collected_from)} to {formatDate(source.collected_to)}; {formatCount(counts.included)} are
          used in the charts.
        </li>
        <li>Popularity is one snapshot per story: the views, favorites, comments and ratings its page showed then.</li>
        <li>Characteristics are counts and simple rules, such as words per sentence or words from a list; no AI.</li>
        <li>
          Each group of stories is summarized by its median and interquartile range; groups of fewer than {meta.min_n}{" "}
          stories are hidden.
        </li>
      </ul>
    </aside>
  );
}

const pct = (share) => `${Math.round(share * 1000) / 10}%`;

/**
 * "Comparing genres": the Genres page's rule (meta.genre_rule) in plain words, one kind of characteristic to a bullet,
 * and the One genre view's row as a picture. The numbers come from the data: the genres' typical sample, the largest
 * genre's share of all genres, the rule's thresholds and level, and the stories a genre needs.
 */
function ComparingGenres({ meta }) {
  const rule = meta.genre_rule || { min_r: 0.2, level: 0.999, min_tvd: 0.2, min_n: meta.small_n };
  const times = Math.round(50 * (1 + rule.min_r));
  // the largest genre's share of all genres, from the genres' sizes on Literotica (F74)
  const genres = meta.genres.filter((g) => g.id !== "all" && g.size);
  const total = genres.reduce((sum, g) => sum + g.size, 0);
  const top = genres.reduce((best, g) => (!best || g.size > best.size ? g : best), null);
  const largest = top && total ? { name: top.name, share: Math.round((100 * top.size) / total) } : null;
  return (
    <>
      <h2 id="genres" tabIndex={-1}>
        Comparing genres
      </h2>
      <p>The Genres page compares each genre’s stories with the stories of all genres.</p>
      <ul>
        <li>
          All genres counts each genre by its size on Literotica, as everywhere on this site.
          {largest && (
            <>
              {" "}
              It includes each genre’s own stories; the largest genre, {largest.name}, is about {largest.share}% of it.
            </>
          )}
        </li>
        <li>Each genre is a random sample of about {formatCount(typicalSample(meta))} stories.</li>
      </ul>
      <p>A genre clearly differs on a characteristic when:</p>
      <ul>
        <li>
          <strong>for a characteristic measured in numbers</strong>, such as word count: picking one of its stories and
          one story from all genres at random, its story is the higher one at least {times} times in 100, or the lower
          one at least {times} times in 100 (ties count as half; this is a rank-biserial correlation of at least{" "}
          {rule.min_r});
        </li>
        <li>
          <strong>for a yes/no characteristic</strong>: a gap of at least {Math.round(rule.min_r * 100)} percentage
          points;
        </li>
        <li>
          <strong>for named groups</strong>, such as narrative perspective: at least {Math.round(rule.min_tvd * 100)}% of
          the genre’s stories would have to change group to match the mix of all genres;
        </li>
        <li>
          <strong>and in every case</strong>, the difference is clear at the {pct(rule.level)} level (stricter than the
          99% used for “tend to”: the page makes thousands of such comparisons), and the genre has at least{" "}
          {rule.min_n} stories with the characteristic.
        </li>
      </ul>
      <ComparisonScale rule={rule} />
      <ul>
        <li>
          The comparison uses every story, not only the medians, so a genre can clearly differ while its median is close
          to that of all genres, or the reverse.
        </li>
        <li>The lists above a chart name the genres in order of the size of their difference, largest first.</li>
        <li>
          When most stories score 0 on a characteristic, the page shows how many stories have any, and the median and
          interquartile range among them.
        </li>
        <li>
          Publication month and weekday are left out: their twelve and seven groups can’t be compared genre by genre in
          one chart.
        </li>
      </ul>
    </>
  );
}

/** "2000–04"; "1998–2003" across a century; a word joiner keeps the range on one line. */
const yearsLabel = ([a, b]) => `${a}–\u2060${Math.floor(a / 100) === Math.floor(b / 100) ? String(b).slice(-2) : b}`;

/**
 * "Changes over time": the Trends page's periods, windows and rule (meta.trend), in plain words, with the periods and
 * the two windows as a picture. The years, the thresholds, the level and the stories each window needs come from the
 * data, and the end of the collection from meta.source; the tag counts describe the handoff (rechecked against it: a
 * median of 10 tags in 2000–04, 4 in 2005–09).
 */
function ChangesOverTime({ meta }) {
  const t = meta.trend;
  if (!t) return null;
  const { rule } = t;
  const times = Math.round(50 * (1 + rule.min_r));
  const last = t.periods[t.periods.length - 1];
  const end = new Date(`${meta.source.collected_to.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const periods = `${t.periods.slice(0, -1).map(yearsLabel).join(", ")}, and ${last[0]} to the end of the collection (${end})`;
  const then = `${t.then[0]}–\u2060${t.then[1]}`;
  return (
    <>
      <h2 id="trends" tabIndex={-1}>
        Changes over time
      </h2>
      <p>The Trends page groups stories by the year they were published: {periods}.</p>
      <TrendWindows trend={t} />
      <ul>
        <li>
          For each period it shows the median and the interquartile range, or the share of stories, with All genres
          counting each genre by its size on Literotica, as everywhere on this site.
        </li>
        <li>
          It compares two windows, the stories published {then} and those published {t.now[0]} or later: the oldest and
          the newest, each pooling several years, so that no thin year can swing the verdict. The periods between are
          drawn but not compared, so a characteristic that dipped and came back reads “No clear change”; the chart shows
          the whole shape.
        </li>
        <li>
          A characteristic clearly changed when, picking one story published in {t.now[0]} or later and one published{" "}
          {then} at random, the newer story would be the higher one at least {times} times in 100, or the lower one at
          least {times} times in 100 (ties count as half), clear at the {pct(rule.level)} level, with at least{" "}
          {rule.min_n} stories on each side. That is the Genres page’s rule. For yes/no characteristics it means a change
          of at least {Math.round(rule.min_r * 100)} percentage points; for characteristics with named groups, at least{" "}
          {Math.round(rule.min_tvd * 100)}% of the newer stories would have to change group to match the mix of {then}.
        </li>
      </ul>
      <p className="how-label">Keep in mind</p>
      <ul>
        <li>
          The stories are the ones still on Literotica when they were collected, in today’s categories: stories removed
          from the site are not in the sample.
        </li>
        <li>
          Two characteristics are not on this page: the number of tags, which jumps between stories published before
          2005 (a median of 10) and after (4), and the author’s number of stories, which was counted when the stories
          were collected, not when they were published.
        </li>
      </ul>
    </>
  );
}

/**
 * The glossary by topic, each topic folded until opened (its name, count and blurb; inside, every characteristic with
 * its definition: the owner, 2026-10-13), and a filter box that uses the picker's search.
 */
function Glossary({ meta }) {
  const [query, setQuery] = useState("");
  const byId = new Map(meta.variables.map((v) => [v.id, v]));
  const results = query.trim() ? searchCharacteristics(meta, query) : null;
  const chart = (v) => toHash("explore", { genre: "all", metric: defaultMetric(meta), v: v.id, sub: "all" });
  const entry = (v) => (
    <div key={v.id}>
      <dt>{v.label}</dt>
      <dd>
        {v.description}
        {v.caveat ? <span className="caveat"> {v.caveat}</span> : null} <a href={chart(v)}>See the chart</a>
      </dd>
    </div>
  );
  return (
    <>
      <label className="glossary-filter">
        <span>Find a characteristic</span>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. tense, dialog, explicit" />
      </label>
      {results ? (
        <>
          <p className="muted" role="status">
            {results.length} {results.length === 1 ? "match" : "matches"}
          </p>
          <dl className="glossary">{results.map((r) => entry(r.variable))}</dl>
        </>
      ) : (
        meta.topics.map((t) => (
          <details key={t.id} className="glossary-group">
            <summary>
              {t.label} <span className="muted">({t.ids.length})</span>
              <span className="glossary-blurb">{t.blurb}</span>
            </summary>
            <dl className="glossary">{t.ids.map((id) => entry(byId.get(id)))}</dl>
          </details>
        ))
      )}
    </>
  );
}

/**
 * Scroll a section's heading to the top (below the section bar, by its scroll margin) and move focus to it. A long
 * smooth scroll can stop a little short (Chrome stops 14 px short of a heading more than about 10,000 px away, as the
 * last sections are on a phone): once it has ended, a heading that stopped within a few lines of its place is put there
 * at once. A heading further away was moved by the visitor's own scrolling, and stays where they left it.
 */
function jumpTo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const behavior = scrollBehavior();
  el.scrollIntoView?.({ behavior, block: "start" });
  el.focus?.({ preventScroll: true });
  // how far the heading is from its place (the scroll hasn't moved yet: a smooth scroll starts on the next frame)
  const off = () => el.getBoundingClientRect().top - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
  if (behavior !== "smooth" || !("onscrollend" in window) || Math.abs(off()) <= 1) return;
  const settle = () => {
    if (Math.abs(off()) > 1 && Math.abs(off()) <= 40) el.scrollIntoView({ block: "start" });
  };
  window.addEventListener("scrollend", settle, { once: true });
  setTimeout(() => window.removeEventListener("scrollend", settle), 3000);
}

/**
 * The section being read: the last section heading that has crossed a line 60 px from the top of the screen (null
 * above the first). An IntersectionObserver on the headings says when one crosses; their positions say which.
 */
function useCurrentSection() {
  const [current, setCurrent] = useState(null);
  useEffect(() => {
    const headings = SECTIONS.map(([id]) => document.getElementById(id)).filter(Boolean);
    if (!headings.length || typeof IntersectionObserver === "undefined") return undefined;
    const update = () => {
      let last = null;
      for (const h of headings) if (h.getBoundingClientRect().top <= 60) last = h.id;
      setCurrent(last);
    };
    const io = new IntersectionObserver(update, { rootMargin: "-60px 0px 0px 0px", threshold: [0, 1] });
    headings.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, []);
  return current;
}

/** The sections as links; the one being read is marked. */
function ContentsList({ current, onPick }) {
  return (
    <ol>
      {SECTIONS.map(([id, title, sub]) => {
        const href = toHash("methodology", { section: id });
        return (
          <li key={id} className={sub ? "sub" : undefined}>
            <a
              href={href}
              aria-current={current === id ? "location" : undefined}
              onClick={(e) => {
                onPick?.();
                // the address already names this section: no hash change will come, so go there now
                if (window.location.hash === href) {
                  e.preventDefault();
                  jumpTo(id);
                }
              }}
            >
              {title}
            </a>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * How it works on narrow screens (concept H3 of the second review): a 44 px bar under the masthead that sticks to the
 * top of the screen, naming the section being read ("How it works › Story age"; at the page's top, before any
 * section, "How it works" alone: round 4's F109), with a "Contents" button that opens the sections under it.
 * Escape, the button again or a tap outside close the panel and give focus back to the button.
 */
function SectionBar({ current }) {
  const [open, setOpen] = useState(false);
  const bar = useRef(null);
  const button = useRef(null);
  const panelId = useId();
  const title = SECTIONS.find(([id]) => id === current)?.[1];
  useEffect(() => {
    if (!open) return undefined;
    const close = () => {
      setOpen(false);
      button.current?.focus();
    };
    const key = (e) => {
      if (e.key === "Escape") close();
    };
    const away = (e) => {
      if (bar.current?.contains(e.target)) return;
      setOpen(false);
      // after the tap has moved focus where it landed: back to the button, unless it landed on another control
      setTimeout(() => {
        const a = document.activeElement;
        if (!a || a === document.body || a.id === "main") button.current?.focus();
      }, 0);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", away);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", away);
    };
  }, [open]);
  return (
    <div className="section-bar" ref={bar}>
      <div className="section-bar-row">
        <p className="section-bar-where">
          How it works
          {title && (
            <>
              {" › "}
              <b>{title}</b>
            </>
          )}
        </p>
        <button
          ref={button}
          type="button"
          className="link-button section-bar-button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((x) => !x)}
        >
          Contents
        </button>
      </div>
      <nav id={panelId} className="section-panel" aria-label="Contents" hidden={!open}>
        <ContentsList current={current} onPick={() => setOpen(false)} />
      </nav>
    </div>
  );
}

export default function Methodology({ meta, section }) {
  const { counts, source } = meta;
  const wide = useMediaQuery("(min-width: 1000px)");
  const current = useCurrentSection();
  // #/methodology/<section>: scroll to the section and move focus to its heading
  useEffect(() => {
    if (section) jumpTo(section);
  }, [section]);
  const genres = meta.genres.filter((g) => g.id !== "all");
  const sample = formatCount(typicalSample(meta));
  const excluded = counts.sampled - counts.included;
  // the reasons, most stories first (a stable sort keeps the data's order between equal counts)
  const reasons = Object.entries(counts.excluded_reasons || {}).sort((a, b) => b[1] - a[1]);
  return (
    <>
      {/* outside the grid, so that it can stick for the whole page */}
      {!wide && <SectionBar current={current} />}
      <div className="methodology-layout">
        {wide && (
          <nav className="contents" aria-label="Contents">
            <p className="contents-title">Contents</p>
            <ContentsList current={current} />
          </nav>
        )}
        <article className="prose methodology">
        <h1>How it works</h1>
        <p className="lede">
          How the stories were chosen, what was measured, and how the charts summarize them. Written for curious
          readers, not statisticians.
        </p>

        <InShort meta={meta} />

        {/* when, what was and wasn't collected, and the random sample; not how the collector worked (the owner,
            2026-10-14) */}
        <h2 id="data" tabIndex={-1}>Where the stories come from</h2>
        <p>
          The stories were collected from Literotica between {formatDate(source.collected_from)} and{" "}
          {formatDate(source.collected_to)}.
        </p>
        <p className="how-label">What was collected</p>
        <ul>
          <li>
            About {sample} stories from each of {genres.length} of Literotica’s genres (the site itself calls them
            categories): {formatCount(counts.with_text)} stories in all.
          </li>
          <li>
            For each story, its text and these details from its page: the title, blurb, publication date and tags; the
            author’s number of stories; and its views, favorites, comments, average rating, number of ratings and
            reading-list adds. The text, titles and blurbs are not on this site.
          </li>
          <li>
            Each chapter of a long work, as one story: Literotica gives every chapter its own page and numbers.
          </li>
        </ul>
        <p className="how-label">What was not collected</p>
        <ul>
          <li>The audio, illustrated and non-English categories, since the measures need English prose.</li>
          <li>Stories removed from Literotica before the collection.</li>
          <li>Anything behind a login, and the comments themselves (only their number).</li>
        </ul>
        <p className="how-label">How the stories were picked</p>
        <p>Every story in a genre had the same chance of being picked, popular or not:</p>
        <SampleSteps meta={meta} />

        <h2 id="popularity" tabIndex={-1}>How popularity was recorded</h2>
        <p>
          Each story’s numbers are the ones its page showed when the story was collected: one snapshot per story, taken
          between {formatDate(source.stats_observed?.[0])} and {formatDate(source.stats_observed?.[1])}. The page’s own
          data also gives the number of ratings behind the average rating. The charts measure popularity four ways:
        </p>
        <ul>
          <li>
            <strong>Average rating</strong>: the star rating (1 to 5) shown on the page. Most stories score between 4 and
            5, and only some readers vote.
          </li>
          <li>
            <strong>Per 1,000 views</strong>: favorites, comments, ratings or reading-list adds divided by views. Of the
            people who opened a story, how many reacted? 80 favorites from 20,000 views are 4 favorites per 1,000 views.
            Only computed for stories with at least 100 views.
          </li>
          <li>
            <strong>Per month online</strong>: views divided by the number of months since publication (at least one
            month), so 20,000 views over 40 months are 500 views per month. A simple way to compare old and new stories,
            not a statistical correction: stories get most of their views soon after they appear.
          </li>
          <li>
            <strong>Totals so far</strong> (views, favorites, comments, number of ratings) keep growing while a story is
            online. They were rounded to three significant figures (48,763 became 48,800) before this site was built.
          </li>
        </ul>

        <h2 id="age" tabIndex={-1}>Story age</h2>
        <p>
          A story’s age is the time from its publication date to the day its numbers were recorded. Age matters a lot
          here:
        </p>
        <ul>
          <li>a 15-year-old story has had 15 years to collect views;</li>
          <li>
            newer stories tend to collect far more favorites, ratings and reading-list adds per 1,000 views than older
            ones.
          </li>
        </ul>
        <p>That is why the site:</p>
        <ul>
          <li>offers views per month alongside raw views;</li>
          <li>warns when a measure is a total that grows with time online;</li>
          <li>lets you look at stories published in the same period with “Only include”.</li>
        </ul>

        <h2 id="measures" tabIndex={-1}>How the story characteristics were measured</h2>
        <p>
          Every characteristic is a simple count or ratio that anyone could check by hand; no artificial intelligence
          or machine-learning model was used.
        </p>
        <ul>
          <li>
            <strong>Words, sentences and paragraphs</strong> are counted with plain rules. Author’s notes, disclaimers
            and headings at the start and end of a story are set aside, so that only the story itself is measured.
          </li>
          <li>
            <strong>Dialogue</strong> means words inside quotation marks; <strong>narration</strong> means everything
            else.
          </li>
          <li>
            <strong>Word lists.</strong> Most language measures count words from short, editable word lists and are
            given per 1,000 words, so long and short stories can be compared. Word lists cannot see context: “not happy”
            still counts as a happy word, and irony is invisible to them.
          </li>
        </ul>
        <ExamplePassage />
        <ul>
          <li>
            <strong>Point of view</strong> is estimated from pronouns in the narration only (characters say “I” and
            “you” in dialogue whatever the narration does):
            <ul>
              <li>plenty of I/me/my means first person;</li>
              <li>very few, or very few compared with he/she/they, means third person;</li>
              <li>“we” narration and second-person “you” narration get their own groups;</li>
              <li>stories in between are “mixed”.</li>
            </ul>
            Checked against 284 passages from 14 classic novels whose narration is known, the rule labeled 94%
            correctly and was confidently wrong 3% of the time; a hand check of stories from this collection found
            similar accuracy. It counts words; it does not understand the story.
          </li>
          <li>
            <strong>Sexual language</strong> is counted from three editable lists: anatomical terms, sexual-action terms
            and other sexual vocabulary. Everyday words with innocent meanings (head, lips, came, ride …) are left out,
            so euphemistic writing is undercounted. A “sex scene” is a stretch of about 200 words that is dense with
            sexual terms. A keyword count is not a measure of how explicit a story feels to a reader.
          </li>
          <li>
            <strong>Emotion</strong> measures count words from small, hand-checked lists (positive, negative,
            affection, anxiety, anger, sadness, excitement and arousal, shame, jealousy, humor).
          </li>
          <li>
            <strong>Psychological</strong> measures count kinds of wording: thinking and perception verbs, “filter”
            words such as noticed or felt, distancing phrases, immediacy words, hedges (maybe, perhaps, seemed) and
            certainty words (definitely, of course). These are features of the writing, not diagnoses of authors or
            characters.
          </li>
        </ul>

        <h2 id="charts" tabIndex={-1}>
          How the charts summarize stories
        </h2>
        <p>For each characteristic, stories are split into groups:</p>
        <ul>
          <li>ranges chosen so that each holds a similar share of stories (with readable round boundaries);</li>
          <li>a separate “None” group when many stories have none at all;</li>
          <li>or the natural categories (first person, third person …).</li>
        </ul>
        <p>
          For each group the charts show the median, the interquartile range and the number of stories. The mean (which
          a few very popular stories can pull up) is in each group’s details.
        </p>
        <ChartKey meta={meta} />
        <p>
          Every genre was sampled equally, but Literotica’s genres differ a lot in size. “All genres” therefore weights
          each story by the size of its genre on Literotica, so that big genres count in proportion.
        </p>
        <GenreSizes meta={meta} />
        <p>
          “Only include” narrows any chart to stories published in a period, of a given length, or above a minimum
          number of views or ratings.
        </p>

        <h2 id="tend-to" tabIndex={-1}>
          When a title says “tend to”
        </h2>
        <p>
          Titles describe a pattern (“Longer stories tend to get more favorites per 1,000 views”) only when it is clear
          in the data. All three must hold:
        </p>
        <ol>
          <li>Stories with higher values of the characteristic rank consistently higher (or lower) on popularity.</li>
          <li>
            The pattern is clear enough that chance is an unlikely explanation, even allowing for the many charts on
            this site.
          </li>
          <li>
            The medians of the lowest and highest groups differ by at least 10% (or 0.1 stars for ratings).
          </li>
        </ol>
        <p>
          Otherwise the chart says “No clear pattern” (or “Too few stories to judge a pattern” when either end has fewer
          than {meta.small_n} stories). “No clear pattern” is an answer too: the groups differ only a little, or not
          consistently. Even a clear pattern describes the medians; individual stories vary widely.
        </p>
        <p>
          Weak, moderate and strong describe how consistently popularity rises or falls across the groups, on a rank
          correlation from 0 (no consistent order) to 1 (a perfectly consistent one): weak below {STRENGTH.moderate},
          moderate from {STRENGTH.moderate} to {STRENGTH.strong}, strong {STRENGTH.strong} or more. Even a strong
          pattern leaves individual stories varying widely.
        </p>
        <StrengthScale />

        <ComparingGenres meta={meta} />
        <ChangesOverTime meta={meta} />

        <h2 id="missing-data" tabIndex={-1}>
          Missing data and excluded stories
        </h2>
        <p>
          Of the {formatCount(counts.sampled)} sampled stories, {formatCount(counts.included)} are used in the charts.
          {excluded > 0 && <> {formatCount(excluded)} {excluded === 1 ? "was" : "were"} left out:</>}
        </p>
        {excluded > 0 && (
          <ul>
            {reasons.map(([r, n]) => (
              <li key={r}>
                {formatCount(n)} {REASONS[r] || `left out (${r.replace(/_/g, " ")})`}
              </li>
            ))}
          </ul>
        )}
        <p>A characteristic can still be blank for a story that is included:</p>
        <ul>
          <li>there is no average speech length in a story without dialogue;</li>
          <li>pacing needs at least 1,000 words;</li>
          <li>some stories have no rating yet.</li>
        </ul>
        <p>
          Each chart counts only the stories that have both the characteristic and the popularity measure, and shows how
          many that is.
        </p>

        <h2 id="limits" tabIndex={-1}>Limitations</h2>
        <ul>
          <li>
            <strong>A sample.</strong> About {sample} random stories per genre, not every story on the site. Small groups
            are uncertain, which is why sample sizes are always shown.
          </li>
          <li>
            <strong>Snapshots.</strong> Views and favorites keep growing; each story’s numbers were recorded once.
          </li>
          <li>
            <strong>Unknown counting rules.</strong> How Literotica counts a view is not public.
          </li>
          <li>
            <strong>Self-selected readers.</strong> Readers who vote, comment or favorite are not typical readers, and
            the site’s own features (such as its “hot” badges) affect what gets read.
          </li>
          <li>
            <strong>Rules, not understanding.</strong> Narration, tense, dialogue and word-list measures are usually
            but not always right.
          </li>
          <li>
            <strong>Not representative.</strong> Literotica’s stories, authors and readers do not stand for erotic
            fiction, readers or human sexuality in general.
          </li>
        </ul>

        <h2 id="privacy" tabIndex={-1}>What this site does not contain</h2>
        <ul>
          <li>No story text, titles, blurbs or story addresses.</li>
          <li>No author names.</li>
          <li>No story-by-story records.</li>
        </ul>
        <p>
          The site holds only summaries of groups of at least {meta.min_n} stories (counts, medians, quartiles and
          means), computed in advance from the collected data.
        </p>

        <h2 id="glossary" tabIndex={-1}>Every characteristic</h2>
        <p>What each of the {meta.variables.length} story characteristics measures, by kind.</p>
        <Glossary meta={meta} />
        <p className="muted small">
          Data processed {formatDate(source.processed_at)} (text measures version {source.text_pipeline_version}).
          Aggregates generated {formatDate(meta.generated_at)}.
        </p>
        </article>
      </div>
    </>
  );
}
