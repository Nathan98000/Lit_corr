import { useId, useRef } from "react";
import { formatCount, formatFixed, formatRange, columnDecimals } from "../lib/format.js";
import { PHONE, capsule, rangeLayout, scaleX } from "../lib/rangeLayout.js";
import { MARK } from "../lib/tokens.js";
import { chartSummary, groupedBy } from "../lib/wording.js";
import useGlide from "./useGlide.js";
import useRowDetails from "./useRowDetails.js";
import useWidth from "./useWidth.js";

/** The full description of one group, for its accessible name and its tooltip. */
function rowDetails(row, format, minN) {
  const s = row.stats;
  if (!s || s.suppressed) return { label: `${row.label}: fewer than ${minN} stories, not shown` };
  const d = columnDecimals([s.median, s.p25, s.p75, s.mean], format);
  return {
    median: formatFixed(s.median, d),
    range: formatRange(s.p25, s.p75, d),
    mean: formatFixed(s.mean, d),
    stories: formatCount(s.n),
    label:
      `${row.label}: median ${formatFixed(s.median, d)}, interquartile range ${formatRange(s.p25, s.p75, d)}, ` +
      `mean ${formatFixed(s.mean, d)}, ${formatCount(s.n)} stories`,
  };
}

/** What the rows are, with hyphenated words kept whole ("first-person" never breaks after its hyphen). */
function GroupedBy({ variable }) {
  const text = groupedBy(variable);
  if (!text) return null;
  return (
    <p className="axis-groups">
      {text.split(/(\S+-\S+)/).map((part, i) => (i % 2 ? <span key={i} className="nowrap">{part}</span> : part))}
    </p>
  );
}

const sameTick = (a, b) => Math.abs(a.v - b.v) < 1e-9;

/**
 * Popularity across the groups of one characteristic, in one genre (concept C2): one row per group, the
 * interquartile range as a capsule, the median as a dot with its value printed, and a dashed line for the median of
 * all stories shown.
 *
 * The chart is one tab stop (F54): the arrow keys, Home and End move between rows, and the focused row shows its
 * details; Escape hides them. Hover shows them too, and a tap or click keeps them until the next tap. On wider
 * charts the details are a card by the row; in the phone layout (narrower than 560 px) they are a line under the
 * chart, so nothing covers the rows (concept K1).
 *
 * What the rows are, and in what unit ("Stories grouped by word count"), is said above the first row, so
 * the unit is read before the numbers (round 3), on a line of its own across the chart: one line on wider screens,
 * not a heading wrapped into the label column's corner (the owner's follow-up). The measure's axis title comes next,
 * from where the plot starts and close above its ticks. A yes/no characteristic has no such line: its rows name
 * themselves.
 *
 * Another genre glides the marks (F51): the scale's domain glides with them, so the dots, the bars, the dashed line,
 * the grid and the ticks are drawn from the same scale in every frame; the old ticks fade out as the new ones fade
 * in, and the printed values fade in at their final places once the marks have arrived. Another characteristic,
 * measure or width redraws the chart.
 */
