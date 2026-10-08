import { columnDecimals, formatAge, formatCount, formatFixed, formatRange } from "../lib/format.js";

/** The decimals for each column of a chart's numbers: one setting per column ("1.0", "0.10–0.66"). */
export function tableDecimals(rows, overall, format) {
  const stats = [...rows.map((r) => r.stats), overall].filter((s) => s && !s.suppressed);
  return {
    median: columnDecimals(stats.map((s) => s.median), format),
    range: columnDecimals(stats.flatMap((s) => [s.p25, s.p75]), format),
    mean: columnDecimals(stats.map((s) => s.mean), format),
  };
}

/**
 * The chart's numbers as a table. It is always in the page right after the chart (screen readers find it there);
 * sighted visitors open it with "Show the numbers". On phones each group becomes a small card instead of a row.
 */
export default function NumbersTable({ rows, overall, metric, minN, id, visible = true, caption }) {
  const d = tableDecimals(rows, overall, metric.format);
  const line = (label, s, key, extraClass) => (
    <tr key={key} className={extraClass}>
      <th scope="row">{label}</th>
      {s && !s.suppressed ? (
        <>
          <td data-label="Stories">{formatCount(s.n)}</td>
          <td data-label="Median">{formatFixed(s.median, d.median)}</td>
          <td data-label="Middle half">{formatRange(s.p25, s.p75, d.range)}</td>
          <td data-label="Mean">{formatFixed(s.mean, d.mean)}</td>
          <td data-label="Typical age">{formatAge(s.age)}</td>
        </>
      ) : (
        <td colSpan={5} className="muted">
          fewer than {minN} stories
        </td>
      )}
    </tr>
  );
  return (
    <div id={id} className={visible ? "numbers-wrap" : "numbers-wrap visually-hidden"}>
      <table className="numbers">
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            <th scope="col">Group</th>
            <th scope="col">Stories</th>
            <th scope="col">Median</th>
            <th scope="col">Middle half</th>
            <th scope="col">Mean</th>
            <th scope="col">Typical age</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => line(r.label, r.stats, r.index))}
          {line("All stories shown", overall, "all", "total")}
        </tbody>
      </table>
    </div>
  );
}
