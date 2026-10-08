import { interpolateRgb } from "d3-interpolate";
import { cellStats, pattern, relativeMedian } from "../lib/data.js";
import { formatCount, formatRatio, formatValue } from "../lib/format.js";

// Colours for "lower than / higher than the genre's typical story" (Literotica's blue for higher).
const NEUTRAL = "#f4f2ee";
const toHigher = interpolateRgb(NEUTRAL, "#4a89f3");
const toLower = interpolateRgb(NEUTRAL, "#e8894a");

export function cellColour(ratio) {
  if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) return null;
  const t = Math.max(-1, Math.min(1, Math.log2(ratio)));
  return t >= 0 ? toHigher(t) : toLower(-t);
}

/**
 * Every genre in its own row (alphabetical: not a ranking). Each cell compares a group's median with the
 * median for all stories shown in that genre, so the rows show how the relationship differs by genre.
 */
export default function CompareTable({ meta, variable, varData, k, metric, smallN, minN, onPickGenre }) {
  const fmt = (v) => formatValue(v, metric.format);
  const showPattern = variable.bins.ordered || Boolean(variable.yes_subject);
  const rows = meta.genres.map((g) => {
    const gd = varData?.g?.[g.id];
    const overall = cellStats(gd?.o, k);
    const cells = variable.bins.labels.map((label, i) => {
      const stats = cellStats(gd?.b?.[i], k);
      return { label, stats, ratio: relativeMedian(stats, overall) };
    });
    return { genre: g, overall, cells, direction: pattern(gd, k)[0] };
  });

  return (
    <div className="compare">
      {variable.bins.labels.length >= 4 && (
        <p className="scroll-hint" aria-hidden="true">
          Scroll sideways to see every group →
        </p>
      )}
      <div className="compare-scroll">
        <table className="compare-table">
          <caption className="visually-hidden">
            {metric.label} by {variable.noun}, compared with each genre’s typical story
          </caption>
          <thead>
            <tr>
              <th scope="col" className="genre-col">
                Genre
              </th>
              {variable.bins.labels.map((label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
              {showPattern && (
                <th scope="col" className="pattern-col">
                  Pattern
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.genre.id} className={row.genre.id === "all" ? "all-row" : undefined}>
                <th scope="row" className="genre-col">
                  <button type="button" className="link-button" onClick={() => onPickGenre(row.genre.id)}>
                    {row.genre.name}
                  </button>
                </th>
                {row.cells.map((c) => {
                  const ok = c.stats && !c.stats.suppressed && c.ratio != null;
                  const small = ok && c.stats.n < smallN;
                  const tip = ok
                    ? `${row.genre.name}, ${c.label}: median ${fmt(c.stats.median)} (${formatCount(c.stats.n)} stories) ` +
                      `vs. ${fmt(row.overall.median)} for all stories shown in the genre`
                    : `${row.genre.name}, ${c.label}: fewer than ${minN} stories`;
                  return (
                    <td
                      key={c.label}
                      className={ok ? (small ? "cell small" : "cell") : "cell empty"}
                      style={ok ? { background: cellColour(c.ratio) } : undefined}
                      title={tip}
                      aria-label={tip}
                    >
                      {ok ? formatRatio(c.ratio) : "·"}
                    </td>
                  );
                })}
                {showPattern && (
                  <td className={`pattern-cell ${row.direction > 0 ? "up" : row.direction < 0 ? "down" : ""}`}>
                    {row.direction > 0 ? "↗" : row.direction < 0 ? "↘" : "–"}
                    <span className="visually-hidden">
                      {row.direction > 0 ? "tends higher" : row.direction < 0 ? "tends lower" : "no clear pattern"}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="compare-legend" aria-hidden="true">
        <span>Lower than the genre’s typical story</span>
        <span className="ramp">
          <span>0.5×</span>
          <span className="ramp-bar" />
          <span>2×</span>
        </span>
        <span>Higher</span>
      </div>
      <p className="axis-caption">
        Numbers are each group’s median {metric.noun} divided by the median for all stories shown in that genre
        (1.0× = the same). Paler cells hold fewer than {smallN} stories; “·” means fewer than {minN}. Genres are
        in alphabetical order, not ranked. Select a genre’s name to see its chart.
      </p>
    </div>
  );
}
