// Layouts of the Genres page's other forms (pure functions, so the geometry can be tested without a browser): the
// 100% bars of named groups and ordered bands, and the chart of mostly-zero characteristics (M1). They share the
// range chart's rows: a label column (two-line names in a 116 px column on phones), the stories in a column on wider
// screens or under the name on phones (below 250), rows 31 px tall on wider screens and at least 44 px on phones.

import { formatCount, stepDecimals, formatFixed } from "./format.js";
import { MARK_GAP, MARK_W, PHONE, niceTicks, stepTicks, textWidth, wrapLabel } from "./rangeLayout.js";
import { TEXT } from "./tokens.js";

const ROW = 31;
const PHONE_LABEL = 116;
const LABEL_SIZE = TEXT.secondary;
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
    : Math.ceil(Math.max(textWidth("Stories", TEXT.tick), ...rows.filter((r) => r.n != null).map((r) => textWidth(formatCount(r.n), TEXT.note))) + 18);
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
    else if (below) count = { x: labelW, y: first + 16 * (lines.length - 1) + 15, text: `${formatCount(r.n)} stories` };
    const boxes = labelLines.map((l) => ({ kind: "label", ...box(l.x, l.y, l.text, LABEL_SIZE, 400, "end") }));
    if (count) boxes.push({ kind: "n", ...box(count.x, count.y, count.text, phone ? TEXT.tick : TEXT.note, 400, "end") });
    return { index: r.index, label: r.label, y0, y1: y, cy, labelLines, count, boxes };
  });
  return { phone, labelW, storiesW, rows: laid, bottom: y, storiesHead: storiesW ? { x: width, y: top - 10, text: "Stories" } : null };
}

// The palettes of the 100% bars are custom properties in genres.css (F72): named groups --group-0 … --group-5, the
// largest group across all genres darkest; ordered bands --band-0 … in a palette per number of bands (.bands-3 to
// .bands-8), light to dark blue on an even scale of contrast. Here: which ink a share printed on each color takes,
// "white" or "dark" where it reaches 4.5:1 there, "" where neither does (the share is then only in the details and
// the row's name). A test reads genres.css and checks these.
export const GROUP_INKS = ["white", "dark", "dark", "dark", "dark", "dark"];
export const BAND_INKS = {
  3: ["dark", "dark", "white"],
  4: ["dark", "dark", "", "white"],
  5: ["dark", "dark", "dark", "white", "white"],
  6: ["dark", "dark", "dark", "", "white", "white"],
  7: ["dark", "dark", "dark", "dark", "", "white", "white"],
  8: ["dark", "dark", "dark", "dark", "dark", "white", "white", "white"],
};
export const bandPalette = (count) => Math.min(8, Math.max(3, count)); // the palettes run from 3 to 8 bands

/**
 * Each group's color class and the ink of its printed share: named groups by their size across all genres (the
 * largest darkest), ordered bands from light to dark in their order. [{ cls, ink }] per group.
 */
export function mixColors(kind, allShares) {
  if (kind === "band") {
    const inks = BAND_INKS[bandPalette(allShares.length)];
    return allShares.map((_, b) => ({ cls: `pal-band-${b}`, ink: inks[b] ?? "" }));
  }
  const rank = allShares.map((s, b) => ({ s, b })).sort((a, c) => c.s - a.s || a.b - c.b);
  const out = [];
  rank.forEach(({ b }, k) => {
    const i = Math.min(k, GROUP_INKS.length - 1);
    out[b] = { cls: `pal-group-${i}`, ink: GROUP_INKS[i] };
  });
  return out;
}

/**
 * The 100% bars: per genre (rows: { index, label, n, shares, mark }), one bar of the groups' shares in their order,
 * after a column for the mark (≠ for named groups, ▲ ▼ for bands). Shares are printed in segments at least 34 px wide
 * (where their ink reaches 4.5:1: mixColors). Over All genres' bar, each group's name sits over the middle of its
 * segment when the segment is at least the name's width and 8 px (`labels`; F72): position as well as color says which
 * group a segment is; names that do not fit are left to the legend.
 */
