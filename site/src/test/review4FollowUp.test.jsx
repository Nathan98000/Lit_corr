// The owner's follow-up to design review 4 (2026-10-13): Popularity's way to the Patterns page (no longer in the
// masthead), what a characteristic measures on the Genres page's one characteristic, every definition open in How it
// works' "Every characteristic", the increases first on both comparisons (One genre's Higher, the Trends page's Rose),
// and the new words' copy scans. (The masthead's menu: review4Wayfinding; the footer: App; the "?" with its last word:
// review4Definitions; the fit and the line breaks are measured in a browser: navfit.mjs, qcheck.mjs.)
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App, { PAGE_NAMES } from "../App.jsx";
import { clearCache } from "../lib/data.js";
import { genreProfile, profileTakeaway, whatItMeasures } from "../lib/genres.js";
import { changesAnnouncement, changesTakeaway, trendProfile } from "../lib/trends.js";
import { theMeasure } from "../lib/wording.js";
import { CAUSAL, UK_SPELLINGS } from "./scans.js";
import { fixtureFetch, fixtureMeta, realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const AGG = path.join(here, "..", "..", "public", "aggregates");
const real = realMeta();
const realJson = (p) => JSON.parse(readFileSync(path.join(AGG, p), "utf8"));
const styles = readFileSync(path.join(here, "..", "styles.css"), "utf8");
const genresCss = readFileSync(path.join(here, "..", "genres.css"), "utf8");

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function open(hash, ready = ".chart-panel[aria-busy='false']") {
  window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(ready)).toBeTruthy());
  return user;
}

describe("Popularity's way to the Patterns page", () => {
  it("ends the question's “Only include” row with “All clear patterns →”, named for the genre and measure", async () => {
    await open("#/explore?genre=all&metric=pop_fav_per_1k_views");
    const metric = fixtureMeta.metrics.find((m) => m.id === "pop_fav_per_1k_views");
    const row = document.querySelector(".question-after");
    const link = within(row).getByRole("link", { name: `All clear patterns with ${theMeasure(metric)} across all genres` });
    expect(link.textContent).toBe("All clear patterns →");
    expect(link.getAttribute("href")).toBe("#/patterns?genre=all&metric=pop_fav_per_1k_views");
    expect(row.lastElementChild).toBe(link); // after "Only include"
    // its name starts with its words (label in name)
    expect(link.getAttribute("aria-label").startsWith(link.textContent.replace(/ →$/, ""))).toBe(true);
    expect(styles).toMatch(/\.patterns-link \{[^}]*min-height: var\(--target\);[^}]*margin-left: auto;/);
  });

  it("follows the genre and the measure, and opens the Patterns page, Popularity marked in the masthead", async () => {
    const user = await open("#/explore?genre=romance&metric=pop_views");
    const genre = fixtureMeta.genres.find((g) => g.id === "romance").name;
    const link = screen.getByRole("link", { name: `All clear patterns with views in ${genre}` });
    expect(link.getAttribute("href")).toBe("#/patterns?genre=romance&metric=pop_views");
    await user.click(link);
    await screen.findByRole("heading", { level: 1, name: /^Clear patterns in / });
    const nav = screen.getByRole("navigation", { name: "Pages" });
    expect(within(nav).getByRole("link", { name: "Popularity" }).getAttribute("aria-current")).toBe("true");
    expect(within(nav).queryByRole("link", { name: "Patterns" })).toBeNull();
    expect(within(nav).getByRole("button", { name: "Patterns, menu" })).toBeTruthy();
  });

  it("is the only Patterns link besides Keep exploring's: the masthead and the footer have none", async () => {
    await open("#/explore");
    const links = screen.getAllByRole("link").filter((a) => (a.getAttribute("href") || "").startsWith("#/patterns"));
    expect(links.map((a) => a.closest(".question-after, .keep-exploring")?.className)).toEqual(["question-after", "keep-exploring"]);
  });
});

describe("what a characteristic measures, on the Genres page's one characteristic", () => {
  it("says it right under the heading, from meta.json's description, as the Trends page does", async () => {
    await open("#/genres?var=dlg_word_share");
    const variable = fixtureMeta.variables.find((v) => v.id === "dlg_word_share");
    const head = document.querySelector(".genre-answer > .chart-head");
    const what = head.nextElementSibling;
    expect(what.className).toBe("genre-what");
    expect(what.tagName).toBe("P");
    expect(what.textContent).toBe(whatItMeasures(variable));
    expect(what.textContent).toBe(variable.description);
    expect(genresCss).toMatch(/\.genre-what \{[^}]*max-width: 62ch;[^}]*font-size: var\(--text-14\);[^}]*color: var\(--ink-3\);/);
  });

  it("leaves it out where the description only repeats the label and the unit (it would define nothing)", async () => {
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) => {
      const res = await serve(url);
      if (!String(url).endsWith("meta.json")) return res;
      const meta = await res.json();
      const v = meta.variables.find((x) => x.id === "dlg_word_share");
      v.description = `${v.label}.`;
      return { ok: true, status: 200, json: async () => meta };
    });
    await open("#/genres?var=dlg_word_share");
    expect(document.querySelector(".genre-what")).toBeNull();
  });

  it.skipIf(!real)("has a definition for every characteristic the Genres page draws (the real data)", () => {
    const shown = real.variables.filter((v) => !["pub_month", "pub_weekday"].includes(v.id));
    expect(shown.filter((v) => !whatItMeasures(v)).map((v) => v.id)).toEqual([]);
  });
});

