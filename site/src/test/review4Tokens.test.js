// Design review 4, phase 2 (X1): one visual system. Every font size in the style sheets is a step of the type scale,
// each size has one line height, and the charts' code (lib/tokens.js) holds the same numbers as styles.css's :root.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LEADING, MARK, TEXT } from "../lib/tokens.js";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["styles.css", "comparison.css", "genres.css", "trends.css", "palettes.css"];
const css = Object.fromEntries(FILES.map((f) => [f, readFileSync(path.join(SRC, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")]));

const SANS = [12, 13, 14, 15, 16, 18];
const SIZE_TOKENS = [...SANS.map((n) => `--text-${n}`), "--serif-20", "--serif-26", "--serif-heading", "--serif-page"];
// the page headings that phase 5 gives the page question's size (Patterns' title and question, How it works' title)
const PENDING = new Set([".prose h1", ".patterns-page h1", ".patterns-question"]);

/** Every declaration of a property: [{ file, selector, value }] (the selector the rule's own, inside media queries too). */
function declarations(prop) {
  const out = [];
  for (const [file, text] of Object.entries(css)) {
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = m[1].trim().replace(/\s+/g, " ");
      for (const d of m[2].matchAll(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "g"))) out.push({ file, selector, value: d[1].trim() });
    }
  }
  return out;
}

/** The :root tokens of styles.css: { name: value }. */
const root = Object.fromEntries(
  [...css["styles.css"].match(/:root \{([^}]*)\}/)[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
);

describe("the type scale (X1)", () => {
  it("is defined once, on :root: sans 12 · 13 · 14 · 15 · 16 · 18, serif 20, 26, 20–26 and 23–37", () => {
    for (const n of SANS) expect(root[`--text-${n}`]).toBe(`${n}px`);
    expect(root["--serif-20"]).toBe("20px");
    expect(root["--serif-26"]).toBe("26px");
    expect(root["--serif-heading"]).toBe("clamp(20px, 2.6vw, 26px)");
    expect(root["--serif-page"]).toBe("clamp(23px, 3.9vw, 37px)");
  });

  it("is the only source of font sizes in every style sheet", () => {
    // every declaration is read, inside media queries too
    const written = Object.values(css).reduce((n, text) => n + (text.match(/font-size\s*:/g) || []).length, 0);
    expect(declarations("font-size").length).toBe(written);
    expect(declarations("font-size").filter((d) => d.selector === ".range-chart .gn")).toHaveLength(1);
    const off = [];
    for (const { file, selector, value } of declarations("font-size")) {
      const token = value.match(/^var\((--[\w-]+)\)( !important)?$/);
      if (token && SIZE_TOKENS.includes(token[1])) continue;
      if (value === "inherit") continue;
      if (PENDING.has(selector)) continue;
      off.push(`${file} ${selector}: ${value}`);
    }
    for (const { file, selector, value } of declarations("font")) {
      if (value === "inherit") continue;
      const m = value.match(/^var\((--text-\d+)\) \/ var\((--leading-\d+)\) var\(--sans\)$/);
      if (!m || m[1].slice(7) !== m[2].slice(10)) off.push(`${file} ${selector}: font: ${value}`);
    }
    expect(off).toEqual([]);
  });

  it("gives each size one line height: a rule that sets both pairs them (text-13 with leading-13)", () => {
    const leading = (n) => root[`--leading-${n}`];
    for (const n of SANS) expect(Number(leading(n))).toBe(LEADING[n]);
    expect(Number(root["--leading-heading"])).toBe(LEADING[20]);
    expect(LEADING[20]).toBe(LEADING[26]); // the headings' sizes, 20 to 26, share one
    const off = [];
    for (const [file, text] of Object.entries(css)) {
      for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const size = m[2].match(/font-size:\s*var\(--text-(\d+)\)/);
        const line = m[2].match(/line-height:\s*([^;]+)/);
        if (!line) continue;
        const value = line[1].trim();
        if (!/^var\(--leading-[\w-]+\)$/.test(value)) off.push(`${file} ${m[1].trim()}: line-height ${value}`);
        else if (size && value !== `var(--leading-${size[1]})`) off.push(`${file} ${m[1].trim()}: ${size[0]} with ${value}`);
      }
    }
    expect(off).toEqual([]);
  });

  it("is the charts' scale too (lib/tokens.js), every role a step of it", () => {
    for (const v of Object.values(TEXT)) expect(SANS).toContain(v);
    expect(TEXT).toEqual({ tick: 12, note: 13, secondary: 14, control: 15, row: 16, lede: 18 });
  });
});

describe("the chart grammar and the one gray (X1)", () => {
  it("draws the median as a 6 px dot with a 2 px ring, the interquartile range as a 10 px capsule, the line 1 px", () => {
    expect([root["--mark-dot"], root["--mark-ring"], root["--mark-bar"], root["--mark-edge"], root["--mark-ref"], root["--mark-score"]]).toEqual(
      [MARK.dot, MARK.ring, MARK.bar, MARK.edge, MARK.ref, MARK.score].map((n) => `${n}px`),
    );
    expect(css["styles.css"]).toMatch(/\.range-chart \.median \{[^}]*stroke-width: var\(--mark-ring\);/);
    expect(css["styles.css"]).toMatch(/\.range-chart \.iqr \{[^}]*stroke-width: var\(--mark-edge\);/);
    expect(css["styles.css"]).toMatch(/\.range-chart \.ref line \{[^}]*stroke-width: var\(--mark-ref\);/);
  });

  it("uses one gray, #857f75, for marks and the borders of controls", () => {
    expect(root["--control"]).toBe("#857f75");
    expect(css["comparison.css"]).toMatch(/--quiet-mark: var\(--control\);/);
    // no other copy of the old border gray, but the "Other" segment's fill, a palette color with dark ink on it
    const old = Object.entries(css).flatMap(([file, text]) => [...text.matchAll(/([^{}]+)\{[^{}]*#8f8a80/g)].map((m) => `${file} ${m[1].trim()}`));
    expect(old).toEqual(["trends.css .pal-other"]);
  });
});
