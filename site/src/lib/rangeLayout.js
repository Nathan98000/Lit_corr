// Layout of the one-genre chart (concept C2 of the design review): one row per group of stories, with the
// interquartile range as a capsule, the median as a dot with its value printed beside it, and a dashed line for the
// median of all stories shown. Pure functions, so that the geometry can be tested without a browser.

import { columnDecimals, formatCompact, formatCount, formatFixed, stepDecimals } from "./format.js";
import { MARK, TEXT } from "./tokens.js";

export const PHONE = 560; // below this width the labels move above the bars (or into a narrow column)
// "One genre"'s rows only: below this chart width a row stacks, the label and the two numbers on one line and the plot
// across the row under them (decision 9)
export const STACKED = 900;
export const MARK_W = 18; // the Genres page's mark column (▲ ▼ ≠), after a gap from the labels
export const MARK_GAP = 8;
export const SHORT_LABEL = 7; // labels this short (months, weekdays, short ranges) fit in a 64 px column

/** Estimated width of a line of text in px (system sans; generous, so estimated boxes never undershoot). */
export function textWidth(text, size = 14, weight = 400) {
  let units = 0;
  for (const ch of String(text)) {
    if (/[ilI.,:;’'|!]/.test(ch)) units += 0.3;
    else if (/[mwMW—]/.test(ch)) units += 0.86;
    else if (/[A-Z0-9%+−–]/.test(ch)) units += 0.64;
    else if (ch === " ") units += 0.28;
    else units += 0.54;
  }
  return units * size * (weight >= 600 ? 1.06 : 1);
}

/**
 * A label in a column `maxW` wide, wrapped to at most two lines: at spaces, else after a slash or a hyphen, else
 * with a hyphen ("Reluctance/" "NonConsent"). Returns the lines.
 */
export function wrapLabel(text, maxW, size = 14) {
  const fits = (t) => textWidth(t, size) <= maxW;
  if (fits(text)) return [text];
  const words = text.split(" ");
  for (let k = words.length - 1; k > 0; k -= 1) {
    const first = words.slice(0, k).join(" ");
    if (fits(first)) return [first, words.slice(k).join(" ")];
  }
  const cut = text.search(/[/-](?=\S)/);
  if (cut > 0 && fits(text.slice(0, cut + 1))) return [text.slice(0, cut + 1), text.slice(cut + 1)];
  let n = text.length - 1;
  while (n > 1 && !fits(`${text.slice(0, n)}-`)) n -= 1;
  return [`${text.slice(0, n)}-`, text.slice(n)];
}

/** "Nice" ticks (1, 2, 2.5 or 5 times a power of ten) from lo to hi: at most `count` intervals. */
export function niceTicks(lo, hi, count) {
  const span = hi - lo || 1;
  const mag = 10 ** Math.floor(Math.log10(span / Math.max(1, count)));
  const step = [1, 2, 2.5, 5, 10, 20].map((m) => m * mag).find((st) => span / st <= count + 1e-9) ?? 20 * mag;
  const ticks = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) ticks.push(Number(v.toFixed(10)));
  return { step, ticks };
}

/**
 * The value axis: counts and rates start at 0; ratings keep a zoomed domain (most stories score 4–5).
 * Returns [lo, hi, ticks, step].
 */
export function valueDomain(rows, overall, format, count = 6) {
  const shown = rows.filter((r) => r.stats && !r.stats.suppressed);
  const vals = shown.flatMap((r) => [r.stats.p25, r.stats.p75, r.stats.median]);
  if (overall && !overall.suppressed) vals.push(overall.median);
  if (!vals.length) return [0, 1, [0, 0.5, 1], 0.5];
  let lo;
  let hi;
  if (format === "rating") {
    lo = Math.max(1, Math.floor((Math.min(...vals) - 0.15) * 10) / 10);
    hi = Math.min(5, Math.ceil((Math.max(...vals) + 0.1) * 10) / 10);
    // round the domain out to whole steps of the ticks it ends up with, so the axis starts and ends on a labeled
    // tick (the axis title names where it starts)
    for (let i = 0; i < 4; i += 1) {
      const { step } = niceTicks(lo, hi, count);
      const lo2 = Number((Math.floor(lo / step + 1e-9) * step).toFixed(10));
      const hi2 = Number((Math.ceil(hi / step - 1e-9) * step).toFixed(10));
      if (lo2 === lo && hi2 === hi) break;
      lo = lo2;
      hi = hi2;
    }
  } else {
    lo = 0;
    hi = Math.max(...vals) * 1.06 || 1;
  }
  const { step, ticks } = niceTicks(lo, hi, count);
  return [lo, hi, ticks.filter((t) => t >= lo - 1e-9 && t <= hi + 1e-9), step];
}

const isShown = (s) => s && !s.suppressed;

/** The value scale: x for a value, clamped to the domain [lo, hi] of a plot that starts at `left`. */
export function scaleX({ lo, hi, left, plotW }) {
  return (v) => left + ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo || 1)) * plotW;
}

