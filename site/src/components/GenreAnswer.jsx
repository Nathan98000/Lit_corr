import { useId, useState } from "react";
import {
  ageNoteText,
  ageSpread,
  allGenresLine,
  chartQuestionText,
  genreRows,
  nounOf,
  orderRows,
  rowsHeading,
  takeawayLists,
  tooFewLine,
} from "../lib/genres.js";
import { subsetConflict, toHash } from "../lib/urlState.js";
import { mixColors } from "../lib/genreLayout.js";
import CopyLink from "./CopyLink.jsx";
import GenreChart from "./GenreChart.jsx";
import GenreMix from "./GenreMix.jsx";
import GenreSplit from "./GenreSplit.jsx";
import GenreTable from "./GenreTable.jsx";

export const HOW_DECIDED = toHash("methodology", { section: "genres" });
const RECENT = "y2020"; // "Published 2020 or later", the age notes' comparison

/**
 * The key of the forms: what the marks and lines mean, and the link to how a difference is decided; for named groups
 * and bands, the groups' swatches (`groups`: [{ label, fill }]).
 */
export function GenreLegend({ kind, anySmall, smallN, groups = null }) {
  const decided = (
    <>
      {" "}
      (<a href={HOW_DECIDED}>how this is decided</a>)
    </>
  );
  const small = anySmall && (
    <li>
      <span className="key key-small" aria-hidden="true" /> Fewer than {smallN} stories
    </li>
  );
  if (kind === "grp" || kind === "band") {
    return (
      <ul className="legend genre-legend">
        {groups.map((g) => (
          <li key={g.label}>
            <span className="key key-swatch" aria-hidden="true" style={{ background: g.fill }} /> {g.label}
          </li>
        ))}
        <li>
          <span>
            {kind === "grp" ? (
              <>
                <span aria-hidden="true">≠</span> A clearly different mix
              </>
            ) : (
              <>
                <span aria-hidden="true">▲▼</span> Clearly higher or lower than all genres
              </>
            )}
            {decided}
          </span>
        </li>
        {small}
      </ul>
    );
  }
  if (kind === "zero") {
    return (
      <ul className="legend genre-legend">
        <li>
          <span className="key key-share" aria-hidden="true" /> Share of stories above 0
        </li>
        <li>
          <span className="key key-median" aria-hidden="true" />
          <span className="key key-iqr" aria-hidden="true" /> Median and interquartile range among stories above 0
        </li>
        <li>
          <span>
            <span aria-hidden="true">▲▼</span> Clearly higher or lower than all genres{decided}
          </span>
        </li>
        {small}
      </ul>
    );
  }
  if (kind === "bin") {
    return (
      <ul className="legend genre-legend">
        <li>
          <span className="key key-share" aria-hidden="true" /> Share of stories
        </li>
        <li>
          <span className="key key-ref" aria-hidden="true" /> All genres
        </li>
        <li>
          <span>
            <span aria-hidden="true">▲▼</span> Clearly more or less common than in all genres{decided}
          </span>
        </li>
        {small}
      </ul>
    );
  }
  return (
    <ul className="legend genre-legend">
      <li>
        <span className="key key-median" aria-hidden="true" /> Median
      </li>
      <li>
        <span className="key key-iqr" aria-hidden="true" /> Interquartile range
      </li>
      <li>
        <span className="key key-ref" aria-hidden="true" /> Median of all genres
      </li>
      <li>
        <span>
          <span aria-hidden="true">▲▼</span> Clearly higher or lower than all genres{decided}
        </span>
      </li>
      {small}
    </ul>
  );
}

/** "Story age." and its one-tap comparison with stories published 2020 or later (left out where it conflicts). */
export function AgeNote({ meta, variable, text, onCompare }) {
  const recent = meta.subsets.find((s) => s.id === RECENT);
  const canCompare = recent && !(variable && subsetConflict(recent, variable));
  return (
    <div className="agebox genre-age">
      <p>
        <b>Story age.</b> {text}
      </p>
      {canCompare && (
        <button type="button" className="link-button" onClick={() => onCompare(RECENT)}>
          Compare stories published 2020 or later
        </button>
      )}
    </div>
  );
}