export function mixLayout({ rows, width, labels = [] }) {
  const phone = width < PHONE;
  const probe = rowGrid({ rows, width, top: 24 });
  const x0 = probe.labelW + MARK_GAP + MARK_W + 6;
  const x1 = width - (probe.storiesW ? probe.storiesW : 0);
  const barW = Math.max(40, x1 - x0);
  const allShares = rows[0]?.shares;
  const names = [];
  if (allShares) {
    let x = x0;
    allShares.forEach((share, b) => {
      const w = share * barW;
      const text = labels[b];
      if (text && w >= textWidth(text, TEXT.tick) + 8) names.push({ b, x: x + w / 2, text });
      x += w;
    });
  }
  // room above the rows for the Stories heading (wider charts) and the groups' names
  const top = phone && !names.length ? 8 : 24;
  const grid = top === 24 ? probe : rowGrid({ rows, width, top });
  const laid = grid.rows.map((g, i) => {
    const r = rows[i];
    const out = { ...g, mark: r.mark ? { x: grid.labelW + MARK_GAP + MARK_W / 2, y: g.cy + 4.5, text: r.mark } : null };
    if (!r.shares) {
      out.none = { x: x0 + 2, y: g.cy + 4, text: r.noneText };
      out.boxes = [...g.boxes, { kind: "none", ...box(x0 + 2, g.cy + 4, r.noneText, TEXT.note) }];
      return out;
    }
    let x = x0;
    out.segments = r.shares.map((s, b) => {
      const w = s * barW;
      const seg = { b, x, width: w, share: s, labelX: x + w / 2 };
      x += w;
      return seg;
    });
    if (out.mark) out.boxes = [...g.boxes, { kind: "mark", ...box(out.mark.x, out.mark.y, out.mark.text, TEXT.note, 700, "middle") }];
    return out;
  });
  const groupNames = names.map((nm) => ({ ...nm, y: top - 10, box: box(nm.x, top - 10, nm.text, TEXT.tick, 400, "middle") }));
  return { ...grid, width, height: grid.bottom + 8, top, barX: x0, barW, rows: laid, names: groupNames };
}

/**
 * Ticks for a plot on [lo, hi]: nice steps, fewer when their labels would touch (`tickFormat(v, step)` writes them), or
 * every `fixed` step for a domain with its own ticks.
 */
function plotTicks(lo, hi, x, plotW, phone, tickFormat, fixed = null) {
  let count = phone ? 4 : 5;
  for (;;) {
    const { step, ticks } = fixed ? stepTicks(lo, hi, fixed) : niceTicks(lo, hi, count);
    const text = tickFormat ? (v) => tickFormat(v, step) : (v) => formatFixed(v, stepDecimals(step));
    const out = ticks.filter((t) => t >= lo - 1e-9 && t <= hi + 1e-9).map((v) => ({ v, x: x(v), text: text(v) }));
    const widest = Math.max(0, ...out.map((t) => textWidth(t.text, TEXT.tick)));
    if (count <= 2 || widest + 10 <= (plotW * step) / (hi - lo || 1)) return out;
    count -= 1;
  }
}

const SHARE_BAR = 40; // the "With any" column's small bar on wider charts

