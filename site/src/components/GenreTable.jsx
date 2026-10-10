import { formatCount } from "../lib/format.js";
import { comparison, formatPercent, formatYears, numberFormat } from "../lib/genres.js";

/** The columns of one characteristic's numbers: [heading, cell(stats)] per form, as the chart prints them. */
function columns(kind, variable, nf) {
  if (kind === "num") {
    return [
      ["Median", (s) => nf.value(s.median)],
      ["Interquartile range", (s) => nf.span(s.p25, s.p75)],
    ];
  }
  if (kind === "bin") return [["Share", (s) => formatPercent(s.share)]];
  if (kind === "zero") {
    return [
      ["Above 0", (s) => formatPercent(s.share)],
      ["Median above 0", (s) => (s.median == null ? "–" : nf.value(s.median))],
      ["Interquartile range above 0", (s) => (s.median == null ? "–" : nf.span(s.p25, s.p75))],
    ];
  }
  return variable.bins.labels.map((label, b) => [label, (s) => formatPercent(s.shares[b])]);
}

/**
 * Every genre's numbers for one characteristic, in the chart's order, with how each genre compares with all genres.
 * Always in the page after the chart (screen readers find it there); "Show the numbers" shows it. On phones each
 * genre becomes a small card (the explorer's table style).
 */
export default function GenreTable({ meta, variable, entry, rows, id, visible, caption }) {
  const kind = entry.k;
  const cols = columns(kind, variable, numberFormat(variable, entry));
  const span = cols.length + 3;
  return (
    <div id={id} className={visible ? "numbers-wrap genre-numbers" : "numbers-wrap genre-numbers visually-hidden"}>
      <table className="numbers">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Genre</th>
            <th scope="col">Stories</th>
            {cols.map(([head]) => (
              <th scope="col" key={head}>
                {head}
              </th>
            ))}
            <th scope="col">Median age</th>
            <th scope="col">Compared with all genres</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const s = row.stats;
            const cmp = comparison(row, variable, kind, meta.min_n);
            return (
              <tr key={row.i} className={row.all ? "total" : undefined}>
                <th scope="row">{row.genre.name}</th>
                {s ? (
                  <>
                    <td data-label="Stories">{formatCount(s.n)}</td>
                    {cols.map(([head, cell]) => (
                      <td key={head} data-label={head}>
                        {cell(s)}
                      </td>
                    ))}
                    <td data-label="Median age">{formatYears(row.age)}</td>
                    <td data-label="Compared with all genres">{cmp ? `${cmp.mark ? `${cmp.mark} ` : ""}${cmp.short}` : ""}</td>
                  </>
                ) : (
                  <td colSpan={span} className="muted">
                    Fewer than {meta.min_n} stories
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
