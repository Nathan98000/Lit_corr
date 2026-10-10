import { useId, useRef } from "react";
import { REPEAT, comparison, formatPercent, rowDetails, withRepeat } from "../lib/genres.js";
import { bandPalette, mixColors, mixLayout } from "../lib/genreLayout.js";
import { GenreRowDetails, useGenreDetails } from "./GenreDetails.jsx";
import useWidth from "./useWidth.js";

/** Each group's share in a genre, for the 100% bars: per row { index, label, n, shares, mark, noneText }. */
export function mixRows(rows, variable, kind, minN) {
  return rows.map((row) => ({
    index: row.i,
    label: row.genre.name,
    n: row.stats?.n ?? null,
    shares: row.stats?.shares ?? null,
    mark: comparison(row, variable, kind)?.mark || "",
    small: row.small,
    noneText: `Fewer than ${minN} stories`,
  }));
}

/**
 * Named groups (grp) and ordered bands (band) in every genre: one 100% bar per genre, the groups in their own order,
 * each genre's shares printed in segments at least 34 px wide where their ink reaches 4.5:1 (every share is in the
 * details and the table). Named groups take the groups' palette, the darkest for the group that is largest across all
 * genres, and ≠ marks a genre whose mix clearly differs; ordered bands go from light to dark blue on an even scale of
 * contrast, with ▲ ▼ as for numbers (the palettes are in genres.css). Each group's name sits over its segment of All
 * genres' bar where it fits. The mark has its own column. Genres with fewer than SMALL_N stories are hatched and never
 * marked. Details and keyboard as on the range chart.
 */
