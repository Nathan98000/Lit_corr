// Layouts of the Genres page's other forms (pure functions, so the geometry can be tested without a browser): the
// 100% bars of named groups and ordered bands, and the split chart of mostly-zero characteristics. They share the
// range chart's rows: a label column (two-line names in a 116 px column on phones), the stories in a column on wider
// screens or under the name on phones (below 250), rows 31 px tall on wider screens and at least 44 px on phones.

import { formatCount, stepDecimals, formatFixed } from "./format.js";
import { PHONE, niceTicks, textWidth, wrapLabel } from "./rangeLayout.js";

export const SPLIT_SIDE = 760; // from this width the mostly-zero chart's two plots sit side by side
const ROW = 31;
const PHONE_LABEL = 116;
const LABEL_SIZE = 14;
const COUNT_BELOW = 250;
const TOP = 30; // the band above the rows for tick labels and column headings

const box = (x, y, text, size, weight = 400, anchor = "start") => {
  const w = textWidth(text, size, weight);
  const x0 = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
  return { x0, x1: x0 + w, y0: y - size * 0.8, y1: y + size * 0.25 };
};

/**
 * The rows' geometry: for each row (index, label, n or null), its top and bottom, center, label lines and stories.
 * `storiesW` is the width of the Stories column (0 on phones).
 */
export function rowGrid({ rows, width, top = TOP }) {
  const phone = width < PHONE;
  const longest = Math.max(0, ...rows.map((r) => textWidth(r.label, LABEL_SIZE)));
  const labelW = phone ? PHONE_LABEL : Math.round(Math.min(220, Math.max(110, width * 0.25, longest + 4)));
  const storiesW = phone
    ? 0
    : Math.ceil(Math.max(textWidth("Stories", 12), ...rows.filter((r) => r.n != null).map((r) => textWidth(formatCount(r.n), 12.5))) + 18);
  let y = top;
  const laid = rows.map((r) => {
    const lines = phone ? wrapLabel(r.label, PHONE_LABEL - 2, LABEL_SIZE) : [r.label];
    const below = phone && r.n != null && r.n < COUNT_BELOW;
    const h = phone ? Math.max(44, 12 + 16 * lines.length + (below ? 13 : 0)) : ROW;
    const y0 = y;
    y += h;
    const cy = y0 + h / 2 + 2;
    const block = lines.length * 16 + (below ? 13 : 0);
    const first = phone ? cy - block / 2 + 12 : cy + 5;
    const labelLines = lines.map((text, k) => ({ text, x: labelW, y: first + 16 * k }));
    let count = null;
    if (r.n != null && !phone) count = { x: width, y: cy + 4.5, text: formatCount(r.n) };
    else if (below) count = { x: labelW, y: first + 16 * (lines.length - 1) + 14, text: `${formatCount(r.n)} stories` };
    const boxes = labelLines.map((l) => ({ kind: "label", ...box(l.x, l.y, l.text, LABEL_SIZE, 400, "end") }));
    if (count) boxes.push({ kind: "n", ...box(count.x, count.y, count.text, phone ? 12 : 12.5, 400, "end") });
    return { index: r.index, label: r.label, y0, y1: y, cy, labelLines, count, boxes };
  });
  return { phone, labelW, storiesW, rows: laid, bottom: y, storiesHead: storiesW ? { x: width, y: top - 10, text: "Stories" } : null };
}

const INK = "#1c1c22";

