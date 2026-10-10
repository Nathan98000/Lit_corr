// The Genres page from the rest of the site: Explore's "See this pattern in every genre" (D7), the Genres page's
// question in Keep exploring, and How it works' "Comparing genres".
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
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

describe("Explore (D7)", () => {
  it("says “See this pattern in every genre →”, not “Compare all … genres”", async () => {
    await renderApp("#/explore?var=dlg_word_share");
    expect(screen.getByRole("button", { name: "See this pattern in every genre →" })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Compare all \d+ genres/);
  });
});

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

  it("asks how the genres differ in the characteristic with All genres, and in compare mode", async () => {
    await renderApp("#/explore?mode=compare&var=dlg_has_dialogue");
    const link = keepExploring()[1];
    expect(link.textContent).toBe("How common are stories with dialogue in each genre?\u00a0→");
    expect(link.getAttribute("href")).toBe("#/genres?var=dlg_has_dialogue&include=all");
  });

  it("leaves the item out for characteristics the Genres page does not show", () => {
    const meta = real || fixtureMeta;
    const month = meta.variables.find((v) => v.id === "pub_month");
    if (!month) return;
    const view = sanitize({ v: "pub_month" }, meta);
    expect(genresQuestion(meta, view, { compare: false, genre: meta.genres[0], variable: month })).toBeNull();
    expect(genresQuestion(meta, view, { compare: false, genre: meta.genres[3], variable: month }).text).toMatch(/^What stands out/);
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
    expect(section[0]).toBe(
      "The Genres page compares each genre’s stories with the stories of all genres. All genres counts each genre by " +
        `its size on Literotica, as everywhere on this site. Each genre is a random sample of about ${typicalSample(fixtureMeta)} stories.`,
    );
    expect(section[1].replace(/\s+/g, " ")).toBe(
      "A genre clearly differs on a characteristic when, picking one of its stories and one story from all genres at " +
        "random, its story is the higher one at least 60 times in 100, or the lower one at least 60 times in 100 (ties " +
        "count as half; this is a rank-biserial correlation of at least 0.2). For yes/no characteristics this means a " +
        "gap of at least 20 percentage points. For characteristics with named groups, such as narrative perspective, at " +
        "least 20% of the genre’s stories would have to change group to match the mix of all genres. The page makes " +
        "thousands of such comparisons, so a difference must also be clear at the 99.9% level, stricter than the 99% " +
        "used for “tend to”, and the genre needs at least 30 stories with the characteristic.",
    );
    expect(section[2]).toBe(
      "When most stories score 0 on a characteristic, the page shows how many stories have any, and the median and " +
        "interquartile range among them. Publication month and weekday are left out: their twelve and seven groups " +
        "can’t be compared genre by genre in one chart.",
    );
    // the "In short" list is unchanged
    expect(within(screen.getByRole("complementary", { name: "In short" })).getAllByRole("listitem")).toHaveLength(4);
  });

  it("says “about 300 stories” from the data, never from a literal", () => {
    if (real) expect(typicalSample(real)).toBe(300);
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
