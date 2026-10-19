// "Download image" (STAGE2_SIMPLIFY_AND_PNG_PROMPT.md; "Download PNG" until round 4's O15): where the button is, what it passes to the image's code, and what
// the image would say (lib/chartImage.js's imagePlan; the canvas itself is checked in a browser). The module's
// downloadChartImage is mocked: jsdom has no canvas.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { FAILED } from "../components/DownloadPng.jsx";
import { exploreFileName } from "../components/Explorer.jsx";
import { genresFileName } from "../components/GenreAnswer.jsx";
import { CREDIT, downloadChartImage, imagePlan } from "../lib/chartImage.js";
import { clearCache } from "../lib/data.js";
import { fixtureFetch, fixtureMeta } from "./fixtures.js";

vi.mock("../lib/chartImage.js", async (original) => ({ ...(await original()), downloadChartImage: vi.fn(async () => {}) }));

// an ordered band characteristic, which the test data does not have (as in genresForms.test.jsx)
const BAND = {
  id: "author_stories_count",
  label: "Author’s story count",
  topic: "narration",
  subgroup: "Narration",
  kind: "count",
  unit: "stories",
  description: "Stories by the author.",
  caveat: "",
  bins: { type: "levels", labels: ["1 story", "2–5", "6–20", "21–50"], ordered: true },
  noun: "the author’s number of stories",
  n: 278,
  more: "Stories by more prolific authors",
};
const meta = {
  ...fixtureMeta,
  variables: [...fixtureMeta.variables, BAND],
  topics: fixtureMeta.topics.map((t) => (t.id === "narration" ? { ...t, ids: [...t.ids, BAND.id] } : t)),
};

