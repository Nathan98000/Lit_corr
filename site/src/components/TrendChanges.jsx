import {
  changesColumns,
  changesHeading,
  changesRowName,
  changesSampleLine,
  changesTakeaway,
  changesTooFewHeading,
  changesWords,
  trendProfile,
  windowsCompared,
} from "../lib/trends.js";
import { subsetConflict } from "../lib/urlState.js";
import ComparisonProfile from "./ComparisonProfile.jsx";
import { ChartLink, HOW_DECIDED } from "./TrendAnswer.jsx";

/**
 * What changed (View 2, §4.1), the page's default: "One genre" as approved, relabeled and drawn by ComparisonProfile.
 * The heading (how many characteristics clearly changed from 2000–2009 to 2020 or later) and the sample line; the
 * takeaway ("▼ Fell", "▲ Rose", "≠ A different mix"); the lists, ordered by the size of the change; every
 * characteristic by topic. Each row compares a story from 2020 or later with one from 2000–2009 (the dot, out of 100),
 * prints the two windows' numbers in that order, and opens its chart over time. When a window has too few stories to
 * compare (Chain Stories, Transgender), the heading says so, with "Show all stories" when an option is on, else "Show
 * All genres".
 */
export default function TrendChanges({ meta, state, file, busy, onSwitch, onNavigate, headingRef }) {
  const genre = meta.genres.find((g) => g.id === file.g);
  const subset = meta.subsets.find((s) => s.id === file.s);
  const common = { className: "genre-profile trend-changes", busy, placeKey: "trendsChanges", widthKey: "trends" };

  if (!windowsCompared(file)) {
    const all = state.sub === "all";
    const header = (
      <header className="chart-head">
        <h2 className="chart-title" ref={headingRef} tabIndex={-1}>
          {changesTooFewHeading(file, genre, subset)}
        </h2>
      </header>
    );
    const button = (
      <p className="inline-actions">
        <button type="button" className="btn" onClick={() => onSwitch(all ? { ...state, genre: "all" } : { ...state, sub: "all" })}>
          {all ? "Show All genres" : "Show all stories"}
        </button>
      </p>
    );
    return <ComparisonProfile {...common} header={header} showAll={button} tooFew />;
  }

  const p = trendProfile(meta, file);
  const takeaway = changesTakeaway(p);
  const header = (
    <header className="chart-head">
      <h2 className="chart-title" ref={headingRef} tabIndex={-1}>
        {changesHeading(p.flagged.length, file)}
      </h2>
      <p className="profile-sample">{changesSampleLine(file, genre, subset)}</p>
    </header>
  );
  const top = takeaway.length > 0 && (
    <div className="takeaway profile-takeaway">
      {takeaway.map((line) => (
        <p key={line.word}>
          <span aria-hidden="true">{line.mark} </span>
          <b>{line.word}:</b> {line.items.join(", ")}.
        </p>
      ))}
    </div>
  );
  const row = {
    columns: changesColumns,
    name: (item) => changesRowName(item, file, meta.min_n),
    link: ({ item, className, children }) => {
      // a characteristic the option leaves out of View 1 (a length option and a length characteristic) opens with all stories
      const sub = subsetConflict(subset, item.variable) ? "all" : file.s;
      return (
        <ChartLink className={className} to={{ v: item.id, genre: file.g, sub }} onNavigate={onNavigate}>
          {children}
        </ChartLink>
      );
    },
  };

  return (
    <ComparisonProfile
      {...common}
      header={header}
      top={top}
      profile={p}
      rule={file.rule}
      answerKey={`${file.g}|${file.s}`}
      words={{ ...changesWords(file), decided: HOW_DECIDED }}
      row={row}
    />
  );
}
