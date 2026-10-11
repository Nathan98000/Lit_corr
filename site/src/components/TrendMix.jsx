import { useId, useRef } from "react";
import { bandPalette } from "../lib/genreLayout.js";
import { formatPercent } from "../lib/genres.js";
import { PHONE } from "../lib/rangeLayout.js";
import { mixSegments, trendLayout } from "../lib/trendLayout.js";
import { periodName, periodWords, trendChartInput, trendMixColors } from "../lib/trends.js";
import { Table, Ticks, usePeriodDetails } from "./TrendChart.jsx";
import useGlide from "./useGlide.js";
import useWidth from "./useWidth.js";

/**
 * Named groups (grp) and ordered bands (band) over time (View 1, section 3.1): one 100% column per period, the groups
 * in their own order from the bottom up, in the Genres page's colors (mixColors: the rank palette for named groups, the
 * largest over the chart's periods darkest; light to dark blues for bands; the palettes are in palettes.css). Shares
 * are printed inside segments at least 16 px tall where their ink reaches 4.5:1; every share is in the details and the
 * period's name. Under the plot the periods and their stories, and the brackets of the two windows compared. A period
 * under SMALL_N stories is hatched; under MIN_N nothing is drawn. One tab stop and details as TrendChart; another
 * genre or option glides the segments.
 */
export default function TrendMix({ meta, variable, entry, file, title }) {
  const kind = entry.k;
  const [ref, width] = useWidth(720, "trends");
  const frame = useRef(null);
  const ids = useId();
  const titleId = `${ids}-title`;
  const overId = `${ids}-over`.replace(/:/g, "");
  const input = trendChartInput(meta, variable, entry, file);
  const layout = trendLayout({ width, ...input });
  const phone = layout.width < PHONE;
  const labels = variable.bins.labels;
  const colors = trendMixColors(kind, input.cells, labels.length);
  const glide = useGlide(
    input.cells.map((c) => (c ? c.shares : null)),
    `${variable.id}|${kind}|${layout.width}|${file.periods.length}`,
  );
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
  const ticks = layout.ticks.map((t) => ({ ...t, fade: 1 }));
  const y = layout.y;
  const inks = colors.map((c) => c.ink);
  const bands = kind === "band" ? ` bands-${bandPalette(labels.length)}` : "";

  return (
    <div
      ref={ref}
      className={`range-chart trend-chart trend-mix kind-${kind}${bands}${phone ? " phone" : ""}`}
    >
      <div className="chart-frame" ref={frame}>
        <span id={titleId} hidden>
          {title}
        </span>
        <svg
          width={layout.width}
          height={layout.height}
          role="group"
          aria-labelledby={titleId}
          className={[d.active != null && "has-active", glide.gliding && "gliding"].filter(Boolean).join(" ") || undefined}
        >
          <defs>
            <pattern id={overId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" className="hatch-over" />
            </pattern>
          </defs>
          <g aria-hidden="true">
            <Ticks layout={layout} ticks={ticks} y={y} />
          </g>
          {layout.columns.map((c, ci) => {
            const shares = glide.values[ci];
            const cls = ["row", "col", c.small && "small", !c.ok && "hidden-group", d.active === c.i && "active"];
            const segments = shares ? mixSegments(layout, c, shares, inks, formatPercent) : [];
            return (
              <g key={c.i} {...d.rowProps(ci, c.i)} className={cls.filter(Boolean).join(" ")} role="img" aria-label={periodName(c.period, words[ci])}>
                <rect className="row-hit" x={c.x0} y={0} width={c.x1 - c.x0} height={layout.height - 30} />
                {segments.map((s) =>
                  s.height > 0 ? (
                    <rect key={s.b} className={`segment ${colors[s.b].cls}`} x={c.bar.x} y={s.y} width={c.bar.width} height={s.height} />
                  ) : null,
                )}
                {shares && c.small && (
                  <rect className="small-over" x={c.bar.x} y={layout.top} width={c.bar.width} height={layout.plotH} fill={`url(#${overId})`} />
                )}
                {shares && <rect className="bar-outline" x={c.bar.x} y={layout.top} width={c.bar.width} height={layout.plotH} />}
                {segments.map((s) =>
                  s.label ? (
                    <text key={`t${s.b}`} className={`seglab seg-ink-${colors[s.b].ink}`} x={s.label.x} y={s.label.y} textAnchor="middle">
                      {s.label.text}
                    </text>
                  ) : null,
                )}
                {c.none?.map((l) => (
                  <text key={l.text} className="gnone" x={l.x} y={l.y} textAnchor="middle">
                    {l.text}
                  </text>
                ))}
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
