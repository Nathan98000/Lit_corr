// Round 2's search (F45): nouns ranked like labels, word beginnings, the new synonyms, and measures typed into the
// characteristic search.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { clearCache } from "../lib/data.js";
import { measureNamed, searchCharacteristics } from "../lib/search.js";
import { fixtureFetch, realMeta } from "./fixtures.js";

const real = realMeta();

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
});

async function renderApp(hash = "") {
  if (hash) window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
  return user;
}

describe("F45: search", () => {
  const top = (q, n = 3) => searchCharacteristics(real, q).slice(0, n).map((r) => r.variable.id);

  it.skipIf(!real)("finds the review's queries on the real data", () => {
    expect(top("length")).toContain("story_words"); // its noun is "story length"
    expect(top("age")).toContain("age_years"); // its noun is "story age"
    const age = searchCharacteristics(real, "age").map((r) => r.variable.label);
    expect(age.filter((l) => /page|language|average/i.test(l))).toEqual([]); // word beginnings only
    expect(measureNamed(real, "rating").id).toBe("pop_rating");
    expect(searchCharacteristics(real, "humour").map((r) => r.variable.id)).toContain("humor_per_1k");
    expect(searchCharacteristics(real, "kissing").map((r) => r.variable.id)).toContain("rel_intimacy_per_1k");
    expect(searchCharacteristics(real, "orgasm").map((r) => r.variable.id)).toContain("sex_action_per_1k");
    expect(searchCharacteristics(real, "1st person").map((r) => r.variable.id)).toContain("pov_is_first_person");
    // what worked before still works
    expect(top("tense").length).toBe(3);
    expect(searchCharacteristics(real, "tense").slice(0, 3).every((x) => x.rank >= 2)).toBe(true);
    expect(searchCharacteristics(real, "pov").map((r) => r.variable.id)).toEqual(expect.arrayContaining(["pov_is_first_person", "pov_class"]));
    expect(top("dialog")).toContain("dlg_word_share");
    expect(searchCharacteristics(real, "swearing").map((r) => r.variable.id)).toEqual(["style_profanity_per_1k"]);
    expect(searchCharacteristics(real, "typos").map((r) => r.variable.id)).toContain("mech_errors_per_1k");
  });

  it.skipIf(!real)("names a measure only for words that belong to the measures", () => {
    const named = (q) => measureNamed(real, q)?.id ?? null;
    expect(named("views")).toBe("pop_views");
    expect(named("favorite")).toBe("pop_favorites");
    expect(named("comments")).toBe("pop_comments");
    expect(named("reading list")).toBe("pop_reading_lists_per_1k_views");
    expect(named("per 1,000 views")).toBeNull(); // four measures fit equally well
    expect(named("month")).toBeNull(); // also "Publication month"
    expect(named("number")).toBeNull(); // also "Number of tags"
  });

  it("tells you when you typed a measure, and switches to it", async () => {
    const user = await renderApp();
    await user.click(screen.getByRole("button", { name: /^Story characteristic:/ }));
    await user.type(await screen.findByRole("combobox", { name: /^Search/ }), "views");
    expect(screen.getByText(/^“Views” is a popularity measure, not a story characteristic\./)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Show views" }));
    await waitFor(() => expect(window.location.hash).toMatch(/metric=pop_views(&|$)/));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("F57: the picker on a phone, with the on-screen keyboard", () => {
  const original = window.matchMedia;

  it("puts Close in the search row while a query is typed, and locks the page behind the sheet", async () => {
    window.matchMedia = (q) => ({ matches: q === "(max-width: 699px)", addEventListener() {}, removeEventListener() {} });
    try {
      const user = await renderApp();
      const trigger = screen.getByRole("button", { name: /^Story characteristic:/ });
      await user.click(trigger);
      expect(document.documentElement.style.overflow).toBe("hidden");
      expect(document.body.style.overflow).toBe("hidden");
      const search = await screen.findByRole("combobox", { name: /^Search/ });
      expect(document.querySelector(".search-row .search-close")).toBeNull(); // nothing typed: Close stays in the title row
      await user.type(search, "dialog");
      expect(document.querySelector(".pick-typing")).toBeTruthy(); // the sheet folds its title row (styles.css)
      await user.click(document.querySelector(".search-row .search-close"));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(document.documentElement.style.overflow).toBe("");
    } finally {
      window.matchMedia = original;
    }
  });
});