export default function RangeChart({
  rows,
  overall,
  metric,
  variable,
  smallN,
  minN,
  title,
  n,
  emptyActions = null,
}) {
  const [ref, width] = useWidth(720, "chart");
  const frame = useRef(null);
  const ids = useId();
  const titleId = `${ids}-title`;
  const descId = `${ids}-desc`;
  const hatchId = `${ids}-hatch`.replace(/:/g, "");

  const layout = rangeLayout({ rows, overall, format: metric.format, width, smallN, minN });
  const glide = useGlide(
    [
      [layout.lo, layout.hi, layout.left, layout.plotW, layout.ref ? overall.median : 0],
      ...layout.rows.map((r) => {
        const s = rows[r.index].stats;
        return r.ok ? [s.p25, s.p75, s.median] : null;
      }),
    ],
    `${variable.id}|${metric.id}|${rows.map((r) => r.label).join("|")}|${layout.width}|${layout.mode}|${Boolean(layout.ref)}`,
    layout.ticks,
  );
  const [scale, ...marks] = glide.values;
  const x = scaleX({ lo: scale[0], hi: scale[1], left: scale[2], plotW: scale[3] });
  const anySmall = layout.rows.some((r) => r.small);
  const shownCount = layout.rows.filter((r) => r.ok).length;
  const phone = layout.width < PHONE;
  // the row whose details are shown ({ i, by: "hover" | "focus" | "tap" }) and the rows' keyboard and pointer handlers
  const { shown, rowProps } = useRowDetails({ ids: layout.rows.map((r) => r.index), frame, phone });

  if (!shownCount) {
    return (
      <div ref={ref} className="chart-empty">
        <p>No group has enough stories in this selection to show a chart.</p>
        {emptyActions}
      </div>
    );
  }

  const active = shown == null ? null : shown.i;
  const activeRow = active == null ? null : layout.rows.find((r) => r.index === active);
  const activeDetails = activeRow ? rowDetails(rows[activeRow.index], metric.format, minN) : null;
  // the phone's details line: the same numbers as the row's name, in one line
  const detailsLine = activeRow && (
    <>
      <b>{activeRow.label}</b>{" "}
      {activeDetails.median ? (
        <>
          median {activeDetails.median} · interquartile range {activeDetails.range} · mean {activeDetails.mean} ·{" "}
          {activeDetails.stories} stories.
          {shown.by === "tap" && <span className="muted"> Tap again to close.</span>}
        </>
      ) : (
        <>fewer than {minN} stories, so this group is not shown.</>
      )}
    </>
  );

  // During a glide every tick sits on the frame's scale: the old ticks fade out as the new ones fade in. A value in
  // both sets is one tick, with its new label ("0.0" and "0" never sit on top of each other).
  const ticks =
    glide.gliding && glide.from
      ? [
          ...glide.from
            .filter((t) => !layout.ticks.some((u) => sameTick(u, t)))
            .map((t) => ({ ...t, fade: 1 - glide.progress })),
          ...layout.ticks.map((t) => ({ ...t, fade: glide.from.some((u) => sameTick(u, t)) ? 1 : glide.progress })),
        ]
      : layout.ticks.map((t) => ({ ...t, fade: 1 }));
  const inDomain = (v) => v >= scale[0] - 1e-9 && v <= scale[1] + 1e-9;
  const axisTitle = (
    <p className="axis-title" aria-hidden="true" style={layout.mode === "stacked" ? undefined : { paddingLeft: layout.left }}>
      {metric.label}
    </p>
  );
  const svgClass = [active != null && "has-active", glide.gliding && "gliding"].filter(Boolean).join(" ");

  return (
    <div ref={ref} className={`range-chart mode-${layout.mode}`}>
      <ul className="legend" aria-hidden="true">
        <li>
          <span className="key key-median" /> Median
        </li>
        <li>
          <span className="key key-iqr" /> Interquartile range
        </li>
        {anySmall && (
          <li>
            <span className="key key-small" /> Fewer than {smallN} stories
          </li>
        )}
        {layout.ref && (
          <li>
            <span className="key key-ref" /> Median of all stories shown
          </li>
        )}
      </ul>
      <GroupedBy variable={variable} />
      {axisTitle}
      <div className="chart-frame" ref={frame}>
        <span id={titleId} hidden>
          {title}
        </span>
        <span id={descId} hidden>
          {chartSummary({ rows, valueText: layout.valueText, n })}
        </span>
        <svg
          width={layout.width}
          height={layout.height}
          role="group"
          className={svgClass || undefined}
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          {/* the hatch of a group with few stories: set as a style on its bar, since the bar's class sets a fill that
              would win over the fill attribute */}
          <defs>
            <pattern id={hatchId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="#fff" />
              <line x1="0" y1="0" x2="0" y2="5" className="hatch-line" />
            </pattern>
          </defs>
          <g aria-hidden="true">
            {ticks
              .filter((t) => inDomain(t.v))
              .map((t) => (
                <g key={t.v} className="tick-mark" data-v={t.v} opacity={t.fade < 1 ? t.fade : undefined}>
                  <line
                    className="grid"
                    x1={x(t.v)}
                    x2={x(t.v)}
                    y1={layout.top - 4}
                    y2={layout.height - (layout.ref ? 22 : 6)}
                  />
                  <text className="tick" x={x(t.v)} y={layout.top - 10} textAnchor="middle">
                    {t.text}
                  </text>
                </g>
              ))}
            {layout.ref && (
              <g className="ref">
                <line x1={x(scale[4])} x2={x(scale[4])} y1={layout.top - 4} y2={layout.height - 22} />
                <text className="reflab" x={layout.ref.labelX} y={layout.ref.labelY} textAnchor="middle">
                  All stories shown: <tspan className="reflab-value">{layout.ref.value}</tspan>
                </text>
              </g>
            )}
          </g>
          {layout.rows.map((r, ri) => {
            const m = marks[ri];
            const details = rowDetails(rows[r.index], metric.format, minN);
            const bar = m ? capsule(x(m[0]), x(m[1])) : null;
            return (
              <g
                key={r.index}
                {...rowProps(ri, r.index)}
                className={`row${r.small ? " small" : ""}${r.ok ? "" : " hidden-group"}${active === r.index ? " active" : ""}`}
                role="img"
                aria-label={details.label}
              >
                <rect className="row-hit" x={0} y={r.y0} width={layout.width} height={r.y1 - r.y0} />
                <text className="glabel" x={r.labelPos.x} y={r.labelPos.y} textAnchor={r.labelPos.anchor}>
                  {r.label}
                </text>
                <text className="gn" x={r.nPos.x} y={r.nPos.y} textAnchor={r.nPos.anchor}>
                  {r.nText}
                </text>
                {r.ok ? (
                  <>
                    <rect
                      className="iqr"
                      x={bar.x}
                      y={r.cy - MARK.bar / 2}
                      width={bar.width}
                      height={MARK.bar}
                      rx={MARK.bar / 2}
                      style={r.small ? { fill: `url(#${hatchId})` } : undefined}
                    />
                    <circle className="median" cx={x(m[2])} cy={r.cy} r={MARK.dot} />
                    <text className="gval" x={r.value.x} y={r.value.y}>
                      {r.value.text}
                    </text>
                  </>
                ) : (
                  <text className="gnone" x={r.none.x} y={r.none.y}>
                    {r.none.text}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {phone && (
          <>
            {/* a tap's details are announced; a focused row's name already says the same, so its line is not */}
            <p className="row-details" aria-live="polite">
              {shown?.by === "tap" ? detailsLine : null}
            </p>
            <p className="row-details" aria-hidden="true">
              {shown && shown.by !== "tap" ? detailsLine : null}
            </p>
          </>
        )}
        {activeRow && !phone && (
          <div
            className={`chart-tip${shown.by === "tap" ? " pinned" : ""}`}
            aria-hidden="true"
            style={{
              left: Math.min(Math.max(activeRow.dotX ?? layout.left + 80, 100), layout.width - 100),
              top: activeRow.y1 + 2,
            }}
          >
            <strong>{activeRow.label}</strong>
            {activeDetails.median ? (
              <dl>
                <dt>Median</dt>
                <dd>{activeDetails.median}</dd>
                <dt>Interquartile range</dt>
                <dd>{activeDetails.range}</dd>
                <dt>Mean</dt>
                <dd>{activeDetails.mean}</dd>
                <dt>Stories</dt>
                <dd>{activeDetails.stories}</dd>
              </dl>
            ) : (
              <p>Fewer than {minN} stories, so this group is not shown.</p>
            )}
          </div>
        )}
      </div>
      {anySmall && <p className="axis-caption">* Fewer than {smallN} stories: worth less trust.</p>}
    </div>
  );
}
