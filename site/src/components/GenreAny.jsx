import { useId, useRef } from "react";
import useOrderGlide from "./GenreGlide.jsx";
import { chartDomain, comparison, formatPercent, numberFormat, rowDetails, tickFormatFor } from "../lib/genres.js";
import { anyLayout } from "../lib/genreLayout.js";
import { GenreRowDetails, useGenreDetails } from "./GenreDetails.jsx";
import useWidth from "./useWidth.js";

/** Each genre's stories with any and their quartiles, for the mostly-zero chart. */
export function anyRows(rows, variable, minN) {
  return rows.map((row) => {
    const s = row.stats;
    return {
      index: row.i,
      label: row.genre.name,
      n: s?.n ?? null,
      share: s ? s.share : null,
      above: s && s.median != null ? { n: s.above, p25: s.p25, median: s.median, p75: s.p75 } : null,
      mark: comparison(row, variable, "zero")?.mark || "",
      small: row.small,
      noneText: `Fewer than ${minN} stories`,
      fewAboveText: `Fewer than ${minN} stories with any`,
    };
  });
}

/** The heading over the plot: "Among stories with any (per 1,000 words)", the unit only when it is a plain one. */
export const anyHeading = (nf) => `Among stories with any${nf.unit ? ` (${nf.unit})` : ""}`;

/**
 * A mostly-zero characteristic in every genre (D6, concept M1): where most stories score 0, a plain median would read
 * 0 in most genres, so each genre's row shows the interquartile range and median among its stories with any, on the
 * plot's own scale, then that median and how many of its stories have any (on wider charts a small bar and the share,
 * then the stories; on phones the median over the share). ▲ ▼ marks a genre that clearly differs, beside its name: the
 * comparison takes every story, the zeros included. All genres comes first and its median among the stories with any
 * is the dashed line. One tab stop; the details as on the other forms.
 */
