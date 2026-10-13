// Design review 4, phase 4 (U1): where am I. The phone masthead names the page being read (since the owner's follow-up
// of 2026-10-13, on the button that opens every page in a menu); the kickers of Genres and Trends name the page and the
// source; Genres' question is its h1, as Trends' is; Trends' word count keeps "Only include" a menu. (The masthead's fit
// is measured in a browser, navfit.mjs; here, its parts and the menu's behavior.)
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import App, { NAV, PAGE_NAMES } from "../App.jsx";
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

const PAGES = [
  ["explore", "#/explore"],
  ["genres", "#/genres"],
  ["trends", "#/trends"],
  ["patterns", "#/patterns"],
  ["methodology", "#/methodology"],
];

describe("U1, with the owner's follow-up: every page in the masthead, the page being read named", () => {
  it("lists Popularity, Genres, Trends and How it works on every page, the page being read marked (Patterns: Popularity)", async () => {
    expect(NAV).toEqual(["explore", "genres", "trends", "methodology"]);
    for (const [page, hash] of PAGES) {
      await open(hash);
      const nav = screen.getByRole("navigation", { name: "Pages" });
      const links = within(nav).getAllByRole("link");
      expect(links.map((a) => a.textContent)).toEqual(["Popularity", "Genres", "Trends", "How it works"]);
      const marked = links.filter((a) => a.hasAttribute("aria-current"));
      expect(marked).toHaveLength(1);
      if (page === "patterns") {
        expect(marked[0].textContent).toBe("Popularity"); // a part of Popularity
        expect(marked[0].getAttribute("aria-current")).toBe("true");
      } else {
        expect(marked[0].textContent).toBe(PAGE_NAMES[page]);
        expect(marked[0].getAttribute("aria-current")).toBe("page");
      }
      // the phone's button: the page being read, then the menu (label in name)
      const button = within(nav).getByRole("button", { name: `${PAGE_NAMES[page]}, menu` });
      expect(button.querySelector(".nav-here").textContent).toBe(PAGE_NAMES[page]);
      expect(button.querySelector("svg").getAttribute("aria-hidden")).toBe("true");
      expect(nav.querySelector("[class*='drop-']")).toBeNull();
      cleanup();
    }
  });

  it("opens and closes the menu: the button, a link, Escape (focus back on the button), a tap outside, focus leaving", async () => {
    const user = userEvent.setup();
    await open("#/genres");
    const nav = screen.getByRole("navigation", { name: "Pages" });
    const button = within(nav).getByRole("button", { name: "Genres, menu" });
    const isOpen = () => button.getAttribute("aria-expanded") === "true" && nav.classList.contains("open");
    const isClosed = () => button.getAttribute("aria-expanded") === "false" && !nav.classList.contains("open");
    await user.click(button);
    expect(isOpen()).toBe(true);
    await user.click(button);
    expect(isClosed()).toBe(true);
    // Escape, with focus inside it
    await user.click(button);
    await user.tab();
    expect(document.activeElement.textContent).toBe("Popularity");
    await user.keyboard("{Escape}");
    expect(isClosed()).toBe(true);
    expect(document.activeElement).toBe(button);
    // a tap outside
    await user.click(button);
    await user.click(document.querySelector("main"));
    expect(isClosed()).toBe(true);
    // focus leaving it
    await user.click(button);
    nav.querySelector(".nav-links a").focus();
    document.querySelector(".brand").focus();
    await waitFor(() => expect(isClosed()).toBe(true));
    // a link
    await user.click(button);
    await user.click(within(nav).getByRole("link", { name: "Trends" }));
    expect(isClosed()).toBe(true);
    await waitFor(() => expect(within(nav).getByRole("button", { name: "Trends, menu" })).toBeTruthy());
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
