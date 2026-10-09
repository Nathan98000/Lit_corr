import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RangeChart from "../components/RangeChart.jsx";
import useGlide from "../components/useGlide.js";
import { fixtureMeta } from "./fixtures.js";

function Probe({ target, k, payload, out }) {
  out.glide = useGlide(target, k, payload);
  out.value = out.glide.values;
  return null;
}

/** requestAnimationFrame under the test's control: tick(t) runs the waiting frames at time t. */
function rafClock() {
  let queue = [];
  vi.stubGlobal("requestAnimationFrame", (f) => queue.push(f));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  return (t) =>
    act(() => {
      const q = queue;
      queue = [];
      q.forEach((f) => f(t));
    });
}

const motionOK = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

describe("gliding marks", () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
    vi.unstubAllGlobals();
  });

  it("moves values over 250 ms while the key stays the same, and hands over the old payload", () => {
    window.matchMedia = motionOK;
    const tick = rafClock();
    const out = {};
    const { rerender } = render(<Probe target={[[0, 10]]} k="a" payload="old ticks" out={out} />);
    rerender(<Probe target={[[100, 20]]} k="a" payload="new ticks" out={out} />);
    // before the first frame the old values are still drawn, already marked as gliding
    expect(out.value).toEqual([[0, 10]]);
    expect(out.glide.gliding).toBe(true);
    tick(0);
    expect(out.value[0][0]).toBe(0);
    tick(125);
    expect(out.value[0][0]).toBeGreaterThan(50); // ease-out: past halfway at half time
    expect(out.value[0][0]).toBeLessThan(100);
    expect(out.glide.from).toBe("old ticks");
    expect(out.glide.progress).toBeCloseTo(out.value[0][0] / 100);
    tick(250);
    expect(out.value).toEqual([[100, 20]]);
    expect(out.glide).toMatchObject({ gliding: false, progress: 1, from: null });
  });

  it("jumps under reduced motion and when the key changes", () => {
    window.matchMedia = (q) => ({ matches: q.includes("reduce"), addEventListener() {}, removeEventListener() {} });
    const out = {};
    const { rerender } = render(<Probe target={[[0, 10]]} k="a" out={out} />);
    rerender(<Probe target={[[100, 20]]} k="a" out={out} />);
    expect(out.value).toEqual([[100, 20]]);
    expect(out.glide.gliding).toBe(false);
    window.matchMedia = () => ({ matches: false });
    rerender(<Probe target={[[5, 5], null]} k="b" out={out} />);
    expect(out.value).toEqual([[5, 5], null]);
    expect(out.glide.gliding).toBe(false);
  });
});

describe("the chart in motion (F51)", () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
    vi.unstubAllGlobals();
  });

  const variable = fixtureMeta.variables.find((v) => v.id === "dlg_word_share");
  const fav = fixtureMeta.metrics.find((m) => m.id === "pop_fav_per_1k_views");
  const views = fixtureMeta.metrics.find((m) => m.id === "pop_views");
  const stats = (median) => ({ n: 100, age: 6, median, p25: median * 0.6, p75: median * 1.4, mean: median * 1.2 });
  const rowsOf = (medians) => medians.map((m, index) => ({ index, label: `Group ${index + 1}`, stats: stats(m) }));
  const A = { rows: rowsOf([0.3, 0.5, 0.7]), overall: stats(0.5) };
  const B = { rows: rowsOf([1.2, 1.9, 2.6]), overall: stats(1.8) };
  const draw = (genre, metric = fav) => (
    <RangeChart {...genre} metric={metric} variable={variable} smallN={30} minN={10} title="A chart" n={300} />
  );
  const dots = (c) => [...c.querySelectorAll(".median")].map((e) => Number(e.getAttribute("cx")));
  const refX = (c) => Number(c.querySelector(".ref line").getAttribute("x1"));
  /** The scale of the frame on screen, read from two of its ticks: x = a + b·value. */
  function tickScale(c) {
    const ticks = [...c.querySelectorAll(".tick-mark")].map((g) => [
      Number(g.getAttribute("data-v")),
      Number(g.querySelector("line").getAttribute("x1")),
    ]);
    const [p, q] = [ticks[0], ticks.find((t) => t[0] !== ticks[0][0])];
    const b = (q[1] - p[1]) / (q[0] - p[0]);
    return { a: p[1] - b * p[0], b, ticks };
  }

  it("glides a genre change on one scale: dots, the dashed line and every tick agree in each frame", () => {
    window.matchMedia = motionOK;
    const tick = rafClock();
    const { container, rerender } = render(draw(A));
    rerender(draw(B));
    tick(0);
    tick(90); // mid-glide
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("class")).toMatch(/gliding/);
    const { a, b, ticks } = tickScale(container);
    // every tick, old or new, is drawn on this frame's scale, and a value in both sets is drawn once
    for (const [v, tx] of ticks) expect(tx).toBeCloseTo(a + b * v, 6);
    expect(new Set(ticks.map(([v]) => v)).size).toBe(ticks.length);
    // the dots and the dashed line have all covered the same share of the way, on that scale
    const value = (px) => (px - a) / b;
    const shares = dots(container).map((cx, i) => (value(cx) - A.rows[i].stats.median) / (B.rows[i].stats.median - A.rows[i].stats.median));
    shares.push((value(refX(container)) - A.overall.median) / (B.overall.median - A.overall.median));
    expect(shares[0]).toBeGreaterThan(0.05);
    expect(shares[0]).toBeLessThan(0.95);
    for (const sh of shares) expect(sh).toBeCloseTo(shares[0], 6);
    tick(400);
    expect(svg.getAttribute("class") || "").not.toMatch(/gliding/);
  });

  it("does not glide a change of measure: the new chart is drawn at once", () => {
    window.matchMedia = motionOK;
    rafClock(); // frames never run: anything that waited for one would still be at its old place
    const fresh = render(draw(B, views)).container;
    const target = { dots: dots(fresh), ref: refX(fresh) };
    fresh.remove();
    const { container, rerender } = render(draw(A, fav));
    rerender(draw(B, views));
    expect(container.querySelector("svg").getAttribute("class") || "").not.toMatch(/gliding/);
    expect(dots(container)).toEqual(target.dots);
    expect(refX(container)).toBe(target.ref);
  });
});
