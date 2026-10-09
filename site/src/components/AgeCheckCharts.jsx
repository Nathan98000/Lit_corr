import { useEffect, useRef, useState } from "react";
import { AGE_ROW, AGE_TICKS, ageHeight, ageLayout } from "../lib/ageLayout.js";
import { cellStats, groupRows, loadVariable, pattern } from "../lib/data.js";
import { columnDecimals, formatAge, formatCount, formatFixed, formatRange } from "../lib/format.js";
import { chartTitle } from "../lib/wording.js";
import useWidth from "./useWidth.js";

export const PERIODS = ["y2000", "y2010", "y2020"];

/** The existing verdict for one chart, in words. */
export function verdictWords(variable, [direction, effect]) {
  if (!(variable.bins.ordered || variable.yes_subject)) return null;
  if (effect == null) return "too few stories to judge";
  if (direction > 0) return "↗ tends higher";
  if (direction < 0) return "↘ tends lower";
  return "no clear pattern";
}

const KEYS = ["ArrowDown", "ArrowUp", "Home", "End"];
const isShown = (s) => s && !s.suppressed;
const plain = (verdict) => verdict.replace(/^[↗↘] /, "");

/** One group in one period, in words (null when the group is not shown). */
function cellDetails(stats, format) {
  if (!isShown(stats)) return null;
  const d = columnDecimals([stats.median, stats.p25, stats.p75, stats.mean], format);
  return {
    median: formatFixed(stats.median, d),
    range: formatRange(stats.p25, stats.p75, d),
    mean: formatFixed(stats.mean, d),
    stories: formatCount(stats.n),
    age: formatAge(stats.age),
  };
}

/**
 * A period's short name for its heading ("2000–2009"), from its option's label ("Published 2000–2009"); word joiners
 * keep a narrow column from breaking it at the dash.
 */
const shortPeriod = (label) => label.replace(/^Published\s+/, "").replace("–", "\u2060–\u2060");

/** The chart's space while its three files load: about as tall as the chart, so the page does not jump. */
function AgeCheckPlaceholder({ groups }) {
  const [ref, width] = useWidth(720, "age");
  return <div ref={ref} className="age-ph" aria-busy="true" style={{ height: ageHeight({ groups, width }) }} />;
}

/**
 * "Stories of similar age" (idea I1, redrawn in round 3): the same chart within 2000–2009, 2010–2019 and 2020 or later,
 * as one aligned chart. The group labels appear once, on the left; each period is a column with its heading (the
 * period, its number of stories and its verdict) and one dot per group at its median, on one scale shared by the three
 * columns: filled for 30 or more stories, hollow for fewer, a short dash for fewer than 10; a thin line joins the dots
 * of an ordered characteristic, and a dashed line marks the median of all the period's stories. Below 72 px a column,
 * the periods are stacked.
 *
 * Details on demand, as on the main chart: hover or focus shows a card on wider charts, a tap shows a line under the
 * chart in the phone layout. Each column is one tab stop (↑/↓, Home and End move between groups; Escape hides the
 * details). The numbers are also in a visually hidden table, for screen readers; the marks are hidden from them.
 */