/** Words wrapped into lines at most `maxW` wide (greedy; a word wider than the line keeps a line of its own). */
export function wrapText(text, maxW, size) {
  const lines = [];
  for (const word of text.split(" ")) {
    const last = lines[lines.length - 1];
    if (last != null && textWidth(`${last} ${word}`, size) <= maxW) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/**
 * The chart of a mostly-zero characteristic (concept M1, F65): one row per genre, its name, its mark (F61a), then a plot
 * of the interquartile range and median among its stories with any, on the plot's own scale with ticks; then the
 * values. Wider charts: a "Median" column (among the stories with any), a "With any" column (a 40 px bar and the share
 * of stories with any) and the Stories column. Phones: one cell with the median over the share, under the heading
 * "Median" over "with any". All genres (the first row) is the plot's dashed line, labeled under the plot.
 *
 * rows: { index, label, n, share (null: fewer than meta.min_n stories), above: { n, p25, median, p75 } | null (fewer
 * than min_n stories with any), mark, noneText, fewAboveText }; `domain` is the plot's [lo, hi] (or [lo, hi, step]:
 * chartDomain); `printed(v)` writes a median, `shareText(v)` a share, `tickFormat(v, step)` a tick.
 */
export function anyLayout({ rows, width, domain, printed, shareText, tickFormat = null }) {
  const phone = width < PHONE;
  const top = phone ? 44 : 30; // the columns' headings (two lines on phones) and the tick labels
  const grid = rowGrid({ rows, width, top });
  const x0 = grid.labelW + MARK_GAP + MARK_W + 6;
  const medTexts = rows.filter((r) => r.above).map((r) => printed(r.above.median));
  const shareTexts = rows.filter((r) => r.share != null).map((r) => shareText(r.share));
  const widest = (texts, size, weight) => Math.ceil(Math.max(0, ...texts.map((t) => textWidth(t, size, weight))));
  const heads = [];
  let medianX;
  let x1;
  let share = null;
  if (phone) {
    const valueW = Math.max(widest(medTexts, TEXT.note, 600), widest(shareTexts, TEXT.tick), widest(["Median", "with any"], TEXT.tick));
    medianX = width;
    x1 = width - valueW - 12;
    heads.push({ x: width, y: top - 24, text: "Median" }, { x: width, y: top - 10, text: "with any" });
  } else {
    const right = width - grid.storiesW;
    const textW = Math.max(widest(shareTexts, TEXT.note, 600), widest(["100%"], TEXT.note, 600));
    const left = right - textW - 6 - SHARE_BAR;
    share = { barX: left, textX: right };
    medianX = left - 16;
    const medW = Math.max(widest(medTexts, TEXT.note, 600), widest(["Median"], TEXT.tick));
    x1 = medianX - medW - 14;
    heads.push({ x: medianX, y: top - 10, text: "Median" }, { x: right, y: top - 10, text: "With any" });
  }
  const [lo, hi, fixed] = domain; // fixed: the step of a domain with its own ticks (flatDomain in genres.js)
  let plotW;
  let x;
  let ticks;
  // the last tick's label stays clear of the columns' headings (they share the band above the rows)
  const headsLeft = Math.min(...heads.map((h) => h.x - textWidth(h.text, TEXT.tick)));
  for (let k = 0; k < 2; k += 1) {
    plotW = Math.max(40, x1 - x0);
    const pw = plotW;
    x = (v) => x0 + ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo || 1)) * pw;
    ticks = plotTicks(lo, hi, x, plotW, phone, tickFormat, fixed);
    const last = ticks[ticks.length - 1];
    const over = last ? last.x + textWidth(last.text, TEXT.tick) / 2 + 10 - headsLeft : 0;
    if (over <= 0) break;
    x1 -= over;
  }
  const markX = grid.labelW + MARK_GAP + MARK_W / 2;
  const laid = grid.rows.map((g, i) => {
    const r = rows[i];
    const row = { ...g, boxes: [...g.boxes] };
    if (r.mark && r.share != null) {
      row.mark = { x: markX, y: g.cy + 4.5, text: r.mark };
      row.boxes.push({ kind: "mark", ...box(markX, g.cy + 4.5, r.mark, TEXT.note, 700, "middle") });
    }
    if (r.share == null) {
      // "Fewer than 10 stories", on two lines where a phone's plot is too narrow for one (288 px at 13 px)
      const lines = wrapText(r.noneText, width - x0 - 4, TEXT.note).slice(0, 2);
      const y = g.cy + 4 - ((lines.length - 1) * 14) / 2;
      row.none = { x: x0 + 2, y, lines, text: r.noneText };
      lines.forEach((t, k) => row.boxes.push({ kind: "none", ...box(x0 + 2, y + 14 * k, t, TEXT.note) }));
      return row;
    }
    if (r.above) {
      const a = x(r.above.p25);
      const b = x(r.above.p75);
      const mid = (a + b) / 2;
      const w = Math.max(12, b - a);
      row.bar = { x: Math.min(a, mid - w / 2), width: w };
      row.dotX = x(r.above.median);
      const y = phone ? g.cy - 1 : g.cy + 4.5;
      row.median = { x: medianX, y, text: printed(r.above.median) };
      row.boxes.push({ kind: "median", ...box(medianX, y, row.median.text, TEXT.note, 600, "end") });
    } else {
      // "Fewer than 10 stories with any": in the plot (on phones also over the empty median line), on two lines if need be
      const avail = phone ? width - textWidth(shareText(r.share), TEXT.tick) - 10 - x0 : x1 - x0;
      const lines = wrapText(r.fewAboveText, avail - 2, TEXT.note).slice(0, 3);
      const y = g.cy + 4 - ((lines.length - 1) * 14) / 2;
      row.fewAbove = { x: x0 + 2, y, lines, text: r.fewAboveText };
      lines.forEach((t, k) => row.boxes.push({ kind: "few", ...box(x0 + 2, y + 14 * k, t, TEXT.note) }));
    }
    const text = shareText(r.share);
    if (phone) {
      const y = r.above ? g.cy + 13 : g.cy + 4.5;
      row.share = { text, x: width, y };
      row.boxes.push({ kind: "share", ...box(width, y, text, TEXT.tick, 400, "end") });
    } else {
      row.share = { text, x: share.textX, y: g.cy + 4.5, bar: { x: share.barX, width: Math.max(1, SHARE_BAR * Math.min(1, r.share)) } };
      row.boxes.push({ kind: "share", ...box(share.textX, g.cy + 4.5, text, TEXT.note, 600, "end") });
    }
    return row;
  });
  const out = { ...grid, width, top, phone, x0, x1, x, lo, hi, ticks, rows: laid, medianX, shareCol: share, shareBarW: SHARE_BAR };
  const all = rows[0];
  out.height = grid.bottom + (all.above ? 30 : 10);
  out.ref = null;
  if (all.above) {
    const rx = x(all.above.median);
    const text = `All genres: ${printed(all.above.median)}`;
    const w = textWidth(text, TEXT.tick);
    const labelX = Math.min(Math.max(rx, x0 + w / 2), Math.max(x0 + w / 2, x1 - w / 2));
    out.ref = { x: rx, labelX, labelY: out.height - 8, text, box: box(labelX, out.height - 8, text, TEXT.tick, 400, "middle") };
  }
  out.heads = heads.map((h) => ({ ...h, box: box(h.x, h.y, h.text, TEXT.tick, 400, "end") }));
  return out;
}

/** Text boxes of a layout that overlap each other or leave the chart (for tests). */
export function layoutProblems(layout, pad = 1) {
  const boxes = layout.rows.flatMap((r) => r.boxes.map((b) => ({ ...b, row: r.index })));
  if (layout.ref) boxes.push({ kind: "ref", row: -1, ...layout.ref.box });
  for (const h of layout.heads || []) boxes.push({ kind: "head", row: -3, ...h.box });
  for (const nm of layout.names || []) boxes.push({ kind: "name", row: -4, ...nm.box });
  if (layout.storiesHead) {
    const w = textWidth(layout.storiesHead.text, TEXT.tick);
    boxes.push({ kind: "head", row: -3, x0: layout.storiesHead.x - w, x1: layout.storiesHead.x, y0: layout.storiesHead.y - 9.6, y1: layout.storiesHead.y + 3 });
  }
  for (const t of layout.ticks || []) {
    const w = textWidth(t.text, TEXT.tick);
    boxes.push({ kind: "tick", row: -2, x0: t.x - w / 2, x1: t.x + w / 2, y0: layout.top - 20, y1: layout.top - 7 });
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
