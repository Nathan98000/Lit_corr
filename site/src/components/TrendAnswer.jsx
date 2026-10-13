import { bandPalette } from "../lib/genreLayout.js";
import {
  genreWords,
  nothingToDraw,
  numbersLine,
  pathLine,
  trendCells,
  trendFormat,
  trendHeading,
  trendMixGroups,
  trendQuestionText,
  whatItMeasures,
  trendsFileName,
  tooFewHeading,
} from "../lib/trends.js";
import { toHash } from "../lib/urlState.js";
import DownloadPng from "./DownloadPng.jsx";
import TrendChart, { TrendSplit } from "./TrendChart.jsx";
import TrendMix from "./TrendMix.jsx";
import WayAcross from "./WayAcross.jsx";

export const HOW_DECIDED = toHash("methodology", { section: "trends" });

const plainClick = (e) => !(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);

/**
 * A link to the other view: a row's to its chart over time (View 1), for its characteristic, genre and option; View
 * 1's "See all changes →" to what changed in its genre and option. A new history entry, focus on the question.
 */
export function ChartLink({ to, onNavigate, className, label, children }) {
  return (
    <a
      className={className}
      href={toHash("trends", to)}
      aria-label={label}
      onClick={(e) => {
        if (!plainClick(e)) return;
        e.preventDefault();
        onNavigate(to, { focus: true });
      }}
    >
      {children}
    </a>
  );
}

/**
 * The chart's key: only what the chart shows (§3), with the link to how a change is decided. Numbers: "Median and
 * interquartile range", a dot inside a capsule; yes/no: "Share of stories", a dot on a short line (so the split chart's
 * two dots differ in the key as they do in the chart); mostly zero: both; named groups and bands: every group's swatch
 * (`groups`: [{ label, cls }], "Other (…)" among them), above the chart since a column is too narrow for names; when a
 * period has fewer than SMALL_N stories, "Fewer than 30 stories (*)", the table's asterisk, with the marks it draws
 * (a hollow dot, a hatched capsule or column); the brackets of the periods compared, "the oldest and the newest", and
 * for the forms that draw them gray, the periods between: "shown but not compared" (fresh eyes: gray reads "no clear
 * change" in "All changes", and why those periods don't count wasn't on the screen).
 */
export function TrendLegend({ kind, anySmall, minStories, groups = null }) {
  const share = (
    <li>
      <span className="key key-share" aria-hidden="true" /> Share of stories
    </li>
  );
  const range = (
    <li>
      <span className="key key-range" aria-hidden="true" /> Median and interquartile range
    </li>
  );
  const bands = kind === "band" ? ` bands-${bandPalette(groups.length)}` : "";
  return (
    <ul className={`legend trend-legend${bands}`}>
      {kind === "bin" && share}
      {kind === "num" && range}
      {kind === "zero" && (
        <>
          {share}
          {range}
        </>
      )}
      {groups?.map((g) => (
        <li key={g.label}>
          <span className={`key key-swatch ${g.cls}`} aria-hidden="true" /> {g.label}
        </li>
      ))}
      {anySmall && (
        <li>
          {(kind === "bin" || kind === "zero") && <span className="key key-small-dot" aria-hidden="true" />}
          {kind !== "bin" && <span className="key key-small" aria-hidden="true" />} Fewer than {minStories} stories (*)
        </li>
      )}
      <li className="legend-text">
        <span className="key key-bracket" aria-hidden="true" />{" "}
        <span>
          The periods compared, the oldest and the newest (<a href={HOW_DECIDED}>how this is decided</a>)
        </span>
      </li>
      {/* gray here means "not compared" (in "All changes" a gray dot means "no clear change"); named groups and bands keep
          their colors there, so only the label under the chart says it */}
      {(kind === "num" || kind === "bin" || kind === "zero") && (
        <li>
          <span className={`key key-mid ${kind === "bin" ? "key-share" : "key-range"}`} aria-hidden="true" /> The periods between them,
          shown but not compared
        </li>
      )}
    </ul>
  );
}

/**
 * What "Download image" draws (section 6): the question as the title; the heading, then the genre and the option, as the
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
 * One characteristic over time (View 1, section 3): the verdict heading, what the characteristic measures (meta's
 * description), the takeaway (the windows' numbers; what happened in between, when a period outside the windows lies
 * beyond both), the key, the chart, the way across to the other pages (round 4's I15: "By genre →", "With popularity
 * →" with this genre and the measure last used on Explore, `lastExplore`) and the actions: "See all changes →" (what
 * changed in the same genre and option, a new history entry) and "Download image".
 * A genre with fewer than MIN_N stories in every period gets the too-few sentence and a way out: all stories when an
 * option is on, else All genres.
 */
export default function TrendAnswer({ meta, state, file, busy, onSwitch, onNavigate, lastExplore, headingRef }) {
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
  const numbers = numbersLine({ variable, entry, file, fmt, smallN });
  const path = pathLine({ entry, file, fmt, smallN });
  const kind = entry.k;
  const cells = trendCells(entry, file.g === "all", smallN);
  // hatched: a period under SMALL_N stories (or, among a mostly-zero characteristic's stories with any, under SMALL_N)
  const anySmall = cells.some((c) => c && (c.small || (kind === "zero" && c.median != null && c.any < smallN)));
  const mixed = kind === "grp" || kind === "band";
  const groups = mixed ? trendMixGroups(kind, cells, variable.bins.labels, entry.t && entry.t.slice(1)) : null;
  const Chart = kind === "zero" ? TrendSplit : mixed ? TrendMix : TrendChart;
  const image = (panel) => trendsImage({ variable, genre, heading, subset, state }, panel);
  const question = trendQuestionText(variable, genre);

  return (
    <article className={`chart-panel trend-answer with-chart${busy ? " is-busy" : ""}`} aria-busy={busy}>
      <header className="chart-head">
        <h2 className="chart-title" ref={headingRef} tabIndex={-1}>
          {heading}
        </h2>
      </header>
      {/* what the characteristic measures (meta's description, as Explore gives it): a row of "All changes" leads here */}
      {whatItMeasures(variable) && <p className="trend-what">{whatItMeasures(variable)}</p>}
      {(numbers || path) && (
        <div className="takeaway trend-takeaway">
          {numbers && (
            <p>
              {numbers.map((seg, i) => (typeof seg === "string" ? seg : <strong key={i}>{seg.strong}</strong>))}
            </p>
          )}
          {path && <p className="trend-path">{path}</p>}
        </div>
      )}
      <TrendLegend kind={kind} anySmall={anySmall} minStories={file.rule.min_n} groups={groups} />
      {/* the chart and the way across under it, in the chart's cell beside the rail on wide screens */}
      <div className="trend-chart-cell">
        <Chart key={variable.id} meta={meta} variable={variable} entry={entry} file={file} title={`${question} ${heading}`} />
        <WayAcross meta={meta} page="trends" variable={variable} genre={file.g} sub={file.s} metric={lastExplore?.metric} />
      </div>
      <div className="chart-actions">
        {/* the name starts with the visible words (label in name), then the genre */}
        <ChartLink
          className="btn primary"
          to={{ view: "changes", genre: file.g, sub: file.s }}
          onNavigate={onNavigate}
          label={`See all changes in ${genreWords(genre)}`}
        >
          See all changes →
        </ChartLink>
        <DownloadPng busy={busy} image={image} />
      </div>
    </article>
  );
}
