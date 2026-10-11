import { useId, useLayoutEffect, useRef } from "react";
import { PHONE } from "../lib/rangeLayout.js";
import { trendLayout } from "../lib/trendLayout.js";
import { periodName, periodWords, trendAxisTitle, trendChartInput } from "../lib/trends.js";
import useGlide from "./useGlide.js";
import useRowDetails from "./useRowDetails.js";
import useWidth from "./useWidth.js";

const sameTick = (a, b) => Math.abs(a.v - b.v) < 1e-9;

/**
 * One characteristic over time (View 1, section 3.1), for numbers (num: each period's interquartile range as an upright
 * capsule and its median as a dot) and yes/no characteristics (bin: a bar from 0 to the share of stories that have
 * it, with a dot on top), the dots joined by a thin line; under the plot, aligned with the columns, the periods, their
 * medians (or shares) and their stories (an asterisk under SMALL_N), and the brackets of the two windows compared. A
 * period with fewer than SMALL_N stories is hatched with a hollow dot; under MIN_N nothing is drawn and the column says
 * "Fewer than 10". The table and the brackets are hidden from screen readers: each period's name says its numbers.
 *
 * One tab stop: ← → (and ↑ ↓), Home and End move between the periods; the focused or hovered period's details show as a
 * card beside its column (wider charts) or a line under the chart (phones). Another genre or option glides the marks
 * and the axis on one scale in every frame; another characteristic draws a new chart, which fades in.
 */
