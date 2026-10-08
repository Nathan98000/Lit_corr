import { formatAge, formatCount, formatValue } from "../lib/format.js";

/** The chart's numbers as a table (also what screen readers use). */
export default function NumbersTable({ rows, overall, metric, minN }) {
  const fmt = (v) => formatValue(v, metric.format);
  const line = (label, s, key, extraClass) => (
    <tr key={key} className={extraClass}>
      <th scope="row">{label}</th>
      {s && !s.suppressed ? (
        <>
          <td>{formatCount(s.n)}</td>
          <td>{fmt(s.median)}</td>
          <td>
            {fmt(s.p25)} – {fmt(s.p75)}
          </td>
          <td>{fmt(s.mean)}</td>
          <td>{formatAge(s.age)}</td>
        </>
      ) : (
        <td colSpan={5} className="muted">
          fewer than {minN} stories
        </td>
      )}
    </tr>
  );
  return (
    <div className="numbers-scroll">
      <table className="numbers">
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
