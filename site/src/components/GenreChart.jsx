import { useId, useRef } from "react";
import useOrderGlide from "./GenreGlide.jsx";
import { REPEAT, chartDomain, chartRows, numberFormat, printedFor, rowDetails, tickFormatFor, withRepeat } from "../lib/genres.js";
import { PHONE, rangeLayout } from "../lib/rangeLayout.js";
import { GenreRowDetails, useGenreDetails } from "./GenreDetails.jsx";
import useWidth from "./useWidth.js";

/**
 * One characteristic in every genre, for numbers (num: each genre's interquartile range as a capsule and its median as
 * a dot) and yes/no characteristics (bin: a bar from 0 to the share of stories that have it, with a dot at its end),
 * built on the explorer's row layout (rangeLayout). All genres comes first, on a shaded band, and its median (or
 * share) is the dashed line. ▲ or ▼ marks a genre that clearly differs in a column of its own after its name (F61a);
 * each value is printed in a column at the right; wider charts have a Stories column, phones the stories under a
 * genre's name when there are fewer than 250. Genres with
 * fewer than SMALL_N stories are hatched with a hollow dot and never marked; fewer than MIN_N: "Fewer than 10 stories".
 *
 * One tab stop: ↑/↓, Home and End move between genres; the focused or hovered genre's details show as a card (wider
 * charts) or a line under the chart (phones), with the link to what stands out about the genre's stories.
 */
export default function GenreChart({ meta, variable, entry, rows, highlight, sub, title, onNavigate }) {
  const kind = entry.k;
  const { min_n: minN, small_n: smallN } = meta;
  const [ref, width] = useWidth(720, "genres");
  const frame = useRef(null);
  const ids = useId();
  const titleId = `${ids}-title`;
  const hatchId = `${ids}-hatch`.replace(/:/g, "");
  // the highlighted genre's row, drawn a second time under All genres (I9)
  const hl = highlight ? rows.find((r) => r.genre.id === highlight) : null;
  const crow = withRepeat(chartRows(rows, variable, kind), hl?.i);
  const layout = rangeLayout({
    rows: crow,
    overall: crow[0].stats,
    format: "count",
    width,
    smallN,
    minN,
    domain: chartDomain(crow, kind),
    tickFormat: tickFormatFor(kind, entry.fmt),
    printed: printedFor(kind, numberFormat(variable, entry)),
    valueColumn: true,
    storiesColumn: true,
    markColumn: true,
    valueHead: kind === "bin" ? "Share" : "Median",
    phoneLabelW: 116,
    rowHeight: 31,
    refText: (v) => `All genres: ${v}`,
    noneText: `Fewer than ${minN} stories`,
  });
  const phone = layout.width < PHONE;
  const byIndex = new Map(rows.map((r) => [r.i, r]));
  const rowOf = (r) => byIndex.get(r.index === REPEAT ? hl.i : r.index); // the copy is the highlighted genre's
  const realIds = layout.rows.filter((r) => r.index !== REPEAT).map((r) => r.index);
  const d = useGenreDetails({ ids: realIds, frame, phone, byIndex, variable, entry, minN });
  const { active, rowProps } = d;
  const activeRow = active == null ? null : layout.rows.find((r) => r.index === (d.shown?.repeat ? REPEAT : active));
  const repeat = layout.rows.find((r) => r.index === REPEAT);
  const x = layout.x;
  const svgClass = active != null ? "has-active" : undefined;
  // a new order glides the rows to their places (I10)
  useOrderGlide(
    frame,
    new Map(layout.rows.map((r) => [String(r.index), r.y0])),
    rows.map((r) => r.i).join(","),
    `${variable.id}|${sub}|${layout.width}|${highlight || ""}`,
  );

  return (
    <div ref={ref} className={`range-chart genre-chart kind-${kind} mode-${layout.mode}`}>
      <div className="chart-frame" ref={frame}>
        <span id={titleId} hidden>
          {title}
        </span>
        <svg width={layout.width} height={layout.height} role="group" aria-labelledby={titleId} className={svgClass}>
          <defs>
            <pattern id={hatchId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="#fff" />
              <line x1="0" y1="0" x2="0" y2="5" className="hatch-line" />
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
                  data-glide={row.all || r.index === REPEAT ? undefined : String(r.index)}
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
            {layout.ticks.map((t) => (
              <g key={t.v} className="tick-mark" data-v={t.v}>
                <line className="grid" x1={t.x} x2={t.x} y1={layout.top - 4} y2={layout.height - (layout.ref ? 22 : 6)} />
                <text className="tick" x={t.x} y={layout.top - 10} textAnchor="middle">
                  {t.text}
                </text>
              </g>
            ))}
            {layout.valueHead && (
              <text className="tick col-head" x={layout.valueHead.x} y={layout.valueHead.y} textAnchor="end">
                {layout.valueHead.text}
              </text>
            )}
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
          {layout.rows.map((r) => {
            const row = rowOf(r);
            const parts = <RowParts r={r} kind={kind} x={x} width={layout.width} hatchId={hatchId} />;
            const state = [r.small && "small", !r.ok && "hidden-group"];
            if (r.index === REPEAT) {
              // the copy: for the eye only, outside the keyboard's sequence; hovering or tapping it shows the genre's details
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
              active === r.index && !d.shown?.repeat && "active",
            ].filter(Boolean);
            return (
              <g
                key={r.index}
                {...rowProps(realIds.indexOf(r.index), r.index)}
                className={cls.join(" ")}
                role="img"
                aria-label={rowDetails(row, variable, entry, minN).name}
                data-glide={row.all ? undefined : String(r.index)}
              >
                {parts}
              </g>
            );
          })}
        </svg>
        <GenreRowDetails
          d={d}
          phone={phone}
          geom={activeRow}
          x={activeRow?.dotX ?? layout.left + 80}
          height={layout.height}
          width={layout.width}
          sub={sub}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}

/** What a row draws: its name and stories, its mark, its range (or share) and median, and its value. */
function RowParts({ r, kind, x, width, hatchId }) {
  return (
    <>
      <rect className="row-hit" x={0} y={r.y0} width={width} height={r.y1 - r.y0} />
      {r.labelLines.map((l, k) => (
        <text key={k} className="glabel" x={l.x} y={l.y} textAnchor="end">
          {l.text}
        </text>
      ))}
      {r.nPos && (
        <text className="gn" x={r.nPos.x} y={r.nPos.y} textAnchor="end">
          {r.nText}
        </text>
      )}
      {r.markPos && (
        <text className="gmark" x={r.markPos.x} y={r.markPos.y} textAnchor="middle">
          {r.mark}
        </text>
      )}
      {r.ok ? (
        <>
          {kind === "bin" ? (
            <rect
              className="share-bar"
              x={x(0)}
              y={r.cy - 5}
              width={Math.max(1, r.dotX - x(0))}
              height={10}
              rx={5}
              fill={r.small ? `url(#${hatchId})` : undefined}
            />
          ) : (
            <rect className="iqr" x={r.bar.x} y={r.cy - 5} width={r.bar.width} height={10} rx={5} fill={r.small ? `url(#${hatchId})` : undefined} />
          )}
          <circle className="median" cx={r.dotX} cy={r.cy} r={6} />
          <text className="gval" x={r.value.x} y={r.value.y} textAnchor="end">
            {r.value.text}
          </text>
        </>
      ) : (
        <text className="gnone" x={r.none.x} y={r.none.y}>
          {r.none.text}
        </text>
      )}
    </>
  );
}
