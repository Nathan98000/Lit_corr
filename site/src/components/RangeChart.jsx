import { useEffect, useId, useRef, useState } from "react";
import { formatAge, formatCount, formatFixed, formatRange, columnDecimals } from "../lib/format.js";
import { capsule, rangeLayout, scaleX } from "../lib/rangeLayout.js";
import { chartSummary } from "../lib/wording.js";
import useGlide from "./useGlide.js";
import useWidth from "./useWidth.js";

/** The unit of a characteristic's ranges, when it helps to read the group labels (e.g. "per 1,000 words"). */
export function unitNote(variable) {
  const u = variable.unit || "";
  if (variable.bins.type !== "ranges" || !u || u.includes("(") || /^(share|yes|1 =|position|year$)/.test(u)) return "";
  return ` (${u})`;
}

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
    age: formatAge(s.age),
    label:
      `${row.label}: typical story ${formatFixed(s.median, d)}, middle half ${formatRange(s.p25, s.p75, d)}, ` +
      `mean ${formatFixed(s.mean, d)}, ${formatCount(s.n)} stories, typical age ${formatAge(s.age)}`,
  };
}

const KEYS = ["ArrowDown", "ArrowUp", "Home", "End"];
const tickKey = (t) => `${t.v}|${t.text}`;

/**
 * Popularity across the groups of one characteristic, in one genre (concept C2): one row per group, the middle
 * half of stories as a capsule, the typical story (median) as a dot with its value printed, and a dashed line for
 * all stories shown.
 *
 * The chart is one tab stop (F54): the arrow keys, Home and End move between rows, and the focused row shows its
 * details; Escape hides them. Hover shows them too, and a tap or click keeps them until the next tap.
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
  compact = false,
  domainRows = null,
  emptyActions = null,
}) {
  const [ref, width] = useWidth(720);
  const [shown, setShown] = useState(null); // the row whose details are shown: { i, by: "hover" | "focus" | "tap" }
  const [focusIdx, setFocusIdx] = useState(0); // the row that holds the chart's tab stop
  const frame = useRef(null);
  const rowEls = useRef([]);
  const ids = useId();
  const titleId = `${ids}-title`;
  const descId = `${ids}-desc`;
  const hatchId = `${ids}-hatch`.replace(/:/g, "");

  const layout = rangeLayout({ rows, overall, format: metric.format, width, smallN, minN, domainRows });
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

  useEffect(() => {
    if (shown == null) return undefined;
    const away = (e) => {
      if (!frame.current?.contains(e.target)) setShown(null);
    };
    const esc = (e) => {
      if (e.key === "Escape") setShown(null);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [shown]);

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
  const tabRow = Math.min(focusIdx, layout.rows.length - 1);

  const onRowKey = (e, ri) => {
    if (!KEYS.includes(e.key)) return;
    e.preventDefault();
    const last = layout.rows.length - 1;
    const next = { ArrowDown: Math.min(last, ri + 1), ArrowUp: Math.max(0, ri - 1), Home: 0, End: last }[e.key];
    setShown({ i: layout.rows[next].index, by: "focus" });
    setFocusIdx(next);
    rowEls.current[next]?.focus();
  };

  // During a glide every tick sits on the frame's scale: the old ticks fade out as the new ones fade in.
  const ticks =
    glide.gliding && glide.from
      ? [
          ...glide.from.map((t) => ({
            ...t,
            fade: layout.ticks.some((u) => tickKey(u) === tickKey(t)) ? 1 : 1 - glide.progress,
          })),
          ...layout.ticks
            .filter((t) => !glide.from.some((u) => tickKey(u) === tickKey(t)))
            .map((t) => ({ ...t, fade: glide.progress })),
        ]
      : layout.ticks.map((t) => ({ ...t, fade: 1 }));
  const inDomain = (v) => v >= scale[0] - 1e-9 && v <= scale[1] + 1e-9;
  const svgClass = [active != null && "has-active", glide.gliding && "gliding"].filter(Boolean).join(" ");

  return (
    <div ref={ref} className={`range-chart mode-${layout.mode}${compact ? " compact" : ""}`}>
      {!compact && (
        <ul className="legend" aria-hidden="true">
          <li>
            <span className="key key-median" /> Typical story (median)
          </li>
          <li>
            <span className="key key-iqr" /> Middle half of stories
          </li>
          {anySmall && (
            <li>
              <span className="key key-small" /> Fewer than {smallN} stories
            </li>
          )}
          {layout.ref && (
            <li>
              <span className="key key-ref" /> All stories shown
            </li>
          )}
        </ul>
      )}
      {!compact && (
        <p className="axis-title" aria-hidden="true">
          {metric.label}
        </p>
      )}
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
                <g key={tickKey(t)} className="tick-mark" data-v={t.v} opacity={t.fade < 1 ? t.fade : undefined}>
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
                ref={(el) => {
                  rowEls.current[ri] = el;
                }}
                className={`row${r.small ? " small" : ""}${r.ok ? "" : " hidden-group"}${active === r.index ? " active" : ""}`}
                role="img"
                tabIndex={ri === tabRow ? 0 : -1}
                aria-label={details.label}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse" && shown?.by !== "tap") setShown({ i: r.index, by: "hover" });
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === "mouse") setShown((s) => (s?.by === "hover" ? null : s));
                }}
                onFocus={() => {
                  setFocusIdx(ri);
                  setShown((s) => (s?.by === "tap" ? s : { i: r.index, by: "focus" }));
                }}
                onBlur={() => setShown((s) => (s?.by === "focus" && s.i === r.index ? null : s))}
                onClick={() => setShown((s) => (s?.by === "tap" && s.i === r.index ? null : { i: r.index, by: "tap" }))}
                onKeyDown={(e) => onRowKey(e, ri)}
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
                      y={r.cy - 6}
                      width={bar.width}
                      height={12}
                      rx={6}
                      fill={r.small ? `url(#${hatchId})` : undefined}
                    />
                    <circle className="median" cx={x(m[2])} cy={r.cy} r={7} />
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
        {activeRow && (
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
                <dt>Typical story</dt>
                <dd>{activeDetails.median}</dd>
                <dt>Middle half</dt>
                <dd>{activeDetails.range}</dd>
                <dt>Mean</dt>
                <dd>{activeDetails.mean}</dd>
                <dt>Stories</dt>
                <dd>{activeDetails.stories}</dd>
                <dt>Typical age</dt>
                <dd>{activeDetails.age}</dd>
              </dl>
            ) : (
              <p>Fewer than {minN} stories, so this group is not shown.</p>
            )}
          </div>
        )}
      </div>
      {!compact && (
        <p className="axis-caption">
          Stories grouped by {variable.noun}
          {unitNote(variable)}.{anySmall ? ` * Fewer than ${smallN} stories: worth less trust.` : ""}
        </p>
      )}
    </div>
  );
}
