import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { clearCache } from "../lib/data.js";
import { parseHash } from "../lib/urlState.js";
import { fixtureFetch, fixtureFile, fixtureMeta } from "./fixtures.js";

let fetchMock;

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  fetchMock = fixtureFetch();
  vi.stubGlobal("fetch", fetchMock);
});

const chartTitle = () => document.querySelector(".chart-title"); // the answer heading
const fullTitle = () => document.title; // the full chart title, also the chart's accessible name

/** Choose a characteristic through the picker: open it, search, press Enter. */
async function pickCharacteristic(user, query) {
  await user.click(screen.getByRole("button", { name: /^Story characteristic:/ }));
  await user.type(await screen.findByRole("combobox", { name: /^Search/ }), query);
  await user.keyboard("{Enter}");
}

/** Choose a popularity measure through its menu (its body loads its own code, so wait for the options). */
async function pickMeasure(user, label) {
  await user.click(screen.getByRole("button", { name: /^Popularity measure:/ }));
  const options = await within(screen.getByRole("dialog", { name: "Popularity measure" })).findAllByRole("option");
  const option = options.find((o) => o.querySelector(".pick-label")?.firstChild.textContent === label);
  await user.click(option);
}

async function renderApp(hash = "") {
  if (hash) window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
  return user;
}

describe("the explorer", () => {
  it("opens with a plain-English title and the independence statement", async () => {
    await renderApp();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "What do popular Literotica stories have in common? · 3 stories · 3 genres".replace("3 stories", `${fixtureMeta.counts.included} stories`),
    );
    expect(screen.getByRole("link", { name: "Literotica Data Explorer" })).toBeTruthy(); // "Story Patterns" until 2026-10-21
    expect(screen.getByRole("group", { name: "Choose what to compare" })).toBeTruthy();
    expect(chartTitle().textContent).toBe("Stories with more dialogue tend to get more favorites per 1,000 views");
    expect(screen.getByText(/not affiliated with or endorsed by Literotica/)).toBeTruthy();
  });

  it("switches genre, popularity measure, characteristic and the stories included", async () => {
    const user = await renderApp();
    await user.selectOptions(screen.getByLabelText("Genre"), "romance");
    // Romance has ~24 stories per group in the test data, too few (< 30) for a "tend to" title.
    await waitFor(() => expect(fullTitle()).toBe("How favorites per 1,000 views vary with dialogue share in Romance"));
    expect(chartTitle().textContent).toBe("No clear pattern");
    expect(window.location.hash).toMatch(/genre=romance/);

    await pickMeasure(user, "Views");
    await waitFor(() => expect(fullTitle()).toBe("How views vary with dialogue share in Romance"));

    await pickCharacteristic(user, "anger");
    await waitFor(() => expect(fullTitle()).toMatch(/anger/i));
    expect(window.location.hash).toMatch(/var=emo_anger_per_1k/);

    await user.selectOptions(screen.getByLabelText("Only include"), "y2020");
    await waitFor(() => expect(fetchMock.calls.some((u) => u.endsWith("v/emo_anger_per_1k/y2020.json"))).toBe(true));
    await waitFor(() => expect(screen.getByText(/Published 2020 or later/, { selector: ".chart-sub" })).toBeTruthy());
  });

  it("gives each group's numbers in its row's name, and the stories shown in the subtitle", async () => {
    await renderApp("#/explore?genre=fetish&var=dlg_word_share&metric=pop_fav_per_1k_views");
    const data = fixtureFile("v/dlg_word_share/all.json").g.fetish;
    const rows = within(document.querySelector(".range-chart svg")).getAllByRole("img");
    const labels = fixtureMeta.variables.find((v) => v.id === "dlg_word_share").bins.labels;
    expect(rows).toHaveLength(labels.length);
    labels.forEach((label, i) => {
      const cell = data.b[i];
      const name = rows[i].getAttribute("aria-label");
      expect(name.startsWith(`${label}: `)).toBe(true);
      if (cell) expect(name).toMatch(new RegExp(`: median .*, interquartile range .*, mean .*, ${cell[0].toLocaleString("en-US")} stories$`));
    });
    expect(document.querySelector(".chart-sub").textContent).toBe(`Fetish · ${data.n.toLocaleString("en-US")} stories`);
  });

  it("opens an example question from Keep exploring, and goes back up to the question", async () => {
    const user = await renderApp("#/explore?var=emo_anger_per_1k");
    const nav = screen.getByRole("navigation", { name: "Keep exploring" });
    await user.click(within(nav).getByRole("link", { name: /Do stories with more dialogue get more comments/ }));
    await waitFor(() => expect(window.location.hash).toMatch(/var=dlg_word_share/));
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById("question")));
  });

  it("has a How it works page that keeps the limits of the sample", async () => {
    const user = await renderApp();
    await user.click(within(screen.getByRole("navigation", { name: "Pages" })).getByRole("link", { name: "How it works" }));
    // the masthead is the one way to every page: the footer is the independence statement alone (the owner, 2026-10-13)
    expect(screen.getAllByRole("link", { name: "How it works" })).toHaveLength(1);
    await screen.findByRole("heading", { level: 1, name: "How it works" });
    expect(document.title).toBe("How it works · What do popular Literotica stories have in common?");
    expect(screen.getByText(/do not stand for erotic fiction, readers or human sexuality in general/)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "What this site does not contain" })).toBeTruthy();
  });

  it("falls back to sensible settings for an unknown address", async () => {
    await renderApp("#/explore?genre=nope&metric=nope&var=nope&include=nope");
    expect(screen.getByLabelText("Genre").value).toBe("all");
    expect(screen.getByLabelText("Only include").value).toBe("all");
  });
});

