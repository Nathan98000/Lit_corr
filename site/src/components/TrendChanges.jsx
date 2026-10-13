import {
  changesColumns,
  changesFileName,
  changesHeading,
  changesQuestion,
  changesRowName,
  changesSampleLine,
  changesScale,
  changesTakeaway,
  changesTooFewHeading,
  changesValues,
  changesWords,
  lengthLine,
  overTimeCharacteristic,
  trendProfile,
  windowsCompared,
} from "../lib/trends.js";
import { periodLabel } from "../lib/trendLayout.js";
import { formatCount } from "../lib/format.js";
import { subsetConflict } from "../lib/urlState.js";
import ComparisonProfile from "./ComparisonProfile.jsx";
import { ChartLink } from "./TrendAnswer.jsx";

/**
 * The stories per period of a genre too few to compare (View 2's too-few state): a compact table, "fewer than 10" under
 * MIN_N (no smaller count is shown anywhere on the site).
 */
function PeriodStories({ file, minN }) {
  return (
    <table className="trend-few-table">
      <caption>Stories per period</caption>
      <thead>
        <tr>
          {file.periods.map((p) => (
            <th key={p[0]} scope="col">
              {periodLabel(p)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {file.n.map((n, i) => (
            <td key={file.periods[i][0]}>{n < minN ? `fewer than ${minN}` : formatCount(n)}</td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

/**
 * What changed (View 2, §4.1), the page's default: "One genre" as approved, relabeled and drawn by ComparisonProfile.
 * The heading (how many of the characteristics compared clearly changed from 2000–2009 to 2020 or later) and the
 * sample line; the takeaway (word count's change, "▼ Fell", "▲ Rose", "≠ A different mix"); the note; the lists,
 * ordered by the size of the change, each row's values first ("51.6 → 38.8 (−25%)") and its dot on a scale zoomed to
 * the view (changesScale); "Download image" of the lists; every characteristic by topic. Each row compares a story from
 * 2020 or later with one from 2000–2009 (the dot, out of 100) and opens its chart over time. When a window has too few
 * stories to compare (Chain Stories, Transgender), the heading says so, then the stories per period, "Show all
 * stories" when an option is on, else "Show All genres", and "One characteristic over time →" (View 1 for the genre
 * and option: its periods still draw).
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
    const v = overTimeCharacteristic(meta, state);
    const button = (
      <>
        <PeriodStories file={file} minN={meta.min_n} />
        <p className="inline-actions">
          <button type="button" className="btn" onClick={() => onSwitch(all ? { ...state, genre: "all" } : { ...state, sub: "all" })}>
            {all ? "Show All genres" : "Show all stories"}
          </button>
          <ChartLink className="btn" to={{ v, genre: file.g, sub: file.s }} onNavigate={onNavigate}>
            One characteristic over time →
          </ChartLink>
        </p>
      </>
    );
    return <ComparisonProfile {...common} header={header} showAll={button} tooFew />;
  }

  const p = trendProfile(meta, file);
  const takeaway = changesTakeaway(p);
  const length = lengthLine(p, file);
  const heading = changesHeading(p.flagged.length, p.compared, file);
  const sample = changesSampleLine(file, genre, subset);
  const header = (
    <header className="chart-head">
      <h2 className="chart-title" ref={headingRef} tabIndex={-1}>
        {heading}
      </h2>
      <p className="profile-sample">{sample}</p>
    </header>
  );
  const top = (length || takeaway.length > 0) && (
    <div className="takeaway profile-takeaway">
      {length && <p className="changes-length">{length}</p>}
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
    values: changesValues,
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
  const png = {
    label: "Download image of these changes",
    image: (panel, lists) => ({
      title: [changesQuestion(genre)],
      subtitle: [heading, sample],
      lists,
      fileName: changesFileName(file),
    }),
  };

  return (
    <ComparisonProfile
      {...common}
      header={header}
      top={top}
      profile={p}
      rule={file.rule}
      answerKey={`${file.g}|${file.s}`}
      words={changesWords(file)}
      row={row}
      png={png}
      valuesFirst
      scale={changesScale(p)}
      thenAbove
    />
  );
}
