import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { clearCache } from "../lib/data.js";
import { fixtureFetch, fixtureFile, fixtureMeta } from "./fixtures.js";

let fetchMock;

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  fetchMock = fixtureFetch();
  vi.stubGlobal("fetch", fetchMock);
});

const chartTitle = () => screen.getByRole("heading", { level: 2 }); // the answer heading
const fullTitle = () => document.title; // the full chart title, also the chart's accessible name

async function renderApp(hash = "") {
  if (hash) window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { level: 2 });
  await screen.findByText(/Typical story \(median\)/);
  return user;
}

describe("the explorer", () => {
  it("opens with a plain-English title and the disclaimer", async () => {
    await renderApp();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("What do popular Literotica stories have in common?");
    expect(chartTitle().textContent).toBe("Stories with more dialogue tend to get more favorites per 1,000 views");
    expect(screen.getAllByText(/do not establish causation/).length).toBeGreaterThan(0);
    expect(screen.getByText(/not affiliated with or endorsed by Literotica/)).toBeTruthy();
  });

  it("switches genre, popularity measure, characteristic and the stories included", async () => {
    const user = await renderApp();
    await user.selectOptions(screen.getByLabelText(/Genre/), "romance");
    // Romance has ~24 stories per group in the test data, too few (< 30) for a "tend to" title.
    await waitFor(() => expect(fullTitle()).toBe("How favorites per 1,000 views vary with dialogue share in Romance"));
    expect(chartTitle().textContent).toBe("No clear pattern");
    expect(window.location.hash).toMatch(/genre=romance/);

    await user.selectOptions(screen.getByLabelText(/Popularity/), "pop_views");
    await waitFor(() => expect(fullTitle()).toBe("How views vary with dialogue share in Romance"));
    expect(screen.getByText(/Totals grow with time online/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Emotion & relationships" }));
    await waitFor(() => expect(fullTitle()).toMatch(/anger/i));
    expect(screen.getByLabelText(/Story characteristic/).value).toBe("emo_anger_per_1k");

    await user.selectOptions(screen.getByLabelText(/Stories included/), "y2020");
    await waitFor(() => expect(fetchMock.calls.some((u) => u.endsWith("v/emo_anger_per_1k/y2020.json"))).toBe(true));
    await waitFor(() => expect(screen.getByText(/Published 2020 or later/, { selector: ".chart-sub" })).toBeTruthy());
  });

  it("shows the right numbers for each group", async () => {
    const user = await renderApp("#/explore?genre=fetish&var=dlg_word_share&metric=pop_fav_per_1k_views");
    await user.click(screen.getByRole("button", { name: "Show the numbers" }));
    const table = screen.getByRole("table");
    const data = fixtureFile("v/dlg_word_share/all.json").g.fetish;
    const rows = within(table).getAllByRole("row").slice(1);
    const labels = fixtureMeta.variables.find((v) => v.id === "dlg_word_share").bins.labels;
    labels.forEach((label, i) => {
      const cell = data.b[i];
      const row = rows[i];
      expect(within(row).getByRole("rowheader").textContent).toBe(label);
      if (cell) expect(within(row).getAllByRole("cell")[0].textContent).toBe(cell[0].toLocaleString("en-US"));
    });
    expect(within(rows[rows.length - 1]).getAllByRole("cell")[0].textContent).toBe(data.o[0].toLocaleString("en-US"));
  });

  it("compares genres side by side and opens a genre from the table", async () => {
    const user = await renderApp();
    await user.click(screen.getByRole("button", { name: "Compare genres" }));
    const table = await screen.findByRole("table");
    expect(chartTitle().textContent).toMatch(/genre by genre$/);
    const names = within(table).getAllByRole("rowheader").map((th) => th.textContent);
    expect(names).toEqual(fixtureMeta.genres.map((g) => g.name));
    const tiny = within(table).getAllByRole("row").find((r) => r.textContent.startsWith("Tiny Genre"));
    expect(within(tiny).getAllByRole("cell").filter((c) => c.textContent === "·").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/^1 Genre$/)).toBeNull();

    await user.click(within(table).getByRole("button", { name: "Romance" }));
    await waitFor(() => expect(screen.getByLabelText(/Genre/).value).toBe("romance"));
    expect(window.location.hash).toMatch(/mode=one/);
  });

  it("opens an example question", async () => {
    const user = await renderApp("#/explore?var=emo_anger_per_1k");
    const chip = screen.getByRole("button", { name: /Do stories with more dialogue get more comments/ });
    await user.click(chip);
    await waitFor(() => expect(screen.getByLabelText(/Story characteristic/).value).toBe("dlg_word_share"));
  });

  it("has a methodology page with the required statement", async () => {
    const user = await renderApp();
    await user.click(screen.getByRole("link", { name: "Methodology" }));
    await screen.findByRole("heading", { level: 1, name: "Methodology" });
    expect(screen.getAllByText(/should not be assumed to represent all erotic fiction, readers, or human sexuality/).length).toBe(2);
    expect(screen.getByText(/What this site does not contain/)).toBeTruthy();
  });

  it("falls back to sensible settings for an unknown address", async () => {
    await renderApp("#/explore?genre=nope&metric=nope&var=nope&include=nope");
    expect(screen.getByLabelText(/Genre/).value).toBe("all");
    expect(screen.getByLabelText(/Stories included/).value).toBe("all");
  });
});

describe("robustness", () => {
  it("shows a friendly error and loads again on Try again", async () => {
    const ok = fetchMock;
    let fail = true;
    vi.stubGlobal("fetch", async (url) => (fail ? { ok: false, status: 503, json: async () => ({}) } : ok(url)));
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/We couldn’t load the data/)).toBeTruthy();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 2 })).toBeTruthy();
  });

  it("copies the link, or shows it to copy by hand when the clipboard is unavailable", async () => {
    const user = await renderApp();
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    const field = screen.getByLabelText("Copy this link:");
    expect(field.value).toBe(window.location.href);
    expect(field.readOnly).toBe(true);
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.getAllByText("Link copied").length).toBeGreaterThan(0);
  });
});