describe("no causation reminders (decision 1 of round 2)", () => {
  const REMINDERS = /do not establish causation|do not show that a characteristic changes|\bnot why\b|Descriptive only/i;
  const pages = [
    ["the explorer, one genre", "#/explore", () => waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy())],
    ["Patterns", "#/patterns?genre=all&metric=pop_fav_per_1k_views", () => screen.findByText(/characteristics have a clear pattern/)],
    ["How it works", "#/methodology", () => screen.findByRole("heading", { level: 1, name: "How it works" })],
  ];
  it.each(pages)("%s has none, and says that the site is independent", async (_, hash, ready) => {
    window.history.replaceState(null, "", `/${hash}`);
    render(<App />);
    await ready();
    expect(document.body.textContent).not.toMatch(REMINDERS);
    const footer = screen.getByRole("contentinfo");
    expect(footer.querySelector("p").textContent).toBe("An independent project, not affiliated with or endorsed by Literotica.");
    // round 3, change 5: the footer no longer lists what the site does not hold; How it works keeps that section
    expect(footer.textContent).not.toMatch(/story-by-story records/);
    // the statement is the whole footer, with no link and no list of pages (the owner, 2026-10-13): the masthead has
    // every page, in its menu on a phone
    expect(footer.textContent).toBe("An independent project, not affiliated with or endorsed by Literotica.");
    expect(within(footer).queryAllByRole("link")).toHaveLength(0);
    expect(within(footer).queryByRole("navigation")).toBeNull();
  });

  it("leaves the note on chance to How it works (the owner's follow-up, 2)", async () => {
    window.history.replaceState(null, "", "/#/patterns?genre=all&metric=pop_fav_per_1k_views");
    render(<App />);
    await screen.findByText(/characteristics have a clear pattern/);
    expect(document.body.textContent).not.toMatch(/appear by chance|allows for that/);
    expect(screen.queryByRole("link", { name: /When a title says/ })).toBeNull();
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
    expect(await screen.findByText("Interquartile range", { selector: "li" })).toBeTruthy();
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
    // the title is set by an effect after the chart is drawn
    await waitFor(() => expect(fullTitle()).not.toBe("What do popular Literotica stories have in common?"));
    const before = fullTitle();
    await pickCharacteristic(user, "anger");
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
    // the full title, then the short answer when it says something else (F47)
    expect(chartTitle().textContent).toBe("No clear pattern");
    expect(live.textContent).toBe(`${fullTitle()}. No clear pattern.`);
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
    await screen.findByText("Interquartile range", { selector: "li" });
  });
});

