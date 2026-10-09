import { describe, expect, it } from "vitest";
import { cardLabel, cellDetail, compareSummary, gridColumns, sparkGeometry, stepFill, verdict } from "../lib/compare.js";

const ordered = { bins: { ordered: true } };
const row = (id, kind) => ({ genre: { id, name: id }, verdict: kind ? { kind } : null });

describe("comparing genres", () => {
  it("words each verdict", () => {
    expect(verdict(ordered, 1, 0.3)).toMatchObject({ text: "tends higher", arrow: "↗" });
    expect(verdict(ordered, -1, -0.3)).toMatchObject({ text: "tends lower", arrow: "↘" });
    expect(verdict(ordered, 0, 0.05).text).toBe("no clear pattern");
    expect(verdict(ordered, 0, null).text).toBe("too few stories to judge");
    expect(verdict({ bins: { ordered: false } }, 0, null)).toBeNull();
  });

  it("counts the verdicts over the genres only, naming none", () => {
    const rows = [row("all", "up"), row("a", "up"), row("b", "flat"), row("c", "up"), row("d", "few")];
    expect(compareSummary(rows)).toBe(
      "Tends higher in 2 of 4 genres, tends lower in none, no clear pattern in 1, too few stories to judge in 1.",
    );
    expect(compareSummary([row("all", "flat"), row("a", "flat")])).toBe(
      "Tends higher in none of 1 genres, tends lower in none, no clear pattern in 1.",
    );
    expect(compareSummary([row("all", null)])).toBeNull();
  });

  it("lays out cards by width and draws hollow dots and dashes", () => {
    expect([300, 500, 800, 1200].map(gridColumns)).toEqual([2, 3, 4, 5]);
    const cells = [
      { ratio: 2.5, small: false, hidden: false },
      { ratio: 1, small: true, hidden: false },
      { ratio: null, small: false, hidden: true },
    ];
    const g = sparkGeometry(cells, 120);
    expect(g.points[0].y).toBe(4); // clamped at 2×
    expect(g.points[1].y).toBeCloseTo(g.one);
    expect(g.points[2].hidden).toBe(true);
    expect(g.band[0]).toBeLessThan(g.one);
    expect(g.band[1]).toBeGreaterThan(g.one);
  });

  it("colors only clear steps, never small groups", () => {
    expect(stepFill(1.05, false)).toBeNull();
    expect(stepFill(0.95, false)).toBeNull();
    expect(stepFill(1.6, false)).toBe("#8fb4f4");
    expect(stepFill(0.6, false)).toBe("#eea877");
    expect(stepFill(1.6, true)).toBeNull();
  });

  it("describes cards and cells in words", () => {
    const r = {
      genre: { id: "romance", name: "Romance" },
      verdict: { text: "tends higher" },
      overall: { median: 0.45 },
      cells: [
        { label: "Low", ratio: 0.8, stats: { median: 0.36, n: 24 }, small: true, hidden: false },
        { label: "High", ratio: null, hidden: true },
      ],
    };
    expect(cardLabel(r, 10)).toBe("Romance: tends higher. Low 0.8× (few stories), High: fewer than 10 stories. Open its chart.");
    expect(cellDetail(r, r.cells[0], (v) => v.toFixed(2), 10)).toBe(
      "Romance, Low: median 0.36 (24 stories), against 0.45 for all Romance stories shown.",
    );
  });
});
