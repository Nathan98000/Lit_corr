// Round 2's quick wins (section 6 of DESIGN_REVIEW_2.md).
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { clearCache } from "../lib/data.js";
import { fixtureFetch } from "./fixtures.js";

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderApp(hash = "") {
  if (hash) window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
  return user;
}

describe("F59: polish", () => {
  it("keeps each slot's last word with its caret, and the question mark on the caret's line", async () => {
    await renderApp();
    const sentence = document.querySelector(".sentence");
    const ends = [...sentence.querySelectorAll(".slot-end")];
    expect(ends.map((e) => e.textContent)).toEqual(["genres", "views", "share"]);
    for (const e of ends) expect(e.lastElementChild.classList.contains("caret")).toBe(true);
    expect(sentence.textContent.endsWith("share\u2060?")).toBe(true);
    expect(sentence.querySelector(".inline-select").nextSibling.textContent).toBe("\u2060,");
  });

  it("names the picker's options by their labels, described by topic and description", async () => {
    const user = await renderApp();
    await user.click(screen.getByRole("button", { name: /^Story characteristic:/ }));
    await user.type(await screen.findByRole("combobox", { name: /^Search/ }), "dialog");
    const option = screen.getByRole("option", { name: "Has dialogue" });
    const described = option.getAttribute("aria-describedby").split(" ").map((id) => document.getElementById(id).textContent);
    expect(described[0]).toBe("Dialogue & characters");
    expect(described[1].length).toBeGreaterThan(10);
  });

  it("puts the skip link inside the header landmark", async () => {
    await renderApp();
    expect(within(document.querySelector("header.masthead")).getByRole("link", { name: "Skip to content" })).toBeTruthy();
  });

  it("gives link previews a title, a description and a type, and no image", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const html = readFileSync(path.join(here, "..", "..", "index.html"), "utf8");
    const meta = (attr, name) => html.match(new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`))?.[1];
    const description =
      "What do popular Literotica stories have in common? Explore how the popularity of about 9,000 stories varies " +
      "with their characteristics, overall and within each genre.";
    expect(html.replace(/\s+/g, " ")).toContain(`name="description" content="${description}"`);
    expect(meta("property", "og:title")).toBe("What do popular Literotica stories have in common?");
    expect(html.replace(/\s+/g, " ")).toContain(`property="og:description" content="${description}"`);
    expect(meta("property", "og:type")).toBe("website");
    expect(meta("name", "twitter:card")).toBe("summary");
    expect(html).not.toMatch(/og:image|twitter:image/);
  });

  it("gives generated symbols in the CSS an empty text alternative, so they are not read out", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const css = readFileSync(path.join(here, "..", "styles.css"), "utf8");
    expect(css.match(/content:\s*"[^"]+"(?!\s*\/)/g)).toBeNull();
  });
});