describe("notes", () => {
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

  it("has no story-age box for totals, nor its switch (the owner, 2026-10-13)", async () => {
    await renderApp("#/explore?var=dlg_word_share&metric=pop_views");
    expect(document.querySelector(".agebox")).toBeNull();
    expect(screen.queryByText(/Totals grow with time online|Older stories have had longer/)).toBeNull();
    expect(screen.queryByRole("button", { name: /^Switch to / })).toBeNull();
    // the notes beside the chart are its three explanations
    expect([...document.querySelectorAll(".notes > *")].every((el) => el.matches("details.disclosure"))).toBe(true);
  });

  it("links every characteristic's “How was this measured?” to How the story characteristics were measured", async () => {
    // narration, sexual language and emotion had subsections of their own until the owner's changes of 2026-10-13
    await renderApp("#/explore?var=pov_class");
    expect(screen.getByRole("link", { name: "How was this measured?" }).getAttribute("href")).toBe("#/methodology/measures");
  });

  it("puts the definitions behind three disclosures and links to How it works", async () => {
    await renderApp();
    expect(screen.getByText("How to read this chart", { selector: "summary" })).toBeTruthy();
    expect(screen.getByText("What “Dialogue share” measures", { selector: "summary" })).toBeTruthy();
    expect(screen.getByText("What “Favorites per 1,000 views” means", { selector: "summary" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "How was this measured?" }).getAttribute("href")).toBe("#/methodology/measures");
  });

  it("has no story-age box when the end groups differ in age, and no check of stories of similar age", async () => {
    vi.stubGlobal("fetch", agedFetch());
    await renderApp("#/explore?var=dlg_word_share");
    expect(document.querySelector(".agebox")).toBeNull();
    expect(screen.queryByText(/Story age/)).toBeNull();
    expect(screen.queryByRole("button", { name: /similar age/ })).toBeNull();
  });

  it("opens an old link to the similar-age check as the plain chart, and the address drops the check", async () => {
    vi.stubGlobal("fetch", agedFetch());
    await renderApp("#/explore?var=dlg_word_share&check=age");
    expect(chartTitle().textContent).toBe("Stories with more dialogue tend to get more favorites per 1,000 views");
    expect(screen.queryByRole("heading", { name: /similar age/ })).toBeNull();
    expect(screen.queryByText(/Story age/)).toBeNull();
    await waitFor(() => expect(window.location.hash).not.toMatch(/check/));
    expect(window.location.hash).toMatch(/^#\/explore\?.*var=dlg_word_share/);
  });
});

describe("the pattern browser (concept G2)", () => {
  it("counts clear patterns, folds the topics with their counts and lists each pattern as a compact row", async () => {
    window.history.replaceState(null, "", "/#/patterns?genre=all&metric=pop_fav_per_1k_views");
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { level: 1, name: /^Clear patterns in / }); // the question, its h1 (round 4's X2)
    expect(document.title).toBe("Patterns · What do popular Literotica stories have in common?");
    // fixture: 3 characteristics read as a trend (dialogue share, has dialogue, anger), 1 without order
    const count = await screen.findByText(/characteristics have a clear pattern/);
    expect(count.textContent).toBe(
      "2 of 3 characteristics have a clear pattern with favorites per 1,000 views across all genres. The other 1 show no clear pattern.",
    );
    expect(count.querySelector("strong").textContent).toBe("2");
    // the count stands alone: no line about the characteristics without an order (the owner's follow-up, 1)
    expect(document.querySelectorAll(".pattern-count")).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/have no order|not summed up as a trend/);
    const key = document.querySelector(".pattern-key");
    expect(key.textContent).toBe(
      "↗ tends higher: the more of the characteristic, the higher the median favorites per 1,000 views (for yes/no " +
        "characteristics: higher in stories that have it). ↘ tends lower: the opposite. What weak, moderate and strong mean",
    );
    expect(within(key).getByRole("link", { name: "What weak, moderate and strong mean" }).getAttribute("href")).toBe(
      "#/methodology/tend-to",
    );

    // the topics in the topics' order (those with something that can show a trend), each with its count, closed
    expect([...document.querySelectorAll(".pattern-topic-head")].map((h) => h.textContent)).toEqual([
      "Dialogue & characters · 2 of 2 clear",
      "Emotion & relationships · 0 of 1 clear",
    ]);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Dialogue & characters",
      "Emotion & relationships",
    ]);
    const dialogue = document.querySelector("details.pattern-topic");
    expect(dialogue.open).toBe(false);
    expect(document.querySelectorAll("details.pattern-topic")).toHaveLength(1); // 0 clear: nothing to fold open yet

    // one row per clear pattern, alphabetical: the name links to its chart, described by the full sentence
    const rows = within(dialogue).getAllByRole("listitem");
    expect(rows.map((r) => r.querySelector("a").textContent)).toEqual(["Dialogue share", "Has dialogue"]);
    const link = within(rows[0]).getByRole("link", { name: "Dialogue share" });
    expect(link.getAttribute("href")).toMatch(/var=dlg_word_share/);
    expect(document.getElementById(link.getAttribute("aria-describedby")).textContent).toBe(
      "Stories with more dialogue tend to get more favorites per 1,000 views",
    );
    expect(rows[0].querySelector(".pattern-dir").textContent).toBe("↗ tends higher");
    expect(rows[0].querySelector(".pattern-strength").textContent).toBe("strong");

    // open and close every topic at once
    await user.click(screen.getByRole("button", { name: "Open all topics" }));
    expect(dialogue.open).toBe(true);
    await user.click(screen.getByRole("button", { name: "Close all topics" }));
    expect(dialogue.open).toBe(false);

    // the toggle adds the others, muted, in the same topics
    await user.click(screen.getByRole("button", { name: "Show the ones with no clear pattern too" }));
    const emotion = [...document.querySelectorAll("details.pattern-topic")].find((d) => d.textContent.includes("Emotion"));
    expect(within(emotion).getByRole("link", { name: "Anger" }).closest("li").textContent).toBe("Anger" + "no clear pattern");

    await user.selectOptions(screen.getByLabelText("Genre"), "tiny");
    await waitFor(() => expect(window.location.hash).toBe("#/patterns?genre=tiny&metric=pop_fav_per_1k_views"));
    expect(document.querySelector(".pattern-count").textContent).toMatch(/^0 of 3 /);
  });
});

