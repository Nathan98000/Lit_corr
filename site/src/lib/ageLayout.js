// Layout of "Stories of similar age" (round 3): one aligned chart. The group labels appear once, in a column on the
// left; each publication period is a column to the right with one dot per group at its median, on one scale shared by
// the three columns. Pure functions, so that the geometry can be tested without a browser.

import { formatCompact, formatFixed, stepDecimals } from "./format.js";
import { textWidth, valueDomain } from "./rangeLayout.js";

export const AGE_ROW = 32; // the height of a group's row
export const AGE_TICKS = 22; // the band above the rows that holds each column's tick labels
export const AGE_PHONE = 560; // narrower than this, details show as a line under the chart, as on the main chart
const LABEL_MIN = 84; // the label column on phones (its labels wrap to two lines)
const COLUMN_MIN = 72; // narrower than this, the periods are stacked instead of side by side
const GAP = 20; // between columns; 8 px on phones
const PHONE_GAP = 8;
const TICK_SIZE = 12;

const shown = (s) => s && !s.suppressed;

/**
 * The geometry for `periods` ([{ rows: [{ stats }], overall }], in order) at `width`: whether the three columns fit
 * side by side, the label column's and each column's width, the shared scale `x` (from a column's left edge) with three
 * or four ticks, the last one at the scale's end, and where each row's center is. Ratings keep their zoomed domain;
 * other measures start at 0.
 */
export function ageLayout({ periods, labels, format, width }) {
  const phone = width < AGE_PHONE;
  const gap = phone ? PHONE_GAP : GAP;
  const longest = Math.max(0, ...labels.map((l) => textWidth(l, 13.5)));
  const labelW = phone ? LABEL_MIN : Math.round(Math.min(200, Math.max(110, longest + 12)));
  const side = Math.floor((width - labelW - 3 * gap) / 3) >= COLUMN_MIN;
  const columns = side ? 3 : 1;
  const colW = Math.max(40, Math.floor((width - labelW - columns * gap) / columns));

  // one scale for the three periods, from their groups' medians and their dashed lines (no interquartile bars here)
  const values = periods
    .flatMap((p) => [...p.rows.map((r) => r.stats), p.overall])
    .filter(shown)
    .map((s) => ({ stats: { median: s.median, p25: s.median, p75: s.median } }));
  const pad = 7; // room for a dot at either end of the scale
  // Three or four tick labels per column: the axis as the main chart would draw it (for 3 or 2 intervals), or ended on
  // its next tick; labels centered on their ticks and kept inside the column. The first candidate whose labels do
  // not touch wins. If none does (total views in a phone's column: "50k" and "100k" do not fit side by side), the
  // first axis that ends on a tick keeps its two end labels; every gridline stays.
  const candidates = [];
  for (const count of [3, 2]) {
    const [lo, hi, ticks, step] = valueDomain(values, null, format, count);
    candidates.push({ lo, hi, ticks, step });
    const last = ticks[ticks.length - 1];
    if (last < hi - 1e-9) {
      const end = Number((last + step).toFixed(10));
      candidates.push({ lo, hi: end, ticks: [...ticks, end], step });
    }
  }
  const draw = ({ lo, hi, ticks, step }) => {
    const x = (v) => pad + ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo || 1)) * (colW - 2 * pad);
    const d = stepDecimals(step);
    // large values in short form, as on the main chart's phone axis; in a narrow column from 1,000 on ("1k", "1.5k")
    const compact = hi >= 10000 || (colW < 110 && hi >= 1000);
    const text = (v) => {
      if (!compact) return formatFixed(v, d);
      return Math.abs(v) >= 1000 && Math.abs(v) < 10000 ? `${Number((v / 1000).toFixed(1))}k` : formatCompact(v, d);
    };
    const labels = ticks.map((v) => {
      const t = text(v);
      const w = textWidth(t, TICK_SIZE);
      const center = Math.min(Math.max(x(v), w / 2), colW - w / 2);
      return { v, x: x(v), text: t, labelX: center, box: [center - w / 2, center + w / 2] };
    });
    const fits = labels.every((t, i) => i === 0 || t.box[0] >= labels[i - 1].box[1] + 4);
    return { lo, hi, x, labels, fits };
  };
  const drawn = candidates.map(draw);
  let axis = drawn.find((a) => a.fits && a.labels.length >= 3 && a.labels.length <= 4);
  if (!axis) {
    axis = drawn.find((a) => a.labels.length >= 3 && a.labels[a.labels.length - 1].v >= a.hi - 1e-9) || drawn[0];
    axis.labels = axis.labels.map((t, i) => (i === 0 || i === axis.labels.length - 1 ? t : { ...t, text: "" }));
  }
  const { lo, hi, x } = axis;
  return {
    phone,
    side,
    labelW,
    colW,
    gap,
    lo,
    hi,
    x,
    ticks: axis.labels.map(({ v, x: tx, text, labelX }) => ({ v, x: tx, text, labelX })),
    rowY: (i) => AGE_TICKS + i * AGE_ROW + AGE_ROW / 2,
    height: AGE_TICKS + labels.length * AGE_ROW + 4,
  };
}

/** About how tall the chart will be, for its placeholder while its code and files load. */
export function ageHeight({ groups, width }) {
  const side = Math.floor((width - LABEL_MIN - 3 * (width < AGE_PHONE ? PHONE_GAP : GAP)) / 3) >= COLUMN_MIN;
  const block = 70 + AGE_TICKS + groups * AGE_ROW + 4; // a period's heading, ticks and rows
  return 26 + (side ? block : 3 * block + 2 * 18);
}
