// The Trends page's chart geometry (STAGE2_TRENDS_PAGE_PROMPT.md, section 3.1): one upright column per period, time
// left to right, with a left gutter for the value ticks and the heads of the table under the plot. Pure, and checked
// for overlapping labels at 320, 375, 768 and 1440 px (trends.test.js), as rangeLayout.js is for the explorer.

import { stepDecimals } from "./format.js";
import { PHONE, niceTicks, textWidth, wrapLabel } from "./rangeLayout.js";

export const TREND_MAX_W = 760; // five columns don't need the page's width (§3.1)
export const TWO_LINES_UNDER = 58; // a column narrower than this puts its period on two lines ("2000" over "–04")
const TICK_SIZE = 12;
const HEAD_SIZE = 12;
const PERIOD_SIZE = 12.5;
const VALUE_SIZES = [13, 12, 11.5]; // smaller when long numbers would crowd each other on a phone ("−0.125"); 11.5 px is the site's smallest text
const VALUE_GAP = 3; // between two values, as textWidth estimates them (about 4 px on screen)
const STORIES_SIZE = 12;
const NONE_SIZE = 12.5;
const BRACKET_SIZE = 12;

/** "2000–04" (the end's last two digits when both years share their century), "2020–26". */
export function periodLabel([lo, hi]) {
  if (lo === hi) return String(lo);
  const end = Math.floor(lo / 100) === Math.floor(hi / 100) ? String(hi).slice(-2) : String(hi);
  return `${lo}–${end}`;
}

/** A period's label on two lines: "2000", "–04". */
export const periodLines = (period) => {
  const label = periodLabel(period);
  const at = label.indexOf("–");
  return at < 0 ? [label] : [label.slice(0, at), label.slice(at)];
};

/**
 * The value axis of numbers (num: the quartiles' range, 4% to spare, from 0 when the lowest is within half the span,
 * as the Genres page's charts do) and of shares (bin: from 0 to the smallest of 25%, 50%, 75% and 100% that holds every
 * share). `cells`: per period { p25, median, p75 } or { share } (null under MIN_N). Returns [lo, hi].
 */
export function trendDomain(kind, cells) {
  const shown = cells.filter(Boolean);
  if (kind === "bin") {
    const top = Math.max(0, ...shown.map((c) => c.share));
    return [0, [0.25, 0.5, 0.75, 1].find((t) => top <= t + 1e-9) ?? 1];
  }
  const vals = shown.flatMap((c) => [c.p25, c.median, c.p75]);
  if (!vals.length) return [0, 1];
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const pad = (hi - lo) * 0.04 || Math.abs(hi) * 0.04 || 1;
  lo = lo >= 0 && lo <= (hi - lo) / 2 ? 0 : lo - pad;
  return [lo, hi + pad];
}

/**
 * The axis's ticks: numbers, three to five nice values over the domain, which grows to its outer ticks; shares, from 0
 * to the domain's top in steps of 5% (to 25%), 10% (to 50%) or 25%. Returns { lo, hi, step, ticks }.
 */
