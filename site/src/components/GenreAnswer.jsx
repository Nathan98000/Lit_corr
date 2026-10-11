import {
  allGenresLine,
  chartQuestionText,
  genreRows,
  nounOf,
  orderLabel,
  orderRows,
  orderWords,
  rowsHeading,
  sortableKind,
  takeawayLists,
  tooFewLine,
} from "../lib/genres.js";
import { toHash } from "../lib/urlState.js";
import { bandPalette, mixColors } from "../lib/genreLayout.js";
import CopyLink from "./CopyLink.jsx";
import GenreChart from "./GenreChart.jsx";
import GenreMix from "./GenreMix.jsx";
import GenreAny from "./GenreAny.jsx";
import Segmented from "./GenreSwitch.jsx";

export const HOW_DECIDED = toHash("methodology", { section: "genres" });

/**
 * The key of the forms: what the marks and lines mean, and the link to how a difference is decided; for named groups
 * and bands, the groups' swatches (`groups`: [{ label, cls }], a palette class of genres.css).
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
      <ul className={`legend genre-legend${kind === "band" ? ` bands-${bandPalette(groups.length)}` : ""}`}>
        {groups.map((g) => (
          <li key={g.label}>
            <span className={`key key-swatch ${g.cls}`} aria-hidden="true" /> {g.label}
          </li>
        ))}
        <li className="legend-text">
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
        <li className="legend-text">
          <span className="key key-median" aria-hidden="true" />
          <span className="key key-iqr" aria-hidden="true" /> Median and interquartile range among stories with any
        </li>
        <li className="legend-text">
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
        <li className="legend-text">
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
      <li className="legend-ref">
        <span className="key key-ref" aria-hidden="true" /> Median of all genres
      </li>
      <li className="legend-text">
        <span>
          <span aria-hidden="true">▲▼</span> Clearly higher or lower than all genres{decided}
        </span>
      </li>
      {small}
    </ul>
  );
}

/**
 * What order the rows are in, on a line of its own between the legend and the chart (F75), with the A–Z / By …
 * toggle at its right for the forms that can be put in order (D3).
 */
function OrderLine({ kind, sort, onSort }) {
  return (
    <div className="order-line">
      <p className="order-words">{orderWords(kind, sort)}</p>
      {sortableKind(kind) && (
        <Segmented
          label="Order"
          className="order-switch compact"
          options={[
            ["az", "A–Z"],
            ["value", orderLabel(kind)],
          ]}
          value={sort === "value" ? "value" : "az"}
          onChange={onSort}
        />
      )}
    </div>
  );
}

/**
 * One characteristic in every genre (View 1): the verdict heading, the takeaway (▲/▼ lists in the D10 words, then
 * All genres, then the genres with too few stories to compare), the legend, the line that says the order (with the
 * toggle), the chart for the characteristic's form and the actions.
 */
export default function GenreAnswer({ meta, state, file, busy, onChange, onNavigate, lastExplore, headingRef }) {
  const variable = meta.variables.find((v) => v.id === state.v);
  const entry = file.c[state.v];
  const kind = entry.k;
  const rows = genreRows(meta, file, state.v);
  const ordered = orderRows(rows, kind, state.sort);
  const heading = rowsHeading(rows);
  const lists = takeawayLists(rows, variable, kind);
  const allLine = allGenresLine(rows, variable, entry);
  const tooFew = tooFewLine(rows, meta.min_n);
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
  const Chart = kind === "zero" ? GenreAny : kind === "grp" || kind === "band" ? GenreMix : GenreChart;
  const groups =
    kind === "grp" || kind === "band"
      ? mixColors(kind, rows[0].stats?.shares || variable.bins.labels.map(() => 0)).map((c, b) => ({
          label: variable.bins.labels[b],
          cls: c.cls,
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
      <GenreLegend kind={kind} anySmall={anySmall} smallN={meta.small_n} groups={groups} />
      <OrderLine kind={kind} sort={state.sort} onSort={(o) => onChange({ ...state, sort: o === "value" ? "value" : undefined })} />
      <Chart key={`${variable.id}/${file.s}`} {...chartProps} />
      <div className="chart-actions">
        <CopyLink />
        {/* the name starts with the visible words (label in name), then the noun as the question has it (F76) */}
        <a className="btn primary" href={explore} aria-label={`Open in Explore: ${nounOf(variable)}`}>
          Open in Explore →
        </a>
      </div>
    </article>
  );
}
