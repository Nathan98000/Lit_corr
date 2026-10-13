// Round 2's quick wins (section 6 of DESIGN_REVIEW_2.md): F47, F52, F54 and F59 (F37's similar-age check, and F39's
// and F53's compare mode, are gone).
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import RangeChart from "../components/RangeChart.jsx";
import { clearCache } from "../lib/data.js";
import { fixtureFetch, fixtureMeta } from "./fixtures.js";

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

describe("F47: what screen readers hear", () => {
  it("announces the full title and the answer, so two charts without a pattern sound different", async () => {
    const user = await renderApp("#/explore?genre=romance&var=dlg_word_share");
    const live = document.querySelector("[aria-live='polite']");
    expect(live.textContent).toBe("How favorites per 1,000 views vary with dialogue share in Romance. No clear pattern.");
    await user.click(screen.getByRole("button", { name: /^Popularity measure:/ }));
    const dialog = await screen.findByRole("dialog", { name: "Popularity measure" });
    await user.click((await within(dialog).findAllByRole("option")).find((o) => o.textContent.startsWith("Views per month")));
    await waitFor(() => expect(live.textContent).toBe("How views per month vary with dialogue share in Romance. No clear pattern."));
    expect(document.querySelector(".chart-title").textContent).toBe("No clear pattern");
  });

  it("announces a clear pattern once, as its title", async () => {
    await renderApp("#/explore?var=dlg_word_share");
    expect(document.querySelector("[aria-live='polite']").textContent).toBe(
      "Stories with more dialogue tend to get more favorites per 1,000 views",
    );
  });
});

describe("F52: ways out and headings", () => {
  it("offers All genres when no group has enough stories", async () => {
    const user = await renderApp("#/explore?genre=tiny&var=dlg_word_share");
    expect(screen.getByText("No group has enough stories in this selection to show a chart.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "All stories" })).toBeNull(); // it would change nothing
    await user.click(screen.getByRole("button", { name: "All genres" }));
    await waitFor(() => expect(window.location.hash).toMatch(/genre=all/));
  });

  it("keeps a level-one heading above the error when nothing could load", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 503, json: async () => ({}) }));
    render(<App />);
    await screen.findByText(/We couldn’t load the data/);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^What do popular Literotica stories have in common\?/);
  });
});

describe("F54: the keyboard in the chart", () => {
  const metric = fixtureMeta.metrics.find((m) => m.id === "pop_fav_per_1k_views");
  const variable = fixtureMeta.variables.find((v) => v.id === "dlg_word_share");
  const stats = (median) => ({ n: 100, median, p25: median * 0.6, p75: median * 1.4, mean: median * 1.2 });
  const rows = ["Under 10%", "10–20%", "20–25%", "25%+"].map((label, index) => ({ index, label, stats: stats(0.3 + index / 10) }));
  const draw = () =>
    render(
      <>
        <button type="button">Before</button>
        <RangeChart rows={rows} overall={stats(0.45)} metric={metric} variable={variable} smallN={30} minN={10} title="T" n={400} />
        <button type="button">After</button>
      </>,
    );
  const card = () => document.querySelector(".chart-tip");

  it("is a single tab stop", async () => {
    const user = userEvent.setup();
    draw();
    const rowEls = screen.getAllByRole("img");
    expect(rowEls.map((r) => r.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1"]);
    screen.getByRole("button", { name: "Before" }).focus();
    await user.tab();
    expect(document.activeElement).toBe(rowEls[0]);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  });

  it("moves between rows with the arrows, Home and End, shows the focused row's details, hides them on Escape", async () => {
    const user = userEvent.setup();
    draw();
    const rowEls = screen.getAllByRole("img");
    screen.getByRole("button", { name: "Before" }).focus();
    await user.tab();
    expect(card().querySelector("strong").textContent).toBe("Under 10%");
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rowEls[1]);
    expect(card().querySelector("strong").textContent).toBe("10–20%");
    expect(rowEls.map((r) => r.getAttribute("tabindex"))).toEqual(["-1", "0", "-1", "-1"]); // the stop moves along
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(rowEls[3]);
    await user.keyboard("{ArrowDown}"); // stays at the end
    expect(document.activeElement).toBe(rowEls[3]);
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(rowEls[0]);
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(rowEls[0]);
    await user.keyboard("{Escape}");
    expect(card()).toBeNull();
    // the row names keep every number
    expect(rowEls[1].getAttribute("aria-label")).toBe("10–20%: median 0.40, interquartile range 0.24–0.56, mean 0.48, 100 stories");
  });

  it("no longer pins the details with Enter or Space", async () => {
    const user = userEvent.setup();
    draw();
    screen.getByRole("button", { name: "Before" }).focus();
    await user.tab();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(card().className).not.toMatch(/pinned/);
    await user.tab(); // leaving the chart hides them
    expect(card()).toBeNull();
  });

  it("keeps a tap's details until the same row is tapped again", () => {
    draw();
    const row = screen.getAllByRole("img")[2];
    fireEvent.click(row);
    expect(card().className).toMatch(/pinned/);
    fireEvent.blur(row);
    expect(card()).toBeTruthy();
    fireEvent.click(row);
    expect(card()).toBeNull();
  });
});

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
      "What do popular Literotica stories have in common? Explore how the popularity of about 13,000 stories varies " +
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
