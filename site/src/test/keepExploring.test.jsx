// After the chart (F50, concept J2): one "Keep exploring" list instead of "Next questions" and "Try another question".
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { keepExploring } from "../components/Explorer.jsx";
import { clearCache } from "../lib/data.js";
import { fixtureFetch, fixtureMeta } from "./fixtures.js";

// six example questions on the fixture's characteristics and measures, in a fixed order
const FEATURED = [
  { question: "Q1: dialogue share, favorites?", var: "dlg_word_share", metric: "pop_fav_per_1k_views" },
  { question: "Q2: dialogue share in Romance, views per month?", var: "dlg_word_share", metric: "pop_views_per_month", genre: "romance" },
  { question: "Q3: anger, views?", var: "emo_anger_per_1k", metric: "pop_views" },
  { question: "Q4: perspective, favorites?", var: "pov_class", metric: "pop_fav_per_1k_views" },
  { question: "Q5: has dialogue, genre by genre?", var: "dlg_has_dialogue", metric: "pop_views", mode: "compare" },
  { question: "Q6: dialogue share, views per month?", var: "dlg_word_share", metric: "pop_views_per_month" },
];
const meta = { ...fixtureMeta, featured: FEATURED };

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  const serve = fixtureFetch();
  vi.stubGlobal("fetch", async (url) =>
    String(url).endsWith("meta.json") ? { ok: true, status: 200, json: async () => meta } : serve(url),
  );
});

async function renderApp(hash) {
  window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
  return user;
}

const items = () => within(screen.getByRole("navigation", { name: "Keep exploring" })).getAllByRole("link");
const view = (v) => ({ mode: "one", genre: "all", metric: "pop_fav_per_1k_views", v: "dlg_word_share", sub: "all", ...v });

describe("keep exploring", () => {
  it("lists the Patterns page, then the first three example questions that open another view, in their order", async () => {
    await renderApp("#/explore?var=dlg_word_share&metric=pop_fav_per_1k_views");
    const links = items();
    expect(links.length).toBeLessThanOrEqual(4);
    expect(links.map((a) => a.textContent)).toEqual([
      "Every clear pattern with favorites per 1,000 views across all genres →",
      "Q2: dialogue share in Romance, views per month? →", // Q1 is the chart shown
      "Q3: anger, views? →",
      "Q4: perspective, favorites? →",
    ]);
    expect(links[0].getAttribute("href")).toBe("#/patterns?genre=all&metric=pop_fav_per_1k_views");
    expect(links[1].getAttribute("href")).toBe(
      "#/explore?mode=one&genre=romance&metric=pop_views_per_month&var=dlg_word_share&include=all",
    );
    for (const a of links) expect(a.getAttribute("href")).not.toBe(window.location.hash); // none opens this view
  });

  it("never repeats the age box's “Switch to …”", async () => {
    await renderApp("#/explore?genre=romance&var=dlg_word_share&metric=pop_views");
    expect(screen.getByRole("button", { name: "Switch to views per month" })).toBeTruthy();
    const texts = items().map((a) => a.textContent);
    expect(texts[0]).toBe("Every clear pattern with views in Romance →");
    expect(texts.slice(1)).toEqual(["Q1: dialogue share, favorites? →", "Q3: anger, views? →", "Q4: perspective, favorites? →"]);
  });

  it("chooses by view only, never by a result", () => {
    // the same settings always give the same list, whatever the data says
    const picks = (v) => keepExploring(meta, view(v)).map((x) => x.question.slice(0, 2));
    expect(picks({})).toEqual(["Q2", "Q3", "Q4"]);
    expect(picks({ v: "emo_anger_per_1k", metric: "pop_views" })).toEqual(["Q1", "Q2", "Q4"]);
    expect(picks({ mode: "compare", v: "dlg_has_dialogue", metric: "pop_views", genre: "fetish" })).toEqual(["Q1", "Q2", "Q3"]);
    expect(picks({ v: "dlg_word_share", metric: "pop_views" })).toEqual(["Q1", "Q2", "Q3"]); // Q6 would be the switch
  });

  it("is there in compare mode, pointing to the Patterns page for all genres", async () => {
    await renderApp("#/explore?mode=compare&genre=romance&var=dlg_word_share");
    expect(items()[0].textContent).toBe("Every clear pattern with favorites per 1,000 views across all genres →");
  });

  it("is there when no group has enough stories", async () => {
    await renderApp("#/explore?genre=tiny&var=dlg_word_share");
    expect(screen.getByText("No group has enough stories in this selection to show a chart.")).toBeTruthy();
    expect(items()[0].textContent).toBe("Every clear pattern with favorites per 1,000 views in Tiny Genre →");
    expect(screen.queryByRole("navigation", { name: "Next questions" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Try another question" })).toBeNull();
  });
});
