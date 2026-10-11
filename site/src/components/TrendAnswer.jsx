import { nounOf } from "../lib/genres.js";
import { mixFixedLine, nothingToDraw, numbersLine, trendCells, trendFormat, trendHeading, trendQuestionText, trendsFileName, tooFewHeading } from "../lib/trends.js";
import { toHash } from "../lib/urlState.js";
import DownloadPng from "./DownloadPng.jsx";
import TrendChart from "./TrendChart.jsx";

export const HOW_DECIDED = toHash("methodology", { section: "trends" });

/**
 * The chart's key: only what the chart shows (§3), with the link to how a change is decided. Numbers: the median and
 * the interquartile range; yes/no: the share of stories; the hatching when a period has fewer than the rule's stories;
 * the brackets of the periods compared.
 */
export function TrendLegend({ kind, anySmall, minStories }) {
  return (
    <ul className="legend trend-legend">
      {kind === "bin" ? (
        <li>
          <span className="key key-median" aria-hidden="true" /> Share of stories
        </li>
      ) : (
        <>
          <li>
            <span className="key key-median" aria-hidden="true" /> Median
          </li>
          <li>
            <span className="key key-iqr" aria-hidden="true" /> Interquartile range
          </li>
        </>
      )}
      {anySmall && (
        <li>
          <span className="key key-small" aria-hidden="true" /> Fewer than {minStories} stories
        </li>
      )}
      <li className="legend-text">
        <span className="key key-bracket" aria-hidden="true" />{" "}
        <span>
          The periods compared (<a href={HOW_DECIDED}>how this is decided</a>)
        </span>
      </li>
    </ul>
  );
}

/**
 * What "Download PNG" draws (section 6): the question as the title; the heading, then the genre and the option, as the
 * subtitle; the key (without "how this is decided"); the chart with its table and brackets.
 */
export function trendsImage({ variable, genre, heading, subset, state }, panel) {
  return {
    title: [trendQuestionText(variable, genre)],
    subtitle: [heading, `${genre.name} · ${subset.label}`],
    chart: panel?.querySelector(".trend-chart"),
    legend: panel?.querySelector(".trend-legend"),
    fileName: trendsFileName(state),
  };
}

/**
 * One characteristic over time (View 1, section 3): the verdict heading, the takeaway (the windows' numbers and, for
 * All genres, the fixed-mix line when it gives another verdict), the key, the chart and the actions ("Download PNG",
 * "Compare genres →"). A genre with fewer than MIN_N stories in every period gets the too-few sentence and a way out:
 * all stories when an option is on, else All genres.
 */
export default function TrendAnswer({ meta, state, file, busy, onSwitch, headingRef }) {
  const variable = meta.variables.find((v) => v.id === state.v);
  const entry = file.c[state.v];
  const genre = meta.genres.find((g) => g.id === file.g);
  const subset = meta.subsets.find((s) => s.id === file.s);
  const smallN = meta.small_n;

  if (nothingToDraw(entry)) {
    const all = state.sub === "all";
    return (
      <article className={`chart-panel trend-answer${busy ? " is-busy" : ""}`} aria-busy={busy}>
        <header className="chart-head">
          <h2 className="chart-title" ref={headingRef} tabIndex={-1}>
            {tooFewHeading({ entry, genre, subset, file })}
          </h2>
        </header>
        <p className="trend-too-few">
          <button type="button" className="btn" onClick={() => onSwitch(all ? { ...state, genre: "all" } : { ...state, sub: "all" })}>
            {all ? "Show All genres" : "Show all stories"}
          </button>
        </p>
      </article>
    );
  }

  const fmt = trendFormat(variable, entry, file.g === "all", smallN);
  const heading = trendHeading({ variable, entry, genre, subset, file });
  const numbers = numbersLine({ variable, entry, genre, file, fmt, smallN });
  const mix = mixFixedLine(entry, file.g);
  const anySmall = trendCells(entry, file.g === "all", smallN).some((c) => c?.small);
  const image = (panel) => trendsImage({ variable, genre, heading, subset, state }, panel);
  const question = trendQuestionText(variable, genre);
  const drawn = entry.k === "num" || entry.k === "bin"; // named groups, bands and mostly-zero ones: next

  return (
    <article className={`chart-panel trend-answer${busy ? " is-busy" : ""}`} aria-busy={busy}>
      <header className="chart-head">
        <h2 className="chart-title" ref={headingRef} tabIndex={-1}>
          {heading}
        </h2>
      </header>
      {(numbers || mix) && (
        <div className="takeaway trend-takeaway">
          {numbers && (
            <p>
              {numbers.map((seg, i) => (typeof seg === "string" ? seg : <strong key={i}>{seg.strong}</strong>))}
            </p>
          )}
          {mix && <p className="trend-mix">{mix}</p>}
        </div>
      )}
      {drawn && <TrendLegend kind={entry.k} anySmall={anySmall} minStories={file.rule.min_n} />}
      {drawn && <TrendChart key={variable.id} meta={meta} variable={variable} entry={entry} file={file} title={`${question} ${heading}`} />}
      <div className="chart-actions">
        <DownloadPng busy={busy} image={image} />
        {/* the name starts with the visible words (label in name), then the noun as the question has it */}
        <a className="btn primary" href={toHash("genres", { v: variable.id, sub: state.sub })} aria-label={`Compare genres: ${nounOf(variable)}`}>
          Compare genres →
        </a>
      </div>
    </article>
  );
}
