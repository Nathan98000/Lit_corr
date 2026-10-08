// Number formatting for charts, tables and tooltips.

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

export function formatAge(years) {
  if (years == null || !Number.isFinite(years)) return "–";
  if (years < 1) return "under a year";
  const v = years >= 10 ? Math.round(years) : Math.round(years * 10) / 10;
  return `${v} year${v === 1 ? "" : "s"}`;
}

/** A ratio such as 1.3× or 0.8×. */
export function formatRatio(r) {
  if (r == null || !Number.isFinite(r)) return "–";
  if (r >= 10) return `${Math.round(r)}×`;
  return `${r.toFixed(1)}×`;
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
