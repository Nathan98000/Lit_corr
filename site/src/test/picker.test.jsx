import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { clearCache } from "../lib/data.js";
import { fold, highlight, oneLine, searchCharacteristics } from "../lib/search.js";
import { sanitize, subsetConflict } from "../lib/urlState.js";
import { questionText } from "../lib/wording.js";
import { fixtureFetch, fixtureMeta, realMeta } from "./fixtures.js";

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
  await screen.findByText(/Typical story \(median\)/);
  return user;
}

const ids = (results) => results.map((r) => r.variable.id);

describe("searching characteristics", () => {
  it("ignores case and accents and ranks label prefix, then label word, then other matches", () => {
    expect(fold("Émotion ‘Filter’")).toBe("emotion 'filter'");
    const meta = fixtureMeta;
    const dial = searchCharacteristics(meta, "DIAL");
    expect(ids(dial).slice(0, 2)).toEqual(["dlg_word_share", "dlg_has_dialogue"]);
    expect(dial.map((x) => x.rank).slice(0, 2)).toEqual([3, 2]);
    const r = searchCharacteristics(meta, "dialogue");
    expect(r[0].rank).toBeGreaterThanOrEqual(r[r.length - 1].rank);
    expect(searchCharacteristics(meta, "zzz")).toEqual([]);
  });

  it.skipIf(!real)("finds characteristics by their synonyms and descriptions on the real data", () => {
    expect(ids(searchCharacteristics(real, "pov"))).toEqual(expect.arrayContaining(["pov_is_first_person", "pov_class"]));
    expect(ids(searchCharacteristics(real, "point of view"))).toContain("pov_class");
    expect(ids(searchCharacteristics(real, "explicit"))).toContain("sex_terms_per_1k");
    expect(ids(searchCharacteristics(real, "typos"))).toContain("mech_errors_per_1k");
    expect(ids(searchCharacteristics(real, "swearing"))).toEqual(["style_profanity_per_1k"]);
    expect(ids(searchCharacteristics(real, "dialog")).slice(0, 3)).toContain("dlg_word_share");
    const tense = searchCharacteristics(real, "tense");
    expect(tense.slice(0, 3).every((x) => x.rank >= 2)).toBe(true); // label matches first
    const length = searchCharacteristics(real, "length");
    expect(ids(length)).toContain("story_words");
  });

  it("highlights the match and cuts descriptions to one line", () => {
    expect(highlight("Present-tense narration", "tense")).toEqual(["Present-", "tense", " narration"]);
    expect(highlight("Anger", "x")).toBeNull();
    const long = "word ".repeat(40);
    expect(oneLine(long).length).toBeLessThanOrEqual(110);
    expect(oneLine(long).endsWith("…")).toBe(true);
  });
});

describe("the question sentence", () => {
  it("reads grammatically for every characteristic and measure", () => {
    for (const meta of [fixtureMeta, real].filter(Boolean)) {
      for (const variable of meta.variables) {
        for (const metric of meta.metrics) {
          for (const compare of [false, true]) {
            const q = questionText({ variable, metric, genre: meta.genres[1], compare });
            expect(q).toMatch(/^(In .+, how (do|does) |Genre by genre, how (do|does) )/);
            expect(q).toMatch(/ (vary with|vary by|differ between) .+\?$/);
            expect(q).not.toMatch(/undefined|null| {2}|\bwith with\b|\bthe the\b/);
            if (!metric.plural) expect(q).toMatch(/how does /);
          }
        }
      }
    }
  });

  it("uses the approved forms", () => {
    const m = (id) => fixtureMeta.metrics.find((x) => x.id === id);
    const v = (id) => fixtureMeta.variables.find((x) => x.id === id);
    const all = fixtureMeta.genres[0];
    expect(questionText({ variable: v("dlg_word_share"), metric: m("pop_fav_per_1k_views"), genre: all })).toBe(
      "In All genres, how do favorites per 1,000 views vary with dialogue share?",
    );
    expect(questionText({ variable: v("pov_class"), metric: m("pop_views"), genre: all, compare: true })).toBe(
      "Genre by genre, how do views vary by narrative perspective?",
    );
    expect(questionText({ variable: v("dlg_has_dialogue"), metric: m("pop_views"), genre: all })).toBe(
      "In All genres, how do views differ between stories with dialogue and stories without dialogue?",
    );
  });
});