/** The relative luminance of a color written as #rrggbb or rgb(r g b) (WCAG). */
function luminance(color) {
  const m = color.startsWith("#")
    ? [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
    : color.match(/\d+/g).slice(0, 3).map(Number);
  const [r, g, b] = m.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The ink for a share printed on a fill: white where it has a contrast of 4.5:1 or more, else the page's ink. */
export function inkOn(fill) {
  return 1.05 / (luminance(fill) + 0.05) >= 4.5 ? "#fff" : INK;
}

const mix = (from, to, t) => `rgb(${from.map((a, k) => Math.round(a + (to[k] - a) * t)).join(" ")})`;

/**
 * Blues from light to dark, one per ordered band (the ordered bands' sequential palette): the first half light (dark
 * text on them), the second half dark (white text), skipping the middle blues, where neither reaches 4.5:1.
 */
export function bandColors(count) {
  const light = [[225, 235, 253], [143, 180, 244]]; // #e1ebfd to #8fb4f4
  const dark = [[61, 108, 192], [29, 74, 153]]; // #3d6cc0 to #1d4a99
  const nLight = Math.ceil(count / 2);
  const nDark = count - nLight;
  const step = (n, i) => (n === 1 ? 0 : i / (n - 1));
  return [
    ...Array.from({ length: nLight }, (_, i) => mix(light[0], light[1], step(nLight, i))),
    ...Array.from({ length: nDark }, (_, i) => mix(dark[0], dark[1], step(nDark, i))),
  ];
}

// named groups: the darkest color for the group that is largest across all genres, then the others by size
const GROUP_COLORS = ["#2b63c6", "#c9c3b8", "#d98a52", "#8fb4f4", "#efece6", "#a5a29a"];

/**
 * Each group's fill and the ink of its printed share: named groups by their size across all genres (the largest
 * darkest), ordered bands from light to dark in their order.
 */
export function mixColors(kind, allShares) {
  if (kind === "band") return bandColors(allShares.length).map((fill) => ({ fill, ink: inkOn(fill) }));
  const rank = allShares.map((s, b) => ({ s, b })).sort((a, c) => c.s - a.s || a.b - c.b);
  const out = [];
  rank.forEach(({ b }, k) => {
    const fill = GROUP_COLORS[Math.min(k, GROUP_COLORS.length - 1)];
    out[b] = { fill, ink: inkOn(fill) };
  });
  return out;
}

/**
 * The 100% bars: per genre (rows: { index, label, n, shares, mark }), one bar of the groups' shares in their order,
 * after a column for the mark (≠ for named groups, ▲ ▼ for bands). Shares are printed in segments at least 34 px wide.
 */
export function mixLayout({ rows, width }) {
  const top = width < PHONE ? 8 : 24; // room for the Stories heading on wider charts
  const grid = rowGrid({ rows, width, top });
  const markW = 18;
  const x0 = grid.labelW + 8 + markW + 6;
  const x1 = width - (grid.storiesW ? grid.storiesW : 0);
  const barW = Math.max(40, x1 - x0);
  const laid = grid.rows.map((g, i) => {
    const r = rows[i];
    const out = { ...g, mark: r.mark ? { x: grid.labelW + 8 + markW / 2, y: g.cy + 4.5, text: r.mark } : null };
    if (!r.shares) {
      out.none = { x: x0 + 2, y: g.cy + 4, text: r.noneText };
      out.boxes = [...g.boxes, { kind: "none", ...box(x0 + 2, g.cy + 4, r.noneText, 12.5) }];
      return out;
    }
    let x = x0;
    out.segments = r.shares.map((s, b) => {
      const w = s * barW;
      const seg = { b, x, width: w, share: s, labelX: x + w / 2 };
      x += w;
      return seg;
    });
    if (out.mark) out.boxes = [...g.boxes, { kind: "mark", ...box(out.mark.x, out.mark.y, out.mark.text, 13, 700, "middle") }];
    return out;
  });
  return { ...grid, width, height: grid.bottom + 8, top, barX: x0, barW, rows: laid };
}

/** Ticks for a share axis from 0 to 100% (fewer when the plot is narrow). */
function shareTicks(plotW) {
  const values = plotW >= 160 ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.5, 1];
  return values.map((v) => ({ v, text: `${Math.round(v * 100)}%` }));
}

/**
 * The split chart of a mostly-zero characteristic: the share of each genre's stories above 0 (a bar from 0 to 100%,
 * the share printed with ▲ ▼), and the interquartile range and median among those stories (its own scale and
 * ticks, the median printed). From SPLIT_SIDE px the two plots sit side by side; below, `half` ("share" or "range")
 * lays out one of them, stacked one after the other. rows: { index, label, n, share, shareText (with its mark),
 * above: { n, p25, median, p75 } | null, noneText, fewAboveText }; `domain` is the range plot's [lo, hi];
 * `printed(v)` writes a value of the range plot. All genres (the first row) is each plot's dashed line.
 */
export function splitLayout({ rows, width, domain, printed, tickFormat = null, half = null }) {
  const side = !half;
  const grid = rowGrid({ rows, width });
  const shareValW = Math.ceil(Math.max(36, ...rows.filter((r) => r.share != null).map((r) => textWidth(r.shareText, 13, 600))) + 12);
  const medValW = Math.ceil(Math.max(36, ...rows.filter((r) => r.above).map((r) => textWidth(printed(r.above.median), 13, 600))) + 12);
  const start = grid.labelW + 14;
  const end = width - grid.storiesW;
  let share = null;
  let range = null;
  if (side) {
    const room = end - start - shareValW - medValW - 28;
    const shareW = Math.max(80, Math.min(240, Math.round(room * 0.38)));
    share = { x0: start, x1: start + shareW, valueX: start + shareW + shareValW };
    range = { x0: share.valueX + 28, x1: end - medValW, valueX: end };
  } else if (half === "share") {
    share = { x0: start, x1: end - shareValW, valueX: end };
  } else {
    range = { x0: start, x1: end - medValW, valueX: end };
  }
  const out = { ...grid, width, top: TOP, side, half, share, range };
  if (share) {
    const w = share.x1 - share.x0;
    share.x = (v) => share.x0 + Math.min(Math.max(v, 0), 1) * w;
    share.ticks = shareTicks(w).map((t) => ({ ...t, x: share.x(t.v) }));
  }
  if (range) {
    const [lo, hi] = domain;
    const w = Math.max(40, range.x1 - range.x0);
    range.x = (v) => range.x0 + ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo || 1)) * w;
    let count = width < PHONE ? 4 : 5;
    for (;;) {
      const { step, ticks } = niceTicks(lo, hi, count);
      const text = tickFormat ? (v) => tickFormat(v, step) : (v) => formatFixed(v, stepDecimals(step));
      range.ticks = ticks.filter((t) => t >= lo - 1e-9 && t <= hi + 1e-9).map((v) => ({ v, x: range.x(v), text: text(v) }));
      const widest = Math.max(0, ...range.ticks.map((t) => textWidth(t.text, 12)));
      if (count <= 2 || widest + 10 <= (w * step) / (hi - lo || 1)) break;
      count -= 1;
    }
  }
  out.rows = grid.rows.map((g, i) => {
    const r = rows[i];
    const row = { ...g, boxes: [...g.boxes] };
    if (r.share == null) {
      const x = (share || range).x0 + 2;
      row.none = { x, y: g.cy + 4, text: r.noneText };
      row.boxes.push({ kind: "none", ...box(x, g.cy + 4, r.noneText, 12.5) });
      return row;
    }
    if (share) {
      row.shareX = share.x(r.share);
      row.shareValue = { x: share.valueX, y: g.cy + 4.5, text: r.shareText };
      row.boxes.push({ kind: "value", ...box(share.valueX, g.cy + 4.5, r.shareText, 13, 600, "end") });
    }
    if (range) {
      if (r.above) {
        const a = range.x(r.above.p25);
        const b = range.x(r.above.p75);
        const mid = (a + b) / 2;
        const w = Math.max(12, b - a);
        row.bar = { x: Math.min(a, mid - w / 2), width: w };
        row.dotX = range.x(r.above.median);
        row.median = { x: range.valueX, y: g.cy + 4.5, text: printed(r.above.median) };
        row.boxes.push({ kind: "median", ...box(range.valueX, g.cy + 4.5, row.median.text, 13, 600, "end") });
      } else {
        row.fewAbove = { x: range.x0 + 2, y: g.cy + 4, text: r.fewAboveText };
        row.boxes.push({ kind: "few", ...box(range.x0 + 2, g.cy + 4, r.fewAboveText, 12.5) });
      }
    }
    return row;
  });
  // All genres as each plot's dashed line, labeled under the plot ("All genres: 43%"), the label kept in its plot
  const all = rows[0];
  const refs = [];
  if (share && all.share != null) refs.push({ plot: share, v: all.share, text: `All genres: ${all.allShareText}` });
  if (range && all.above) refs.push({ plot: range, v: all.above.median, text: `All genres: ${printed(all.above.median)}` });
  out.height = grid.bottom + (refs.length ? 30 : 10);
  out.refs = refs.map(({ plot, v, text }) => {
    const x = plot.x(v);
    const w = textWidth(text, 12);
    const labelX = Math.min(Math.max(x, plot.x0 + w / 2), Math.max(plot.x0 + w / 2, plot.x1 - w / 2));
    return { x, labelX, labelY: out.height - 8, text, box: box(labelX, out.height - 8, text, 12, 400, "middle") };
  });
  return out;
}

/** Text boxes of a layout that overlap each other or leave the chart (for tests). */
export function layoutProblems(layout, pad = 1) {
  const boxes = layout.rows.flatMap((r) => r.boxes.map((b) => ({ ...b, row: r.index })));
  for (const ref of layout.refs || []) boxes.push({ kind: "ref", row: -1, ...ref.box });
  for (const plot of [layout.share, layout.range].filter(Boolean)) {
    for (const t of plot.ticks) {
      const w = textWidth(t.text, 12);
      boxes.push({ kind: "tick", row: -2, x0: t.x - w / 2, x1: t.x + w / 2, y0: layout.top - 20, y1: layout.top - 7 });
    }
  }
  const problems = [];
  for (const b of boxes) if (b.x0 < -0.5 || b.x1 > layout.width + 0.5) problems.push(["outside", b]);
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const c = boxes[j];
      if (a.x0 < c.x1 - pad && c.x0 < a.x1 - pad && a.y0 < c.y1 - pad && c.y0 < a.y1 - pad) problems.push(["overlap", a, c]);
    }
  }
  return problems;
}
