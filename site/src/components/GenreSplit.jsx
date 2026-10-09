import { useId, useRef } from "react";
import { chartDomain, comparison, formatNumber, formatPercent, plainUnit, rowDetails, tickFormatFor } from "../lib/genres.js";
import { SPLIT_SIDE, splitLayout } from "../lib/genreLayout.js";
import { GenreRowDetails, useGenreDetails } from "./GenreDetails.jsx";
import useWidth from "./useWidth.js";

/** Each genre's stories above 0 and their quartiles, for the split chart. */
export function splitRows(rows, variable, minN) {
  return rows.map((row) => {
    const s = row.stats;
    const cmp = comparison(row, variable, "zero");
    return {
      index: row.i,
      label: row.genre.name,
      n: s?.n ?? null,
      share: s ? s.share : null,
      shareText: s ? `${cmp?.mark ? `${cmp.mark} ` : ""}${formatPercent(s.share)}` : "",
      allShareText: s ? formatPercent(s.share) : "",
      above: s && s.median != null ? { n: s.above, p25: s.p25, median: s.median, p75: s.p75 } : null,
      small: row.small,
      noneText: `Fewer than ${minN} stories`,
      // under the heading "Among stories above 0", the copy's own words say it (and fit a 320 px phone)
      fewAboveText: `Fewer than ${minN} stories`,
    };
  });
}

/** The headings of the two halves: "Stories above 0", "Among stories above 0 (per 1,000 words)". */
export function splitHeadings(variable, fmt) {
  const unit = plainUnit(variable, fmt);
  return ["Stories above 0", `Among stories above 0${unit ? ` (${unit})` : ""}`];
}

/**
 * A mostly-zero characteristic in every genre (D6): where most stories score 0, a plain median would read 0 in most
 * genres, so the chart answers two questions: how many of a genre's stories are above 0 (a bar from 0 to 100%, its
 * share printed, with ▲ ▼ when the genre clearly differs), and how much among those stories (interquartile range and
 * median on its own scale). On screens from 760 px wide the two plots sit side by side, below they are stacked, the
 * share first, then the range under its heading, a genre per row in both. All genres is each plot's dashed line.
 */
export default function GenreSplit({ meta, variable, entry, rows, highlight, sub, title, onNavigate }) {
  const [ref, width] = useWidth(720, "genres");
  const sRows = splitRows(rows, variable, meta.min_n);
  const domain = chartDomain(sRows.map((r) => ({ stats: r.above })), "num");
  const [shareHead, rangeHead] = splitHeadings(variable, entry.fmt);
  const common = { meta, variable, entry, rows, sRows, domain, highlight, sub, title, onNavigate, width };
  return (
    <div ref={ref} className="genre-split">
      {width >= SPLIT_SIDE ? (
        <SplitPlot {...common} heads={[shareHead, rangeHead]} />
      ) : (
        <>
          <p className="split-head" aria-hidden="true">
            {shareHead}
          </p>
          <SplitPlot {...common} half="share" />
          <p className="split-head" aria-hidden="true">
            {rangeHead}
          </p>
          <SplitPlot {...common} half="range" />
        </>
      )}
    </div>
  );
}

