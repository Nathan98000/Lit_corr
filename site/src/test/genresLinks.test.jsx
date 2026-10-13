// The Genres page from the rest of the site: the Genres page's question in Keep exploring, and How it works'
// "Comparing genres" (Explore's "See this pattern in every genre", D7, is gone with compare mode).
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import CharacteristicPicker from "../components/CharacteristicPicker.jsx";
import { genresQuestion } from "../components/Explorer.jsx";
import { clearCache } from "../lib/data.js";
import { sanitize } from "../lib/urlState.js";
import { typicalSample } from "../lib/wording.js";
import { fixtureFetch, fixtureMeta, realMeta } from "./fixtures.js";

const real = realMeta();

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function renderApp(hash) {
  window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
  return user;
}

const keepExploring = () => within(screen.getByRole("navigation", { name: "Keep exploring" })).getAllByRole("link");

describe("Keep exploring", () => {
  it("asks what stands out about the chosen genre's stories, after every clear pattern", async () => {
    const user = await renderApp("#/explore?genre=romance&var=dlg_word_share&include=y2020");
    const link = keepExploring()[1];
    expect(link.textContent).toBe("What stands out about stories in Romance?\u00a0→"); // the arrow kept with its word
    expect(link.getAttribute("href")).toBe("#/genres?view=genre&genre=romance&include=y2020");
    await user.click(link);
    await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
    expect(screen.getByLabelText("Genre").value).toBe("romance");
  });

  it("has no Genres item with All genres: the characteristic is “By genre →” under the chart (round 4's I15)", async () => {
    await renderApp("#/explore?var=dlg_has_dialogue");
    expect(keepExploring().map((a) => a.getAttribute("href")).some((h) => h.startsWith("#/genres"))).toBe(false);
    expect(screen.getByRole("link", { name: "Has dialogue by genre" }).getAttribute("href")).toBe("#/genres?var=dlg_has_dialogue&include=all");
  });

  it("asks what stands out with a genre chosen, whatever the characteristic (month and weekday too)", () => {
    const meta = real || fixtureMeta;
    const month = meta.variables.find((v) => v.id === "pub_month");
    if (!month) return;
    const view = sanitize({ v: "pub_month" }, meta);
    expect(genresQuestion(meta, view, { genre: meta.genres[0], variable: month })).toBeNull();
    expect(genresQuestion(meta, view, { genre: meta.genres[3], variable: month }).text).toMatch(/^What stands out/);
  });
});

