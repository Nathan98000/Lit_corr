// Design review 4, phase 5 (X2): one page frame. The question balanced at every width and up to 44 characters wide from
// 760 px; Patterns opening as the other pages do (the kicker, the question as its h1, the count line in the takeaway's
// box); How it works' title at the page question's size. (The lines themselves are measured in a browser,
// lastword.mjs: no question's last word alone at 768, 1024, 1280 and 1440 px.)
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { clearCache } from "../lib/data.js";
import { aboutCount } from "../lib/wording.js";
import { fixtureFetch, fixtureMeta } from "./fixtures.js";

const styles = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "styles.css"), "utf8");

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("X2: the question", () => {
  it("is balanced at every width, at the page question's size, and up to 44 characters wide from 760 px", () => {
    expect(styles).toMatch(/\.sentence \{[^}]*max-width: 34ch;[^}]*font-size: var\(--serif-page\);[^}]*text-wrap: balance;/);
    expect(styles).toMatch(/@media \(min-width: 760px\) \{\s*\.sentence \{\s*max-width: 44ch;/);
    expect(styles).not.toMatch(/\.sentence \{[^}]*text-wrap: pretty/);
  });
});

describe("X2: Patterns opens as the other pages do", () => {
  it("has the kicker, the question as its one h1, and the count line in the takeaway's box; its tab keeps “Patterns”", async () => {
    window.history.replaceState(null, "", "/#/patterns?genre=all&metric=pop_fav_per_1k_views");
    render(<App />);
    const h1 = await screen.findByRole("heading", { level: 1, name: "Clear patterns in all genres with favorites per 1,000 views" });
    expect(h1.classList.contains("sentence")).toBe(true);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Patterns" })).toBeNull();
    const kicker = document.querySelector(".kicker");
    expect(kicker.tagName).toBe("P");
    expect(kicker.textContent).toBe(`Patterns · ${aboutCount(fixtureMeta.counts.included)} Literotica stories · ${fixtureMeta.genres.length - 1} genres`);
    const count = await waitFor(() => {
      const el = document.querySelector(".pattern-count");
      expect(el).toBeTruthy();
      return el;
    });
    expect(count.classList.contains("takeaway")).toBe(true);
    expect(count.textContent).toMatch(/^\d+ of \d+ characteristics have a clear pattern with favorites per 1,000 views across all genres\./);
    expect(document.title).toBe("Patterns · What do popular Literotica stories have in common?");
    // its selects keep their names
    expect(screen.getByRole("combobox", { name: "Genre" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Popularity measure" })).toBeTruthy();
  });

  it("draws its question at the page question's size and its count line at the takeaway's (no sizes of its own)", () => {
    expect(styles).toMatch(/\.patterns-question \{\s*margin-bottom: var\(--space-16\);\s*\}/);
    expect(styles).not.toMatch(/\.patterns-page h1/);
    expect(styles).toMatch(/\.takeaway \{[^}]*font-size: var\(--text-16\);/);
  });
});

describe("X2: How it works", () => {
  it("sets its title at the page question's size", async () => {
    expect(styles).toMatch(/\.prose h1 \{\s*font-size: var\(--serif-page\);\s*line-height: var\(--leading-page\);/);
    window.history.replaceState(null, "", "/#/methodology");
    render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: "How it works" })).toBeTruthy();
  });
});
