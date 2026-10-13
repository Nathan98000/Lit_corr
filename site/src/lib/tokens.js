// The site's one visual system (design review 4, X1) for the charts' code: the same numbers as the tokens on
// styles.css's :root (a test reads both). Layouts estimate text with these sizes and draw marks with these radii.

/** The sans type scale, by role: 12 chart ticks and small labels, 13 notes, units, keys' small text and the values
 * printed beside marks, 14 secondary text and keys (a chart's group labels), 15 controls and Explore's body, 16 rows,
 * lists and How it works' body, 18 the lede. */
export const TEXT = { tick: 12, note: 13, secondary: 14, control: 15, row: 16, lede: 18 };

/** One line height for each size (styles.css's --leading-*). */
export const LEADING = { 12: 1.3, 13: 1.4, 14: 1.45, 15: 1.45, 16: 1.5, 18: 1.4, 20: 1.25, 26: 1.25 };

/**
 * The chart grammar: the median, a dot of radius 6 with a 2 px white ring, on every range chart; the interquartile
 * range, a 10 px capsule with a 1 px edge; "all stories", a dashed 1 px line; a comparison's score, a dot of radius 5
 * (a row that doesn't stand out keeps R3's small gray dot, 3.5).
 */
export const MARK = { dot: 6, ring: 2, bar: 10, edge: 1, ref: 1, score: 5, quiet: 3.5 };