export function AgeChart({ meta, d, periods }) {
  const [ref, width] = useWidth(720, "age");
  const [shown, setShown] = useState(null); // { col, i, by: "hover" | "focus" | "tap" }
  const [focusIdx, setFocusIdx] = useState([0, 0, 0]); // the row that holds each column's tab stop
  const cells = useRef({});
  const labels = d.variable.bins.labels;
  const L = ageLayout({ periods, labels, format: d.metric.format, width });
  const { min_n: minN, small_n: smallN } = meta;

  useEffect(() => {
    if (shown == null) return undefined;
    const away = (e) => {
      if (!ref.current?.contains(e.target)) setShown(null);
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
  }, [shown, ref]);

  const details = (col, i) => cellDetails(periods[col].rows[i].stats, d.metric.format);
  const where = (col, i) => `${labels[i]}, ${periods[col].subset.label.toLowerCase()}`;
  const name = (col, i) => {
    const c = details(col, i);
    if (!c) return `${where(col, i)}: fewer than ${minN} stories, not shown`;
    return (
      `${where(col, i)}: median ${c.median}, interquartile range ${c.range}, mean ${c.mean}, ${c.stories} stories, ` +
      `median age ${c.age}`
    );
  };

  const onKey = (e, col, i) => {
    if (!KEYS.includes(e.key)) return;
    e.preventDefault();
    const last = labels.length - 1;
    const next = { ArrowDown: Math.min(last, i + 1), ArrowUp: Math.max(0, i - 1), Home: 0, End: last }[e.key];
    setFocusIdx((f) => f.map((v, c) => (c === col ? next : v)));
    setShown({ col, i: next, by: "focus" });
    cells.current[`${col}-${next}`]?.focus();
  };

  // a group's card on wider charts: under its dot, kept inside the chart
  const card = (col) => {
    if (!shown || shown.col !== col || L.phone) return null;
    const c = details(col, shown.i);
    const stats = periods[col].rows[shown.i].stats;
    const colLeft = L.labelW + L.gap + (L.side ? col * (L.colW + L.gap) : 0);
    const center = colLeft + (c ? L.x(stats.median) : L.colW / 2);
    return (
      <div
        className={`chart-tip${shown.by === "tap" ? " pinned" : ""}`}
        aria-hidden="true"
        style={{ left: Math.min(Math.max(center, 100), width - 100) - colLeft, top: L.rowY(shown.i) + 14 }}
      >
        <strong>{labels[shown.i]}</strong>
        <span className="tip-period">{periods[col].subset.label}</span>
        {c ? (
          <dl>
            <dt>Median</dt>
            <dd>{c.median}</dd>
            <dt>Interquartile range</dt>
            <dd>{c.range}</dd>
            <dt>Mean</dt>
            <dd>{c.mean}</dd>
            <dt>Stories</dt>
            <dd>{c.stories}</dd>
            <dt>Median age</dt>
            <dd>{c.age}</dd>
          </dl>
        ) : (
          <p>Fewer than {minN} stories, so this group is not shown.</p>
        )}
      </div>
    );
  };

  const column = (p, col) => {
    const refX = isShown(p.overall) ? L.x(p.overall.median) : null;
    const points = p.rows.map((r, i) => (isShown(r.stats) ? { x: L.x(r.stats.median), y: L.rowY(i), small: r.stats.n < smallN } : null));
    const joined = points.filter(Boolean);
    const path = d.variable.bins.ordered && joined.length > 1 ? joined.map((pt, k) => `${k ? "L" : "M"}${pt.x},${pt.y}`).join("") : null;
    const tab = Math.min(focusIdx[col], labels.length - 1);
    const active = shown?.col === col ? shown.i : null;
    return (
      <div className="age-col">
        <svg
          width={L.colW}
          height={L.height}
          role="group"
          aria-label={`${p.subset.label}: ${formatCount(p.gd?.n ?? 0)} stories${p.verdict ? `, ${plain(p.verdict)}` : ""}`}
        >
          <g aria-hidden="true">
            {L.ticks.map((t) => (
              <g key={t.v}>
                <line className="age-grid-line" x1={t.x} x2={t.x} y1={AGE_TICKS - 4} y2={L.height} />
                {t.text && (
                  <text className="age-tick" x={t.labelX} y={13} textAnchor="middle">
                    {t.text}
                  </text>
                )}
              </g>
            ))}
            {refX != null && <line className="age-ref" x1={refX} x2={refX} y1={AGE_TICKS - 4} y2={L.height} />}
            {path && <path className="age-line" d={path} />}
          </g>
          {p.rows.map((r, i) => {
            const pt = points[i];
            const y = L.rowY(i);
            return (
              <g
                key={i}
                ref={(el) => {
                  cells.current[`${col}-${i}`] = el;
                }}
                className={`age-cell${active === i ? " active" : ""}`}
                role="img"
                tabIndex={i === tab ? 0 : -1}
                aria-label={name(col, i)}
                onPointerEnter={(e) => {
                  // no hover details in the phone layout: a line appearing under the chart would move the page
                  if (e.pointerType === "mouse" && !L.phone) setShown((s) => (s?.by === "tap" ? s : { col, i, by: "hover" }));
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === "mouse") setShown((s) => (s?.by === "hover" ? null : s));
                }}
                onFocus={() => {
                  setFocusIdx((f) => f.map((v, c) => (c === col ? i : v)));
                  setShown((s) => (s?.by === "tap" ? s : { col, i, by: "focus" }));
                }}
                onBlur={() => setShown((s) => (s?.by === "focus" && s.col === col && s.i === i ? null : s))}
                onClick={() => setShown((s) => (s?.by === "tap" && s.col === col && s.i === i ? null : { col, i, by: "tap" }))}
                onKeyDown={(e) => onKey(e, col, i)}
              >
                <rect className="age-hit" x={0} y={y - AGE_ROW / 2} width={L.colW} height={AGE_ROW} />
                {pt ? (
                  <circle className={pt.small ? "age-dot hollow" : "age-dot"} cx={pt.x} cy={y} r={pt.small ? 4.5 : 5} />
                ) : (
                  // at the start of the row, like a dash in a table cell (on the dashed line it would read as "+")
                  <line className="age-dash" x1={L.x(L.lo)} x2={L.x(L.lo) + 10} y1={y} y2={y} />
                )}
              </g>
            );
          })}
        </svg>
        {card(col)}
      </div>
    );
  };

  const heading = (p) => (
    <div className="age-period-head">
      <h4>
        <span className="visually-hidden">{p.subset.label}</span>
        <span aria-hidden="true">{shortPeriod(p.subset.label)}</span>
      </h4>
      <p className="age-period-meta">{formatCount(p.gd?.n ?? 0)} stories</p>
      {p.verdict && <p className={`age-verdict ${p.direction > 0 ? "up" : p.direction < 0 ? "down" : "flat"}`}>{p.verdict}</p>}
    </div>
  );

  // the group labels, once (beside each stacked period when the columns do not fit side by side)
  const labelColumn = (col) => (
    <div className="age-labels" aria-hidden="true" style={{ paddingTop: AGE_TICKS }}>
      {labels.map((label, i) => (
        <div key={label} className={`age-label${shown?.i === i && (L.side || shown.col === col) ? " active" : ""}`} style={{ height: AGE_ROW }}>
          {label}
        </div>
      ))}
    </div>
  );

  const c = shown && details(shown.col, shown.i);
  const line = shown && (
    <>
      <b>{labels[shown.i]}</b>, {periods[shown.col].subset.label.toLowerCase()}:{" "}
      {c ? (
        <>
          median {c.median} · interquartile range {c.range} · mean {c.mean} · {c.stories} stories · median age {c.age}.
        </>
      ) : (
        <>fewer than {minN} stories, so this group is not shown.</>
      )}
      {shown.by === "tap" && <span className="muted"> Tap again to close.</span>}
    </>
  );
  const grid = (cols) => ({ gridTemplateColumns: `${L.labelW}px repeat(${cols}, ${L.colW}px)`, columnGap: L.gap });

  return (
    <div ref={ref} className="age-chart">
      <p className="age-axis-title" aria-hidden="true">
        {d.metric.label}
        {L.lo > 0 ? ` (the axis starts at ${Number(L.lo.toFixed(2)).toLocaleString("en-US")})` : ""}
      </p>
      {L.side ? (
        <div className={`age-grid${L.colW < 110 ? " narrow" : ""}`} style={grid(3)}>
          <div />
          {periods.map((p) => (
            <div key={p.id}>{heading(p)}</div>
          ))}
          {labelColumn(null)}
          {periods.map((p, col) => (
            <div key={p.id}>{column(p, col)}</div>
          ))}
        </div>
      ) : (
        periods.map((p, col) => (
          <div key={p.id} className={`age-grid stacked${L.colW < 110 ? " narrow" : ""}`} style={grid(1)}>
            <div />
            {heading(p)}
            {labelColumn(col)}
            {column(p, col)}
          </div>
        ))
      )}
      {L.phone && (
        <>
          {/* a tap's details are announced; a focused group's name already says the same, so its line is not */}
          <p className="row-details" aria-live="polite">
            {shown?.by === "tap" ? line : null}
          </p>
          <p className="row-details" aria-hidden="true">
            {shown && shown.by !== "tap" ? line : null}
          </p>
        </>
      )}
      <AgeTable meta={meta} d={d} periods={periods} labels={labels} />
    </div>
  );
}

