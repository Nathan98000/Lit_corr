// Design review 4, phase 8: the quick wins. F104, the Trends page's key drawn as the chart draws its marks; F109, How
// it works' phone bar at the page's top; F110, 44 px targets on Patterns; F112, the too-few table at 400% zoom; F118,
// "and 2 more" when the Trends takeaway names fewer changes than its list holds. (The tap areas and the sideways scroll
// are measured in a browser: taps.mjs, sweep.mjs.)
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { clearCache } from "../lib/data.js";
import { changesAnnouncement, changesLineWords, changesTakeaway, trendProfile, windowsCompared } from "../lib/trends.js";
import { CAUSAL, UK_SPELLINGS } from "./scans.js";
import { fixtureFetch, fixtureMeta, realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const AGG = path.join(here, "..", "..", "public", "aggregates");
const real = realMeta();
const realTrends = (sub, g) => JSON.parse(readFileSync(path.join(AGG, "trends", sub, `${g}.json`), "utf8"));
const styles = readFileSync(path.join(here, "..", "styles.css"), "utf8");
const trendsCss = readFileSync(path.join(here, "..", "trends.css"), "utf8");
const rule = (css, selector) => {
  const at = css.indexOf(`${selector} {`);
  return at < 0 ? null : css.slice(at, css.indexOf("}", at));
};

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function open(hash, ready = ".chart-panel[aria-busy='false']") {
  window.history.replaceState(null, "", `/${hash}`);
  render(<App />);
  await waitFor(() => expect(document.querySelector(ready)).toBeTruthy());
}

describe("F104: the Trends page's key, as the chart draws its marks", () => {
  it("draws the median's capsule 10 × 18 px with its dot and no outline, blue and then gray", () => {
    const range = rule(trendsCss, ".trend-legend .key-range");
    expect(range).toMatch(/--key-h: 18px;/);
    expect(range).toMatch(/width: 10px;/);
    expect(range).toMatch(/border-radius: 5px;/);
    expect(range).not.toMatch(/border:/);
    expect(range).toMatch(/radial-gradient\(circle at 50% 50%, var\(--accent-ink\) 0 4px, transparent 4\.5px\), var\(--accent-bar\)/);
    const mid = rule(trendsCss, ".trend-legend .key-mid.key-range");
    expect(mid).not.toMatch(/border/);
    expect(mid).toMatch(/var\(--quiet-mark\) 0 4px/);
  });

  it("draws the brackets' key as a 16 px line with 4 px ticks", () => {
    const bracket = rule(trendsCss, ".trend-legend .key-bracket");
    expect(bracket).toMatch(/--key-h: 4px;/);
    expect(bracket).toMatch(/box-sizing: border-box;/);
    expect(bracket).toMatch(/width: 16px;/);
    expect(bracket).toMatch(/border: 1px solid var\(--ink-3\);\s*border-top: 0;/);
  });

  it("centers every mark on the first line of its words, and outlines the capsules in forced colors as the chart's are", () => {
    expect(trendsCss).toMatch(/\.trend-legend li \{\s*align-items: flex-start;/);
    expect(trendsCss).toMatch(/\.trend-legend \.key \{\s*flex: none;\s*height: var\(--key-h\);\s*margin-top: calc\(\(1lh - var\(--key-h\)\) \/ 2\);/);
    for (const mark of ["key-share", "key-range", "key-small-dot", "key-small", "key-swatch", "key-bracket"]) {
      expect(rule(trendsCss, `.trend-legend .${mark}`), mark).toMatch(/--key-h: \d+px;/);
    }
    const forced = trendsCss.slice(trendsCss.indexOf("@media (forced-colors: active)"));
    expect(forced).toMatch(/\.trend-legend \.key-range \{[^}]*border: 1px solid CanvasText;/);
    expect(forced).toMatch(/\.trend-legend \.key-mid\.key-range \{[^}]*border: 1px solid GrayText;/);
  });

  it("keeps the key's entries and their marks on the page", async () => {
    await open("#/trends?var=dlg_word_share", ".trends-page .chart-panel[aria-busy='false']");
    const marks = [...document.querySelectorAll(".trend-legend .key")].map((k) => [...k.classList].filter((c) => c !== "key").join(" "));
    expect(marks).toEqual(["key-range", "key-bracket", "key-mid key-range"]);
  });
});

describe("F109: How it works' phone bar at the page's top", () => {
  it("reads “How it works” beside its Contents button, until a section is reached", async () => {
    vi.stubGlobal("matchMedia", (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
    await open("#/methodology", ".section-bar");
    expect(document.querySelector(".section-bar-where").textContent).toBe("How it works");
    expect(document.querySelector(".section-bar-where b")).toBeNull();
    expect(screen.getByRole("button", { name: "Contents" })).toBeTruthy();
  });
});

describe("F110: 44 px targets on Patterns", () => {
  it("makes every characteristic's link at least 44 px tall, its name centered in it", () => {
    const link = rule(styles, ".pattern-row a");
    expect(link).toMatch(/display: flex;/);
    expect(link).toMatch(/align-items: center;/);
    expect(link).toMatch(/min-height: var\(--target\);/);
  });

  it("lets the question's two selects answer taps over 44 px, the genre's upward and the measure's downward, as “Only include” does", async () => {
    expect(styles).toMatch(/\.patterns-question \.inline-select select \{\s*inset: min\(0px, calc\(100% - var\(--target\) - 1px\)\) -4px 0;\s*width: auto;\s*height: auto;/);
    expect(styles).toMatch(/\.patterns-question \.inline-select ~ \.inline-select select \{\s*inset: 0 -4px min\(0px, calc\(100% - var\(--target\) - 1px\)\);/);
    // "Only include", over 44 px whatever its words' height
    expect(styles).toMatch(/\.include \.inline-select select \{\s*inset: min\(0px, calc\(\(100% - var\(--target\)\) \/ 2 - 1px\)\) -4px;/);
    await open("#/patterns?genre=all&metric=pop_fav_per_1k_views", ".patterns-page");
    await waitFor(() => expect(document.querySelectorAll(".patterns-question .inline-select select")).toHaveLength(2));
  });
});

describe("F112: the too-few table fits a 320 px screen at 400% zoom", () => {
  it("lets a period's label take two lines, “2000” over “–04”, breaking only before its dash", async () => {
    await open("#/trends?genre=tiny", ".trends-page .chart-panel[aria-busy='false']");
    const heads = [...document.querySelectorAll(".trend-few-table th")];
    expect(heads.map((t) => t.textContent)).toEqual(["2000–04", "2005–09", "2010–14", "2015–19", "2020–26"]);
    for (const th of heads) {
      expect(th.querySelector("wbr").nextElementSibling.className).toBe("period-end");
      expect(th.querySelector(".period-end").textContent).toMatch(/^–\d\d$/);
    }
    expect(rule(trendsCss, ".trend-few-table th")).not.toMatch(/white-space: nowrap/);
    expect(rule(trendsCss, ".trend-few-table .period-end")).toMatch(/white-space: nowrap;/);
  });
});

describe("F118: “and 2 more” when the takeaway names fewer changes than its list holds", () => {
  it("ends a line with how many more its list holds", () => {
    expect(changesLineWords({ items: ["a", "b", "c"], more: 2 })).toBe("a, b, c and 2 more.");
    expect(changesLineWords({ items: ["a", "b", "c"], more: 0 })).toBe("a, b, c.");
    expect(changesLineWords({ items: ["a"], more: 0 })).toBe("a.");
    for (const s of ["and 2 more", "and 18 more"]) {
      expect(s).not.toMatch(UK_SPELLINGS);
      expect(s).not.toMatch(CAUSAL);
    }
  });

  it.skipIf(!real)("reads so on the real data's All genres, on the page's takeaway and in what screen readers hear", () => {
    const file = realTrends("all", "all");
    const p = trendProfile(real, file);
    const fell = changesTakeaway(p).find((l) => l.word === "Fell");
    expect(fell.more).toBe(p.lower.length - 3);
    expect(`${fell.mark} ${fell.word}: ${changesLineWords(fell)}`).toBe(
      "▼ Fell: average paragraph length, median paragraph length, very long paragraphs (‘walls of text’) and 1 more.",
    );
    expect(changesAnnouncement(real, file, {})).toContain(`Fell: ${changesLineWords(fell)}`);
  });

  it.skipIf(!real)("counts the rest of each list exactly, for every genre and option", { timeout: 30000 }, () => {
    let more = 0;
    for (const sub of real.trend.subsets) {
      for (const g of real.genres) {
        let file;
        try {
          file = realTrends(sub, g.id);
        } catch {
          continue;
        }
        if (!windowsCompared(file)) continue;
        const p = trendProfile(real, file);
        const lists = { Fell: p.lower, Rose: p.higher, "A different mix": p.mix };
        for (const line of changesTakeaway(p)) {
          expect(line.items).toHaveLength(Math.min(3, lists[line.word].length));
          expect(line.more).toBe(lists[line.word].length - line.items.length);
          if (line.more) more += 1;
        }
      }
    }
    expect(more).toBeGreaterThan(0);
  });

  it("shows it on the page and says it to screen readers", async () => {
    // two more characteristics like dialogue share, so that five rose
    const extra = ["x0", "x1"].map((id, i) => ({ ...fixtureMeta.variables[0], id, label: `Extra ${i}` }));
    const meta = {
      ...fixtureMeta,
      variables: [...fixtureMeta.variables, ...extra],
      topics: fixtureMeta.topics.map((t) => (t.id === "dialogue" ? { ...t, ids: [...t.ids, "x0", "x1"] } : t)),
    };
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) => {
      if (String(url).endsWith("meta.json")) return { ok: true, status: 200, json: async () => meta };
      const res = await serve(url);
      if (!String(url).includes("trends/")) return res;
      const body = await res.json();
      body.c.x0 = { ...body.c.dlg_word_share };
      body.c.x1 = { ...body.c.dlg_word_share };
      for (const e of Object.values(body.c)) if (e.k !== "grp") Object.assign(e, { r: 0.3, f: 1 });
      return { ok: true, status: 200, json: async () => body };
    });
    await open("#/trends", ".trends-page .chart-panel[aria-busy='false']");
    const rose = [...document.querySelectorAll(".profile-takeaway p")].find((x) => x.textContent.startsWith("▲ Rose:"));
    expect(rose.textContent).toMatch(/^▲ Rose: [^,]+, [^,]+, [^,]+ and 2 more\.$/);
    const list = [...document.querySelectorAll(".profile-list")].find((l) => l.querySelector("h3").textContent.includes("Rose"));
    expect(list.querySelectorAll(".profile-row")).toHaveLength(5);
    await waitFor(() => expect(document.querySelector(".trends-page > [aria-live='polite']").textContent).toMatch(/Rose: .* and 2 more\./));
  });
});
