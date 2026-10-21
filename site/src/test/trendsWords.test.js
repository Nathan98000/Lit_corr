// Every sentence the Trends page builds, for every characteristic, genre and option of the real data: no causal
// language, US spelling, no gaps, no notes about chance; "clearly" only through the file's flags, and never "borderline",
// "just past" or a length band (the owner took the fixed-mix check and the band line off the page); every axis title
// names a rate's unit once; and no year written into the page's code (the years come from the files and meta.trend).
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CARD_MAX, cardPlace, periodCardWidth } from "../components/TrendChart.jsx";
import { PHONE } from "../lib/rangeLayout.js";
import { periodLabel, splitLayout, trendLayout } from "../lib/trendLayout.js";
import {
  changesAnnouncement,
  changesHeading,
  changesRowName,
  changesValues,
  changesSampleLine,
  changesTakeaway,
  changesTooFewHeading,
  changesWords,
  nothingToDraw,
  numbersLine,
  pathLine,
  periodDetails,
  periodName,
  periodWords,
  trendAnnouncement,
  trendAxisTitle,
  trendCells,
  trendChartInput,
  trendFormat,
  trendHeading,
  trendQuestionText,
  trendProfile,
  trendSplitInputs,
  tooFewHeading,
  windowNumbers,
  windowWords,
  windowsCompared,
} from "../lib/trends.js";
import { realMeta } from "./fixtures.js";
import { CAUSAL, UK_SPELLINGS } from "./scans.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "..");
const real = realMeta();
const GAPS = /undefined|NaN|null|\[object| {2}|\.\.|,,|\(\)/;
// authors never chose or switched; stories never "moved to"; no notes about chance or correlation (the prompt's §7);
// the data's own unit text may say "ratio (1 = random order)"
const NOT_SAID = /\b(chose|choose|chosen|switch\w*|moved to|chance|correlat\w*|significan\w*|at random|randomly)\b/i;
// what the owner took off the page (2026-10-12): the fixed-mix check ("borderline", "just past" its line) and the band line
const OFF_THE_PAGE = /\b(borderline|just past|length bands?|held fixed|mix of genres)\b/i;

function* sentences(meta, file) {
  const genre = meta.genres.find((g) => g.id === file.g);
  const subset = meta.subsets.find((s) => s.id === file.s);
  const all = file.g === "all";
  for (const [id, entry] of Object.entries(file.c)) {
    const variable = meta.variables.find((v) => v.id === id);
    const at = `${file.s}/${file.g} ${id}`;
    // "clearly" is said only by the heading (the flag f), and the announcement repeats it
    const clearly = !nothingToDraw(entry) && entry.r != null && Boolean(entry.f);
    yield { at, text: trendQuestionText(variable, genre), clearly: false };
    yield { at, text: trendAnnouncement(meta, file, { v: id, genre: file.g, sub: file.s }), clearly };
    if (nothingToDraw(entry)) {
      yield { at, text: tooFewHeading({ entry, genre, subset, file }), clearly: false };
      continue;
    }
    yield { at, text: trendHeading({ variable, entry, genre, subset, file }), clearly };
    const fmt = trendFormat(variable, entry, all, meta.small_n);
    const numbers = numbersLine({ variable, entry, file, fmt, smallN: meta.small_n });
    if (numbers) yield { at, text: numbers.map((s) => (typeof s === "string" ? s : s.strong)).join(""), clearly: false };
    const path = pathLine({ entry, file, fmt, smallN: meta.small_n });
    if (path) yield { at, text: path, clearly: false };
    const w = windowWords(file);
    for (const kind of entry.k === "zero" ? ["any", "among"] : [entry.k]) {
      const nums = windowNumbers({ entry, file, fmt, kind, smallN: meta.small_n });
      for (const k of ["then", "now"]) if (nums?.[k]) yield { at, text: `${w[k]} · ${nums[k]}`, clearly: false };
    }
    if (entry.k === "num" || entry.k === "bin") yield { at, text: trendAxisTitle(variable, entry), clearly: false };
    if (entry.k === "zero") for (const h of trendSplitInputs(meta, variable, entry, file)) yield { at, text: `${h.title}: ${h.axisTitle}`, clearly: false };
    const cells = trendCells(entry, all, meta.small_n);
    for (const [i, p] of file.periods.entries()) {
      const words = periodWords({ variable, entry, cell: cells[i], fmt, minN: meta.min_n });
      yield { at, text: periodName(periodLabel(p), words), clearly: false };
      // the period's card on wider charts
      const d = periodDetails({ variable, entry, cell: cells[i], fmt, minN: meta.min_n });
      yield { at, text: d.stories ?? d.line, clearly: false };
      for (const b of d.blocks) {
        if (b.caption) yield { at, text: b.caption.join(" "), clearly: false };
        for (const [k, v] of b.items) yield { at, text: `${k} ${v}`, clearly: false };
      }
    }
  }
}

/** View 2's sentences for one file: "clearly" only in a changed row's name, and in the heading's count. */
function* changesSentences(meta, file) {
  const genre = meta.genres.find((g) => g.id === file.g);
  const subset = meta.subsets.find((s) => s.id === file.s);
  const at = `${file.s}/${file.g} what changed`;
  yield { at, text: changesAnnouncement(meta, file, {}), clearly: null };
  if (!windowsCompared(file)) {
    yield { at, text: changesTooFewHeading(file, genre, subset), clearly: false };
    return;
  }
  const p = trendProfile(meta, file);
  yield { at, text: changesHeading(p.flagged.length, p.compared, file), clearly: true };
  yield { at, text: changesSampleLine(file, genre, subset), clearly: false };
  for (const line of changesTakeaway(p)) yield { at, text: `${line.word}: ${line.items.join(", ")}.`, clearly: false };
  const w = changesWords(file);
  const titles = Object.values(w.lists).flatMap((t) => [t.full, `${t.mark} ${t.word}`]);
  const more = ["lower", "higher"].flatMap((list) => [1, 21].map((n) => w.showAll(n, list)));
  for (const text of [...w.heads(), ...w.valuesHead, ...titles, ...more, w.axisTitle, w.zone, w.mixLine({}), w.mixLine({ inTopic: true }), w.topicsLine]) {
    yield { at, text, clearly: false };
  }
  for (const inTopic of [false, true]) for (const tap of [false, true]) yield { at, text: w.note({ inTopic, tap }), clearly: false };
  for (const t of p.topics) yield { at, text: `${t.topic.label}, ${w.topicCount(t).text}`, clearly: false };
  for (const item of p.items) {
    yield { at: `${at} ${item.id}`, text: changesRowName(item, file, meta.min_n), clearly: Boolean(item.f) };
    yield { at: `${at} ${item.id}`, text: changesValues(item).text, clearly: false };
  }
}

describe("the Trends page's sentences on the real data", () => {
  it.skipIf(!real)("are never causal, always US English, have no gaps, say clearly only through the flags, never borderline", { timeout: 60000 }, () => {
    let count = 0;
    for (const sub of real.trend.subsets) {
      for (const name of readdirSync(path.join(src, "..", "public", "aggregates", "trends", sub))) {
        const file = JSON.parse(readFileSync(path.join(src, "..", "public", "aggregates", "trends", sub, name), "utf8"));
        for (const s of [...sentences(real, file), ...changesSentences(real, file)]) {
          count += 1;
          expect(s.text, s.at).not.toMatch(CAUSAL);
          expect(s.text, s.at).not.toMatch(UK_SPELLINGS);
          expect(s.text, s.at).not.toMatch(NOT_SAID);
          expect(s.text, `${s.at}: ${s.text}`).not.toMatch(OFF_THE_PAGE);
          expect(s.text, `${s.at}: ${s.text}`).not.toMatch(GAPS);
          if (s.clearly !== null) expect(/\bclearly\b/.test(s.text), `${s.at}: ${s.text}`).toBe(s.clearly);
        }
      }
    }
    expect(count).toBeGreaterThan(100000);
  });
});

describe("the periods' cards on the real data", () => {
  // a card is as wide as its content, up to CARD_MAX and the room cardPlace leaves it beside its column; a label, a
  // value, a part of a caption or the first line too wide for it would wrap. The narrowest room is on the narrowest
  // chart that draws cards (PHONE), where the split chart's halves are stacked. The tightest there, a balance's
  // "Interquartile range  −0.333 to −0.032" beside 2010–14, covers 8 px more of its own column.
  it.skipIf(!real)("are never too narrow for their numbers, captions or first lines, nor leave the chart, in any characteristic or genre", { timeout: 60000 }, () => {
    const byId = new Map(real.variables.map((v) => [v.id, v]));
    const problems = [];
    let cards = 0;
    for (const sub of real.trend.subsets) {
      const dir = path.join(src, "..", "public", "aggregates", "trends", sub);
      for (const name of readdirSync(dir)) {
        const file = JSON.parse(readFileSync(path.join(dir, name), "utf8"));
        const all = file.g === "all";
        for (const [id, entry] of Object.entries(file.c)) {
          const variable = byId.get(id);
          if (!variable || nothingToDraw(entry)) continue;
          const fmt = trendFormat(variable, entry, all, real.small_n);
          const cells = trendCells(entry, all, real.small_n);
          // the chart's width and each period's columns (both halves of a split chart)
          let width;
          let columns;
          if (entry.k === "zero") {
            const split = splitLayout({ width: PHONE, halves: trendSplitInputs(real, variable, entry, file) });
            width = split.width;
            columns = (i) => split.halves.map((h) => ({ ...h.layout.columns[i], x: h.layout.columns[i].x + h.dx, x0: h.layout.columns[i].x0 + h.dx, x1: h.layout.columns[i].x1 + h.dx }));
          } else {
            const layout = trendLayout({ width: PHONE, ...trendChartInput(real, variable, entry, file) });
            width = layout.width;
            columns = (i) => [layout.columns[i]];
          }
          for (const [i, p] of file.periods.entries()) {
            const d = periodDetails({ variable, entry, cell: cells[i], fmt, minN: real.min_n });
            const need = periodCardWidth(periodLabel(p), d);
            for (const at of columns(i)) {
              cards += 1;
              const style = cardPlace({ at: { ...at, top: 0 }, width, need });
              const w = Math.min(need, style.maxWidth ?? CARD_MAX);
              const left = style.left ?? width - style.right - w;
              const where = `${sub}/${file.g} ${id} ${periodLabel(p)}`;
              if (need > (style.maxWidth ?? CARD_MAX)) problems.push(`${where}: ${need} px in ${Math.round(style.maxWidth)}`);
              if (left < -0.5 || left + w > width + 0.5) problems.push(`${where}: outside the chart (${Math.round(left)}–${Math.round(left + w)} of ${width})`);
            }
          }
        }
      }
    }
    expect(problems).toEqual([]);
    expect(cards).toBeGreaterThan(30000); // all stories only since the owner's 2026-10-20 (four options before)
  });
});

describe("the Trends page's axis titles on the real data", () => {
  it.skipIf(!real)("name a rate's unit once, never “per 1,000 words” twice (“Sex scenes per 10,000 words”)", () => {
    const byId = new Map(real.variables.map((v) => [v.id, v]));
    const PER_WORDS = /\bper [\d,]+(?: [a-z]+)? words\b/gi;
    const times = (text, part) => text.toLowerCase().split(part.toLowerCase()).length - 1;
    // every characteristic as a chart of numbers, whatever its files draw (scene breaks and exclamations, whose labels end
    // with their unit, draw the split chart), then every title the page draws in every file: the chart's, or the split
    // chart's halves'
    const titles = real.variables.map((variable) => ({
      at: `${variable.id} as numbers`,
      variable,
      rate: true,
      text: trendAxisTitle(variable, { k: "num", fmt: "num" }),
    }));
    for (const sub of real.trend.subsets) {
      const dir = path.join(src, "..", "public", "aggregates", "trends", sub);
      for (const name of readdirSync(dir)) {
        const file = JSON.parse(readFileSync(path.join(dir, name), "utf8"));
        for (const [id, entry] of Object.entries(file.c)) {
          const variable = byId.get(id);
          const at = `${sub}/${file.g} ${id}`;
          if (entry.k === "num" || entry.k === "bin") {
            titles.push({ at, variable, rate: entry.k === "num" && entry.fmt !== "percent", text: trendAxisTitle(variable, entry) });
          }
          if (entry.k === "zero") {
            for (const h of trendSplitInputs(real, variable, entry, file)) {
              titles.push({ at: `${at} (${h.title})`, variable, rate: false, text: h.axisTitle });
            }
          }
        }
      }
    }
    for (const t of titles) {
      expect((t.text.match(PER_WORDS) ?? []).length, `${t.at}: ${t.text}`).toBeLessThan(2);
      if (t.rate && /^per /.test(t.variable.unit ?? "")) expect(times(t.text, t.variable.unit), `${t.at}: ${t.text}`).toBe(1);
    }
    // the scan meets labels that end with their unit ("Sex scenes per 10,000 words" …)
    const named = titles.filter((t) => t.rate && /^per /.test(t.variable.unit ?? "") && t.variable.label.endsWith(t.variable.unit));
    expect(named.length).toBeGreaterThan(0);
    expect(titles.length).toBeGreaterThan(6000); // all stories only since the owner's 2026-10-20 (four options before)
  });
});

describe("the Trends page's code", () => {
  it("writes no year: the periods and the windows come from the files and meta.trend", () => {
    const files = [
      "lib/trends.js",
      "lib/trendLayout.js",
      "components/TrendChart.jsx",
      "components/TrendMix.jsx",
      "components/TrendAnswer.jsx",
      "components/TrendChanges.jsx",
      "components/TrendsPage.jsx",
    ];
    for (const f of files) {
      const code = readFileSync(path.join(src, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(code.match(/\b(19|20)\d\d\b/g), f).toBeNull();
    }
  });
});