describe("How it works", () => {
  it("opens an old subsection's address at How the story characteristics were measured, and settles the address", async () => {
    for (const old of ["point-of-view", "explicitness", "emotion"]) expect(parseHash(`#/methodology/${old}`).section).toBe("measures");
    window.history.replaceState(null, "", "/#/methodology/explicitness");
    render(<App />);
    const heading = await screen.findByRole("heading", { level: 2, name: "How the story characteristics were measured" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    await waitFor(() => expect(window.location.hash).toBe("#/methodology/measures"));
  });

  it("has an In short box, contents, linkable sections and a filterable glossary", async () => {
    window.history.replaceState(null, "", "/#/methodology/tend-to");
    const user = userEvent.setup();
    render(<App />);
    const heading = await screen.findByRole("heading", { level: 2, name: "When a title says “tend to”" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    const short = screen.getByRole("complementary", { name: "In short" });
    expect(within(short).getAllByRole("listitem")).toHaveLength(4);
    expect(short.textContent).toMatch(/collected October 1, 2026 to October 8, 2026/);
    await user.click(screen.getByRole("button", { name: "Contents" })); // narrow screens: the section bar's panel
    const contents = screen.getByRole("navigation", { name: "Contents" });
    for (const id of ["measures", "charts", "tend-to", "missing-data"]) {
      expect(within(contents).getAllByRole("link").some((a) => a.getAttribute("href") === `#/methodology/${id}`)).toBe(true);
      expect(document.getElementById(id)).toBeTruthy();
    }
    // "How the story characteristics were measured" has no subsections (the owner, 2026-10-13): their paragraphs stay
    for (const id of ["point-of-view", "explicitness", "emotion"]) {
      expect(within(contents).queryAllByRole("link").some((a) => a.getAttribute("href") === `#/methodology/${id}`)).toBe(false);
      expect(document.getElementById(id)).toBeNull();
    }
    const measures = document.getElementById("measures");
    expect(measures.closest("article").querySelectorAll("h3")).toHaveLength(0);
    expect(measures.closest("article").textContent).toMatch(/Point of view is estimated from pronouns in the narration only/);
    expect(measures.closest("article").textContent).toMatch(/Sexual language is counted from three editable lists/);
    expect(measures.closest("article").textContent).toMatch(/Emotion measures count words from small, hand-checked lists/);
    // the glossary uses the topics, folded until opened, each with every characteristic's definition (the owner,
    // 2026-10-13), and can be filtered
    const topic = screen.getByText("Dialogue & characters", { selector: "summary" }).closest("details");
    expect(topic.open).toBe(false);
    const defs = topic.querySelector("dl.glossary");
    expect(defs.querySelectorAll("dt").length).toBeGreaterThan(0);
    expect([...defs.querySelectorAll("dd")].every((d) => d.textContent.trim().length > 0)).toBe(true);
    await user.type(screen.getByLabelText("Find a characteristic"), "anger");
    expect(screen.getByText("1 match")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See the chart" }).getAttribute("href")).toMatch(/var=emo_anger_per_1k/);
  });
});