/** The middle-half capsule between two x positions: never narrower than 12 px, centered on the span. */
export function capsule(x1, x2) {
  const mid = (x1 + x2) / 2;
  const width = Math.max(12, x2 - x1);
  return { x: Math.min(x1, mid - width / 2), width };
}

/** How the chart prints its medians: one number of decimals for every group and the "all stories" line. */
export function chartValueText(rows, overall, format) {
  const meds = rows.filter((r) => isShown(r.stats)).map((r) => r.stats.median);
  const d = columnDecimals([...meds, isShown(overall) ? overall.median : null], format);
  return (v) => formatFixed(v, d);
}

/**
 * Everything needed to draw the chart at a given width. Text positions come with estimated boxes
 * ({x0, x1, y0, y1}) so that tests can check that nothing overlaps.
 *
 * The Genres page draws one row per genre with these options; absent (the explorer), the layout is unchanged:
 * `domain` ([lo, hi] of the value axis), `tickFormat(v, step)` (the axis labels), `printed(stats)` (a row's value),
 * `valueColumn` (values right-aligned in a column at the right, each after its row's `mark`, ▲ or ▼), `storiesColumn`
 * (the stories in a muted column at the right; in the phone layout under the label, below `storiesBelow` stories),
 * `phoneLabelW` (in the phone layout, the labels in a column this wide, wrapped to two lines, instead of above the
 * bars), `rowHeight` (of rows beside their labels), `refText(value)` (the dashed line's label), `noneText` (a row
 * with too few stories), `markColumn` (the marks in an 18 px column right after the labels, the values without
 * them, F61a) and `valueHead` (the value column's heading, beside the ticks like the Stories heading, F74).
 */