describe("How it works", () => {
  it("explains comparing genres in its own section, after “tend to”, with the data's numbers", async () => {
    window.history.replaceState(null, "", "/#/methodology/genres");
    render(<App />);
    const heading = await screen.findByRole("heading", { level: 2, name: "Comparing genres" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    const order = [...document.querySelectorAll(".methodology h2")].map((h) => h.id);
    expect(order.indexOf("genres")).toBe(order.indexOf("tend-to") + 1);
    const section = [];
    for (let el = heading.nextElementSibling; el && el.tagName === "P"; el = el.nextElementSibling) section.push(el.textContent);
    expect(section).toHaveLength(3);
    // the largest genre's share of all genres comes from the genres' sizes (F74): in the test data Fetish, 4,000 of 5,050
    expect(section[0].replace(/\s+/g, " ")).toBe(
      "The Genres page compares each genre’s stories with the stories of all genres. All genres counts each genre by " +
        `its size on Literotica, as everywhere on this site. Each genre is a random sample of about ${typicalSample(fixtureMeta)} stories. ` +
        "All genres includes each genre’s own stories; the largest genre, Fetish, is about 79% of it.",
    );
    expect(section[1].replace(/\s+/g, " ")).toBe(
      "A genre clearly differs on a characteristic when, picking one of its stories and one story from all genres at " +
        "random, its story is the higher one at least 60 times in 100, or the lower one at least 60 times in 100 (ties " +
        "count as half; this is a rank-biserial correlation of at least 0.2). For yes/no characteristics this means a " +
        "gap of at least 20 percentage points. For characteristics with named groups, such as narrative perspective, at " +
        "least 20% of the genre’s stories would have to change group to match the mix of all genres. The page makes " +
        "thousands of such comparisons, so a difference must also be clear at the 99.9% level, stricter than the 99% " +
        "used for “tend to”, and the genre needs at least 30 stories with the characteristic. The comparison uses every " +
        "story, not only the medians, so a genre can clearly differ while its median is close to that of all genres, or " +
        "the reverse. The lists above a chart name the genres in order of the size of their difference, largest first.",
    );
    expect(section[2]).toBe(
      "When most stories score 0 on a characteristic, the page shows how many stories have any, and the median and " +
        "interquartile range among them. Publication month and weekday are left out: their twelve and seven groups " +
        "can’t be compared genre by genre in one chart.",
    );
    // the "In short" list is unchanged
    expect(within(screen.getByRole("complementary", { name: "In short" })).getAllByRole("listitem")).toHaveLength(4);
  });

  it.skipIf(!real)("names the largest genre and its share of all genres on the real data", async () => {
    vi.stubGlobal("fetch", async (url) => (String(url).endsWith("meta.json") ? { ok: true, status: 200, json: async () => real } : fixtureFetch()(url)));
    window.history.replaceState(null, "", "/#/methodology/genres");
    render(<App />);
    const heading = await screen.findByRole("heading", { level: 2, name: "Comparing genres" });
    expect(heading.nextElementSibling.textContent).toMatch(/All genres includes each genre’s own stories; the largest genre, Erotic Couplings, is about 12% of it\.$/);
  });

  it("says “about 420 stories” from the data, never from a literal", () => {
    if (real) expect(typicalSample(real)).toBe(420);
    expect(typicalSample({ genres: [{ id: "all", n: 9 }, { n: 296 }, { n: 300 }, { n: 299 }] })).toBe(300);
    expect(typicalSample({ genres: [{ id: "all", n: 9 }, { n: 101 }, { n: 117 }] })).toBe(110);
  });

  it("is where the legend's “how this is decided” leads", async () => {
    await renderApp("#/explore");
    window.location.hash = "#/genres?var=dlg_word_share";
    await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
    expect(screen.getByRole("link", { name: "how this is decided" }).getAttribute("href")).toBe("#/methodology/genres");
  });
});

describe("the picker on the Genres page (F77)", () => {
  // the test data with the "When published" topic, whose month and weekday the Genres page leaves out
  const published = [
    ["pub_year", "Publication year", "publication year"],
    ["pub_month", "Publication month", "publication month"],
    ["pub_weekday", "Publication weekday", "publication weekday"],
    ["pub_is_weekend", "Published on a weekend", "published on a weekend"],
    ["age_years", "Years online", "story age"],
  ].map(([id, label, noun]) => ({ id, label, noun, topic: "published", subgroup: "Publication", kind: "count", unit: "", description: label, caveat: "", bins: { type: "ranges", labels: ["a", "b"], ordered: true }, n: 278 }));
  const meta = {
    ...fixtureMeta,
    variables: [...fixtureMeta.variables, ...published],
    topics: [...fixtureMeta.topics, { id: "published", label: "When published", blurb: "Year, month, weekday, years online", syn: "date time when age old new", ids: published.map((v) => v.id) }],
  };
  const genresPicker = (props = {}) =>
    render(
      <CharacteristicPicker
        meta={meta}
        value="dlg_word_share"
        onPick={() => {}}
        focusRef={{ current: null }}
        exclude={["pub_month", "pub_weekday"]}
        excludedNote="Publication month and weekday aren’t compared on this page."
        metricHref={(id) => `#/explore?metric=${id}`}
        {...props}
      />,
    );
  const note = () => document.querySelector(".pick-measure-note").textContent;

  it("says what the page leaves out when a query names publication month or weekday", async () => {
    const user = userEvent.setup();
    genresPicker();
    const box = screen.getByRole("combobox");
    await user.type(box, "month");
    expect(note()).toBe("Publication month and weekday aren’t compared on this page."); // not "Views per month", a measure
    await user.clear(box);
    await user.type(box, "weekday");
    expect(note()).toBe("Publication month and weekday aren’t compared on this page.");
    await user.clear(box);
    await user.type(box, "dialogue");
    expect(note()).toBe("");
  });

  it("says a popularity measure is one, with a link to see it on the Popularity page", async () => {
    const user = userEvent.setup();
    genresPicker();
    await user.type(screen.getByRole("combobox"), "rating");
    expect(note()).toBe("“Ratings (number of)” is a popularity measure, not a story characteristic. See it on the Popularity page →");
    expect(within(document.querySelector(".pick-measure-note")).getByRole("link", { name: /See it on the Popularity page/ }).getAttribute("href")).toBe(
      "#/explore?metric=pop_rating_count",
    );
  });

  it("lists a topic's remaining characteristics as its blurb", () => {
    genresPicker();
    const topic = [...document.querySelectorAll(".topic-row")].find((t) => t.querySelector(".topic-name").textContent === "When published");
    expect(topic.querySelector(".topic-blurb").textContent).toBe("Publication year, published on a weekend, years online");
    expect(topic.querySelector(".topic-count").textContent).toMatch(/^3/);
  });

  it("leaves Explore's picker as it was", async () => {
    const user = userEvent.setup();
    render(<CharacteristicPicker meta={meta} value="dlg_word_share" onPick={() => {}} onPickMetric={() => {}} focusRef={{ current: null }} />);
    const topic = [...document.querySelectorAll(".topic-row")].find((t) => t.querySelector(".topic-name").textContent === "When published");
    expect(topic.querySelector(".topic-blurb").textContent).toBe("Year, month, weekday, years online");
    await user.type(screen.getByRole("combobox"), "rating");
    expect(screen.getByRole("button", { name: "Show ratings (number of)" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /See it on the Popularity page/ })).toBeNull();
  });

  it("is given the note and the link by the Genres page, and opens Popularity (Explore) with the measure and the characteristic", async () => {
    window.history.replaceState(null, "", "/#/genres?var=dlg_word_share");
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /^Story characteristic:/ }));
    const box = await screen.findByRole("combobox", { name: /^Search/ });
    await user.type(box, "rating");
    const link = await within(document.querySelector(".pick-measure-note")).findByRole("link", { name: /See it on the Popularity page/ });
    expect(link.getAttribute("href")).toBe("#/explore?genre=all&metric=pop_rating_count&var=dlg_word_share&include=all");
  });
});