function withBand() {
  const serve = fixtureFetch();
  return async (url) => {
    if (String(url).endsWith("meta.json")) return { ok: true, status: 200, json: async () => meta };
    const res = await serve(url);
    if (!String(url).includes("genres/")) return res;
    const body = await res.json();
    body.c.author_stories_count = {
      k: "band",
      q: [[278, 0.3, 0.3, 0.2, 0.2], [150, 0.4, 0.3, 0.2, 0.1], [120, 0.1, 0.2, 0.3, 0.4], null],
      r: [null, -0.15, 0.41, null],
      f: [0, 0, 1, 0],
    };
    return { ok: true, status: 200, json: async () => body };
  };
}

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", withBand());
  downloadChartImage.mockReset();
  downloadChartImage.mockImplementation(async () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function open(hash) {
  window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
  return user;
}

const pngButton = () => screen.queryByRole("button", { name: "Download image of this chart" });

/** Press Download image and return what the page passed to the image's code. */
async function press(user) {
  await user.click(pngButton());
  await waitFor(() => expect(downloadChartImage).toHaveBeenCalledTimes(1));
  return downloadChartImage.mock.calls[0][0];
}

describe("the button", () => {
  it("is on Explore and on “One characteristic”; Copy link is nowhere (the trends review, O2)", async () => {
    for (const [hash, png, copy] of [
      ["#/explore?var=dlg_word_share", true, false],
      ["#/explore?var=pov_class", true, false],
      ["#/genres?var=dlg_word_share", true, false],
      ["#/genres?var=pov_class", true, false],
      ["#/genres?view=genre&genre=romance&include=all", false, false],
    ]) {
      clearCache();
      const { unmount } = render(<App />);
      window.location.hash = hash;
      await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
      await waitFor(() => expect(Boolean(pngButton())).toBe(png));
      expect(Boolean(screen.queryByRole("button", { name: /Copy link/ }))).toBe(copy);
      unmount();
    }
  });

  it("shows the label “Download image”, its name starting with it, alone in the actions row (the ways across are a line above it)", async () => {
    await open("#/genres?var=dlg_word_share");
    const button = pngButton();
    expect(button.textContent).toBe("Download image");
    expect(button.getAttribute("aria-label")).toBe("Download image of this chart");
    expect(button.className).toBe("btn"); // Copy link's look and size
    const actions = button.closest(".chart-actions");
    expect([...actions.querySelectorAll("button, a")].map((el) => el.textContent)).toEqual(["Download image"]);
    expect(actions.previousElementSibling.className).toBe("way-across");
  });

  it("is the only action on Explore, and is not there when no chart is drawn", async () => {
    await open("#/explore?var=dlg_word_share");
    expect([...pngButton().closest(".chart-actions").querySelectorAll("button, a")]).toHaveLength(1);
    window.location.hash = "#/explore?genre=tiny&var=dlg_word_share";
    await waitFor(() => expect(screen.getByText("No group has enough stories in this selection to show a chart.")).toBeTruthy());
    expect(pngButton()).toBeNull();
    expect(document.querySelector(".chart-actions")).toBeNull(); // no empty row
  });

  it("calls the image's code with the panel's chart, its key and the file's name; focus stays on the button", async () => {
    const user = await open("#/explore?genre=romance&var=dlg_word_share");
    const spec = await press(user);
    const panel = document.querySelector(".chart-panel");
    expect(spec.chart).toBe(panel.querySelector(".range-chart"));
    expect(spec.legend).toBe(panel.querySelector(".range-chart .legend"));
    expect(spec.fileName).toBe("explore-dlg_word_share-pop_fav_per_1k_views-romance-all.png");
    expect(document.activeElement).toBe(pngButton());
  });

  it("calls it with “One characteristic”'s chart, for every form", async () => {
    for (const [v, chart] of [
      ["dlg_word_share", ".genre-chart"],
      ["dlg_has_dialogue", ".genre-chart"],
      ["emo_anger_per_1k", ".genre-any"],
      ["pov_class", ".genre-mix"],
      ["author_stories_count", ".genre-mix"],
    ]) {
      clearCache();
      downloadChartImage.mockClear();
      const user = userEvent.setup();
      const { unmount } = render(<App />);
      window.location.hash = `#/genres?var=${v}&include=y2020`;
      await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
      await waitFor(() => expect(document.querySelector(chart)).toBeTruthy());
      const spec = await press(user);
      expect(spec.chart).toBe(document.querySelector(chart));
      expect(spec.legend).toBe(document.querySelector(".genre-legend"));
      expect(spec.fileName).toBe(`genres-${v}-y2020.png`);
      unmount();
    }
  });

  it("does nothing while the panel is busy", async () => {
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    const serve = withBand();
    vi.stubGlobal("fetch", async (url) => {
      if (String(url).includes("y2020")) await gate;
      return serve(url);
    });
    const user = await open("#/explore?var=dlg_word_share");
    await user.selectOptions(screen.getByLabelText("Only include"), "y2020");
    expect(document.querySelector(".chart-panel").getAttribute("aria-busy")).toBe("true");
    expect(pngButton().getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(pngButton());
    await new Promise((r) => setTimeout(r, 30));
    expect(downloadChartImage).not.toHaveBeenCalled();
    release();
    await waitFor(() => expect(document.querySelector(".chart-panel").getAttribute("aria-busy")).toBe("false"));
    expect(pngButton().hasAttribute("aria-disabled")).toBe(false);
  });

  it("says when the image can't be made, in a polite status beside the button, and clears it on the next try", async () => {
    downloadChartImage.mockImplementation(async () => {
      throw new Error("no canvas");
    });
    const user = await open("#/explore?var=dlg_word_share");
    await user.click(pngButton());
    const status = pngButton().parentElement.querySelector("[role=status]");
    await waitFor(() => expect(status.textContent).toBe("Couldn’t make the image. Try again."));
    expect(FAILED).toBe("Couldn’t make the image. Try again.");
    expect(screen.getByText(FAILED, { selector: ".png-failed" })).toBeTruthy(); // seen beside the button
    expect(document.activeElement).toBe(pngButton());
    downloadChartImage.mockImplementation(async () => {});
    await user.click(pngButton());
    await waitFor(() => expect(status.textContent).toBe(""));
    expect(document.querySelector(".png-failed")).toBeNull();
  });

  it("loads the image's code as a lazy part", () => {
    const config = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "vite.config.js"), "utf8");
    expect(config).toMatch(/lib\[\\\\\/\]\((\w+\|)*chartImage(\|\w+)*\)\\\.js/); // among the lazy helpers
  });
});

