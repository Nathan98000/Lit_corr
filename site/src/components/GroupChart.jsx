import { scaleBand, scaleLinear } from "d3-scale";
import { useState } from "react";
import { formatAge, formatCount, formatValue } from "../lib/format.js";
import useWidth from "./useWidth.js";

function wrap(label, maxChars) {
  const lines = [];
  let line = "";
  for (const word of label.split(" ")) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= maxChars) line = `${line} ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > 3) {
    lines.length = 3;
    lines[2] = `${lines[2]}…`;
  }
  return lines;
}

/** The unit of a characteristic's ranges, when it helps to read the group labels (e.g. "per 1,000 words"). */
export function unitNote(variable) {
  const u = variable.unit || "";
  if (variable.bins.type !== "ranges" || !u || u.includes("(") || /^(share|yes|1 =|position|year$)/.test(u)) return "";
  return ` (${u})`;
}

function yScale(rows, overall, metric, innerH) {
  const shown = rows.filter((r) => r.stats && !r.stats.suppressed);
  const vals = shown.flatMap((r) => [r.stats.p25, r.stats.p75, r.stats.median]);
  if (overall && !overall.suppressed) vals.push(overall.median);
  const y = scaleLinear().range([innerH, 0]);
  if (!vals.length) return y.domain([0, 1]);
  if (metric.format === "rating") {
    const lo = Math.max(1, Math.floor((Math.min(...vals) - 0.15) * 10) / 10);
    const hi = Math.min(5, Math.ceil((Math.max(...vals) + 0.1) * 10) / 10);
    return y.domain([lo, hi]).nice();
  }
  return y.domain([0, (Math.max(...vals) || 1) * 1.08]).nice();
}

/**
 * Popularity across the groups of one characteristic, in one genre: for each group the median (dot), the
 * middle half of stories (bar) and the mean (diamond), with the median of all stories shown as a dashed line.
 */
export default function GroupChart({ rows, overall, metric, variable, smallN, minN, title }) {
  const [ref, width] = useWidth(720);
  const [active, setActive] = useState(null);
  const narrow = width < 520;
  const height = narrow ? 330 : 380;
  const margin = { top: 34, right: narrow ? 10 : 24, bottom: 78, left: narrow ? 46 : 62 };
  const innerW = Math.max(160, width - margin.left - margin.right);
  const innerH = height - margin.top - margin.bottom;
  const shown = rows.filter((r) => r.stats && !r.stats.suppressed);
  const x = scaleBand()
    .domain(rows.map((r) => r.index))
    .range([0, innerW])
    .paddingInner(rows.length > 8 ? 0.15 : 0.3)
    .paddingOuter(0.15);
  const y = yScale(rows, overall, metric, innerH);
  const [y0, y1] = y.domain();
  const barW = Math.min(52, x.bandwidth() * 0.62);
  const maxChars = Math.max(4, Math.floor(x.bandwidth() / 6.6));
  const ticks = y.ticks(narrow ? 4 : 5);
  const fmt = (v) => formatValue(v, metric.format);
  const anySmall = shown.some((r) => r.stats.n < smallN);
  const activeRow = active == null ? null : rows[active];

  if (!shown.length) {
    return (
      <div ref={ref} className="chart-empty">
        Too few stories in this selection to show a chart. Try “All stories” or another genre.
      </div>
    );
  }

  return (
    <div ref={ref} className="group-chart">
      <ul className="legend" aria-hidden="true">
        <li>
          <span className="key key-median" /> Median (the typical story)
        </li>
        <li>
          <span className="key key-iqr" /> Middle half of stories
        </li>
        <li>
          <span className="key key-mean" /> Mean
        </li>
        {overall && !overall.suppressed && (
          <li>
            <span className="key key-ref" /> All stories shown: {fmt(overall.median)}
          </li>
        )}
      </ul>
      <div className="chart-frame">
        <svg width={width} height={height} role="img" aria-label={title}>
          <g transform={`translate(${margin.left},${margin.top})`}>
            <text className="axis-title" x={-margin.left} y={-18}>
              {metric.label}
            </text>
            {ticks.map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line className="grid" x1={0} x2={innerW} />
                <text className="tick" x={-8} dy="0.32em" textAnchor="end">
                  {fmt(t)}
                </text>
              </g>
            ))}
            {overall && !overall.suppressed && (
              <g className="ref" transform={`translate(0,${y(overall.median)})`}>
                <line x1={0} x2={innerW} />
              </g>
            )}
            {rows.map((r) => {
              const cx = x(r.index) + x.bandwidth() / 2;
              const s = r.stats;
              const ok = s && !s.suppressed;
              const small = ok && s.n < smallN;
              const lines = wrap(r.label, maxChars);
              return (
                <g key={r.index} transform={`translate(${cx},0)`}>
                  {ok && (
                    <g className={small ? "group small" : "group"}>
                      <rect
                        className="iqr"
                        x={-barW / 2}
                        width={barW}
                        y={y(Math.min(s.p75, y1))}
                        height={Math.max(2, y(Math.max(s.p25, y0)) - y(Math.min(s.p75, y1)))}
                        rx={3}
                      />
                      {s.mean >= y0 && s.mean <= y1 ? (
                        <path
                          className="mean"
                          d={`M0,${y(s.mean) - 5}L5,${y(s.mean)}L0,${y(s.mean) + 5}L-5,${y(s.mean)}Z`}
                        />
                      ) : (
                        <path className="mean" d={`M-4,${s.mean > y1 ? 6 : innerH - 6}L4,${s.mean > y1 ? 6 : innerH - 6}L0,${s.mean > y1 ? 0 : innerH}Z`} />
                      )}
                      <circle className="median" cy={y(s.median)} r={6} />
                    </g>
                  )}
                  {!ok && (
                    <text className="none-label" y={innerH - 10} textAnchor="middle">
                      too few
                    </text>
                  )}
                  <text className="group-label" y={innerH + 18} textAnchor="middle">
                    {lines.map((line, i) => (
                      <tspan key={i} x={0} dy={i === 0 ? 0 : "1.15em"}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                  <text className="group-n" y={innerH + 22 + lines.length * 14} textAnchor="middle">
                    {ok ? `n = ${formatCount(s.n)}${small ? "*" : ""}` : `n < ${minN}`}
                  </text>
                  <rect
                    className="hit"
                    x={-x.bandwidth() / 2}
                    width={x.bandwidth()}
                    y={0}
                    height={innerH}
                    tabIndex={0}
                    aria-label={ok ? `${r.label}: median ${fmt(s.median)}, ${formatCount(s.n)} stories` : `${r.label}: too few stories`}
                    onMouseEnter={() => setActive(r.index)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(r.index)}
                    onBlur={() => setActive(null)}
                  />
                </g>
              );
            })}
            <line className="baseline" x1={0} x2={innerW} y1={innerH} y2={innerH} />
          </g>
        </svg>
        {activeRow && (
          <div
            className="chart-tip"
            style={{
              left: Math.min(Math.max(margin.left + x(activeRow.index) + x.bandwidth() / 2, 90), width - 90),
              top: margin.top + 8,
            }}
          >
            <strong>{activeRow.label}</strong>
            {activeRow.stats && !activeRow.stats.suppressed ? (
              <dl>
                <dt>Stories</dt>
                <dd>{formatCount(activeRow.stats.n)}</dd>
                <dt>Median</dt>
                <dd>{fmt(activeRow.stats.median)}</dd>
                <dt>Middle half</dt>
                <dd>
                  {fmt(activeRow.stats.p25)} – {fmt(activeRow.stats.p75)}
                </dd>
                <dt>Mean</dt>
                <dd>{fmt(activeRow.stats.mean)}</dd>
                <dt>Typical age</dt>
                <dd>{formatAge(activeRow.stats.age)}</dd>
              </dl>
            ) : (
              <p>Fewer than {minN} stories, so this group is not shown.</p>
            )}
          </div>
        )}
      </div>
      <p className="axis-caption">
        Stories grouped by {variable.noun}
        {unitNote(variable)}
        {anySmall ? `. * Fewer than ${smallN} stories: paler, and worth less trust.` : "."}
      </p>
    </div>
  );
}
