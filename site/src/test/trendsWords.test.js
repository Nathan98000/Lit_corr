// Every sentence the Trends page builds, for every characteristic, genre and option of the real data: no causal
// language, US spelling, no gaps, no notes about chance; "clearly" only through the file's flags; and no year written
// into the page's code (the years come from the files and meta.trend).
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { periodLabel } from "../lib/trendLayout.js";
import {
  mixFixedLine,
  nothingToDraw,
  numbersLine,
  periodName,
  periodWords,
  trendAnnouncement,
  trendAxisTitle,
  trendCells,
  trendFormat,
  trendHeading,
  trendQuestionText,
  tooFewHeading,
} from "../lib/trends.js";
import { realMeta } from "./fixtures.js";
import { CAUSAL, UK_SPELLINGS } from "./scans.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "..");
const real = realMeta();
const GAPS = /undefined|NaN|null|\[object| {2}|\.\.|,,|\(\)/;
// authors never chose or switched; stories never "moved to"; no notes about chance or correlation (the prompt's §7)
const NOT_SAID = /\b(chose|choose|chosen|switch\w*|moved to|chance|correlat\w*|significan\w*|random\w*)\b/i;

function* sentences(meta, file) {
  const genre = meta.genres.find((g) => g.id === file.g);
  const subset = meta.subsets.find((s) => s.id === file.s);
  const all = file.g === "all";
  for (const [id, entry] of Object.entries(file.c)) {
    const variable = meta.variables.find((v) => v.id === id);
    const at = `${file.s}/${file.g} ${id}`;
    // "clearly" is said only by the heading (the flag f) and the fixed-mix line (fm), and the announcement repeats them
    const mix = mixFixedLine(entry, file.g);
    const shown = !nothingToDraw(entry) && entry.r != null;
    const clearly = shown && (Boolean(entry.f) || Boolean(mix && entry.fm));
    yield { at, text: trendQuestionText(variable, genre), clearly: false };
    yield { at, text: trendAnnouncement(meta, file, { v: id, genre: file.g, sub: file.s }), clearly };
    if (nothingToDraw(entry)) {
      yield { at, text: tooFewHeading({ entry, genre, subset, file }), clearly: false };
      continue;
    }
    yield { at, text: trendHeading({ variable, entry, genre, subset, file }), clearly: shown && Boolean(entry.f) };
    const fmt = trendFormat(variable, entry, all, meta.small_n);
    const numbers = numbersLine({ variable, entry, genre, file, fmt, smallN: meta.small_n });
    if (numbers) yield { at, text: numbers.map((s) => (typeof s === "string" ? s : s.strong)).join(""), clearly: false };
    if (mix) yield { at, text: mix, clearly: Boolean(entry.fm) };
    if (entry.k === "num" || entry.k === "bin") {
      yield { at, text: trendAxisTitle(variable, entry), clearly: false };
      const cells = trendCells(entry, all, meta.small_n);
      for (const [i, p] of file.periods.entries()) {
        const words = periodWords({ variable, entry, cell: cells[i], fmt, minN: meta.min_n });
        yield { at, text: periodName(periodLabel(p), words), clearly: false };
      }
    }
  }
}

describe("the Trends page's sentences on the real data", () => {
  it.skipIf(!real)("are never causal, always US English, have no gaps, and say clearly only through the flags", { timeout: 60000 }, () => {
    let count = 0;
    for (const sub of real.trend.subsets) {
      for (const name of readdirSync(path.join(src, "..", "public", "aggregates", "trends", sub))) {
        const file = JSON.parse(readFileSync(path.join(src, "..", "public", "aggregates", "trends", sub, name), "utf8"));
        for (const s of sentences(real, file)) {
          count += 1;
          expect(s.text, s.at).not.toMatch(CAUSAL);
          expect(s.text, s.at).not.toMatch(UK_SPELLINGS);
          expect(s.text, s.at).not.toMatch(NOT_SAID);
          expect(s.text, `${s.at}: ${s.text}`).not.toMatch(GAPS);
          expect(/\bclearly\b/.test(s.text), `${s.at}: ${s.text}`).toBe(s.clearly);
        }
      }
    }
    expect(count).toBeGreaterThan(100000);
  });
});

describe("the Trends page's code", () => {
  it("writes no year: the periods and the windows come from the files and meta.trend", () => {
    const files = ["lib/trends.js", "lib/trendLayout.js", "components/TrendChart.jsx", "components/TrendAnswer.jsx", "components/TrendsPage.jsx"];
    for (const f of files) {
      const code = readFileSync(path.join(src, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(code.match(/\b(19|20)\d\d\b/g), f).toBeNull();
    }
  });
});