export default function TrendChart({ meta, variable, entry, file, title }) {
  const kind = entry.k;
  const { min_n: minN } = meta;
  const [ref, width] = useWidth(720, "trends");
  const frame = useRef(null);
  const ids = useId();
  const titleId = `${ids}-title`;
  const hatchId = `${ids}-hatch`.replace(/:/g, "");
  const input = trendChartInput(meta, variable, entry, file);
  const { fmt, cells, axis } = input;
  const layout = trendLayout({ width, ...input });
  const phone = layout.width < PHONE;

  // the marks and the axis glide together to another genre or option (useGlide); another characteristic or width jumps
  const glide = useGlide(
    [[axis.lo, axis.hi], ...cells.map((c) => (c ? (kind === "bin" ? [c.share] : [c.p25, c.median, c.p75]) : null))],
    `${variable.id}|${kind}|${layout.width}|${file.periods.length}`,
    layout.ticks,
  );
  const [[lo, hi], ...marks] = glide.values;
  const y = (v) => layout.bottom - ((v - lo) / (hi - lo || 1)) * layout.plotH;
  const ticks =
    glide.gliding && glide.from
      ? [
          ...glide.from.filter((t) => !layout.ticks.some((u) => sameTick(u, t))).map((t) => ({ ...t, fade: 1 - glide.progress })),
          ...layout.ticks.map((t) => ({ ...t, fade: glide.from.some((u) => sameTick(u, t)) ? 1 : glide.progress })),
        ]
      : layout.ticks.map((t) => ({ ...t, fade: 1 }));
  const inAxis = (v) => v >= lo - 1e-9 && v <= hi + 1e-9;

  const words = layout.columns.map((c) => periodWords({ variable, entry, cell: cells[c.i], fmt, minN }));
  const detailsRef = useRef(null);
  const { shown, setShown, rowProps } = useRowDetails({ ids: layout.columns.map((c) => c.i), frame, phone, within: detailsRef, columns: true });
  const active = shown?.i ?? null;
  const activeCol = active == null ? null : layout.columns[active];
  // on phones the line sticks to the bottom of the screen: a column focused from the keyboard is never left under it
  useLayoutEffect(() => {
    if (!phone || shown?.by !== "focus") return;
    const col = document.activeElement;
    const line = detailsRef.current;
    if (!col || !line || !frame.current?.contains(col)) return;
    const box = line.getBoundingClientRect();
    if (!box.height || box.top >= window.innerHeight) return;
    const covered = col.getBoundingClientRect().bottom + 4 - box.top;
    if (covered > 0) window.scrollBy?.(0, covered);
  }, [phone, shown?.i, shown?.by]); // eslint-disable-line react-hooks/exhaustive-deps

  // smaller values when long numbers would crowd each other on a phone (trendLayout)
  const valueStyle = layout.valueSize !== 13 ? { fontSize: `${layout.valueSize}px` } : undefined;
  const line = marks
    .map((m, i) => (m ? [layout.columns[i].x, y(kind === "bin" ? m[0] : m[1])] : null))
    .filter(Boolean)
    .map(([x, yy], k) => `${k ? "L" : "M"}${x.toFixed(1)},${yy.toFixed(1)}`)
    .join(" ");

  return (
    <div ref={ref} className={`range-chart trend-chart kind-${kind}${phone ? " phone" : ""}`}>
      <p className="axis-title trend-axis-title" aria-hidden="true">
        {trendAxisTitle(variable, entry)}
      </p>
      <div className="chart-frame" ref={frame}>
        <span id={titleId} hidden>
          {title}
        </span>
        <svg
          width={layout.width}
          height={layout.height}
          role="group"
          aria-labelledby={titleId}
          className={[active != null && "has-active", glide.gliding && "gliding"].filter(Boolean).join(" ") || undefined}
        >
          <defs>
            <pattern id={hatchId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="#fff" />
              <line x1="0" y1="0" x2="0" y2="5" className="hatch-line" />
            </pattern>
          </defs>
          <g aria-hidden="true">
            {ticks.filter((t) => inAxis(t.v)).map((t) => (
              <g key={`${t.v}`} className="tick-mark" style={t.fade < 1 ? { opacity: t.fade } : undefined}>
                <line className="grid" x1={layout.gutter - 4} x2={layout.width} y1={y(t.v)} y2={y(t.v)} />
                <text className="tick" x={t.x} y={y(t.v) + 4} textAnchor="end">
                  {t.text}
                </text>
              </g>
            ))}
            {line && <path className="trend-line" d={line} />}
          </g>
          {layout.columns.map((c, ci) => {
            const m = marks[ci];
            const hatch = c.small ? { fill: `url(#${hatchId})` } : undefined;
            const cls = ["row", "col", c.small && "small", !c.ok && "hidden-group", active === c.i && "active"];
            return (
              <g key={c.i} {...rowProps(ci, c.i)} className={cls.filter(Boolean).join(" ")} role="img" aria-label={periodName(c.period, words[ci])}>
                <rect className="row-hit" x={c.x0} y={0} width={c.x1 - c.x0} height={layout.height - 30} />
                {m && kind === "bin" && (
                  <rect className="share-bar" x={c.bar.x} y={y(m[0])} width={c.bar.width} height={Math.max(1, layout.bottom - y(m[0]))} style={hatch} />
                )}
                {m && kind !== "bin" && (
                  <rect className="iqr" x={c.x - 6} y={Math.min(y(m[2]), y(m[1]) - 6)} width={12} height={Math.max(12, y(m[0]) - y(m[2]))} rx={6} style={hatch} />
                )}
                {m && <circle className="median" cx={c.x} cy={y(kind === "bin" ? m[0] : m[1])} r={6} />}
                {c.none?.map((l) => (
                  <text key={l.text} className="gnone" x={l.x} y={l.y} textAnchor="middle">
                    {l.text}
                  </text>
                ))}
              </g>
            );
          })}
          <g aria-hidden="true" className="trend-table">
            {layout.columns.map((c) => (
              <g key={c.i}>
                {c.lines.map((l) => (
                  <text key={l.y} className="tick period" x={c.x} y={l.y} textAnchor="middle">
                    {l.text}
                  </text>
                ))}
                <text className="gval" x={c.value.x} y={c.value.y} textAnchor="middle" style={valueStyle}>
                  {c.value.text}
                </text>
                <text className="gn" x={c.stories.x} y={c.stories.y} textAnchor="middle">
                  {c.stories.text}
                </text>
              </g>
            ))}
            {layout.heads.map((h) => (
              <text key={h.text} className="tick col-head" x={h.x} y={h.y}>
                {h.text}
              </text>
            ))}
            {layout.brackets.map((b) => (
              <g key={b.label} className="bracket">
                <path d={`M${b.x0},${b.y - 5} V${b.y} H${b.x1} V${b.y - 5}`} />
                <text x={b.labelX} y={b.labelY} textAnchor="middle">
                  {b.label}
                </text>
              </g>
            ))}
          </g>
        </svg>
        {phone ? (
          <div ref={detailsRef} className={`row-details trend-line-details${activeCol ? "" : " empty"}`} onKeyDown={(e) => e.key === "Escape" && setShown(null)}>
            <span aria-live="polite">{shown?.by === "tap" && activeCol ? <Line col={activeCol} words={words[activeCol.i]} /> : null}</span>
            <span aria-hidden="true">{activeCol && shown?.by !== "tap" ? <Line col={activeCol} words={words[activeCol.i]} /> : null}</span>
            {shown?.by === "tap" && <span className="muted"> Tap again to close.</span>}
          </div>
        ) : (
          activeCol && <Card col={activeCol} words={words[activeCol.i]} layout={layout} cardRef={detailsRef} pinned={shown.by === "tap"} />
        )}
      </div>
    </div>
  );
}

const Line = ({ col, words }) => (
  <>
    <b>{col.period}</b> {words.join(" · ")}
  </>
);

/** A period's details on wider charts: a card beside its column, at the plot's top, on the side with more room. */
function Card({ col, words, layout, cardRef, pinned }) {
  const right = col.x < layout.width / 2;
  const style = right ? { left: col.x1 - 4, top: layout.top } : { right: layout.width - col.x0 - 4, top: layout.top };
  return (
    <div ref={cardRef} className={`chart-tip trend-tip${pinned ? " pinned" : ""}`} style={style} aria-hidden="true">
      <strong>{col.period}</strong>
      <p>{words.join(" · ")}</p>
    </div>
  );
}