export default function GenreMix({ meta, variable, entry, rows, highlight, sub, title, onNavigate }) {
  const kind = entry.k;
  const [ref, width] = useWidth(720, "genres");
  const frame = useRef(null);
  const ids = useId();
  const titleId = `${ids}-title`;
  const hatchId = `${ids}-hatch`.replace(/:/g, "");
  const labels = variable.bins.labels;
  const colors = mixColors(kind, rows[0].stats?.shares || labels.map(() => 0));
  // the highlighted genre's row, drawn a second time under All genres (I9)
  const hl = highlight ? rows.find((r) => r.genre.id === highlight) : null;
  const layout = mixLayout({ rows: withRepeat(mixRows(rows, variable, kind, meta.min_n), hl?.i), width, labels });
  const byIndex = new Map(rows.map((r) => [r.i, r]));
  const rowOf = (r) => byIndex.get(r.index === REPEAT ? hl.i : r.index);
  const realIds = layout.rows.filter((r) => r.index !== REPEAT).map((r) => r.index);
  const repeat = layout.rows.find((r) => r.index === REPEAT);
  const d = useGenreDetails({
    ids: realIds,
    frame,
    phone: layout.phone,
    byIndex,
    variable,
    entry,
    minN: meta.min_n,
  });
  const activeRow = d.active == null ? null : layout.rows.find((r) => r.index === (d.shown?.repeat ? REPEAT : d.active));

  return (
    <div ref={ref} className={`genre-mix kind-${kind}${kind === "band" ? ` bands-${bandPalette(labels.length)}` : ""}`}>
      <div className="chart-frame" ref={frame}>
        <span id={titleId} hidden>
          {title}
        </span>
        <svg
          width={layout.width}
          height={layout.height}
          role="group"
          aria-labelledby={titleId}
          className={d.active != null ? "has-active" : undefined}
        >
          <defs>
            <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" className="hatch-over" />
            </pattern>
          </defs>
          <g aria-hidden="true">
            {layout.rows.map((r) => {
              const row = rowOf(r);
              if (!row.all && row.genre.id !== highlight) return null;
              return (
                <rect
                  key={r.index}
                  className={row.all ? "band-all" : "band-highlight"}
                  x={0}
                  y={r.y0 + 1}
                  width={layout.width}
                  height={r.y1 - r.y0 - 2}
                  rx={4}
                />
              );
            })}
            {layout.rows.length > 1 && (
              <line className="all-rule" x1={0} x2={layout.width} y1={layout.rows[1].y0} y2={layout.rows[1].y0} />
            )}
            {repeat && <line className="all-rule" x1={0} x2={layout.width} y1={repeat.y1} y2={repeat.y1} />}
            {layout.storiesHead && (
              <text className="tick stories-head" x={layout.storiesHead.x} y={layout.storiesHead.y} textAnchor="end">
                {layout.storiesHead.text}
              </text>
            )}
            {layout.names.map((nm) => (
              <text key={nm.b} className="group-name" x={nm.x} y={nm.y} textAnchor="middle">
                {nm.text}
              </text>
            ))}
          </g>
          {layout.rows.map((r) => {
            const row = rowOf(r);
            const parts = <MixRow r={r} row={row} layout={layout} colors={colors} hatchId={hatchId} />;
            const state = [row.small && "small", !row.stats && "hidden-group"];
            if (r.index === REPEAT) {
              const cls = ["row", "repeat", "highlight", ...state, d.shown?.repeat && "active"].filter(Boolean);
              return (
                <g key={REPEAT} {...d.repeatProps(hl.i)} className={cls.join(" ")} aria-hidden="true">
                  {parts}
                </g>
              );
            }
            const cls = [
              "row",
              ...state,
              row.all && "all",
              row.genre.id === highlight && "highlight",
              d.active === r.index && !d.shown?.repeat && "active",
            ].filter(Boolean);
            return (
              <g
                key={r.index}
                {...d.rowProps(realIds.indexOf(r.index), r.index)}
                className={cls.join(" ")}
                role="img"
                aria-label={rowDetails(row, variable, entry, meta.min_n).name}
              >
                {parts}
              </g>
            );
          })}
        </svg>
        <GenreRowDetails
          d={d}
          phone={layout.phone}
          geom={activeRow}
          x={layout.barX + layout.barW / 2}
          height={layout.height}
          width={layout.width}
          sub={sub}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}

/** One genre's row: name, stories, mark and its bar. */
function MixRow({ r, row, layout, colors, hatchId }) {
  return (
    <>
      <rect className="row-hit" x={0} y={r.y0} width={layout.width} height={r.y1 - r.y0} />
      {r.labelLines.map((l, k) => (
        <text key={k} className="glabel" x={l.x} y={l.y} textAnchor="end">
          {l.text}
        </text>
      ))}
      {r.count && (
        <text className="gn" x={r.count.x} y={r.count.y} textAnchor="end">
          {r.count.text}
        </text>
      )}
      {r.mark && (
        <text className="gmark" x={r.mark.x} y={r.mark.y} textAnchor="middle">
          {r.mark.text}
        </text>
      )}
      {r.segments ? (
        <>
          {r.segments.map((s) =>
            s.width > 0 ? (
              <rect key={s.b} className={`segment ${colors[s.b].cls}`} x={s.x} y={r.cy - 9} width={s.width} height={18} />
            ) : null,
          )}
          {row.small && (
            <rect className="small-over" x={layout.barX} y={r.cy - 9} width={layout.barW} height={18} fill={`url(#${hatchId})`} />
          )}
          <rect className="bar-outline" x={layout.barX} y={r.cy - 9} width={layout.barW} height={18} />
          {r.segments.map((s) =>
            s.width >= 34 && colors[s.b].ink ? (
              <text key={`t${s.b}`} className={`seglab seg-ink-${colors[s.b].ink}`} x={s.labelX} y={r.cy + 4} textAnchor="middle">
                {formatPercent(s.share)}
              </text>
            ) : null,
          )}
        </>
      ) : (
        <text className="gnone" x={r.none.x} y={r.none.y}>
          {r.none.text}
        </text>
      )}
    </>
  );
}