describe("loading", () => {
  it("keeps the previous heading and chart until the new data has arrived, and announces only the result", async () => {
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) => {
      if (String(url).includes("v/emo_anger_per_1k/")) await gate;
      return serve(url);
    });
    const user = await renderApp();
    const before = fullTitle();
    await user.click(screen.getByRole("button", { name: "Emotion & relationships" }));
    // the new file is still on its way: the old chart stays, marked busy, and nothing is worded from missing data
    expect(fullTitle()).toBe(before);
    expect(document.querySelector(".chart-panel").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByText(/too few stories/i)).toBeNull();
    expect(screen.queryByText(/Loading/)).toBeNull();
    const live = document.querySelector("[aria-live]");
    expect(live.textContent).toBe("");
    release();
    await waitFor(() => expect(fullTitle()).toMatch(/anger/i));
    expect(document.querySelector(".chart-panel").getAttribute("aria-busy")).toBe("false");
    expect(live.textContent).toBe(chartTitle().textContent);
  });

  it("draws the page frame before the data arrives", async () => {
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) => {
      await gate;
      return serve(url);
    });
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(document.querySelector(".chart-placeholder")).toBeTruthy();
    release();
    await screen.findByRole("heading", { level: 2 });
  });
});

describe("notes, age check and next questions", () => {
  /** Serve the fixtures, with the end groups of dialogue share made 15 and 3 years old. */
  function agedFetch() {
    const serve = fixtureFetch();
    const fn = async (url) => {
      const res = await serve(url);
      if (!String(url).includes("v/dlg_word_share/")) return res;
      const body = await res.json();
      for (const gd of Object.values(body.g)) {
        const cells = gd.b.filter(Boolean);
        if (cells.length >= 2) {
          cells[0][1] = 15;
          cells[cells.length - 1][1] = 3;
        }
      }
      return { ok: true, status: 200, json: async () => body };
    };
    fn.calls = serve.calls;
    return fn;
  }

  it("warns about totals with a one-tap switch to the per-month measure", async () => {
    const user = await renderApp("#/explore?var=dlg_word_share&metric=pop_views");
    expect(screen.getByText("Totals grow with time online.")).toBeTruthy();
    expect(screen.getByText(/Older stories have had longer to collect views\./)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Switch to views per month" }));
    await waitFor(() => expect(window.location.hash).toMatch(/metric=pop_views_per_month/));
    expect(screen.queryByText("Totals grow with time online.")).toBeNull();
  });

  it("puts the definitions behind three disclosures and links to How it works", async () => {
    await renderApp();
    expect(screen.getByText("How to read this chart", { selector: "summary" })).toBeTruthy();
    expect(screen.getByText("What “Dialogue share” measures", { selector: "summary" })).toBeTruthy();
    expect(screen.getByText("What “Favorites per 1,000 views” means", { selector: "summary" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "How was this measured?" }).getAttribute("href")).toBe("#/methodology/measures");
    expect(screen.getByText(/do not show that a characteristic changes how popular/)).toBeTruthy();
  });

  it("checks stories of similar age in three periods, with the state in the address", async () => {
    fetchMock = agedFetch();
    vi.stubGlobal("fetch", fetchMock);
    const user = await renderApp("#/explore?var=dlg_word_share");
    expect(screen.getByText("Story age.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Check stories of similar age" }));
    await waitFor(() => expect(window.location.hash).toMatch(/check=age/));
    expect(await screen.findByRole("heading", { name: "Stories of similar age" })).toBeTruthy();
    for (const p of ["y2000", "y2010", "y2020"]) {
      await waitFor(() => expect(fetchMock.calls.some((u) => u.endsWith(`v/dlg_word_share/${p}.json`))).toBe(true));
    }
    expect(await screen.findByRole("heading", { level: 4, name: "Published 2000–2009" })).toBeTruthy();
    expect(screen.getByText(/so the stories compared are of similar age/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(window.location.hash).not.toMatch(/check=age/));
  });

  it("offers the next two characteristics of the topic and the rate version of a total", async () => {
    await renderApp("#/explore?var=dlg_word_share&metric=pop_views");
    const nav = screen.getByRole("navigation", { name: "Next questions" });
    const links = within(nav).getAllByRole("link");
    expect(links[0].textContent).toMatch(/views per month/);
    expect(links[0].getAttribute("href")).toMatch(/metric=pop_views_per_month/);
    expect(links[1].getAttribute("href")).toMatch(/var=dlg_has_dialogue/);
    expect(links).toHaveLength(2); // the fixture's Dialogue topic has only two characteristics
  });

  it("switches to comparing all genres", async () => {
    const user = await renderApp();
    await user.click(screen.getByRole("button", { name: /Compare all 3 genres/ }));
    await waitFor(() => expect(window.location.hash).toMatch(/mode=compare/));
  });
});
