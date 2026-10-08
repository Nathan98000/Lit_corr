import { cardLabel, gridColumns, sparkGeometry } from "../lib/compare.js";
import { textWidth } from "../lib/rangeLayout.js";
import useWidth from "./useWidth.js";

/** One genre's mini chart: groups left to right, each typical story against the genre's own (dashed line). */
function Spark({ row, width, ordered, showLabels }) {
  const g = sparkGeometry(row.cells, width, 56, showLabels ? Math.min(60, width / (2 * row.cells.length)) : 10);
  const shown = g.points.filter((p) => !p.hidden);
  const path = ordered && shown.length > 1 ? shown.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join("") : null;
  const height = g.height + (showLabels ? 20 : 0);
  return (
    <svg width={width} height={height} aria-hidden="true" className="spark">
      <rect x={0} y={g.band[0]} width={width} height={g.band[1] - g.band[0]} className="spark-band" />
      <line x1={0} x2={width} y1={g.one} y2={g.one} className="spark-one" />
      {path && <path d={path} className="spark-line" />}
      {g.points.map((p, i) =>
        p.hidden ? (
          <line key={i} x1={p.x - 4} x2={p.x + 4} y1={p.y} y2={p.y} className="spark-dash" />
        ) : (
          <circle key={i} cx={p.x} cy={p.y} r={p.small ? 3.4 : 4.2} className={p.small ? "spark-dot hollow" : "spark-dot"} />
        ),
      )}
      {showLabels &&
        g.points.map((p, i) => (
          <text key={`l${i}`} x={p.x} y={g.height + 14} textAnchor="middle" className="spark-label">
            {p.label}
          </text>
        ))}
    </svg>
  );
}

/**
 * Compare genres (concept D2): one small chart per genre, alphabetical, not ranked. Each card is a button that
 * opens that genre's chart; its accessible name gives the verdict and every group's ratio.
 */
export default function CompareGrid({ rows, variable, minN, onPickGenre }) {
  const [ref, width] = useWidth(960);
  const cols = gridColumns(width);
  const gap = 10;
  const cardW = Math.floor((width - gap * (cols - 1)) / cols);
  const ordered = variable.bins.ordered;
  const labels = variable.bins.labels;
  const allW = width - 2;
  const labelsFit = labels.every((l) => textWidth(l, 11.5) + 8 <= (allW - 120) / labels.length);

  return (
    <div ref={ref} className="compare-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {rows.map((row) => {
        const all = row.genre.id === "all";
        const v = row.verdict;
        return (
          <button
            key={row.genre.id}
            type="button"
            className={`genre-card${all ? " all" : ""}`}
            aria-label={cardLabel(row, minN)}
            title={row.genre.name}
            onClick={() => onPickGenre(row.genre.id)}
          >
            <span className="genre-card-head">
              <span className="genre-name">{row.genre.name}</span>
              {v && (
                <span className={`verdict ${v.kind}`}>
                  {v.arrow && <span aria-hidden="true">{v.arrow} </span>}
                  {v.text}
                </span>
              )}
            </span>
            <Spark row={row} width={Math.max(60, (all ? allW : cardW) - 2)} ordered={ordered} showLabels={all && labelsFit} />
          </button>
        );
      })}
    </div>
  );
}