/**
 * One characteristic in every genre (View 1): the verdict heading, the takeaway (▲/▼ lists in the D10 words, then
 * All genres), the story-age note when the genres' median ages are 5 or more years apart (All stories only), the
 * legend, the chart for the characteristic's form, its numbers and the actions.
 */
export default function GenreAnswer({ meta, state, file, busy, onChange, onSwitch, onNavigate, lastExplore, headingRef }) {
  const [showNumbers, setShowNumbers] = useState(false);
  const numbersId = useId();
  const variable = meta.variables.find((v) => v.id === state.v);
  const entry = file.c[state.v];
  const kind = entry.k;
  const rows = genreRows(meta, file, state.v);
  const ordered = orderRows(rows, kind, state.sort);
  const heading = rowsHeading(rows);
  const lists = takeawayLists(rows, variable, kind);
  const allLine = allGenresLine(rows, variable, entry);
  const tooFew = tooFewLine(rows, meta.min_n);
  const spread = state.sub === "all" ? ageSpread(file) : null;
  const anySmall = rows.some((r) => r.small);
  const question = chartQuestionText(variable);
  const explore = toHash("explore", {
    mode: "one",
    genre: state.genre || "all",
    metric: lastExplore?.metric,
    v: variable.id,
    sub: state.sub,
  });

  const chartProps = {
    meta,
    variable,
    entry,
    rows: ordered,
    highlight: state.genre,
    sub: state.sub,
    title: `${question} ${heading}`,
    onNavigate,
  };
  const Chart = kind === "zero" ? GenreSplit : kind === "grp" || kind === "band" ? GenreMix : GenreChart;
  const groups =
    kind === "grp" || kind === "band"
      ? mixColors(kind, rows[0].stats?.shares || variable.bins.labels.map(() => 0)).map((c, b) => ({
          label: variable.bins.labels[b],
          fill: c.fill,
        }))
      : null;

  return (
    <article className={`chart-panel genre-answer${busy ? " is-busy" : ""}`} aria-busy={busy}>
      <header className="chart-head">
        <h2 className="chart-title" ref={headingRef} tabIndex={-1}>
          {heading}
        </h2>
      </header>
      {(lists.length > 0 || allLine || tooFew) && (
        <div className="takeaway genre-takeaway">
          {lists.map((l) => (
            <p key={l.mark} className="genre-list">
              <b>
                <span aria-hidden="true">{l.mark} </span>
                {l.word}:
              </b>{" "}
              {l.names.join(", ")}.
            </p>
          ))}
          {allLine && (
            <p className="all-line">
              {allLine.map((seg, i) => (typeof seg === "string" ? seg : <strong key={i}>{seg.strong}</strong>))}
            </p>
          )}
          {tooFew && <p className="too-few muted">{tooFew}</p>}
        </div>
      )}
      {spread && <AgeNote meta={meta} variable={variable} text={ageNoteText(spread)} onCompare={(sub) => onSwitch({ ...state, sub })} />}
      <GenreLegend kind={kind} anySmall={anySmall} smallN={meta.small_n} groups={groups} />
      <Chart key={`${variable.id}/${file.s}`} {...chartProps} />
      <GenreTable
        meta={meta}
        variable={variable}
        entry={entry}
        rows={ordered}
        id={numbersId}
        visible={showNumbers}
        caption={`The numbers behind the chart: ${question}`}
      />
      <div className="chart-actions">
        <button
          type="button"
          className="btn"
          aria-expanded={showNumbers}
          aria-controls={numbersId}
          onClick={() => setShowNumbers((x) => !x)}
        >
          {showNumbers ? "Hide the numbers" : "Show the numbers"}
        </button>
        <CopyLink />
        {/* the name starts with the visible words (label in name), then the noun as the question has it (F76) */}
        <a className="btn primary" href={explore} aria-label={`Open in Explore: ${nounOf(variable)}`}>
          Open in Explore →
        </a>
      </div>
    </article>
  );
}
