import { formatCount, formatDate } from "../lib/format.js";

const REASONS = {
  no_text: "no story text could be collected",
  text_too_short: "it had fewer than 100 words of text",
  possibly_not_english: "the text did not look like English",
  missing_date: "it had no publication date",
  missing_views: "it had no view count",
  duplicate_text: "it had the same text as another story",
};

function Glossary({ meta }) {
  return meta.groups.map((g) => {
    const vars = meta.variables.filter((v) => v.group === g.id);
    if (!vars.length) return null;
    return (
      <details key={g.id} className="glossary-group">
        <summary>
          {g.label} <span className="muted">({vars.length})</span>
        </summary>
        <dl className="glossary">
          {vars.map((v) => (
            <div key={v.id}>
              <dt>{v.label}</dt>
              <dd>
                {v.description}
                {v.caveat ? <span className="caveat"> {v.caveat}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    );
  });
}

export default function Methodology({ meta }) {
  const { counts, source } = meta;
  const genres = meta.genres.filter((g) => g.id !== "all");
  const excluded = counts.sampled - counts.included;
  const reasons = Object.entries(counts.excluded_reasons || {});
  return (
    <article className="prose methodology">
      <h1>Methodology</h1>
      <p className="lede">
        How the stories were chosen, what was measured, and how the charts summarise them. Written for curious
        readers, not statisticians.
      </p>

      <aside className="callout">
        The visualizations show descriptive associations in stories on Literotica. They do not establish causation,
        and the stories and users represented on Literotica should not be assumed to represent all erotic fiction,
        readers, or human sexuality.
      </aside>

      <h2 id="data">Where the stories come from</h2>
      <p>
        The stories were collected from Literotica’s public pages between {formatDate(source.collected_from)} and{" "}
        {formatDate(source.collected_to)}, by a slow collector that read one page at a time, at least eight seconds
        apart, followed the site’s robots.txt rules and stopped whenever the site signalled it should. It read only
        pages that anyone can open without logging in: the list of categories, category listing pages, and story
        pages. It never used search, accounts, comments or voting.
      </p>
      <p>
        Literotica holds far more stories than could be read politely, so this site uses a <strong>sample</strong>.
        For each of {genres.length} of Literotica’s own categories (genres), the collector read an evenly spread
        selection of the category’s alphabetical listing pages, which list every story whatever its popularity,
        and then picked 300 stories at random from them. The audio, illustrated and non-English categories were
        left out because the measures need English prose. When a sampled story could not be collected (it had
        been removed, or the site kept returning an error for it), the next story in that category’s random order
        took its place, so every genre has its full sample. In all, {formatCount(counts.with_text)} stories were
        collected with their text.
      </p>
      <p>
        A story is identified by its address on the site, which avoids counting the same story twice. Literotica
        publishes long works as separate chapters, each with its own page and statistics, so here each chapter
        counts as one story, exactly as on the site.
      </p>

      <h2 id="popularity">How popularity was recorded</h2>
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

      <h2 id="age">Story age</h2>
      <p>
        A story’s age is the time from its publication date to the day its numbers were recorded. Age matters a lot
        here: a 15-year-old story has had 15 years to collect views, and newer stories tend to collect far more
        favorites, ratings and reading-list adds per 1,000 views than older ones. That is why the site offers views
        per month alongside raw views, shows each group’s typical age, warns when the groups being compared differ
        in age, and lets you look at stories published in the same period.
      </p>

      <h2 id="measures">How the story characteristics were measured</h2>
      <p>
        Every characteristic is a simple count or ratio that anyone could check by hand; no artificial intelligence
        or machine-learning model was used. Words, sentences and paragraphs are counted with plain rules; author’s
        notes, disclaimers and headings at the start and end of a story are set aside so that only the story itself
        is measured. Dialogue means words inside quotation marks; narration means everything else. Most language
        measures count words from short, editable word lists and are given per 1,000 words, so long and short
        stories can be compared. Word lists cannot see context: “not happy” still counts as a happy word, and irony
        is invisible to them.
      </p>
      <h3>First person or third person?</h3>
      <p>
        Point of view is estimated from pronouns in the narration only (characters say “I” and “you” in dialogue
        whatever the narration does). Plenty of I/me/my means first person; very few, or very few compared with
        he/she/they, means third person; “we” narration and second-person “you” narration get their own groups, and
        stories in between are “mixed”. Checked against 284 passages from 14 classic novels whose narration is
        known, the rule labelled 94% correctly and was confidently wrong 3% of the time; a hand check of stories
        from this collection found similar accuracy. It counts words; it does not understand the story.
      </p>
      <h3>Explicitness</h3>
      <p>
        Sexual language is counted from three editable lists: anatomical terms, sexual-action terms and other sexual
        vocabulary. Everyday words with innocent meanings (head, lips, came, ride …) are left out, so euphemistic
        writing is undercounted. A “sex scene” is a stretch of about 200 words that is dense with sexual terms. A
        keyword count is not a measure of how explicit a story feels to a reader.
      </p>
      <h3>Emotion and psychological language</h3>
      <p>
        Emotion measures count words from small, hand-checked lists (positive, negative, affection, anxiety, anger,
        sadness, excitement and arousal, shame, jealousy, humour). Psychological measures count kinds of wording:
        thinking and perception verbs, “filter” words such as noticed or felt, distancing phrases, immediacy words,
        hedges (maybe, perhaps, seemed) and certainty words (definitely, of course). These are features of the
        writing, not diagnoses of authors or characters.
      </p>

      <h2 id="charts">How the charts summarise stories</h2>
      <p>
        For each characteristic, stories are split into groups: ranges chosen so that each holds a similar share of
        stories (with readable round boundaries), a separate “None” group when many stories have none at all, or
        the natural categories (first person, third person …). For each group the chart shows the{" "}
        <strong>median</strong> (the typical story: half score higher, half lower), the{" "}
        <strong>middle half</strong> of stories (from the 25th to the 75th percentile), the <strong>mean</strong>{" "}
        (which a few very popular stories can pull up), the number of stories, and their typical age.
      </p>
      <p>
        Every genre was sampled equally, but Literotica’s genres differ a lot in size. “All genres” therefore
        weights each story by the size of its genre on Literotica, so that big genres count in proportion. Groups
        with fewer than {meta.min_n} stories are not shown, and groups with fewer than {meta.small_n} are drawn paler.
        The “Stories included” menu narrows any chart to stories published in a period, of a given length, or above a
        minimum number of views or ratings. In “Compare genres”, each genre’s groups are compared with that genre’s
        own typical story, and genres are listed alphabetically, never ranked.
      </p>

      <h2 id="patterns">When a title says “tend to”</h2>
      <p>
        Titles describe a pattern (“Longer stories tend to get more favorites per 1,000 views”) only when it is
        clear in the data: stories with higher values of the characteristic must rank consistently higher (or
        lower) on popularity, clearly enough that chance is an unlikely explanation even allowing for the many
        charts on this site, and the typical story in the lowest and highest groups must differ by at least 10% (or
        0.1 stars for ratings). Otherwise the title is neutral (“How favorites per 1,000 views vary with …”). Even a
        clear pattern describes the typical story; individual stories vary widely.
      </p>

      <h2 id="missing">Missing data and excluded stories</h2>
      <p>
        Of the {formatCount(counts.sampled)} sampled stories, {formatCount(counts.included)} are used in the charts.
        {excluded > 0 && (
          <>
            {" "}
            {formatCount(excluded)} were left out:{" "}
            {reasons.map(([r, n], i) => (
              <span key={r}>
                {i > 0 ? (i === reasons.length - 1 ? " and " : ", ") : ""}
                {formatCount(n)} because {REASONS[r] || r.replace(/_/g, " ")}
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

      <h2 id="limits">Limitations</h2>
      <ul>
        <li>
          <strong>Descriptive only.</strong> A pattern can come from something else: the author’s experience, the
          sub-genre, the year of publication, or how the site promotes stories.
        </li>
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

      <h2 id="privacy">What this site does not contain</h2>
      <p>
        No story text, titles, descriptions, story addresses, author names or story-by-story records. The site holds
        only summaries of groups of at least {meta.min_n} stories (counts, medians, quartiles and means), computed in
        advance from the collected data.
      </p>

      <h2 id="glossary">Every characteristic</h2>
      <p>What each of the {meta.variables.length} story characteristics measures, by kind.</p>
      <Glossary meta={meta} />
      <p className="muted small">
        Data processed {formatDate(source.processed_at)} (text measures version {source.text_pipeline_version}).
        Aggregates generated {formatDate(meta.generated_at)}.
      </p>
    </article>
  );
}
