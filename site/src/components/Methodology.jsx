import { useEffect, useId, useRef, useState } from "react";
import { formatCount, formatDate } from "../lib/format.js";
import { scrollBehavior } from "../lib/motion.js";
import { searchCharacteristics } from "../lib/search.js";
import { defaultMetric, toHash } from "../lib/urlState.js";
import { typicalSample } from "../lib/wording.js";
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
  ["point-of-view", "First person or third person?", true],
  ["explicitness", "Explicitness", true],
  ["emotion", "Emotion and psychological language", true],
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
  const perGenre = Math.round(counts.sampled / Math.max(1, genres));
  return (
    <aside className="in-short" aria-labelledby="in-short-title">
      <h2 id="in-short-title">In short</h2>
      <ul>
        <li>
          A random sample: {formatCount(perGenre)} stories in each of {genres} genres, collected{" "}
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
 * "Comparing genres": the Genres page's rule (meta.genre_rule) in plain words. The numbers come from the data: the
 * genres' typical sample, the largest genre's share of all genres, the rule's thresholds and level, and the stories a
 * genre needs.
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
      <p>
        The Genres page compares each genre’s stories with the stories of all genres. All genres counts each genre by
        its size on Literotica, as everywhere on this site. Each genre is a random sample of about{" "}
        {formatCount(typicalSample(meta))} stories.
        {largest && (
          <>
            {" "}
            All genres includes each genre’s own stories; the largest genre, {largest.name}, is about {largest.share}% of
            it.
          </>
        )}
      </p>
      <p>
        A genre clearly differs on a characteristic when, picking one of its stories and one story from all genres at
        random, its story is the higher one at least {times} times in 100, or the lower one at least {times} times in
        100 (ties count as half; this is a rank-biserial correlation of at least {rule.min_r}). For yes/no
        characteristics this means a gap of at least {Math.round(rule.min_r * 100)} percentage points. For
        characteristics with named groups, such as narrative perspective, at least {Math.round(rule.min_tvd * 100)}% of
        the genre’s stories would have to change group to match the mix of all genres. The page makes thousands of
        such comparisons, so a difference must also be clear at the {pct(rule.level)} level, stricter than the 99% used
        for “tend to”, and the genre needs at least {rule.min_n} stories with the characteristic. The comparison uses
        every story, not only the medians, so a genre can clearly differ while its median is close to that of all
        genres, or the reverse. The lists above a chart name the genres in order of the size of their difference,
        largest first.
      </p>
      <p>
        When most stories score 0 on a characteristic, the page shows how many stories have any, and the median and
        interquartile range among them. Publication month and weekday are left out: their twelve and seven groups
        can’t be compared genre by genre in one chart.
      </p>
    </>
  );
}

/** "2000–04"; "1998–2003" across a century; a word joiner keeps the range on one line. */
const yearsLabel = ([a, b]) => `${a}–\u2060${Math.floor(a / 100) === Math.floor(b / 100) ? String(b).slice(-2) : b}`;

