// Number formatting for charts and their details.

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** A popularity value, formatted for its measure ("count", "rate" or "rating"). */
export function formatValue(v, format) {
  if (v == null || !Number.isFinite(v)) return "–";
  if (format === "rating") return v.toFixed(2);
  const a = Math.abs(v);
  if (a === 0) return "0";
  if (a >= 100) return whole.format(v);
  if (a >= 10) return String(Number(v.toFixed(1)));
  return String(Number(v.toPrecision(2)));
}

export const formatCount = (n) => (n == null ? "–" : whole.format(n));

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** Decimals that a value needs under formatValue's rules (0 for counts and anything ≥ 100). */
export function decimalsOf(v, format) {
  if (v == null || !Number.isFinite(v)) return 0;
  if (format === "rating") return 2;
  const a = Math.abs(v);
  if (a === 0 || a >= 100) return 0;
  const text = formatValue(v, format);
  const dot = text.indexOf(".");
  return dot < 0 ? 0 : text.length - dot - 1;
}

/** One number of decimals for a whole column or axis, so that "1" and "1.5" become "1.0" and "1.5". */
export function columnDecimals(values, format) {
  const ds = values.filter((v) => v != null && Number.isFinite(v)).map((v) => decimalsOf(v, format));
  return ds.length ? Math.min(3, Math.max(...ds)) : 0;
}

/** Decimals needed to write every multiple of an axis step (0.25 → 2, 0.2 → 1, 5,000 → 0). */
export function stepDecimals(step) {
  for (let d = 0; d <= 4; d += 1) {
    const x = step * 10 ** d;
    if (Math.abs(x - Math.round(x)) < 1e-6 * Math.max(1, x)) return d;
  }
  return 4;
}

const fixedFormats = new Map();
/** A number with exactly `decimals` decimals and US thousands separators. */
export function formatFixed(v, decimals) {
  if (v == null || !Number.isFinite(v)) return "–";
  if (!fixedFormats.has(decimals)) {
    fixedFormats.set(
      decimals,
      new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
    );
  }
  const out = fixedFormats.get(decimals).format(v);
  return out === "-0" ? "0" : out.replace("-", "−");
}

/** A compact axis label for large values on small screens: 60k, 800k, 1.2M. */
export function formatCompact(v, decimals = 0) {
  if (v == null || !Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a >= 1e6) return `${Number((v / 1e6).toFixed(1))}M`;
  if (a >= 1e4) return `${Number((v / 1e3).toFixed(a >= 1e5 ? 0 : 1))}k`;
  return formatFixed(v, decimals);
}

/** A range such as "0.10–0.66" (en dash, no spaces), both ends with the same decimals. */
export function formatRange(lo, hi, decimals) {
  return `${formatFixed(lo, decimals)}–${formatFixed(hi, decimals)}`;
}