/** One plot of the split chart, or both side by side (`half` null), with its rows, details and keyboard. */
function SplitPlot({ meta, variable, entry, rows, sRows, domain, highlight, sub, title, onNavigate, width, half = null, heads = null }) {
  const frame = useRef(null);
  const ids = useId();
  const titleId = `${ids}-title`;
  const hatchId = `${ids}-hatch`.replace(/:/g, "");
  const fmt = entry.fmt;
  const layout = splitLayout({
    rows: sRows,
    width,
    domain,
    printed: (v) => formatNumber(v, fmt),
    tickFormat: tickFormatFor("zero", fmt),
    half,
  });
  const byIndex = new Map(rows.map((r) => [r.i, r]));
  const d = useGenreDetails({
    ids: layout.rows.map((r) => r.index),
    frame,
    phone: layout.phone,
    byIndex,
    variable,
    entry,
    minN: meta.min_n,
  });
  const activeRow = d.active == null ? null : layout.rows.find((r) => r.index === d.active);
  const { share, range } = layout;
  const plots = [share, range].filter(Boolean);
  return (
    <>
      {heads && (
        <div
          className="split-heads"
          aria-hidden="true"
          style={{ gridTemplateColumns: `${share.x0}px ${range.x0 - share.x0}px minmax(0, 1fr)` }}
        >
          <span />
          <span>{heads[0]}</span>
          <span>{heads[1]}</span>
        </div>
      )}
      <div className={`range-chart genre-chart split-plot${half ? ` half-${half}` : ""}`}>
        <div className="chart-frame" ref={frame}>
          <span id={titleId} hidden>
            {title}
            {half === "share" ? " Stories above 0" : half === "range" ? " Among stories above 0" : ""}
          </span>
          <svg
            width={layout.width}
            height={layout.height}
            role="group"
            aria-labelledby={titleId}
            className={d.active != null ? "has-active" : undefined}
          >
            <defs>
              <pattern id={hatchId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="5" height="5" fill="#fff" />
                <line x1="0" y1="0" x2="0" y2="5" className="hatch-line" />
              </pattern>
            </defs>
            <g aria-hidden="true">
              {layout.rows.map((r) => {
                const row = byIndex.get(r.index);
                if (!row.all && row.genre.id !== highlight) return null;
                return (
                  <rect
                    key={r.index}
                    className={row.all ? "band-all" : "band-highlight"}
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
              {plots.flatMap((plot, p) =>
                plot.ticks.map((t) => (
                  <g key={`${p}-${t.v}`} className="tick-mark">
                    <line className="grid" x1={t.x} x2={t.x} y1={layout.top - 4} y2={layout.height - 22} />
                    <text className="tick" x={t.x} y={layout.top - 10} textAnchor="middle">
                      {t.text}
                    </text>
                  </g>
                )),
              )}
              {layout.storiesHead && (
                <text className="tick stories-head" x={layout.storiesHead.x} y={layout.storiesHead.y} textAnchor="end">
                  {layout.storiesHead.text}
                </text>
              )}
              {layout.refs.map((ref) => (
                <g key={ref.text} className="ref">
                  <line x1={ref.x} x2={ref.x} y1={layout.top - 4} y2={layout.height - 22} />
                  <text className="reflab" x={ref.labelX} y={ref.labelY} textAnchor="middle">
                    {ref.text}
                  </text>
                </g>
              ))}
            </g>
            {layout.rows.map((r, ri) => {
              const row = byIndex.get(r.index);
              const cls = [
                "row",
                row.small && "small",
                !row.stats && "hidden-group",
                row.all && "all",
                row.genre.id === highlight && "highlight",
                d.active === r.index && "active",
              ].filter(Boolean);
              const fill = row.small ? `url(#${hatchId})` : undefined;
              return (
                <g
                  key={r.index}
                  {...d.rowProps(ri, r.index)}
                  className={cls.join(" ")}
                  role="img"
                  aria-label={rowDetails(row, variable, entry, meta.min_n).name}
                >
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
                  {r.none && (
                    <text className="gnone" x={r.none.x} y={r.none.y}>
                      {r.none.text}
                    </text>
                  )}
                  {share && r.shareX != null && (
                    <>
                      <rect
                        className="share-bar"
                        x={share.x0}
                        y={r.cy - 5}
                        width={Math.max(1, r.shareX - share.x0)}
                        height={10}
                        rx={5}
                        fill={fill}
                      />
                      <circle className="median" cx={r.shareX} cy={r.cy} r={6} />
                      <text className="gval" x={r.shareValue.x} y={r.shareValue.y} textAnchor="end">
                        {r.shareValue.text}
                      </text>
                    </>
                  )}
                  {range && r.bar && (
                    <>
                      <rect className="iqr" x={r.bar.x} y={r.cy - 5} width={r.bar.width} height={10} rx={5} fill={fill} />
                      <circle className="median" cx={r.dotX} cy={r.cy} r={6} />
                      <text className="gval" x={r.median.x} y={r.median.y} textAnchor="end">
                        {r.median.text}
                      </text>
                    </>
                  )}
                  {range && r.fewAbove && (
                    <text className="gnone" x={r.fewAbove.x} y={r.fewAbove.y}>
                      {r.fewAbove.text}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <GenreRowDetails
            d={d}
            phone={layout.phone}
            geom={activeRow}
            x={activeRow?.shareX ?? activeRow?.dotX ?? layout.labelW + 120}
            height={layout.height}
            width={layout.width}
            sub={sub}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    </>
  );
}