export function rangeLayout({
  rows,
  overall,
  format,
  width,
  smallN = 30,
  minN = 10,
  domain = null,
  tickFormat = null,
  printed = null,
  valueColumn = false,
  storiesColumn = false,
  storiesBelow = 250,
  phoneLabelW = 0,
  rowHeight = null,
  refText = null,
  noneText = "Too few stories to show",
  markColumn = false,
  valueHead = "",
}) {
  const phone = width < PHONE;
  const longest = Math.max(0, ...rows.map((r) => r.label.length));
  const genreRows = Boolean(valueColumn || storiesColumn || phoneLabelW);
  const mode = !phone || phoneLabelW ? "side" : longest <= SHORT_LABEL ? "inline" : "stacked";
  const shown = rows.filter((r) => isShown(r.stats));

  // value axis and its labels: 4 ticks on phones (never more than 5), 6 wider; fewer if their labels would touch
  const labelSize = TEXT.secondary;
  const nSize = TEXT.note;
  const tickSize = TEXT.tick;
  const longestLabelW = Math.max(0, ...rows.map((r) => textWidth(r.label, labelSize)));
  const labelW =
    mode === "side" && phone
      ? phoneLabelW
      : mode === "side"
        ? Math.round(Math.min(220, Math.max(110, width * 0.25, longestLabelW + 4)))
        : mode === "inline"
          ? 64
          : 0;
  // labels wrapped into the phone's label column; stories under them, below storiesBelow
  const lines = rows.map((r) => (phone && phoneLabelW ? wrapLabel(r.label, phoneLabelW - 2, labelSize) : [r.label]));
  const countBelow = (r) => phone && storiesColumn && isShown(r.stats) && r.stats.n < storiesBelow;
  const rowH = genreRows ? rowHeight || 44 : mode === "stacked" ? 56 : 44;
  // a genre's row on a phone is as tall as its name and its stories need, and at least 44 px (a tap target)
  const heights = rows.map((r, i) =>
    genreRows && phone ? Math.max(44, 12 + 16 * lines[i].length + (countBelow(r) ? 13 : 0)) : rowH,
  );
  const tops = heights.map((_, i) => heights.slice(0, i).reduce((a, b) => a + b, 0));
  const valueText = chartValueText(rows, overall, format);
  const shownValue = (r) => `${r.mark && !markColumn ? `${r.mark} ` : ""}${printed ? printed(r.stats) : valueText(r.stats.median)}`;
  const valueW = Math.max(30, ...shown.map((r) => textWidth(shownValue(r), TEXT.note, 600)), valueHead ? textWidth(valueHead, tickSize) : 0);
  // the stories column (wider screens): its heading and the longest count
  const storiesW =
    storiesColumn && !phone
      ? Math.ceil(Math.max(textWidth("Stories", tickSize), ...shown.map((r) => textWidth(formatCount(r.stats.n), nSize))) + 18)
      : 0;
  const right = Math.ceil(valueW + 16) + storiesW;
  let count = phone ? 4 : 6;
  let lo;
  let hi;
  let ticks;
  let step;
  let compact;
  let tickD;
  let tickText;
  let left;
  let plotW;
  for (;;) {
    if (domain) {
      [lo, hi] = domain;
      ({ step, ticks } = niceTicks(lo, hi, count));
      ticks = ticks.filter((t) => t >= lo - 1e-9 && t <= hi + 1e-9);
    } else {
      [lo, hi, ticks, step] = valueDomain(rows, overall, format, count);
    }
    if (phone && ticks.length > 5) {
      ticks = ticks.filter((_, i) => i % 2 === 0);
      step *= 2;
    }
    compact = phone && hi >= 10000;
    tickD = stepDecimals(step);
    const d = tickD;
    const st = step;
    tickText = tickFormat ? (v) => tickFormat(v, st) : (v) => (compact ? formatCompact(v, d) : formatFixed(v, d));
    const firstTickW = textWidth(tickText(ticks[0] ?? lo), tickSize);
    left = mode === "stacked" ? Math.max(4, Math.ceil(firstTickW / 2) + 2) : labelW + (markColumn ? MARK_GAP + MARK_W + 6 : 14);
    plotW = Math.max(40, width - left - right);
    if (valueHead && ticks.length) {
      // the last tick's label keeps clear of the value column's heading, which shares its line
      const last = ticks[ticks.length - 1];
      const lastX = left + ((last - lo) / (hi - lo || 1)) * plotW;
      const over = lastX + textWidth(tickText(last), tickSize) / 2 + 10 - (width - storiesW - textWidth(valueHead, tickSize));
      if (over > 0) plotW = Math.max(40, plotW - over);
    }
    const widest = Math.max(...ticks.map((t) => textWidth(tickText(t), tickSize)));
    const spacing = (plotW * step) / (hi - lo || 1);
    if (widest + 10 <= spacing || count <= 2) break;
    count -= 1;
  }

  const valueD = columnDecimals([...shown.map((r) => r.stats.median), isShown(overall) ? overall.median : null], format);
  const nText = (s) => {
    if (!isShown(s)) return mode === "inline" ? `n < ${minN}` : `fewer than ${minN}`;
    const star = s.n < smallN ? "*" : "";
    return mode === "side" ? `${formatCount(s.n)} stories${star}` : `n = ${formatCount(s.n)}${star}`;
  };
  const top = 30;
  const x = scaleX({ lo, hi, left, plotW });

  const hasRef = isShown(overall);
  const rowsTop = top;
  const height = rowsTop + heights.reduce((a, b) => a + b, 0) + (hasRef ? 30 : 10);

  const box = (cx, y, text, size, weight, anchor = "start") => {
    const w = textWidth(text, size, weight);
    const x0 = anchor === "end" ? cx - w : anchor === "middle" ? cx - w / 2 : cx;
    return { x0, x1: x0 + w, y0: y - size * 0.8, y1: y + size * 0.25 };
  };

  const laidOut = rows.map((r, i) => {
    const y0 = rowsTop + tops[i];
    const s = r.stats;
    const ok = isShown(s);
    const small = ok && s.n < smallN;
    const cy = mode === "stacked" ? y0 + 38 : y0 + heights[i] / 2 + 2;
    if (genreRows) return genreRow(r, i, { y0, cy, ok, small, s });
    let label;
    let n;
    if (mode === "stacked") {
      label = { x: left, y: y0 + 18, anchor: "start" };
      n = { x: width - 2, y: y0 + 18, anchor: "end" };
    } else if (mode === "inline") {
      label = { x: 0, y: cy - 1, anchor: "start" };
      n = { x: 0, y: cy + 14, anchor: "start" };
    } else {
      label = { x: labelW, y: cy - 1, anchor: "end" };
      n = { x: labelW, y: cy + 15, anchor: "end" };
    }
    const nT = nText(s);
    const out = {
      index: r.index,
      label: r.label,
      y0,
      y1: y0 + rowH,
      cy,
      ok,
      small,
      labelPos: label,
      nPos: n,
      nText: nT,
      boxes: [
        { kind: "label", ...box(label.x, label.y, r.label, labelSize, 400, label.anchor) },
        { kind: "n", ...box(n.x, n.y, nT, nSize, 400, n.anchor) },
      ],
    };
    if (ok) {
      out.bar = capsule(x(s.p25), x(s.p75));
      out.dotX = x(s.median);
      const vx = Math.max(out.bar.x + out.bar.width, out.dotX + MARK.dot) + 8;
      out.value = { x: vx, y: cy + 4.5, text: valueText(s.median) };
      out.boxes.push({ kind: "value", ...box(vx, cy + 4.5, out.value.text, TEXT.note, 600) });
    } else {
      out.none = { x: left + 2, y: cy + 4, text: "Too few stories to show" };
      out.boxes.push({ kind: "none", ...box(left + 2, cy + 4, out.none.text, TEXT.note, 400) });
    }
    return out;
  });

  /** A genre's row: the label (wrapped on phones), its stories, the plot and the value in its column. */
  function genreRow(r, i, { y0, cy, ok, small, s }) {
    const ls = lines[i];
    const below = countBelow(r);
    const block = ls.length * 16 + (below ? 13 : 0);
    const first = phone ? cy - block / 2 + 12 : cy + 5;
    const labelLines = ls.map((text, k) => ({ text, x: labelW, y: first + 16 * k, anchor: "end" }));
    const out = {
      index: r.index,
      label: r.label,
      y0,
      y1: y0 + heights[i],
      cy,
      ok,
      small,
      labelPos: labelLines[0],
      labelLines,
      mark: r.mark || "",
      boxes: labelLines.map((l) => ({ kind: "label", ...box(l.x, l.y, l.text, labelSize, 400, "end") })),
    };
    let nPos = null;
    let nT = "";
    if (ok && storiesColumn && !phone) {
      nPos = { x: width, y: cy + 4.5, anchor: "end" };
      nT = formatCount(s.n);
    } else if (below) {
      // a pixel more than the label's line height, so a name's descenders and its count never touch
      nPos = { x: labelW, y: first + 16 * (ls.length - 1) + 15, anchor: "end" };
      nT = `${formatCount(s.n)} stories`;
    }
    out.nPos = nPos;
    out.nText = nT;
    if (nPos) out.boxes.push({ kind: "n", ...box(nPos.x, nPos.y, nT, phone ? tickSize : nSize, 400, "end") });
    if (markColumn && ok && r.mark) {
      out.markPos = { x: labelW + MARK_GAP + MARK_W / 2, y: cy + 4.5 };
      out.boxes.push({ kind: "mark", ...box(out.markPos.x, out.markPos.y, r.mark, TEXT.note, 700, "middle") });
    }
    if (ok) {
      out.bar = capsule(x(s.p25), x(s.p75));
      out.dotX = x(s.median);
      const vx = width - storiesW;
      out.value = { x: vx, y: cy + 4.5, text: shownValue(r), anchor: "end" };
      out.boxes.push({ kind: "value", ...box(vx, cy + 4.5, out.value.text, TEXT.note, 600, "end") });
    } else {
      out.none = { x: left + 2, y: cy + 4, text: noneText };
      out.boxes.push({ kind: "none", ...box(left + 2, cy + 4, noneText, TEXT.note, 400) });
    }
    return out;
  }

  let ref = null;
  if (hasRef) {
    const rx = x(overall.median);
    const text = refText ? refText(printed ? printed(overall) : valueText(overall.median)) : `All stories shown: ${valueText(overall.median)}`;
    const w = textWidth(text, tickSize, 400);
    const cx = Math.min(Math.max(rx, w / 2 + 2), width - w / 2 - 2);
    ref = { x: rx, labelX: cx, labelY: height - 8, text, value: printed ? printed(overall) : valueText(overall.median) };
    ref.box = box(cx, height - 8, text, tickSize, 400, "middle");
  }

  const out = {
    mode,
    width,
    height,
    top,
    left,
    right,
    plotW,
    rowH,
    labelW,
    lo,
    hi,
    x,
    ticks: ticks.map((v) => ({ v, x: x(v), text: tickText(v) })),
    rows: laidOut,
    ref,
    valueText,
    valueDecimals: valueD,
  };
  if (storiesW) out.storiesHead = { x: width, y: top - 10, text: "Stories" };
  if (valueHead) out.valueHead = { x: width - storiesW, y: top - 10, text: valueHead };
  return out;
}