describe("the characteristic picker", () => {
  it("opens from the sentence, browses topics without changing the chart, and picks with the keyboard", async () => {
    const user = await renderApp();
    const trigger = screen.getByRole("button", { name: /^Story characteristic:/ });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Story characteristic" });
    const search = within(dialog).getByRole("combobox");
    expect(document.activeElement).toBe(search);
    expect(within(dialog).getByText("Popular")).toBeTruthy();
    expect(within(dialog).getByText("Browse by topic")).toBeTruthy();
    // the first option (Popular) is active; move down to a topic and open it
    const options = () => within(dialog).getAllByRole("option");
    expect(search.getAttribute("aria-activedescendant")).toBe(options()[0].id);
    await user.keyboard("{End}");
    expect(search.getAttribute("aria-activedescendant")).toBe(options()[options().length - 1].id);
    await user.keyboard("{Home}{ArrowDown}");
    expect(search.getAttribute("aria-activedescendant")).toBe(options()[1].id);
    const topic = options().find((o) => o.textContent.includes("Emotion & relationships"));
    await user.click(topic);
    expect(within(dialog).getByText("‹ All topics")).toBeTruthy();
    expect(window.location.hash).not.toMatch(/emo_anger/); // browsing never changes the chart
    await user.keyboard("{Enter}"); // the first characteristic of the topic is active
    await waitFor(() => expect(window.location.hash).toMatch(/var=emo_anger_per_1k/));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Story characteristic:/ }));
  });

  it("searches, marks the match, says when nothing matches, and returns focus on Escape", async () => {
    const user = await renderApp();
    const trigger = screen.getByRole("button", { name: /^Story characteristic:/ });
    await user.click(trigger);
    await user.type(screen.getByRole("combobox", { name: /^Search/ }), "perspective");
    expect(screen.getByText("perspective", { selector: "mark" })).toBeTruthy();
    expect(screen.getByText(/1 match/)).toBeTruthy();
    await user.clear(screen.getByRole("combobox", { name: /^Search/ }));
    await user.type(screen.getByRole("combobox", { name: /^Search/ }), "qqq");
    expect(screen.getByText(/No matches/)).toBeTruthy();
    expect(screen.getAllByRole("option").some((o) => o.textContent.includes("Narration"))).toBe(true);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("the measure menu", () => {
  it("opens on click and on tap, groups the measures with their help, and picks with the keyboard", async () => {
    const user = await renderApp();
    const trigger = screen.getByRole("button", { name: /^Popularity measure:/ });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Popularity measure" });
    expect(within(dialog).getByText(/Totals keep growing while a story is online/)).toBeTruthy();
    expect(within(dialog).getByText("Per 1,000 views")).toBeTruthy();
    expect(within(dialog).getByText("Totals so far")).toBeTruthy();
    const list = within(dialog).getByRole("listbox");
    expect(document.activeElement).toBe(list);
    await user.keyboard("{End}{Enter}");
    await waitFor(() => expect(window.location.hash).toMatch(/metric=pop_rating_count/));
    expect(screen.queryByRole("dialog")).toBeNull();
    // a tap (touch pointer, then click) opens it too and keeps it open
    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Popularity measure" })).toBeTruthy();
  });
});

describe("only include", () => {
  it("turns off options that conflict with the characteristic, and says why", () => {
    const length = { id: "short", group: "Length" };
    const published = { id: "y2000", group: "Published" };
    expect(subsetConflict(length, { id: "story_words", label: "Word count" })).toBe("not with word count");
    expect(subsetConflict(published, { id: "pub_year", label: "Publication year" })).toBe("not with publication year");
    expect(subsetConflict(published, { id: "story_words", label: "Word count" })).toBeNull();
  });

  it.skipIf(!real)("never keeps a conflicting option in the address", () => {
    expect(sanitize({ v: "story_words", sub: "short" }, real).sub).toBe("all");
    expect(sanitize({ v: "story_words", sub: "y2000" }, real).sub).toBe("y2000");
  });
});
