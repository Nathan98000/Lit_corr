import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useGlide from "../components/useGlide.js";

function Probe({ target, k, out }) {
  out.value = useGlide(target, k);
  return null;
}

describe("gliding marks", () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
    vi.unstubAllGlobals();
  });

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

  it("moves marks over 250 ms when only the measure or genre changes", () => {
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    const tick = rafClock();
    const out = {};
    const { rerender } = render(<Probe target={[[0, 10]]} k="a" out={out} />);
    rerender(<Probe target={[[100, 20]]} k="a" out={out} />);
    tick(0);
    expect(out.value[0][0]).toBe(0);
    tick(125);
    expect(out.value[0][0]).toBeGreaterThan(50); // ease-out: past halfway at half time
    expect(out.value[0][0]).toBeLessThan(100);
    tick(250);
    expect(out.value).toEqual([[100, 20]]);
  });

  it("jumps under reduced motion and when the characteristic changes", () => {
    window.matchMedia = (q) => ({ matches: q.includes("reduce"), addEventListener() {}, removeEventListener() {} });
    const out = {};
    const { rerender } = render(<Probe target={[[0, 10]]} k="a" out={out} />);
    rerender(<Probe target={[[100, 20]]} k="a" out={out} />);
    expect(out.value).toEqual([[100, 20]]);
    window.matchMedia = () => ({ matches: false });
    rerender(<Probe target={[[5, 5], null]} k="b" out={out} />);
    expect(out.value).toEqual([[5, 5], null]);
  });
});