/** Estimated text boxes that overlap each other (for tests): pairs of [a, b]. */
export function overlaps(layout, pad = 1) {
  const boxes = [];
  layout.rows.forEach((r) => r.boxes.forEach((b) => boxes.push({ ...b, row: r.index })));
  if (layout.ref) boxes.push({ kind: "ref", row: -1, ...layout.ref.box });
  for (const h of [layout.valueHead, layout.storiesHead].filter(Boolean)) {
    const w = textWidth(h.text, TEXT.tick);
    boxes.push({ kind: "head", row: -3, x0: h.x - w, x1: h.x, y0: h.y - 9.6, y1: h.y + 3 });
  }
  const tickBoxes = layout.ticks.map((t) => {
    const w = textWidth(t.text, TEXT.tick);
    return { kind: "tick", row: -2, x0: t.x - w / 2, x1: t.x + w / 2, y0: layout.top - 20, y1: layout.top - 7 };
  });
  boxes.push(...tickBoxes);
  const hits = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.x0 < b.x1 - pad && b.x0 < a.x1 - pad && a.y0 < b.y1 - pad && b.y0 < a.y1 - pad) hits.push([a, b]);
    }
  }
  return hits;
}

/** Boxes that leave the chart's own width (for tests). */
export function outside(layout) {
  const all = [...layout.rows.flatMap((r) => r.boxes), ...(layout.ref ? [layout.ref.box] : [])];
  return all.filter((b) => b.x0 < -0.5 || b.x1 > layout.width + 0.5);
}
