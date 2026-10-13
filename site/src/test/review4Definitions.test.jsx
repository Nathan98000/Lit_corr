// Design review 4, phase 7 (I16): definitions in place. On "One genre"'s and the Trends page's rows (lists and open
// topics), a "?" just after the name shows the characteristic's description from meta.json under the row and hides
// it again. The row's link is its name, stretched over the row, so the row still opens from anywhere but the button:
// one tab stop for the link and one for the button. Nothing is remembered: a new answer or the way back starts with
// every definition closed. (The real hit areas and "no page move" are measured in a browser, defhits.mjs.)
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { downloadChartImage, listsImagePlan } from "../lib/chartImage.js";
import { clearCache } from "../lib/data.js";
import { CAUSAL, UK_SPELLINGS } from "./scans.js";
import { fixtureFetch, fixtureMeta } from "./fixtures.js";

vi.mock("../lib/chartImage.js", async (original) => ({ ...(await original()), downloadChartImage: vi.fn(async () => {}) }));

const here = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.join(here, "..", "comparison.css"), "utf8");
const trendsCss = readFileSync(path.join(here, "..", "trends.css"), "utf8");
const byLabel = new Map(fixtureMeta.variables.map((v) => [v.label, v]));

/** Romance standing out on purpose (as genresProfile.test.jsx's test data), so that it has lists as well as topics. */
function standOuts(body) {
  if (body.n[2] < body.rule.min_n) return body;
  const set = (id, r, f) => Object.assign(body.c[id], { r, f });
  set("dlg_word_share", [null, 0.05, -0.32, null], [0, 0, -1, 0]);
  set("emo_anger_per_1k", [null, 0.02, 0.24, null], [0, 0, 1, 0]);
  set("pov_class", [null, 0.03, 0.27, null], [0, 0, 1, 0]);
  return body;
}

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  const serve = fixtureFetch();
  vi.stubGlobal("fetch", async (url) => {
    const res = await serve(url);
    if (!String(url).includes("genres/")) return res;
    const body = standOuts(await res.json());
    return { ok: true, status: 200, json: async () => body };
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const PAGES = [
  ["“One genre”", "#/genres?view=genre&genre=romance&include=all", ".genres-page .chart-panel[aria-busy='false']"],
  ["“What changed”", "#/trends", ".trends-page .chart-panel[aria-busy='false']"],
];

async function open(hash, ready) {
  window.history.replaceState(window.history.state, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(ready)).toBeTruthy());
  return user;
}

const openAllTopics = async (user) => {
  for (const s of document.querySelectorAll(".profile-topic summary")) await user.click(s);
};

/** The elements a row puts in the tab order. */
const tabbable = (row) => [...row.querySelectorAll("a[href], button, input, select, textarea, [tabindex]")].filter((el) => el.tabIndex >= 0);

describe("I16: a “?” on every row, just after its name", () => {
  for (const [page, hash, ready] of PAGES) {
    it(`on ${page}: in the lists and the open topics, named “What “…” measures”, closed, controlling its description`, async () => {
      const user = await open(hash, ready);
      await openAllTopics(user);
      const rows = [...document.querySelectorAll(".profile-row")];
      expect(rows.some((r) => r.closest(".profile-list"))).toBe(true);
      expect(rows.some((r) => r.closest(".profile-topic"))).toBe(true);
      for (const row of rows) {
        const label = row.querySelector(".profile-label-text").textContent;
        const button = row.querySelector(".profile-def-button");
        expect(button.textContent).toBe("?");
        expect(button.getAttribute("type")).toBe("button");
        expect(button.getAttribute("aria-label")).toBe(`What “${label}” measures`);
        expect(button.getAttribute("aria-expanded")).toBe("false");
        // just after the name, kept with its last word
        const link = row.querySelector(".profile-link");
        expect(link.nextSibling.textContent).toBe("⁠");
        expect(link.nextSibling.nextSibling).toBe(button);
        expect(link.contains(button)).toBe(false); // a button never sits inside a link
        const def = document.getElementById(button.getAttribute("aria-controls"));
        expect(row.contains(def)).toBe(true);
        expect(def.hidden).toBe(true);
        expect(def.textContent).toBe(byLabel.get(label).description);
        // one tab stop for the link and one for the button
        expect(tabbable(row)).toEqual([link, button]);
      }
    });
  }

  it("shows the description under the row's name when pressed, and hides it when pressed again", async () => {
    const user = await open(...PAGES[0].slice(1));
    const row = document.querySelector(".profile-list .profile-row");
    const button = within(row).getByRole("button", { name: /^What “Dialogue share” measures$/ });
    const def = document.getElementById(button.getAttribute("aria-controls"));
    const hash = window.location.hash;
    await user.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(def.hidden).toBe(false);
    expect(def.textContent).toBe(byLabel.get("Dialogue share").description);
    expect(row.classList.contains("defined")).toBe(true);
    expect(window.location.hash).toBe(hash); // the button opens nothing
    expect(document.activeElement).toBe(button);
    // only this row's
    expect([...document.querySelectorAll(".profile-def")].filter((d) => !d.hidden)).toEqual([def]);
    await user.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(def.hidden).toBe(true);
    expect(row.classList.contains("defined")).toBe(false);
  });

  it("leaves the row opening from its name, as before", async () => {
    const user = await open(...PAGES[0].slice(1));
    const row = document.querySelector(".profile-list .profile-row");
    await user.click(within(row).getByRole("button", { name: /measures$/ }));
    await user.click(row.querySelector(".profile-link"));
    await waitFor(() => expect(window.location.hash).toBe("#/genres?var=dlg_word_share&include=all"));
  });

  it("is never remembered: the way back and a new answer start with every definition closed", async () => {
    const user = await open(...PAGES[0].slice(1));
    const first = () => document.querySelector(".profile-list .profile-row");
    await user.click(within(first()).getByRole("button", { name: /measures$/ }));
    expect(first().classList.contains("defined")).toBe(true);
    await user.click(first().querySelector(".profile-link"));
    await waitFor(() => expect(window.location.hash).toBe("#/genres?var=dlg_word_share&include=all"));
    window.history.back();
    await waitFor(() => expect(document.querySelector(".genres-page .genre-profile[aria-busy='false'] .profile-list")).toBeTruthy());
    expect(document.querySelector(".profile-row.defined")).toBeNull();
    expect([...document.querySelectorAll(".profile-def-button")].every((b) => b.getAttribute("aria-expanded") === "false")).toBe(true);
    // another option: the answer is drawn anew
    await user.click(within(first()).getByRole("button", { name: /measures$/ }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Only include" }), "y2020");
    await waitFor(() => expect(window.location.hash).toMatch(/include=y2020/));
    await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
    expect(document.querySelector(".profile-row.defined")).toBeNull();
  });

  it("moves nothing on the page: no scrolling, and the description goes after the button, inside its own row", async () => {
    const user = await open(...PAGES[1].slice(1));
    const scrolls = [vi.spyOn(window, "scrollTo"), vi.spyOn(window, "scrollBy"), vi.spyOn(Element.prototype, "scrollIntoView")];
    const rows = [...document.querySelectorAll(".profile-row")];
    const row = rows[Math.min(1, rows.length - 1)];
    const button = row.querySelector(".profile-def-button");
    await user.click(button);
    for (const s of scrolls) expect(s).not.toHaveBeenCalled();
    const def = document.getElementById(button.getAttribute("aria-controls"));
    expect(button.compareDocumentPosition(def) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const above of rows.slice(0, rows.indexOf(row))) expect(above.contains(def)).toBe(false);
  });

  it("is left out of the image: no buttons and no open definitions", async () => {
    downloadChartImage.mockClear();
    const user = await open(...PAGES[0].slice(1));
    const button = document.querySelector(".profile-list .profile-def-button");
    await user.click(button);
    await user.click(screen.getByRole("button", { name: "Download image of what stands out" }));
    await waitFor(() => expect(downloadChartImage).toHaveBeenCalledTimes(1));
    const plan = listsImagePlan(downloadChartImage.mock.calls[0][0]);
    const words = JSON.stringify(plan.lists);
    expect(words).not.toContain(byLabel.get("Dialogue share").description);
    expect(words).not.toMatch(/measures”|"\?"/);
  });
});

describe("I16: how it looks", () => {
  it("draws an 18 px circle with a 13 px “?” in the second ink, a 1 px ring in the controls' gray", () => {
    const rule = css.match(/\.profile-def-button \{([^}]*)\}/)[1];
    expect(rule).toMatch(/width: 18px;/);
    expect(rule).toMatch(/height: 18px;/);
    expect(rule).toMatch(/border: 1px solid var\(--control\);/);
    expect(rule).toMatch(/border-radius: 50%;/);
    expect(rule).toMatch(/color: var\(--ink-2\);/);
    expect(rule).toMatch(/font-size: var\(--text-13\);/);
  });

  it("gives it a 44 px wide area the row's height, centered on it, under the name and over the row's link", () => {
    expect(css).toMatch(/\.profile-row \{\s*position: relative;/);
    expect(css).toMatch(/\.profile-def-button::before \{[^}]*position: absolute;[^}]*top: 0;[^}]*bottom: 0;[^}]*z-index: 1;[^}]*width: var\(--target\);/);
    expect(css).toMatch(/\.profile-def-button \{[^}]*display: inline-flex;[^}]*justify-content: center;/); // centers the area
    expect(css).toMatch(/\.profile-link::after \{[^}]*position: absolute;[^}]*inset: 0;/); // the link over the row
    expect(css).toMatch(/\.profile-label-text \{\s*position: relative;\s*z-index: 2;/); // the name over the "?"'s area
  });

  it("sets the description at 13 px in the second ink, at most 62 characters wide, across the row (under the name's line when stacked)", () => {
    expect(css).toMatch(/\.profile-def \{[^}]*grid-column: 1 \/ -1;[^}]*max-width: 62ch;[^}]*font-size: var\(--text-13\);[^}]*color: var\(--ink-2\);/);
    expect(css).toMatch(/\.genre-profile\.stacked \.profile-row\.defined \{\s*grid-template-areas: "label n1 n2 chev" "def def def def" "plot plot plot plot";/);
    expect(trendsCss).toMatch(/\.trend-changes\.stacked \.profile-row\.defined \{\s*grid-template-areas: "label values chev" "def def def" "plot plot plot";/);
  });

  it("names it in US English, never causally", () => {
    for (const v of fixtureMeta.variables) {
      const name = `What “${v.label}” measures`;
      expect(name).not.toMatch(UK_SPELLINGS);
      expect(name).not.toMatch(CAUSAL);
    }
  });
});
