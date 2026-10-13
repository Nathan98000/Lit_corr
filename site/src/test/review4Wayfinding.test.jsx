// Design review 4, phase 4 (U1): where am I. The phone masthead keeps the page being read; the kickers of Genres and
// Trends name the page and the source; Genres' question is its h1, as Trends' is; Trends' word count keeps "Only
// include" a menu. (The masthead's fit is measured in a browser, mastfit5.mjs; here, the rule and its classes.)
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App, { NAV, NAV_TIERS, navDrop, navSet } from "../App.jsx";
import { clearCache } from "../lib/data.js";
import { aboutCount } from "../lib/wording.js";
import { fixtureFetch, fixtureMeta } from "./fixtures.js";

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function open(hash) {
  window.history.replaceState(null, "", `/${hash}`);
  render(<App />);
  await waitFor(() => expect(document.querySelector("main [aria-busy='true']")).toBeNull());
}

const NAMES = { explore: "Explore", genres: "Genres", trends: "Trends", patterns: "Patterns", methodology: "How it works" };
const shownAt = (tier, page) => navSet(NAV_TIERS.find((t) => t.below === tier).links, page).map((l) => NAMES[l]).join(" ");

describe("U1: the phone masthead keeps the page being read", () => {
  it("shows as many links as before at each width, the page being read among them, the last other link making room", () => {
    // before: four links below 602 px, three below 414, two below 352
    expect(NAV_TIERS.map((t) => [t.below, t.links.length])).toEqual([[602, 4], [414, 3], [352, 2]]);
    expect(shownAt(414, "explore")).toBe("Explore Genres Trends"); // 375 px on Explore (the prompt's example)
    expect(shownAt(352, "explore")).toBe("Explore Genres");
    expect(shownAt(602, "explore")).toBe("Explore Genres Trends Patterns");
    expect(shownAt(352, "patterns")).toBe("Genres Patterns");
    expect(shownAt(414, "patterns")).toBe("Genres Trends Patterns");
    for (const page of ["genres", "trends"]) {
      expect([602, 414, 352].map((t) => shownAt(t, page))).toEqual(["Explore Genres Trends Patterns", "Genres Trends Patterns", "Genres Trends"]);
    }
    for (const page of ["explore", "genres", "trends", "patterns"]) {
      for (const t of NAV_TIERS) {
        const set = navSet(t.links, page);
        expect(set).toHaveLength(t.links.length);
        expect(set).toContain(page);
      }
    }
  });

  it("keeps How it works's masthead as before for now: its own link doesn't fit in another's place (the owner decides)", () => {
    expect([602, 414, 352].map((t) => shownAt(t, "methodology"))).toEqual([
      "Explore Genres Trends Patterns",
      "Genres Trends Patterns",
      "Genres Trends",
    ]);
  });

  it("hides each link from the width where it leaves, on every page (its class), and never the page being read", async () => {
    for (const [page, hash] of [
      ["explore", "#/explore"],
      ["genres", "#/genres"],
      ["trends", "#/trends"],
      ["patterns", "#/patterns"],
      ["methodology", "#/methodology"],
    ]) {
      await open(hash);
      const nav = screen.getByRole("navigation", { name: "Pages" });
      const links = within(nav).getAllByRole("link");
      expect(links.map((a) => a.textContent)).toEqual(NAV.map((l) => NAMES[l]));
      links.forEach((a, i) => {
        const drop = navDrop(NAV[i], page);
        if (drop) expect(a.classList.contains(drop)).toBe(true);
        expect([...a.classList].filter((c) => c.startsWith("drop-"))).toEqual(drop ? [drop] : []);
      });
      const current = links.find((a) => a.getAttribute("aria-current") === "page");
      expect(current.textContent).toBe(NAMES[page]);
      if (page !== "methodology") expect([...current.classList].some((c) => c.startsWith("drop-"))).toBe(false);
      cleanup();
    }
  });
});

describe("U1: the kickers name the page and the source; the question is the h1", () => {
  const stories = aboutCount(fixtureMeta.counts.included);
  const genres = fixtureMeta.genres.length - 1;

  for (const [hash, kicker, h1] of [
    ["#/genres?var=dlg_word_share", `Genres · ${stories} Literotica stories · ${genres} genres`, "How do genres differ in dialogue share?"],
    ["#/genres?view=genre&genre=romance", `Genres · ${stories} Literotica stories · ${genres} genres`, "What stands out about stories in Romance?"],
    ["#/trends", `Trends · ${stories} Literotica stories · 2000–2026`, "What has changed in stories across all genres?"],
    ["#/trends?var=dlg_word_share", `Trends · ${stories} Literotica stories · 2000–2026`, "Across all genres, how has dialogue share changed over time?"],
  ]) {
    it(`on ${hash}: “${kicker}”, a paragraph, and one h1, the question`, async () => {
      await open(hash);
      const k = document.querySelector(".kicker");
      expect(k.tagName).toBe("P");
      expect(k.textContent).toBe(kicker);
      // the pieces never break badly: each separator leads its piece (styles.css clips one at a line's start)
      expect([...k.querySelectorAll(".kicker-piece")].map((p) => p.textContent)).toEqual([
        `${stories} Literotica stories`,
        kicker.slice(kicker.lastIndexOf(" · ")),
      ]);
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      const heading = screen.getByRole("heading", { level: 1, name: h1 });
      expect(heading.classList.contains("sentence")).toBe(true);
      expect(document.getElementById("question").contains(heading)).toBe(true);
      // the question's controls keep their names
      expect(screen.getAllByRole("combobox", { name: /^(Genre|Only include)$/ }).length).toBeGreaterThan(0);
    });
  }

  it("keeps Explore's headline as its kicker and h1, and gives How it works no kicker", async () => {
    await open("#/explore");
    const k = document.querySelector(".kicker");
    expect(k.tagName).toBe("H1");
    expect(k.textContent).toBe(`What do popular Literotica stories have in common? · ${stories} stories · ${genres} genres`);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    cleanup();
    await open("#/methodology");
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "How it works" })).toBeTruthy());
    expect(document.querySelector(".kicker")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

describe("U1: Trends' word count keeps “Only include” a menu", () => {
  it("draws “All stories ▾” with its Length options turned off inside it, and no note that they don't apply", async () => {
    const realish = {
      ...fixtureMeta,
      variables: [...fixtureMeta.variables, { ...fixtureMeta.variables[0], id: "story_words", label: "Word count", noun: "word count" }],
    };
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) => {
      if (String(url).endsWith("meta.json")) return { ok: true, status: 200, json: async () => realish };
      const res = await serve(url);
      if (!String(url).includes("trends/")) return res;
      const body = await res.json();
      body.c.story_words = body.c.dlg_word_share;
      return { ok: true, status: 200, json: async () => body };
    });
    await open("#/trends?var=story_words");
    const select = screen.getByRole("combobox", { name: "Only include" });
    const off = [...select.options].filter((o) => o.disabled).map((o) => o.textContent);
    expect(off).toEqual(fixtureMeta.subsets.filter((s) => s.group === "Length").map((s) => `${s.label} (not with word count)`));
    expect(select.closest(".include").querySelector(".slot-text").textContent).toBe("All stories");
    expect(document.body.textContent).not.toMatch(/options don’t apply/);
  });
});
