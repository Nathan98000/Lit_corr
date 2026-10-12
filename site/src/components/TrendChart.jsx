import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { PHONE } from "../lib/rangeLayout.js";
import { splitLayout, trendLayout } from "../lib/trendLayout.js";
import { periodName, periodWords, trendAxisTitle, trendCells, trendChartInput, trendFormat, trendSplitInputs } from "../lib/trends.js";
import useGlide from "./useGlide.js";
import useRowDetails from "./useRowDetails.js";
import useWidth from "./useWidth.js";

const sameTick = (a, b) => Math.abs(a.v - b.v) < 1e-9;

/** The window's height, kept up to date: a short window draws a shorter plot (plotHeight in trendLayout.js). */
export function useViewportHeight() {
  const [height, setHeight] = useState(() => (typeof window !== "undefined" && window.innerHeight) || null);
  useEffect(() => {
    const on = () => setHeight(window.innerHeight);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return height;
}

/**
 * An axis gliding to another genre or option (useGlide): the domain (the layout's, which may reach past its outer
 * ticks) and the marks glide together on one scale in every frame; the old ticks fade out while the new ones fade in.
 * `marks`: per period an array of numbers or null. Returns { y, marks, ticks (with their opacity), gliding }.
 */
export function useAxisGlide(layout, marks, key) {
  const glide = useGlide([layout.domain, ...marks], key, layout.ticks);
  const [[lo, hi], ...now] = glide.values;
  const y = (v) => layout.bottom - ((v - lo) / (hi - lo || 1)) * layout.plotH;
  const ticks =
    glide.gliding && glide.from
      ? [
          ...glide.from.filter((t) => !layout.ticks.some((u) => sameTick(u, t))).map((t) => ({ ...t, fade: 1 - glide.progress })),
          ...layout.ticks.map((t) => ({ ...t, fade: glide.from.some((u) => sameTick(u, t)) ? 1 : glide.progress })),
        ]
      : layout.ticks.map((t) => ({ ...t, fade: 1 }));
  const inAxis = (v) => v >= lo - 1e-9 && v <= hi + 1e-9;
  return { y, marks: now, ticks: ticks.filter((t) => inAxis(t.v)), gliding: glide.gliding };
}

/** The value axis: its grid lines and tick labels (at their faded opacity while an axis glides). */
export function Ticks({ layout, ticks, y }) {
  return ticks.map((t) => (
    <g key={`${t.v}`} className="tick-mark" style={t.fade < 1 ? { opacity: t.fade } : undefined}>
      <line className="grid" x1={layout.gutter - 4} x2={layout.width} y1={y(t.v)} y2={y(t.v)} />
      <text className="tick" x={t.x} y={y(t.v) + 4} textAnchor="end">
        {t.text}
      </text>
    </g>
  ));
}

/**
 * The table under the plot, aligned with the columns and hidden from screen readers (each period's name says its
 * numbers): the periods, the medians or shares (smaller when long values would crowd a phone: trendLayout), the stories,
 * the rows' heads, the brackets of the two windows compared with their numbers ("2000–2009 · median 2,810", on two
 * lines where they don't fit), and "not compared" between them, under the periods outside both windows.
 */
export function Table({ layout }) {
  const valueStyle = layout.valueSize !== 13 ? { fontSize: `${layout.valueSize}px` } : undefined;
  return (
    <g aria-hidden="true" className="trend-table">
      {layout.columns.map((c) => (
        <g key={c.i}>
          {c.lines.map((l) => (
            <text key={l.y} className="tick period" x={c.x} y={l.y} textAnchor="middle">
              {l.text}
            </text>
          ))}
          {c.value && (
            <text className="gval" x={c.value.x} y={c.value.y} textAnchor="middle" style={valueStyle}>
              {c.value.text}
            </text>
          )}
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
          {b.lines.map((l) => (
            <text key={l.y} x={l.x} y={l.y} textAnchor={l.anchor}>
              {l.text}
            </text>
          ))}
        </g>
      ))}
      {layout.notCompared && (
        <text className="not-compared" x={layout.notCompared.x} y={layout.notCompared.y} textAnchor="middle">
          {layout.notCompared.text}
        </text>
      )}
    </g>
  );
}

/**
 * The hatching of a period under SMALL_N stories, as the explorer's capsules have it; in gray (`${id}-mid`) for a period
 * outside both windows.
 */
export const Hatch = ({ id }) => (
  <defs>
    <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="5" height="5" fill="#fff" />
      <line x1="0" y1="0" x2="0" y2="5" className="hatch-line" />
    </pattern>
    <pattern id={`${id}-mid`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="5" height="5" fill="#fff" />
      <line x1="0" y1="0" x2="0" y2="5" className="hatch-line mid" />
    </pattern>
  </defs>
);

/**
 * The periods as one tab stop with their details (useRowDetails, with ← → for columns): a card beside the column on
 * wider charts, the line under the chart on phones, which sticks to the bottom of the screen and never covers a column
 * focused from the keyboard. `words` and `labels` per period; `place(i)` puts the card ({ x0, x1, x, top } in the
 * frame's coordinates). Returns { rowProps, active, details } (`details` to render after the svg).
 */
export function usePeriodDetails({ ids, frame, phone, words, labels, place, width }) {
  const detailsRef = useRef(null);
  const { shown, setShown, rowProps } = useRowDetails({ ids, frame, phone, within: detailsRef, columns: true });
  const active = shown?.i ?? null;
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
  const details = phone ? (
    <div
      ref={detailsRef}
      className={`row-details trend-line-details${active == null ? " empty" : ""}`}
      onKeyDown={(e) => e.key === "Escape" && setShown(null)}
    >
      <span aria-live="polite">{shown?.by === "tap" && active != null ? <Line label={labels[active]} words={words[active]} /> : null}</span>
      <span aria-hidden="true">{active != null && shown?.by !== "tap" ? <Line label={labels[active]} words={words[active]} /> : null}</span>
      {shown?.by === "tap" && <span className="muted"> Tap again to close.</span>}
    </div>
  ) : (
    active != null && (
      <Card label={labels[active]} words={words[active]} at={place(active)} width={width} cardRef={detailsRef} pinned={shown.by === "tap"} />
    )
  );
  return { rowProps, active, details };
}

const Line = ({ label, words }) => (
  <>
    <b>{label}</b> {words.join(" · ")}
  </>
);

/** A period's details on wider charts: a card beside its column, at the plot's top, on the side with more room. */
function Card({ label, words, at, width, cardRef, pinned }) {
  const right = at.x < width / 2;
  const style = right ? { left: at.x1 - 4, top: at.top } : { right: width - at.x0 - 4, top: at.top };
  return (
    <div ref={cardRef} className={`chart-tip trend-tip${pinned ? " pinned" : ""}`} style={style} aria-hidden="true">
      <strong>{label}</strong>
      <p>{words.join(" · ")}</p>
    </div>
  );
}

/**
 * A num or bin column's marks: the capsule (num) and the dot, the capsule hatched and the dot hollow under SMALL_N (a
 * yes/no share is a dot alone, as on a line chart); "Fewer than 10" under MIN_N. A period outside both windows draws in
 * gray (the row's class "middle"; its hatching gray too).
 */
function ColumnMarks({ kind, col, m, y, hatchId, dx = 0, dy = 0 }) {
  const hatch = col.small ? { fill: `url(#${hatchId}${col.middle ? "-mid" : ""})` } : undefined;
  const x = col.x + dx;
  return (
    <>
      {m && kind !== "bin" && (
        <rect
          className="iqr"
          x={x - 6}
          y={dy + Math.min(y(m[2]), y(m[1]) - 6)}
          width={12}
          height={Math.max(12, y(m[0]) - y(m[2]))}
          rx={6}
          style={hatch}
        />
      )}
      {m && <circle className="median" cx={x} cy={dy + y(kind === "bin" ? m[0] : m[1])} r={6} />}
      {col.none?.map((l) => (
        <text key={l.text} className="gnone" x={l.x + dx} y={l.y + dy} textAnchor="middle">
          {l.text}
        </text>
      ))}
    </>
  );
}

/**
 * The thin gray line through the medians (or the shares), under the marks; it breaks where a period isn't drawn (fewer
 * than MIN_N stories), so no segment joins the periods on either side of it.
 */
function medianLine(layout, marks, y, kind) {
  const runs = [[]];
  marks.forEach((m, i) => {
    if (m) runs[runs.length - 1].push([layout.columns[i].x, y(kind === "bin" ? m[0] : m[1])]);
    else runs.push([]);
  });
  return runs
    .filter((r) => r.length > 1) // a period alone between two gaps has its dot and no line
    .map((r) => r.map(([x, yy], k) => `${k ? "L" : "M"}${x.toFixed(1)},${yy.toFixed(1)}`).join(" "))
    .join(" ");
}

const markValues = (kind) => (c) => (c ? (kind === "bin" ? [c.share] : [c.p25, c.median, c.p75]) : null);

/**
 * One characteristic over time (View 1, section 3.1), for numbers (num: each period's interquartile range as an upright
 * capsule and its median as a dot) and yes/no characteristics (bin: a dot at the share of stories that have it), the
 * dots joined by a thin gray line that breaks where a period isn't drawn; the two windows compared in blue, the periods
 * between them in gray ("not compared"); under the plot, aligned with the columns, the periods, their medians (or
 * shares) and their stories (an asterisk under SMALL_N), and the brackets of the two windows compared, with the
 * windows' numbers. A period with fewer than SMALL_N stories has a hollow dot (and a hatched capsule); under MIN_N
 * nothing is drawn and the column says "Fewer than 10". The table and the brackets are hidden from screen readers:
 * each period's name says its numbers.
 *
 * One tab stop: ← → (and ↑ ↓), Home and End move between the periods; the focused or hovered period's details show as a
 * card beside its column (wider charts) or a line under the chart (phones). Another genre or option glides the marks
 * and the axis on one scale in every frame; another characteristic draws a new chart, which fades in.
 */
export default function TrendChart({ meta, variable, entry, file, title }) {
  const kind = entry.k;
  const [ref, width] = useWidth(720, "trends");
  const frame = useRef(null);
  const ids = useId();
  const titleId = `${ids}-title`;
  const hatchId = `${ids}-hatch`.replace(/:/g, "");
  const viewportH = useViewportHeight();
  const input = trendChartInput(meta, variable, entry, file);
  const layout = trendLayout({ width, ...input, viewportH });
  const phone = layout.width < PHONE;
  const g = useAxisGlide(layout, input.cells.map(markValues(kind)), `${variable.id}|${kind}|${layout.width}|${file.periods.length}`);
  const words = layout.columns.map((c) => periodWords({ variable, entry, cell: input.cells[c.i], fmt: input.fmt, minN: meta.min_n }));
  const d = usePeriodDetails({
    ids: layout.columns.map((c) => c.i),
    frame,
    phone,
    words,
    labels: layout.columns.map((c) => c.period),
    width: layout.width,
    place: (i) => ({ ...layout.columns[i], top: layout.top }),
  });
  const line = medianLine(layout, g.marks, g.y, kind);

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
          className={[d.active != null && "has-active", g.gliding && "gliding"].filter(Boolean).join(" ") || undefined}
        >
          <Hatch id={hatchId} />
          <g aria-hidden="true">
            <Ticks layout={layout} ticks={g.ticks} y={g.y} />
            {line && <path className="trend-line" d={line} />}
          </g>
          {layout.columns.map((c, ci) => {
            const cls = ["row", "col", c.small && "small", c.middle && "middle", !c.ok && "hidden-group", d.active === c.i && "active"];
            return (
              <g key={c.i} {...d.rowProps(ci, c.i)} className={cls.filter(Boolean).join(" ")} role="img" aria-label={periodName(c.period, words[ci])}>
                <rect className="row-hit" x={c.x0} y={0} width={c.x1 - c.x0} height={layout.height - 30} />
                <ColumnMarks kind={kind} col={c} m={g.marks[ci]} y={g.y} hatchId={hatchId} />
              </g>
            );
          })}
          <Table layout={layout} />
        </svg>
        {d.details}
      </div>
    </div>
  );
}

/**
 * A mostly-zero characteristic over time (section 3.1): the split chart in one svg, so the PNG keeps both halves.
 * "Stories with any": each period's share of stories above 0, as share columns; "Among stories with any": the
 * interquartile range and median of those stories, as range columns on their own axis, with how many there are under
 * each period (hatched under SMALL_N, nothing drawn under MIN_N). The halves sit side by side from a 760 px screen and
 * are stacked below. A period is one row across both halves: hovering or focusing it lights it in both, and its
 * details say both in the Genres page's words ("11% with any · among those, median …"); the card goes beside the
 * column the pointer is on.
 */
export function TrendSplit({ meta, variable, entry, file, title }) {
  const [ref, width] = useWidth(720, "trends");
  const frame = useRef(null);
  const ids = useId();
  const titleId = `${ids}-title`;
  const hatchId = `${ids}-hatch`.replace(/:/g, "");
  const viewportH = useViewportHeight();
  const halves = trendSplitInputs(meta, variable, entry, file);
  const split = splitLayout({ width, halves, viewportH });
  const [A, B] = split.halves;
  const phone = split.width < PHONE;
  const key = `${variable.id}|zero|${split.width}|${file.periods.length}`;
  const glides = [
    useAxisGlide(A.layout, halves[0].input.cells.map(markValues("bin")), `${key}|any`),
    useAxisGlide(B.layout, halves[1].input.cells.map(markValues("num")), `${key}|among`),
  ];
  const kinds = ["bin", "num"];
  const fmt = trendFormat(variable, entry, file.g === "all", meta.small_n);
  const cells = trendCells(entry, file.g === "all", meta.small_n);
  const words = A.layout.columns.map((c) => periodWords({ variable, entry, cell: cells[c.i], fmt, minN: meta.min_n }));
  const [half, setHalf] = useState(0); // the half the pointer is on, where the card goes
  const d = usePeriodDetails({
    ids: A.layout.columns.map((c) => c.i),
    frame,
    phone,
    words,
    labels: A.layout.columns.map((c) => c.period),
    width: split.width,
    place: (i) => {
      const h = split.halves[half];
      const c = h.layout.columns[i];
      return { x0: c.x0 + h.dx, x1: c.x1 + h.dx, x: c.x + h.dx, top: h.dy + h.layout.top };
    },
  });

  return (
    <div ref={ref} className={`range-chart trend-chart trend-split kind-zero${split.side ? " side" : ""}${phone ? " phone" : ""}`}>
      <div className="chart-frame" ref={frame}>
        <span id={titleId} hidden>
          {title}
        </span>
        <svg
          width={split.width}
          height={split.height}
          role="group"
          aria-labelledby={titleId}
          className={[d.active != null && "has-active", glides.some((g) => g.gliding) && "gliding"].filter(Boolean).join(" ") || undefined}
        >
          <Hatch id={hatchId} />
          {split.halves.map((h, k) => (
            <g key={k} aria-hidden="true" transform={`translate(${h.dx},${h.dy})`}>
              <text className="half-title" x={h.title.x} y={h.title.y}>
                {h.title.text}
              </text>
              <text className="half-axis-title" x={h.axisTitle.x} y={h.axisTitle.y}>
                {h.axisTitle.text}
              </text>
              <Ticks layout={h.layout} ticks={glides[k].ticks} y={glides[k].y} />
              <path className="trend-line" d={medianLine(h.layout, glides[k].marks, glides[k].y, kinds[k])} />
            </g>
          ))}
          {A.layout.columns.map((c, ci) => {
            const cls = ["row", "col", c.middle && "middle", !c.ok && "hidden-group", d.active === c.i && "active"];
            return (
              <g key={c.i} {...d.rowProps(ci, c.i)} className={cls.filter(Boolean).join(" ")} role="img" aria-label={periodName(c.period, words[ci])}>
                {split.halves.map((h, k) => {
                  const col = h.layout.columns[ci];
                  return (
                    <g key={k} className={`half${col.small ? " small" : ""}`} onPointerEnter={() => setHalf(k)}>
                      <rect
                        className="row-hit"
                        x={col.x0 + h.dx}
                        y={h.dy + h.layout.top - 8}
                        width={col.x1 - col.x0}
                        height={h.layout.height - 30 - h.layout.top + 8}
                      />
                      <ColumnMarks
                        kind={kinds[k]}
                        col={col}
                        m={glides[k].marks[ci]}
                        y={glides[k].y}
                        hatchId={hatchId}
                        dx={h.dx}
                        dy={h.dy}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
          {split.halves.map((h, k) => (
            <g key={k} transform={`translate(${h.dx},${h.dy})`}>
              <Table layout={h.layout} />
            </g>
          ))}
        </svg>
        {d.details}
      </div>
    </div>
  );
}
