// Layout of the one-genre chart (concept C2 of the design review): one row per group of stories, with the
// middle half of stories as a capsule, the typical story (median) as a dot with its value printed beside it,
// and a dashed line for all stories shown. Pure functions, so that the geometry can be tested without a browser.

import { columnDecimals, formatCompact, formatCount, formatFixed, stepDecimals } from "./format.js";

export const PHONE = 560; // below this width the labels move above the bars (or into a narrow column)
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
    const { step } = niceTicks(lo, hi, count);
    lo = Math.floor(lo / step + 1e-9) * step;
    hi = Math.ceil(hi / step - 1e-9) * step;
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
 */
export function rangeLayout({ rows, overall, format, width, smallN = 30, minN = 10, domainRows = null }) {
  const phone = width < PHONE;
  const longest = Math.max(0, ...rows.map((r) => r.label.length));
  const mode = !phone ? "side" : longest <= SHORT_LABEL ? "inline" : "stacked";
  const shown = rows.filter((r) => isShown(r.stats));

  // value axis and its labels: 4 ticks on phones (never more than 5), 6 wider; fewer if their labels would touch
  const labelSize = 14;
  const nSize = 12.5;
  const rowH = mode === "stacked" ? 56 : 44;
  const longestLabelW = Math.max(0, ...rows.map((r) => textWidth(r.label, labelSize)));
  const labelW =
    mode === "side"
      ? Math.round(Math.min(220, Math.max(110, width * 0.25, longestLabelW + 4)))
      : mode === "inline"
        ? 64
        : 0;
  const valueText = chartValueText(rows, overall, format);
  const valueW = Math.max(30, ...shown.map((r) => textWidth(valueText(r.stats.median), 13, 600)));
  const right = Math.ceil(valueW + 16);
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
    [lo, hi, ticks, step] = valueDomain(domainRows ? [...rows, ...domainRows] : rows, overall, format, count);
    if (phone && ticks.length > 5) {
      ticks = ticks.filter((_, i) => i % 2 === 0);
      step *= 2;
    }
    compact = phone && hi >= 10000;
    tickD = stepDecimals(step);
    const d = tickD;
    tickText = (v) => (compact ? formatCompact(v, d) : formatFixed(v, d));
    const firstTickW = textWidth(tickText(ticks[0] ?? lo), 12);
    left = mode === "stacked" ? Math.max(4, Math.ceil(firstTickW / 2) + 2) : labelW + 14;
    plotW = Math.max(40, width - left - right);
    const widest = Math.max(...ticks.map((t) => textWidth(tickText(t), 12)));
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
  const height = rowsTop + rows.length * rowH + (hasRef ? 30 : 10);

  const box = (cx, y, text, size, weight, anchor = "start") => {
    const w = textWidth(text, size, weight);
    const x0 = anchor === "end" ? cx - w : anchor === "middle" ? cx - w / 2 : cx;
    return { x0, x1: x0 + w, y0: y - size * 0.8, y1: y + size * 0.25 };
  };

  const laidOut = rows.map((r, i) => {
    const y0 = rowsTop + i * rowH;
    const s = r.stats;
    const ok = isShown(s);
    const small = ok && s.n < smallN;
    const cy = mode === "stacked" ? y0 + 38 : y0 + rowH / 2 + 2;
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
      const vx = Math.max(out.bar.x + out.bar.width, out.dotX + 7) + 8;
      out.value = { x: vx, y: cy + 4.5, text: valueText(s.median) };
      out.boxes.push({ kind: "value", ...box(vx, cy + 4.5, out.value.text, 13, 600) });
    } else {
      out.none = { x: left + 2, y: cy + 4, text: "Too few stories to show" };
      out.boxes.push({ kind: "none", ...box(left + 2, cy + 4, out.none.text, 12.5, 400) });
    }
    return out;
  });

  let ref = null;
  if (hasRef) {
    const rx = x(overall.median);
    const text = `All stories shown: ${valueText(overall.median)}`;
    const w = textWidth(text, 12, 400) + textWidth(" ", 12) * 0;
    const cx = Math.min(Math.max(rx, w / 2 + 2), width - w / 2 - 2);
    ref = { x: rx, labelX: cx, labelY: height - 8, text, value: valueText(overall.median) };
    ref.box = box(cx, height - 8, text, 12, 400, "middle");
  }

  return {
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
}

/** Estimated text boxes that overlap each other (for tests): pairs of [a, b]. */
export function overlaps(layout, pad = 1) {
  const boxes = [];
  layout.rows.forEach((r) => r.boxes.forEach((b) => boxes.push({ ...b, row: r.index })));
  if (layout.ref) boxes.push({ kind: "ref", row: -1, ...layout.ref.box });
  const tickBoxes = layout.ticks.map((t) => {
    const w = textWidth(t.text, 12);
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
