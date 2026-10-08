import { useEffect, useId, useRef, useState } from "react";
import { formatAge, formatCount, formatFixed, formatRange, columnDecimals } from "../lib/format.js";
import { rangeLayout } from "../lib/rangeLayout.js";
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

/**
 * Popularity across the groups of one characteristic, in one genre (concept C2): one row per group, the middle
 * half of stories as a capsule, the typical story (median) as a dot with its value printed, and a dashed line for
 * all stories shown. Rows are focusable; hover, focus or a tap shows the details (a tap pins them).
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
}) {
  const [ref, width] = useWidth(720);
  const [active, setActive] = useState(null); // index of the row whose details are shown
  const [pinned, setPinned] = useState(false);
  const frame = useRef(null);
  const ids = useId();
  const titleId = `${ids}-title`;
  const descId = `${ids}-desc`;
  const hatchId = `${ids}-hatch`.replace(/:/g, "");

  const layout = rangeLayout({ rows, overall, format: metric.format, width, smallN, minN, domainRows });
  // genre or measure changes glide the marks to their new places; another characteristic or width redraws them
  const glide = useGlide(
    layout.rows.map((r) => (r.ok ? [r.bar.x, r.bar.width, r.dotX, r.value.x] : null)),
    `${variable.id}|${rows.map((r) => r.label).join("|")}|${layout.width}|${layout.mode}`,
  );
  const anySmall = layout.rows.some((r) => r.small);
  const shownCount = layout.rows.filter((r) => r.ok).length;

  useEffect(() => {
    if (active == null) return undefined;
    const away = (e) => {
      if (!frame.current?.contains(e.target)) {
        setActive(null);
        setPinned(false);
      }
    };
    const esc = (e) => {
      if (e.key === "Escape") {
        setActive(null);
        setPinned(false);
      }
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [active]);

  if (!shownCount) {
    return (
      <div ref={ref} className="chart-empty">
        No group has enough stories in this selection to show a chart.
      </div>
    );
  }

  const activeRow = active == null ? null : layout.rows.find((r) => r.index === active);
  const activeDetails = activeRow ? rowDetails(rows[activeRow.index], metric.format, minN) : null;
  const toggle = (i) => {
    if (pinned && active === i) {
      setPinned(false);
      setActive(null);
    } else {
      setActive(i);
      setPinned(true);
    }
  };

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
          className={active != null ? "has-active" : undefined}
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
            {layout.ticks.map((t) => (
              <g key={t.v}>
                <line className="grid" x1={t.x} x2={t.x} y1={layout.top - 4} y2={layout.height - (layout.ref ? 22 : 6)} />
                <text className="tick" x={t.x} y={layout.top - 10} textAnchor="middle">
                  {t.text}
                </text>
              </g>
            ))}
            {layout.ref && (
              <g className="ref">
                <line x1={layout.ref.x} x2={layout.ref.x} y1={layout.top - 4} y2={layout.height - 22} />
                <text className="reflab" x={layout.ref.labelX} y={layout.ref.labelY} textAnchor="middle">
                  All stories shown: <tspan className="reflab-value">{layout.ref.value}</tspan>
                </text>
              </g>
            )}
          </g>
          {layout.rows.map((r, ri) => {
            const g = glide[ri] || (r.ok ? [r.bar.x, r.bar.width, r.dotX, r.value.x] : null);
            const details = rowDetails(rows[r.index], metric.format, minN);
            const on = active === r.index;
            return (
              <g
                key={r.index}
                className={`row${r.small ? " small" : ""}${r.ok ? "" : " hidden-group"}${on ? " active" : ""}`}
                role="img"
                tabIndex={0}
                aria-label={details.label}
                onPointerEnter={(e) => e.pointerType === "mouse" && !pinned && setActive(r.index)}
                onPointerLeave={(e) => e.pointerType === "mouse" && !pinned && setActive(null)}
                onFocus={() => !pinned && setActive(r.index)}
                onBlur={() => !pinned && setActive(null)}
                onClick={() => toggle(r.index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle(r.index);
                  }
                }}
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
                      x={g[0]}
                      y={r.cy - 6}
                      width={g[1]}
                      height={12}
                      rx={6}
                      fill={r.small ? `url(#${hatchId})` : undefined}
                    />
                    <circle className="median" cx={g[2]} cy={r.cy} r={7} />
                    <text className="gval" x={g[3]} y={r.value.y}>
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
            className={`chart-tip${pinned ? " pinned" : ""}`}
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
