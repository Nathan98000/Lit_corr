// Round 3, change 6: the average rating is the default measure and the Rating group comes first; a singular measure
// takes "the" wherever its noun starts a noun phrase in a sentence.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { keepExploring } from "../components/Explorer.jsx";
import { clearCache } from "../lib/data.js";
import { DEFAULT_STATE, sanitize } from "../lib/urlState.js";
import { chartTitle, questionText, theMeasure } from "../lib/wording.js";
import { fixtureFetch, fixtureMeta, realMeta } from "./fixtures.js";

const real = realMeta();

// The test data leaves the average rating out (too few of its stories have one); this meta offers it, as the real
// data does, in the same place: last in meta.metrics, first in meta.metric_groups.
const RATING = {
  id: "pop_rating",
  label: "Average rating",
  group: "Rating",
  noun: "average rating",
  plural: false,
  more: "have higher average ratings",
  less: "have lower average ratings",
  format: "rating",
  age: false,
  help: "The average star rating (1 to 5) shown on the story page.",
};
const meta = { ...fixtureMeta, metrics: [...fixtureMeta.metrics, RATING] };

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  const serve = fixtureFetch();
  vi.stubGlobal("fetch", async (url) =>
    String(url).endsWith("meta.json") ? { ok: true, status: 200, json: async () => meta } : serve(url),
  );
});

/** A sentence as it reads on screen: without the selects' options, the hidden labels and the word joiners. */
function shown(el) {
  const copy = el.cloneNode(true);
  copy.querySelectorAll("select, .visually-hidden").forEach((x) => x.remove());
  return copy.textContent.replace(/\u2060/g, "");
}

async function renderApp(hash) {
  window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
  return user;
}

describe("the average rating first", () => {
  it("is the default in the data and in the address, and the Rating group leads", () => {
    expect(fixtureMeta.default_metric).toBe("pop_rating");
    expect(fixtureMeta.metric_groups).toEqual(["Rating", "Per 1,000 views", "Per month online", "Totals so far"]);
    expect(DEFAULT_STATE.metric).toBe("pop_rating");
    expect(sanitize({}, meta).metric).toBe("pop_rating");
    expect(sanitize({ metric: "pop_views" }, meta).metric).toBe("pop_views"); // a shared address keeps its measure
  });

  it.skipIf(!real)("keeps the real data's measures in their order (the aggregate files hold them by position)", () => {
    expect(real.default_metric).toBe("pop_rating");
    expect(real.metric_groups[0]).toBe("Rating");
    expect(real.metrics.map((m) => m.id)).toEqual([
      "pop_fav_per_1k_views",
      "pop_comments_per_1k_views",
      "pop_ratings_per_1k_views",
      "pop_reading_lists_per_1k_views",
      "pop_views_per_month",
      "pop_views",
      "pop_favorites",
      "pop_comments",
      "pop_rating_count",
      "pop_rating",
    ]);
  });

  it("opens an address without a measure on ratings, with the article, and lists Rating first", async () => {
    const user = await renderApp("#/explore?var=dlg_word_share");
    const sentence = document.querySelector(".sentence");
    expect(shown(sentence)).toBe("In All genres, how does the average rating vary with dialogue share?");
    expect(within(sentence).getByRole("button", { name: /^Popularity measure:/ }).textContent).toBe("Popularity measure: average rating");
    expect(document.title).toBe("How the average rating varies with dialogue share across all genres");
    const nav = screen.getByRole("navigation", { name: "Keep exploring" });
    expect(within(nav).getAllByRole("link")[0].textContent).toBe("Every clear pattern with the average rating across all genres\u00a0→");
    await user.click(screen.getByRole("button", { name: /^Popularity measure:/ }));
    const dialog = screen.getByRole("dialog", { name: "Popularity measure" });
    const options = await within(dialog).findAllByRole("option");
    expect(options[0].querySelector(".pick-label").firstChild.textContent).toBe("Average rating");
    expect([...dialog.querySelectorAll(".pick-section")].map((s) => s.textContent)).toEqual([
      "Rating",
      "Per 1,000 views",
      "Per month online",
      "Totals so far",
    ]);
  });

  it("keeps the measure of an address that names one, with no article for plural measures", async () => {
    await renderApp("#/explore?var=dlg_word_share&metric=pop_views");
    expect(shown(document.querySelector(".sentence"))).toBe(
      "In All genres, how do views vary with dialogue share?",
    );
  });

  it("puts the article in the Patterns page's sentence and count line, and lists Rating first in its select", async () => {
    window.history.replaceState(null, "", "/#/patterns");
    render(<App />);
    const count = await screen.findByText(/characteristics have a clear pattern/);
    expect(shown(document.querySelector(".patterns-question"))).toBe(
      "Clear patterns in All genres with the average rating",
    );
    expect(count.textContent).toMatch(/^\d+ of 3 characteristics have a clear pattern with the average rating across all genres\./);
    const select = screen.getByLabelText("Popularity measure");
    expect(select.value).toBe("pop_rating");
    expect([...select.querySelectorAll("optgroup")].map((g) => g.label)[0]).toBe("Rating");
  });
});

describe("singular measures take “the”", () => {
  const v = (id) => fixtureMeta.variables.find((x) => x.id === id);
  const all = fixtureMeta.genres[0];
  const romance = fixtureMeta.genres.find((g) => g.id === "romance");

  it("in titles, the question and Keep exploring; plural measures are unchanged", () => {
    expect(theMeasure(RATING)).toBe("the average rating");
    expect(theMeasure(fixtureMeta.metrics[0])).toBe("favorites per 1,000 views");
    expect(chartTitle({ variable: v("dlg_word_share"), metric: RATING, genre: all, direction: 0 })).toBe(
      "How the average rating varies with dialogue share across all genres",
    );
    expect(chartTitle({ variable: v("dlg_has_dialogue"), metric: RATING, genre: romance, direction: 0 })).toBe(
      "How the average rating varies between stories with dialogue and stories without dialogue in Romance",
    );
    expect(chartTitle({ variable: v("pov_class"), metric: RATING, genre: all, direction: 0, compare: true })).toBe(
      "How the average rating varies by narrative perspective, genre by genre",
    );
    expect(chartTitle({ variable: v("dlg_word_share"), metric: RATING, genre: all, direction: 1 })).toBe(
      "Stories with more dialogue tend to have higher average ratings",
    );
    expect(questionText({ variable: v("dlg_word_share"), metric: RATING, genre: all, compare: true })).toBe(
      "Genre by genre, how does the average rating vary with dialogue share?",
    );
    expect(keepExploring(meta, sanitize({ v: "dlg_word_share" }, meta)).every((x) => x.state.metric)).toBe(true);
  });

  it.skipIf(!real)("never doubles or drops the article, in any sentence about the average rating", () => {
    const rating = real.metrics.find((m) => m.id === "pop_rating");
    const genres = [real.genres[0], real.genres[5]];
    for (const variable of real.variables) {
      const sentences = [
        questionText({ variable, metric: rating, genre: genres[1] }),
        questionText({ variable, metric: rating, genre: genres[0], compare: true }),
        ...genres.flatMap((genre) => [-1, 0, 1].map((direction) => chartTitle({ variable, metric: rating, genre, direction }))),
        chartTitle({ variable, metric: rating, genre: genres[0], direction: 0, compare: true }),
      ];
      for (const s of sentences) {
        expect(s).not.toMatch(/\bthe the\b|(how does|How|with|varies) average rating|average rating vary\b(?! with| by| between)/);
        if (/^How /.test(s)) expect(s).toMatch(/^How the average rating varies /);
      }
    }
  });
});