export function trendTicks(kind, [lo, hi]) {
  if (kind === "bin") {
    const step = hi <= 0.25 ? 0.05 : hi <= 0.5 ? 0.1 : 0.25;
    const ticks = [];
    for (let v = 0; v <= hi + 1e-9; v += step) ticks.push(Number(v.toFixed(10)));
    return { lo: 0, hi, step, ticks };
  }
  for (const count of [4, 3, 2]) {
    const { step } = niceTicks(lo, hi, count);
    const a = lo === 0 ? 0 : Math.floor(lo / step + 1e-9) * step;
    const b = Math.ceil(hi / step - 1e-9) * step;
    const ticks = [];
    for (let v = a; v <= b + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
    if (ticks.length <= 5) return { lo: a, hi: b, step, ticks };
  }
  const { step, ticks } = niceTicks(lo, hi, 2);
  return { lo: ticks[0], hi: ticks[ticks.length - 1], step, ticks };
}

/** A tick's text: shares and percentages as "25%", numbers with the step's decimals and US separators. */
export function tickText(v, step, percent) {
  const d = stepDecimals(percent ? step * 100 : step);
  const n = new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(percent ? v * 100 : v);
  return `${n.replace("-", "−")}${percent ? "%" : ""}`;
}

/**
 * The chart's geometry. `cells`: per period { p25, median, p75 } (num) or { share } (bin), with `n` (stories with the
 * characteristic) and `small` (under SMALL_N), or null under MIN_N; `periods` and the two windows (`then`, `now`) from
 * the file; `texts`: per period { value, stories } as the table under the plot prints them; `valueHead` "Median" or
 * "Share"; `windows`: { then, now } words ("2000–2009", "2020 or later"); `axis` from trendTicks; `percent` for the
 * ticks. Returns the plot's box, the y scale, the ticks, a column per period (x, its marks' positions, the table's
 * texts and positions, "Fewer than 10" where nothing is drawn) and the two brackets.
 */
export function trendLayout({ width, kind, cells, periods, then, now, texts, valueHead, windows, axis, percent, noneText }) {
  const W = Math.max(240, Math.min(TREND_MAX_W, Math.floor(width)));
  const phone = W < PHONE;
  const tickTexts = axis.ticks.map((t) => tickText(t, axis.step, percent));
  const heads = [valueHead, "Stories"];
  const gutter = Math.ceil(Math.max(...tickTexts.map((t) => textWidth(t, TICK_SIZE)), ...heads.map((h) => textWidth(h, HEAD_SIZE)))) + 12;
  const n = periods.length;
  const colW = (W - gutter) / n;
  const two = colW < TWO_LINES_UNDER;
  const top = 10;
  const plotH = phone ? 200 : 250;
  const bottom = top + plotH;
  const y = (v) => bottom - ((v - axis.lo) / (axis.hi - axis.lo || 1)) * plotH;
  const periodY = [bottom + 20, bottom + 34];
  const valueY = (two ? periodY[1] : periodY[0]) + 21;
  // the values' size: the largest that leaves every two neighbors apart; when even the smallest doesn't (a rare pair
  // like "0.00060" and "0.0032" at 320 px), every other value drops a line
  const fitsAt = (size) => {
    const w = texts.map((t) => textWidth(t.value, size, 600));
    return w.every((wi, i) => wi <= colW && (i === 0 || (w[i - 1] + wi) / 2 <= colW - VALUE_GAP));
  };
  const valueSize = VALUE_SIZES.find(fitsAt) ?? VALUE_SIZES[VALUE_SIZES.length - 1];
  const stagger = !fitsAt(valueSize);
  const storiesY = valueY + (stagger ? 33 : 18);
  const bracketY = storiesY + 15;
  const bracketLabelY = bracketY + 17;
  const height = bracketLabelY + 6;
  const barW = Math.min(28, colW * 0.42);
  const columns = periods.map((p, i) => {
    const x = gutter + colW * (i + 0.5);
    const c = cells[i];
    const col = {
      i,
      x,
      x0: gutter + colW * i,
      x1: gutter + colW * (i + 1),
      ok: Boolean(c),
      small: Boolean(c?.small),
      period: periodLabel(p),
      lines: two ? periodLines(p).map((t, k) => ({ text: t, y: periodY[k] })) : [{ text: periodLabel(p), y: periodY[0] }],
      value: { text: texts[i].value, x, y: valueY + (stagger && i % 2 ? 15 : 0) },
      stories: { text: texts[i].stories, x, y: storiesY },
    };
    if (!c) {
      col.none = wrapLabel(noneText, colW - 6, NONE_SIZE).map((t, k, all) => ({ text: t, x, y: bottom - 12 - (all.length - 1 - k) * 15 }));
      return col;
    }
    if (kind === "bin") {
      col.dotY = y(c.share);
      col.bar = { x: x - barW / 2, y: col.dotY, width: barW, height: Math.max(1, bottom - col.dotY) };
    } else {
      col.dotY = y(c.median);
      col.capsule = { x: x - 6, y: y(c.p75), width: 12, height: Math.max(12, y(c.p25) - y(c.p75)) };
      if (col.capsule.height === 12) col.capsule.y = col.dotY - 6;
    }
    return col;
  });
  // the brackets under the windows compared: the first periods (2000–2009) and the last (2020 or later); a label stays
  // inside the chart
  const inWindow = (p, [a, b]) => p[0] >= a && p[1] <= b;
  const bracket = (idx, label) => {
    if (!idx.length) return null;
    const x0 = columns[idx[0]].x0 + 6;
    const x1 = columns[idx[idx.length - 1]].x1 - 6;
    const half = textWidth(label, BRACKET_SIZE, 600) / 2;
    const cx = Math.min(Math.max((x0 + x1) / 2, half + 1), W - half - 1);
    return { x0, x1, y: bracketY, label, labelX: cx, labelY: bracketLabelY };
  };
  const brackets = [
    bracket(periods.map((p, i) => (inWindow(p, then) ? i : -1)).filter((i) => i >= 0), windows.then),
    bracket(periods.map((p, i) => (p[0] >= now[0] ? i : -1)).filter((i) => i >= 0), windows.now),
  ].filter(Boolean);
  return {
    width: W,
    height,
    phone,
    gutter,
    colW,
    two,
    top,
    bottom,
    plotH,
    y,
    valueSize,
    stagger,
    ticks: axis.ticks.map((t, k) => ({ v: t, y: y(t), text: tickTexts[k], x: gutter - 8 })),
    heads: [
      { text: valueHead, x: 0, y: valueY },
      { text: "Stories", x: 0, y: storiesY },
    ],
    columns,
    brackets,
    line: columns.filter((c) => c.ok).map((c) => [c.x, c.dotY]),
  };
}

/**
 * Text boxes that overlap in a layout (for the tests): the period labels, the table's values and counts, the row
 * heads, the tick labels and the brackets' labels, each estimated with textWidth; and anything outside the chart.
 */
export function trendOverlaps(layout) {
  const boxes = [];
  const add = (kind, text, x, yy, size, anchor = "middle", weight = 400) => {
    const w = textWidth(text, size, weight);
    const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
    boxes.push({ kind, text, x0, x1: x0 + w, y0: yy - size, y1: yy + 2 });
  };
  for (const c of layout.columns) {
    for (const l of c.lines) add("period", l.text, c.x, l.y, PERIOD_SIZE);
    add("value", c.value.text, c.value.x, c.value.y, layout.valueSize, "middle", 600);
    add("stories", c.stories.text, c.stories.x, c.stories.y, STORIES_SIZE);
    for (const l of c.none || []) add("none", l.text, l.x, l.y, NONE_SIZE);
  }
  for (const h of layout.heads) add("head", h.text, h.x, h.y, HEAD_SIZE, "start");
  for (const t of layout.ticks) add("tick", t.text, t.x, t.y + 4, TICK_SIZE, "end");
  for (const b of layout.brackets) add("bracket", b.label, b.labelX, b.labelY, BRACKET_SIZE, "middle", 600);
  const out = [];
  for (let i = 0; i < boxes.length; i += 1) {
    const a = boxes[i];
    if (a.x0 < -0.5 || a.x1 > layout.width + 0.5) out.push(`${a.kind} "${a.text}" outside the chart`);
    for (let j = i + 1; j < boxes.length; j += 1) {
      const b = boxes[j];
      if (a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5) out.push(`${a.kind} "${a.text}" on ${b.kind} "${b.text}"`);
    }
  }
  return out;
}