export default function GenreAny({ meta, variable, entry, rows, sub, title, onNavigate }) {
  const [ref, width] = useWidth(720, "genres");
  const frame = useRef(null);
  const ids = useId();
  const titleId = `${ids}-title`;
  const hatchId = `${ids}-hatch`.replace(/:/g, "");
  const nf = numberFormat(variable, entry);
  const aRows = anyRows(rows, variable, meta.min_n);
  const layout = anyLayout({
    rows: aRows,
    width,
    domain: chartDomain(aRows.map((r) => ({ stats: r.above })), "num"),
    printed: nf.value,
    shareText: formatPercent,
    tickFormat: tickFormatFor("zero", entry.fmt),
  });
  const byIndex = new Map(rows.map((r) => [r.i, r]));
  const rowIds = layout.rows.map((r) => r.index);
  const d = useGenreDetails({ ids: rowIds, frame, phone: layout.phone, byIndex, variable, entry, minN: meta.min_n });
  const activeRow = d.active == null ? null : layout.rows.find((r) => r.index === d.active);
  // a new order glides the rows to their places (I10)
  useOrderGlide(
    frame,
    new Map(layout.rows.map((r) => [String(r.index), r.y0])),
    rows.map((r) => r.i).join(","),
    `${variable.id}|${sub}|${layout.width}`,
  );
  return (
    <div ref={ref} className="range-chart genre-chart genre-any">
      <p className="axis-title any-head" aria-hidden="true" style={layout.phone ? undefined : { paddingLeft: layout.x0 }}>
        {anyHeading(nf)}
      </p>
      <div className="chart-frame" ref={frame}>
        <span id={titleId} hidden>
          {title}
        </span>
        <svg width={layout.width} height={layout.height} role="group" aria-labelledby={titleId} className={d.active != null ? "has-active" : undefined}>
          <defs>
            <pattern id={hatchId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="#fff" />
              <line x1="0" y1="0" x2="0" y2="5" className="hatch-line" />
            </pattern>
          </defs>
          <g aria-hidden="true">
            <rect
              className="band-all"
              x={0}
              y={layout.rows[0].y0 + 1}
              width={layout.width}
              height={layout.rows[0].y1 - layout.rows[0].y0 - 2}
              rx={4}
            />
            {layout.rows.length > 1 && <line className="all-rule" x1={0} x2={layout.width} y1={layout.rows[1].y0} y2={layout.rows[1].y0} />}
            {layout.ticks.map((t) => (
              <g key={t.v} className="tick-mark">
                <line className="grid" x1={t.x} x2={t.x} y1={layout.top - 4} y2={layout.height - (layout.ref ? 22 : 6)} />
                <text className="tick" x={t.x} y={layout.top - 10} textAnchor="middle">
                  {t.text}
                </text>
              </g>
            ))}
            {layout.heads.map((h) => (
              <text key={h.text} className="tick col-head" x={h.x} y={h.y} textAnchor="end">
                {h.text}
              </text>
            ))}
            {layout.storiesHead && (
              <text className="tick stories-head" x={layout.storiesHead.x} y={layout.storiesHead.y} textAnchor="end">
                {layout.storiesHead.text}
              </text>
            )}
            {layout.ref && (
              <g className="ref">
                <line x1={layout.ref.x} x2={layout.ref.x} y1={layout.top - 4} y2={layout.height - 22} />
                <text className="reflab" x={layout.ref.labelX} y={layout.ref.labelY} textAnchor="middle">
                  {layout.ref.text}
                </text>
              </g>
            )}
          </g>
          {layout.rows.map((r, ri) => {
            const row = byIndex.get(r.index);
            const cls = ["row", row.small && "small", !row.stats && "hidden-group", row.all && "all", d.active === r.index && "active"];
            return (
              <g
                key={r.index}
                {...d.rowProps(ri, r.index)}
                className={cls.filter(Boolean).join(" ")}
                role="img"
                aria-label={rowDetails(row, variable, entry, meta.min_n).name}
                data-glide={row.all ? undefined : String(r.index)}
              >
                <AnyRow r={r} layout={layout} fill={row.small ? `url(#${hatchId})` : undefined} />
              </g>
            );
          })}
        </svg>
        <GenreRowDetails
          d={d}
          phone={layout.phone}
          geom={activeRow}
          x={activeRow?.dotX ?? layout.x0 + 80}
          height={layout.height}
          width={layout.width}
          sub={sub}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}

/** One genre's row: its name and stories, its mark, the range among its stories with any, the median and the share. */
function AnyRow({ r, layout, fill }) {
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
      {r.none && (
        <text className="gnone" x={r.none.x} y={r.none.y}>
          {r.none.text}
        </text>
      )}
      {r.bar && (
        <>
          <rect className="iqr" x={r.bar.x} y={r.cy - 5} width={r.bar.width} height={10} rx={5} fill={fill} />
          <circle className="median" cx={r.dotX} cy={r.cy} r={6} />
          <text className="gval" x={r.median.x} y={r.median.y} textAnchor="end">
            {r.median.text}
          </text>
        </>
      )}
      {r.fewAbove && (
        <text className="gnone" x={r.fewAbove.x} y={r.fewAbove.y}>
          {r.fewAbove.lines.map((t, k) => (
            <tspan key={k} x={r.fewAbove.x} dy={k ? 14 : 0}>
              {t}
            </tspan>
          ))}
        </text>
      )}
      {r.share && r.share.bar && (
        <>
          <rect className="share-track" x={r.share.bar.x} y={r.cy - 4} width={layout.shareBarW} height={8} rx={2} />
          <rect className="share-bar" x={r.share.bar.x} y={r.cy - 4} width={r.share.bar.width} height={8} rx={2} fill={fill} />
        </>
      )}
      {r.share && (
        <text className={r.share.bar ? "gval" : "gval any-share"} x={r.share.x} y={r.share.y} textAnchor="end">
          {r.share.text}
        </text>
      )}
    </>
  );
}