/** The numbers for screen readers, instead of the dots: each group's median and number of stories, period by period. */
function AgeTable({ meta, d, periods, labels }) {
  // one number of decimals for every median in the table, as in the main chart's numbers
  const medians = periods.flatMap((p) => [...p.rows.map((r) => r.stats), p.overall]).filter(isShown).map((s) => s.median);
  const decimals = columnDecimals(medians, d.metric.format);
  const cell = (s) =>
    isShown(s) ? `median ${formatFixed(s.median, decimals)}, ${formatCount(s.n)} stories` : `fewer than ${meta.min_n} stories`;
  // in a hidden box: a table is as wide as its content, whatever its own width says
  return (
    <div className="visually-hidden">
      <table>
        <caption>
          {chartTitle({ variable: d.variable, metric: d.metric, genre: d.genre, direction: 0 })}, within three publication
          periods: each group’s median and number of stories
        </caption>
        <thead>
          <tr>
            <th scope="col">Group</th>
            {periods.map((p) => (
              <th scope="col" key={p.id}>
                {p.subset.label}
                {p.verdict ? `: ${plain(p.verdict)}` : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {periods.map((p) => (
                <td key={p.id}>{cell(p.rows[i].stats)}</td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row">All stories shown</th>
            {periods.map((p) => (
              <td key={p.id}>{cell(p.overall)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * The chart of "Check stories of similar age": loads the three existing files (one per period) on demand, then draws
 * them as one aligned chart.
 */
export default function AgeCheckCharts({ meta, view, d }) {
  const [files, setFiles] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all(PERIODS.map((p) => loadVariable(view.v, p))).then(
      (fs) => live && setFiles(fs),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [view.v]);

  if (failed) return <p className="muted">We couldn’t load these charts. Check your connection and try again.</p>;
  if (!files) return <AgeCheckPlaceholder groups={d.variable.bins.labels.length} />;
  const periods = PERIODS.map((p, i) => {
    const gd = files[i].g[view.genre];
    const pat = pattern(gd, d.k);
    return {
      id: p,
      subset: meta.subsets.find((s) => s.id === p),
      gd,
      rows: groupRows(d.variable, gd, d.k),
      overall: cellStats(gd?.o, d.k),
      verdict: verdictWords(d.variable, pat),
      direction: pat[0],
    };
  });
  return <AgeChart meta={meta} d={d} periods={periods} />;
}