describe("How it works: every characteristic with its definition", () => {
  it("opens every topic: its name and count, its blurb, then each characteristic and what it measures", async () => {
    await open("#/methodology/glossary", ".prose h1");
    const groups = [...document.querySelectorAll(".glossary-group")];
    expect(groups).toHaveLength(fixtureMeta.topics.length);
    groups.forEach((g, i) => {
      const t = fixtureMeta.topics[i];
      expect(g.tagName).toBe("SECTION");
      expect(within(g).getByRole("heading", { level: 3 }).textContent).toBe(`${t.label} (${t.ids.length})`);
      expect(g.querySelector(".glossary-blurb").textContent).toBe(t.blurb);
      const terms = [...g.querySelectorAll("dt")].map((dt) => dt.textContent);
      expect(terms).toEqual(t.ids.map((id) => fixtureMeta.variables.find((v) => v.id === id).label));
      for (const dd of g.querySelectorAll("dd")) expect(dd.textContent).toMatch(/\S.*See the chart$/);
    });
    expect(document.querySelector(".glossary-group details, .glossary-group summary")).toBeNull();
  });
});

describe("the increases first, on both comparisons", () => {
  it("lists One genre's Higher before its Lower, in the takeaway and in the lists", () => {
    const p = { higher: [{ id: "a", variable: { label: "Anger" } }], lower: [{ id: "b", variable: { label: "Dialogue share" } }], mix: [] };
    expect(profileTakeaway(p).map((l) => l.word)).toEqual(["Higher", "Lower"]);
  });

  it.skipIf(!real)("lists the Trends page's Rose before its Fell, in the takeaway, the lists and what screen readers hear (the real data)", async () => {
    const file = realJson("trends/all/all.json");
    const p = trendProfile(real, file);
    expect(changesTakeaway(p).map((l) => l.word)).toEqual(["Rose", "Fell"]);
    const said = changesAnnouncement(real, file, {});
    expect(said.indexOf("Rose:")).toBeLessThan(said.indexOf("Fell:"));
    expect(said.indexOf("Rose:")).toBeGreaterThan(0);
  });

  it.skipIf(!real)("puts Romance's Higher before its Lower on the real data, and Later with Higher", () => {
    const file = realJson("genres/all.json");
    const romance = genreProfile(real, file, file.genres.indexOf("adult-romance"));
    expect(profileTakeaway(romance).map((l) => l.word)).toEqual(["Higher", "Later", "Lower"]);
  });

  it("draws the Trends page's Rose list first", async () => {
    // two characteristics that rose and one that fell, in the test data
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) => {
      const res = await serve(url);
      if (!String(url).includes("trends/")) return res;
      const body = await res.json();
      const ids = Object.keys(body.c).filter((id) => body.c[id].k !== "grp").slice(0, 3);
      ids.forEach((id, i) => Object.assign(body.c[id], { r: i < 2 ? 0.3 : -0.3, f: i < 2 ? 1 : -1 }));
      return { ok: true, status: 200, json: async () => body };
    });
    await open("#/trends", ".trends-page .chart-panel[aria-busy='false']");
    const titles = [...document.querySelectorAll(".profile-list h3")].map((h) => h.textContent);
    expect(titles[0]).toMatch(/Rose/);
    expect(titles[1]).toMatch(/Fell/);
    const takeaway = [...document.querySelectorAll(".profile-takeaway p")].map((x) => x.textContent);
    expect(takeaway.findIndex((t) => t.startsWith("▲ Rose:"))).toBeLessThan(takeaway.findIndex((t) => t.startsWith("▼ Fell:")));
  });
});

describe("the new words pass the copy scans", () => {
  it("has no UK spelling and no causal word", () => {
    const words = [
      ...Object.values(PAGE_NAMES),
      "All clear patterns →",
      "All clear patterns with the average rating across all genres",
      "See it on the Popularity page →",
      "Popularity, menu",
      "An independent project, not affiliated with or endorsed by Literotica.",
    ];
    for (const w of words) {
      expect(w).not.toMatch(UK_SPELLINGS);
      expect(w).not.toMatch(CAUSAL);
      expect(w).not.toMatch(/\bbecause\b/i);
    }
  });
});
