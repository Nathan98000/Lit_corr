// The simpler site (STAGE2_SIMPLIFY_AND_PNG_PROMPT.md): what that round removed stays removed, on every view.
import { render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { clearCache } from "../lib/data.js";
import { fixtureFetch, fixtureMeta, realMeta } from "./fixtures.js";

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function open(hash) {
  window.history.replaceState(null, "", `/${hash}`);
  render(<App />);
  await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
}

const VIEWS = [
  ["Explore", "#/explore?var=dlg_word_share"],
  ["Explore, a yes/no characteristic", "#/explore?var=dlg_has_dialogue"],
  ["Explore, named groups", "#/explore?var=pov_class"],
  ["One characteristic, numbers", "#/genres?var=dlg_word_share"],
  ["One characteristic, yes/no", "#/genres?var=dlg_has_dialogue"],
  ["One characteristic, mostly zero", "#/genres?var=emo_anger_per_1k"],
  ["One characteristic, named groups", "#/genres?var=pov_class"],
  ["One genre", "#/genres?view=genre&genre=romance&include=all"],
];

describe("no numbers tables (decision 5)", () => {
  it.each(VIEWS)("%s: no “Show the numbers” or “Hide the numbers”, and no table", async (_, hash) => {
    await open(hash);
    expect(screen.queryByRole("button", { name: /(Show|Hide) the numbers/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(/(Show|Hide) the numbers/);
    expect(document.querySelector("table")).toBeNull();
  });
});

describe("no comparing genres on Explore (decision 6)", () => {
  const PAGES = [
    ...VIEWS,
    ["Explore, a total", "#/explore?var=dlg_word_share&metric=pop_views"],
    ["Patterns", "#/patterns?genre=all&metric=pop_fav_per_1k_views"],
    ["How it works", "#/methodology"],
  ];

  it.each(PAGES)("%s: no “See this pattern in every genre” and no “Genre by genre”", async (name, hash) => {
    window.history.replaceState(null, "", `/${hash}`);
    render(<App />);
    if (name === "Patterns") await screen.findByText(/characteristics have a clear pattern/);
    else if (name === "How it works") await screen.findByRole("heading", { level: 1, name: "How it works" });
    else await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
    const text = document.body.textContent;
    expect(text).not.toMatch(/See this pattern in every genre|Genre by genre|, genre by genre|side by side|Back to one genre/);
    expect(screen.queryByRole("button", { name: /every genre|one genre/ })).toBeNull();
    expect(document.querySelector(".compare-grid, .genre-card, .compare-table")).toBeNull();
    expect(document.title).not.toMatch(/genre by genre/i);
  });

  it("has no example question that opens compare mode", () => {
    for (const meta of [fixtureMeta, realMeta()].filter(Boolean)) {
      expect(meta.featured.length).toBeGreaterThan(0);
      for (const q of meta.featured) {
        expect(q.mode).toBeUndefined();
        expect(q.question).not.toMatch(/every genre|genre by genre/i);
      }
    }
  });

  it.each([
    ["mode=compare with a genre", "#/explore?mode=compare&genre=fetish&var=dlg_word_share", "fetish"],
    ["mode=compare without one", "#/explore?mode=compare&var=dlg_word_share", "all"],
    ["an old shared link (mode=one)", "#/explore?mode=one&genre=romance&metric=pop_views&var=dlg_word_share&include=all", "romance"],
  ])("opens an old link with %s as one genre's chart, and its address drops mode", async (_, hash, genre) => {
    await open(hash);
    expect(screen.getByLabelText("Genre").value).toBe(genre);
    expect(document.querySelector(".range-chart svg")).toBeTruthy();
    await waitFor(() => expect(window.location.hash).not.toMatch(/mode/));
    expect(window.location.hash).toMatch(new RegExp(`^#/explore\\?genre=${genre}&.*var=dlg_word_share`));
  });
});

describe("no highlighted genre on the Genres page (decision 8)", () => {
  it.each(VIEWS.filter(([name]) => name.startsWith("One characteristic")))("%s: no Highlight menu", async (_, hash) => {
    await open(hash);
    expect(screen.queryByLabelText("Highlight")).toBeNull();
    expect(document.querySelector(".genres-controls").textContent).not.toMatch(/Highlight/);
    expect([...document.querySelectorAll(".genres-controls select")].map((x) => x.getAttribute("aria-label") || x.id)).toHaveLength(1);
  });

  it("draws no second row for an old link's genre, and the address drops it", async () => {
    await open("#/genres?var=dlg_word_share&genre=romance");
    const rows = [...document.querySelectorAll(".genre-chart .row")];
    expect(rows).toHaveLength(4); // All genres and the three genres, once each
    expect(rows.filter((r) => r.getAttribute("aria-label").startsWith("Romance:"))).toHaveLength(1);
    expect(document.querySelector(".row.repeat, .row.highlight, .band-highlight")).toBeNull();
    await waitFor(() => expect(window.location.hash).toBe("#/genres?var=dlg_word_share&include=all"));
  });

  const here = path.dirname(fileURLToPath(import.meta.url));
  const REAL = path.join(here, "..", "..", "public", "aggregates");
  const real = realMeta();
  it.skipIf(!real)("#/genres?var=story_words&genre=adult-romance: no repeated row, and the address loses genre (real data)", async () => {
    vi.stubGlobal("fetch", async (url) => {
      const rel = String(url).split("aggregates/")[1];
      const body = readFileSync(path.join(REAL, rel), "utf8");
      return { ok: true, status: 200, json: async () => JSON.parse(body) };
    });
    await open("#/genres?var=story_words&genre=adult-romance");
    const names = [...document.querySelectorAll(".genre-chart .row")].map((r) => r.getAttribute("aria-label").split(":")[0]);
    expect(names).toHaveLength(real.genres.length);
    expect(names[0]).toBe("All genres");
    expect(names.filter((n) => n === "Romance")).toHaveLength(1);
    expect(document.querySelector(".row.repeat, .row.highlight, .band-highlight")).toBeNull();
    await waitFor(() => expect(window.location.hash).toBe("#/genres?var=story_words&include=all"));
  });
});