describe("what the image says", () => {
  it("has the exact credit", () => {
    expect(CREDIT).toBe("Chart by Nathan Nguyen, @NathanDNguyen");
  });

  it("names its file from the view's ids, in lower case", () => {
    expect(exploreFileName({ v: "story_words", metric: "pop_rating", genre: "all", sub: "all" })).toBe(
      "explore-story_words-pop_rating-all-all.png",
    );
    expect(exploreFileName({ v: "pov_class", metric: "pop_views", genre: "Adult-Romance", sub: "y2020" })).toBe(
      "explore-pov_class-pop_views-adult-romance-y2020.png",
    );
    expect(genresFileName({ v: "story_words", sub: "all" })).toBe("genres-story_words-all.png");
    expect(genresFileName({ v: "Rel_Romance_Per_1k", sub: "Long" })).toBe("genres-rel_romance_per_1k-long.png");
  });

  it("Explore, numbers with a clear pattern: the title, the subtitle, the key, the lines above the chart, the credit", async () => {
    const user = await open("#/explore?var=dlg_word_share");
    const plan = imagePlan(await press(user));
    expect(plan.title).toEqual(["Stories with more dialogue tend to get more favorites per 1,000 views"]);
    expect(plan.subtitle).toEqual([document.querySelector(".chart-sub").textContent]);
    expect(plan.subtitle[0]).toMatch(/^All genres · [\d,]+ stories$/);
    expect(plan.key.map((k) => k.text)).toEqual(["Median", "Interquartile range"]); // the dashed line is labeled on the chart
    expect(plan.key.map((k) => k.swatches)).toEqual([["key-median"], ["key-iqr"]]);
    expect(plan.above).toEqual(["Stories grouped by dialogue share", "Favorites per 1,000 views"]);
    expect(plan.below).toEqual([]);
    expect(plan.credit).toBe(CREDIT);
  });

  it("Explore, no clear pattern and small groups: the answer on its own line, the small-sample key, nothing under", async () => {
    const user = await open("#/explore?genre=romance&var=dlg_word_share");
    const plan = imagePlan(await press(user));
    // the pair screen readers hear
    expect(plan.title).toEqual(["How favorites per 1,000 views vary with dialogue share in Romance", "No clear pattern"]);
    expect(document.querySelector("[aria-live='polite']").textContent).toBe(`${plan.title[0]}. ${plan.title[1]}.`);
    expect(plan.subtitle[0]).toMatch(/^Romance · [\d,]+ stories$/);
    expect(plan.key.map((k) => k.text)).toContain("Fewer than 30 stories");
    expect(plan.key.find((k) => k.text === "Fewer than 30 stories").swatches).toEqual(["key-small"]);
    expect(plan.below).toEqual([]); // no row prints its stories, so no asterisk's caption (the owner, 2026-10-19)
  });

  it("Explore, yes/no and named groups", async () => {
    let user = await open("#/explore?var=dlg_has_dialogue&include=y2020");
    let plan = imagePlan(await press(user));
    expect(plan.subtitle[0]).toMatch(/^All genres · Published 2020 or later · [\d,]+ stories$/);
    expect(plan.above).toEqual(["Favorites per 1,000 views"]); // yes/no rows name themselves: no grouping line
    document.body.innerHTML = "";
    downloadChartImage.mockClear();
    clearCache();
    user = await open("#/explore?var=pov_class&metric=pop_views");
    plan = imagePlan(await press(user));
    expect(plan.title).toEqual(["How views vary by narrative perspective across all genres", "Each group on its own"]);
    expect(plan.above).toEqual(["Stories grouped by narrative perspective", "Views"]);
  });

  const GENRES = [
    [
      "numbers",
      "dlg_word_share",
      "How do genres differ in dialogue share?",
      ["Median", "Interquartile range", "▲▼ Clearly higher or lower than all genres"], // the dashed line is labeled on the chart
      [],
      "Genres by median, highest first",
    ],
    [
      "yes/no",
      "dlg_has_dialogue",
      "How common are stories with dialogue in each genre?",
      ["Share of stories", "▲▼ Clearly more or less common than in all genres"],
      [],
      "Genres by share, highest first",
    ],
    [
      "mostly zero",
      "emo_anger_per_1k",
      "How do genres differ in anger?",
      ["Median and interquartile range among stories with any", "▲▼ Clearly higher or lower than all genres"],
      ["Among stories with any (per 1,000 words)"],
      "Genres by share with any, highest first",
    ],
    [
      "named groups",
      "pov_class",
      "How do genres differ in narrative perspective?",
      [...fixtureMeta.variables.find((v) => v.id === "pov_class").bins.labels, "≠ A clearly different mix"],
      [],
      "Genres in alphabetical order",
    ],
    ["bands", "author_stories_count", "How do genres differ in the author’s number of stories?", [...BAND.bins.labels, "▲▼ Clearly higher or lower than all genres"], [], "Genres in alphabetical order"],
  ];

  // the order a chart opens in: by the values where it can be ordered (the owner, 2026-10-13), else A–Z
  it.each(GENRES)("“One characteristic”, %s: the question, the verdict and the order, and the key without its link", async (_, v, title, key, above, order) => {
    const user = await open(`#/genres?var=${v}`);
    const plan = imagePlan(await press(user));
    expect(plan.title).toEqual([title]);
    expect(plan.subtitle).toEqual([document.querySelector(".genres-page .chart-title").textContent, `All stories · ${order}`]);
    expect(plan.key.map((k) => k.text)).toEqual(key);
    expect(plan.key.every((k) => !/how this is decided|\(|\)$/.test(k.text) || /\((I|we|you)\)$/.test(k.text))).toBe(true);
    expect(plan.above).toEqual(above);
    expect(plan.below).toEqual([]);
    expect(plan.credit).toBe(CREDIT);
  });

  it("“One characteristic”: the order line's words follow the order chosen, and the option is named", async () => {
    const user = await open("#/genres?var=dlg_word_share&include=y2020&sort=value");
    const plan = imagePlan(await press(user));
    expect(plan.subtitle[1]).toBe("Published 2020 or later · Genres by median, highest first");
    const swatches = (await import("../lib/chartImage.js")).keyItems(document.querySelector(".genre-legend")).map((k) => k.swatches.length);
    expect(swatches).toEqual([1, 1, 0]); // median, interquartile range, then the marks' words
  });
});