/**
 * "Changes over time": the Trends page's periods, windows and rule (meta.trend), in plain words. The years, the
 * thresholds, the level and the stories each window needs come from the data, and the end of the collection from
 * meta.source; the tag counts describe the handoff (rechecked against it: a median of 10 tags in 2000–04, 4 in 2005–09).
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
      <p>
        The Trends page groups stories by the year they were published: {periods}. For each period it shows the median
        and the interquartile range, or the share of stories, with All genres counting each genre by its size on
        Literotica, as everywhere on this site.
      </p>
      <p>
        It compares two windows, the stories published {then} and those published {t.now[0]} or later: the oldest and
        the newest, each pooling several years, so that no thin year can swing the verdict. The periods between are drawn
        but not compared, so a characteristic that dipped and came back reads “No clear change”; the chart shows the
        whole shape.
      </p>
      <p>
        A characteristic clearly changed when, picking one story published in {t.now[0]} or later and one published{" "}
        {then} at random, the newer story would be the higher one at least {times} times in 100, or the lower one at
        least {times} times in 100 (ties count as half), clear at the {pct(rule.level)} level, with at least {rule.min_n}{" "}
        stories on each side. That is the Genres page’s rule. For yes/no characteristics it means a change of at least{" "}
        {Math.round(rule.min_r * 100)} percentage points; for characteristics with named groups, at least{" "}
        {Math.round(rule.min_tvd * 100)}% of the newer stories would have to change group to match the mix of {then}.
      </p>
      <p>
        The stories are the ones still on Literotica when they were collected, in today’s categories: stories removed
        from the site are not in the sample. Two characteristics are not on this page: the number of tags, which jumps
        between stories published before 2005 (a median of 10) and after (4), and the author’s number of stories, which
        was counted when the stories were collected, not when they were published.
      </p>
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

/** Scroll a section's heading to the top (below the section bar, by its scroll margin) and move focus to it. */
function jumpTo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView?.({ behavior: scrollBehavior(), block: "start" });
  el.focus?.({ preventScroll: true });
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
 * top of the screen, naming the section being read ("How it works › Explicitness"; at the page's top, before any
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
  const excluded = counts.sampled - counts.included;
  const reasons = Object.entries(counts.excluded_reasons || {});
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

        <h2 id="data" tabIndex={-1}>Where the stories come from</h2>
        <p>
          The stories were collected from Literotica’s public pages between {formatDate(source.collected_from)} and{" "}
          {formatDate(source.collected_to)}, by a slow collector that read one page at a time, at least eight seconds
          apart, followed the site’s robots.txt rules and stopped whenever the site signaled it should. It read only
          pages that anyone can open without logging in: the list of categories, category listing pages, and story
          pages. It never used search, accounts, comments or voting.
        </p>
        <p>
          Literotica holds far more stories than could be read politely, so this site uses a <strong>sample</strong>.
          For each of {genres.length} of Literotica’s genres (the site itself calls them categories), the collector read an evenly spread
          selection of the category’s alphabetical listing pages, which list every story whatever its popularity,
          and then picked 300 stories at random from them. The audio, illustrated and non-English categories were
          left out, since the measures need English prose. When a sampled story could not be collected (it had
          been removed, or the site kept returning an error for it), the next story in that category’s random order
          took its place, so every genre has its full sample. In all, {formatCount(counts.with_text)} stories were
          collected with their text.
        </p>
        <p>
          A story is identified by its address on the site, which avoids counting the same story twice. Literotica
          publishes long works as separate chapters, each with its own page and statistics, so here each chapter
          counts as one story, exactly as on the site.
        </p>

        <h2 id="popularity" tabIndex={-1}>How popularity was recorded</h2>
        <p>
          Each story’s views, favorites, comments, ratings and reading-list adds are the numbers the story page showed
          when the story was collected (one snapshot per story, taken between {formatDate(source.stats_observed?.[0])}{" "}
          and {formatDate(source.stats_observed?.[1])}). The page’s own data also gives the number of ratings behind
          the average rating. Totals were rounded to three significant figures before this site was built.
        </p>
        <ul>
          <li>
            <strong>Totals so far</strong> (views, favorites, comments, number of ratings) keep growing while a story
            is online.
          </li>
          <li>
            <strong>Per 1,000 views</strong>: favorites, comments, ratings or reading-list adds divided by views. Of the
            people who opened a story, how many reacted? Only computed for stories with at least 100 views.
          </li>
          <li>
            <strong>Per month online</strong>: views divided by the number of months since publication (at least one
            month). A simple way to compare old and new stories, not a statistical correction: stories get most of
            their views soon after they appear.
          </li>
          <li>
            <strong>Average rating</strong>: the star rating (1 to 5) shown on the page. Most stories score between 4
            and 5, and only some readers vote.
          </li>
        </ul>

        <h2 id="age" tabIndex={-1}>Story age</h2>
        <p>
          A story’s age is the time from its publication date to the day its numbers were recorded. Age matters a lot
          here: a 15-year-old story has had 15 years to collect views, and newer stories tend to collect far more
          favorites, ratings and reading-list adds per 1,000 views than older ones. That is why the site offers views
          per month alongside raw views, warns when a measure is a total that grows with time online, and lets you
          look at stories published in the same period with “Only include”.
        </p>

        <h2 id="measures" tabIndex={-1}>How the story characteristics were measured</h2>
        <p>
          Every characteristic is a simple count or ratio that anyone could check by hand; no artificial intelligence
          or machine-learning model was used. Words, sentences and paragraphs are counted with plain rules; author’s
          notes, disclaimers and headings at the start and end of a story are set aside so that only the story itself
          is measured. Dialogue means words inside quotation marks; narration means everything else. Most language
          measures count words from short, editable word lists and are given per 1,000 words, so long and short
          stories can be compared. Word lists cannot see context: “not happy” still counts as a happy word, and irony
          is invisible to them.
        </p>
        <h3 id="point-of-view" tabIndex={-1}>
          First person or third person?
        </h3>
        <p>
          Point of view is estimated from pronouns in the narration only (characters say “I” and “you” in dialogue
          whatever the narration does). Plenty of I/me/my means first person; very few, or very few compared with
          he/she/they, means third person; “we” narration and second-person “you” narration get their own groups, and
          stories in between are “mixed”. Checked against 284 passages from 14 classic novels whose narration is
          known, the rule labeled 94% correctly and was confidently wrong 3% of the time; a hand check of stories
          from this collection found similar accuracy. It counts words; it does not understand the story.
        </p>
        <h3 id="explicitness" tabIndex={-1}>
          Explicitness
        </h3>
        <p>
          Sexual language is counted from three editable lists: anatomical terms, sexual-action terms and other sexual
          vocabulary. Everyday words with innocent meanings (head, lips, came, ride …) are left out, so euphemistic
          writing is undercounted. A “sex scene” is a stretch of about 200 words that is dense with sexual terms. A
          keyword count is not a measure of how explicit a story feels to a reader.
        </p>
        <h3 id="emotion" tabIndex={-1}>
          Emotion and psychological language
        </h3>
        <p>
          Emotion measures count words from small, hand-checked lists (positive, negative, affection, anxiety, anger,
          sadness, excitement and arousal, shame, jealousy, humor). Psychological measures count kinds of wording:
          thinking and perception verbs, “filter” words such as noticed or felt, distancing phrases, immediacy words,
          hedges (maybe, perhaps, seemed) and certainty words (definitely, of course). These are features of the
          writing, not diagnoses of authors or characters.
        </p>

        <h2 id="charts" tabIndex={-1}>
          How the charts summarize stories
        </h2>
        <p>
          For each characteristic, stories are split into groups: ranges chosen so that each holds a similar share of
          stories (with readable round boundaries), a separate “None” group when many stories have none at all, or
          the natural categories (first person, third person …). For each group the charts show the median, the
          interquartile range and the number of stories. The mean (which a few very popular stories can pull up) is in
          each group’s details.
        </p>
        <p>
          Every genre was sampled equally, but Literotica’s genres differ a lot in size. “All genres” therefore
          weights each story by the size of its genre on Literotica, so that big genres count in proportion. Groups
          with fewer than {meta.min_n} stories are not shown, and groups with fewer than {meta.small_n} are drawn hatched,
          with a hollow dot: they deserve less trust. “Only include” narrows any chart to stories published in a
          period, of a given length, or above a minimum number of views or ratings.
        </p>

        <h2 id="tend-to" tabIndex={-1}>
          When a title says “tend to”
        </h2>
        <p>
          Titles describe a pattern (“Longer stories tend to get more favorites per 1,000 views”) only when it is
          clear in the data: stories with higher values of the characteristic must rank consistently higher (or
          lower) on popularity, clearly enough that chance is an unlikely explanation even allowing for the many
          charts on this site, and the medians of the lowest and highest groups must differ by at least 10% (or 0.1
          stars for ratings). Otherwise the chart says “No clear pattern” (or “Too few stories to judge a pattern” when
          either end has fewer than {meta.small_n} stories). “No clear pattern” is an answer too: the groups differ only a
          little, or not consistently. Even a clear pattern describes the medians; individual stories vary widely.
        </p>
        <p>
          Weak, moderate and strong describe how consistently popularity rises or falls across the groups, on a rank
          correlation from 0 (no consistent order) to 1 (a perfectly consistent one): weak below 0.2, moderate from 0.2
          to 0.4, strong 0.4 or more. Even a strong pattern leaves individual stories varying widely.
        </p>

        <ComparingGenres meta={meta} />
        <ChangesOverTime meta={meta} />

        <h2 id="missing-data" tabIndex={-1}>
          Missing data and excluded stories
        </h2>
        <p>
          Of the {formatCount(counts.sampled)} sampled stories, {formatCount(counts.included)} are used in the charts.
          {excluded > 0 && (
            <>
              {" "}
              {formatCount(excluded)} were left out:{" "}
              {reasons.map(([r, n], i) => (
                <span key={r}>
                  {i > 0 ? (i === reasons.length - 1 ? " and " : ", ") : ""}
                  {formatCount(n)} {REASONS[r] || `left out (${r.replace(/_/g, " ")})`}
                </span>
              ))}
              .
            </>
          )}{" "}
          A characteristic can still be blank for a story that is included: there is no average speech length in a
          story without dialogue, pacing needs at least 1,000 words, and some stories have no rating yet. Each chart
          counts only the stories that have both the characteristic and the popularity measure, and shows how many
          that is.
        </p>

        <h2 id="limits" tabIndex={-1}>Limitations</h2>
        <ul>
          <li>
            <strong>A sample.</strong> 300 random stories per genre, not every story on the site. Small groups are
            uncertain, which is why sample sizes are always shown.
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
        <p>
          No story text, titles, blurbs, story addresses, author names or story-by-story records. The site holds
          only summaries of groups of at least {meta.min_n} stories (counts, medians, quartiles and means), computed in
          advance from the collected data.
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
