// The Genres page, one genre against all genres (View 2): the heading and its 0 state, the biggest differences,
// the lists ordered by the size of the difference with "Show all", the topics folded, the too-few state and the links
// to every genre's numbers.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { profileAnnouncement } from "../components/GenreProfile.jsx";
import { clearCache } from "../lib/data.js";
import { genreAgeNote, genreProfile, profileHeading, profileRowDescription, profileTakeaway, profileValues } from "../lib/genres.js";
import { fixtureFetch, fixtureMeta, realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const real = realMeta();
const realFile = (sub = "all") =>
  JSON.parse(readFileSync(path.join(here, "..", "..", "public", "aggregates", "genres", `${sub}.json`), "utf8"));

/**
 * The test data with Romance standing out on purpose: less dialogue (r −0.32), more anger above 0 (+0.24), more
 * often with dialogue (+0.21) and a different mix of perspectives (0.27); Fetish stands out on nothing. Romance's
 * stories are 6 years older than all genres'.
 */
function profileFetch({ ages = [11, 10.8, 17, null] } = {}) {
  const serve = fixtureFetch();
  const fn = async (url) => {
    const res = await serve(url);
    if (!String(url).includes("genres/")) return res;
    const body = await res.json();
    const set = (id, r, f) => Object.assign(body.c[id], { r, f });
    set("dlg_word_share", [null, 0.05, -0.32, null], [0, 0, -1, 0]);
    set("emo_anger_per_1k", [null, 0.02, 0.24, null], [0, 0, 1, 0]);
    set("dlg_has_dialogue", [null, -0.01, 0.21, null], [0, 0, 1, 0]);
    set("pov_class", [null, 0.03, 0.27, null], [0, 0, 1, 0]);
    body.age = ages;
    return { ok: true, status: 200, json: async () => body };
  };
  fn.calls = serve.calls;
  return fn;
}

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", profileFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openGenre(hash) {
  window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
  return user;
}

const heading = () => document.querySelector(".genres-page .chart-title").textContent;
const listTitles = () => [...document.querySelectorAll(".profile-list h3")].map((h) => h.textContent);

describe("the heading and the takeaway", () => {
  it("count the characteristics that set the genre apart: 0, 1 or k", () => {
    const g = { name: "Romance" };
    expect(profileHeading(0, { name: "Fetish" })).toBe("No characteristic clearly sets Fetish apart from all genres");
    expect(profileHeading(1, g)).toBe("1 characteristic clearly sets Romance apart from all genres");
    expect(profileHeading(28, g)).toBe("28 characteristics clearly set Romance apart from all genres");
  });

  it("name the biggest differences with the D10 words, and the defaults", async () => {
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    expect(heading()).toBe("4 characteristics clearly set Romance apart from all genres");
    expect(document.querySelector(".profile-takeaway").textContent).toBe(
      "Biggest differences: dialogue share (less dialogue), narrative perspective (different mix), anger (higher).",
    );
    const one = [{ variable: { noun: "story length in words", more_word: "Longer", less_word: "Shorter", bins: {} }, kind: "num", f: -1 }];
    expect(profileTakeaway(one)).toBe("Biggest difference: story length in words (shorter).");
    const yes = [{ variable: { yes_subject: "First-person stories", noun: "first-person narration", bins: {} }, kind: "bin", f: 1 }];
    expect(profileTakeaway(yes)).toBe("Biggest difference: first-person stories (more common).");
    expect(profileTakeaway([])).toBeNull();
  });

  it("says when nothing stands out, and keeps the topics", async () => {
    await openGenre("#/genres?view=genre&genre=fetish&include=all");
    expect(heading()).toBe("No characteristic clearly sets Fetish apart from all genres");
    expect(document.querySelector(".profile-none").textContent).toBe(
      "Its stories are close to those of all genres on each of the 4 characteristics compared.",
    );
    expect(document.querySelector(".profile-takeaway")).toBeNull();
    expect(document.querySelectorAll(".profile-list")).toHaveLength(0); // empty lists are left out
    expect(document.querySelectorAll(".profile-topic").length).toBeGreaterThan(0);
  });
});

describe("the lists", () => {
  it("order the stand-outs by the size of the difference, lower, then higher, then a different mix", async () => {
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    expect(listTitles()).toEqual(["Lower in Romance than in all genres", "Higher in Romance than in all genres", "A different mix"]);
    const lists = [...document.querySelectorAll(".profile-list")];
    const names = (l) => [...l.querySelectorAll(".profile-label")].map((x) => x.textContent);
    expect(names(lists[0])).toEqual(["Dialogue share"]);
    expect(names(lists[1])).toEqual(["Anger", "Has dialogue"]); // 0.24 before 0.21
    expect(names(lists[2])).toEqual(["Narrative perspective"]);
    expect(lists[1].querySelector(".list-count").textContent).toBe("2 characteristics2");
    expect(lists[0].querySelector(".list-count .short").getAttribute("aria-hidden")).toBe("true");
  });

  it("show seven rows, then all of them with “Show all”", async () => {
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) => {
      const res = await serve(url);
      if (String(url).endsWith("meta.json")) {
        const meta = await res.json();
        // nine more characteristics like dialogue share, each standing out a little less
        const extra = Array.from({ length: 9 }, (_, i) => ({ ...meta.variables[0], id: `x${i}`, label: `Extra ${i}` }));
        meta.variables.push(...extra);
        meta.topics[0].ids.push(...extra.map((v) => v.id));
        return { ok: true, status: 200, json: async () => meta };
      }
      if (!String(url).includes("genres/")) return res;
      const body = await res.json();
      for (let i = 0; i < 9; i += 1) body.c[`x${i}`] = { ...body.c.dlg_word_share, r: [null, 0, -0.3 + i / 100, null], f: [0, 0, -1, 0] };
      return { ok: true, status: 200, json: async () => body };
    });
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all");
    const list = document.querySelector(".profile-list");
    expect(list.querySelector("h3").textContent).toBe("Lower in Romance than in all genres");
    expect(list.querySelectorAll(".profile-row")).toHaveLength(7);
    const more = within(list).getByRole("button", { name: "Show all 9" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    await user.click(more);
    expect(list.querySelectorAll(".profile-row")).toHaveLength(9);
    expect(within(list).getByRole("button", { name: "Show fewer" }).getAttribute("aria-expanded")).toBe("true");
    expect([...list.querySelectorAll(".profile-label")].map((x) => x.textContent)[0]).toBe("Extra 0"); // |r| 0.30 first
  });

  it("are links to every genre's numbers, with the genre highlighted, as a new history entry", async () => {
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all");
    const row = document.querySelector(".profile-list .profile-row");
    expect(row.getAttribute("href")).toBe("#/genres?var=dlg_word_share&include=all&genre=romance");
    // the name starts with what is on screen (label in name, F76): the label and the values, then the description
    expect(row.hasAttribute("aria-label")).toBe(false);
    expect(
      screen.getByRole("link", {
        name: /^Dialogue share\s*\d+% · all \d+%\. Romance median \d+%, interquartile range \d+%–\d+%; all genres median \d+%, interquartile range \d+%–\d+%; clearly less dialogue\. Opens every genre’s numbers\.$/,
      }),
    ).toBe(row);
    await user.click(row);
    await waitFor(() => expect(window.location.hash).toBe("#/genres?var=dlg_word_share&include=all&genre=romance"));
    await waitFor(() => expect(document.querySelector(".genre-chart .row.highlight")).toBeTruthy());
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById("question")));
    window.history.back();
    await waitFor(() => expect(window.location.hash).toBe("#/genres?view=genre&genre=romance&include=all"));
  });
});

describe("every characteristic, by topic", () => {
  it("folds the topics with their counts and draws a topic's rows only when it is opened", async () => {
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all");
    const topics = [...document.querySelectorAll(".profile-topic")];
    const heads = topics.map((t) => [t.querySelector("h4").textContent, t.querySelector(".profile-topic-count").textContent]);
    const expected = fixtureMeta.topics.map((t) => {
      const k = { dialogue: 2, narration: 1, emotion: 1 }[t.id] ?? 0;
      return [t.label, k ? `${k} of ${t.ids.length} stand out` : `${t.ids.length} characteristic${t.ids.length === 1 ? "" : "s"}`];
    });
    expect(heads).toEqual(expected);
    expect(topics.every((t) => !t.open && !t.querySelector(".profile-row"))).toBe(true);
    await user.click(topics[0].querySelector("summary"));
    await waitFor(() => expect(topics[0].querySelectorAll(".profile-row").length).toBe(fixtureMeta.topics[0].ids.length));
    // in a topic, the stand-outs carry their marks
    const values = [...topics[0].querySelectorAll(".profile-values")].map((v) => v.textContent);
    expect(values.some((v) => /^[▲▼≠] /.test(v))).toBe(true);
  });
});

describe("edge states", () => {
  it("says when a genre has too few stories for the option, and offers all stories", async () => {
    const user = await openGenre("#/genres?view=genre&genre=tiny&include=all");
    expect(heading()).toBe("Fewer than 10 stories in Tiny Genre match “All stories”: too few to compare.");
    expect(screen.queryByRole("button", { name: "Show all stories" })).toBeNull(); // all stories are shown already
    expect(document.querySelector(".profile-topics")).toBeNull();
    window.location.hash = "#/genres?view=genre&genre=tiny&include=y2020";
    await waitFor(() => expect(heading()).toBe("Fewer than 10 stories in Tiny Genre match “Published 2020 or later”: too few to compare."));
    await user.click(screen.getByRole("button", { name: "Show all stories" }));
    await waitFor(() => expect(window.location.hash).toBe("#/genres?view=genre&genre=tiny&include=all"));
  });

  it("says a genre with 10 to 29 stories is too few to compare, and keeps its numbers by topic (F60)", async () => {
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) => {
      const res = await serve(url);
      if (!String(url).includes("genres/")) return res;
      const body = await res.json();
      body.n[2] = 24;
      for (const e of Object.values(body.c)) {
        if (e.q[2]) e.q[2][0] = 24;
        e.r[2] = null;
        e.f[2] = 0;
      }
      return { ok: true, status: 200, json: async () => body };
    });
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all");
    expect(heading()).toBe("Fewer than 30 stories in Romance match “All stories”: too few to compare.");
    expect(document.querySelector(".profile-none")).toBeNull(); // never "close to all genres" when nothing was compared
    expect(document.querySelectorAll(".profile-list")).toHaveLength(0);
    expect(document.querySelectorAll(".profile-topic").length).toBeGreaterThan(0);
    await user.click(document.querySelector(".profile-topic summary"));
    await waitFor(() => expect(document.querySelector(".profile-row.small")).toBeTruthy());
    expect(document.querySelector(".profile-row.small .visually-hidden").textContent).toMatch(/; too few stories to compare\. Opens/);
  });

  it("offers all stories when an option leaves a genre with 10 to 29 stories (F60)", async () => {
    // the test data's "5,000 words or more", as built: Romance has 15 stories, so no r and no flag
    vi.stubGlobal("fetch", fixtureFetch());
    const user = await openGenre("#/genres?view=genre&genre=romance&include=long");
    expect(heading()).toBe("Fewer than 30 stories in Romance match “5,000 words or more”: too few to compare.");
    expect(document.querySelector(".profile-takeaway")).toBeNull();
    expect(document.querySelectorAll(".profile-topic").length).toBeGreaterThan(0);
    expect(document.querySelector(".profile-topic-count").textContent).toMatch(/^\d+ characteristics?$/);
    await user.click(screen.getByRole("button", { name: "Show all stories" }));
    await waitFor(() => expect(window.location.hash).toBe("#/genres?view=genre&genre=romance&include=all"));
  });

  it("notes the story age when the genre's and all genres' are 3 or more years apart, with All stories", async () => {
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all");
    expect(document.querySelector(".genre-age").textContent).toMatch(
      /^Story age\. Stories in Romance have a median age of 17\.0 years; stories in all genres, 11\.0 years\.Compare stories published 2020 or later$/,
    );
    await user.click(screen.getByRole("button", { name: "Compare stories published 2020 or later" }));
    await waitFor(() => expect(window.location.hash).toBe("#/genres?view=genre&genre=romance&include=y2020"));
    await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
    expect(document.querySelector(".genre-age")).toBeNull();
    const file = { age: [9.3, 19.5, 10.1] };
    expect(genreAgeNote(file, 1, { name: "Chain Stories" })).toBe(
      "Stories in Chain Stories have a median age of 19.5 years; stories in all genres, 9.3 years.",
    );
    expect(genreAgeNote(file, 2, { name: "Romance" })).toBeNull();
  });
});

describe("one genre on the real data", () => {
  it.skipIf(!real)("reproduces the acceptance numbers", () => {
    const file = realFile();
    const at = (id) => file.genres.indexOf(id);
    const romance = genreProfile(real, file, at("adult-romance"));
    expect([romance.flagged.length, romance.lower.length, romance.higher.length, romance.mix.length]).toEqual([28, 18, 10, 0]);
    // sexual-action terms and anatomical terms tie at r = −0.43: the tie keeps the topic's order
    expect(romance.flagged.slice(0, 3).map((x) => x.id)).toEqual(["sex_terms_per_1k", "sex_sentence_share", "sex_anatomy_per_1k"]);
    expect(romance.flagged.slice(0, 4).map((x) => x.r)).toEqual([-0.48, -0.45, -0.43, -0.43]);
    expect(genreProfile(real, file, at("fetish-stories")).flagged).toHaveLength(0);
    expect(genreProfile(real, file, at("adult-how-to")).flagged).toHaveLength(116);
    expect(genreProfile(real, file, at("reviews-and-essays")).flagged).toHaveLength(115);
    expect(genreProfile(real, file, at("erotic-couplings")).flagged).toHaveLength(10);
    expect(genreProfile(real, file, at("anal-sex-stories")).flagged).toHaveLength(28);
    expect(profileAnnouncement(real, file, { genre: "adult-romance", sub: "all" })).toBe(
      "28 characteristics clearly set Romance apart from all genres. Biggest differences: sexual language (less), " +
        "the share of sentences with sexual language (lower), anatomical terms (less).",
    );
  });

  it.skipIf(!real)("says Chain Stories' 12 stories of 2020 or later are too few to compare (F60)", () => {
    const file = realFile("y2020");
    const gi = file.genres.indexOf("chain-stories");
    expect(file.n[gi]).toBe(12);
    expect(profileAnnouncement(real, file, { genre: "chain-stories", sub: "y2020" })).toBe(
      "Fewer than 30 stories in Chain Stories match “Published 2020 or later”: too few to compare.",
    );
    const p = genreProfile(real, file, gi);
    expect([p.flagged.length, p.compared]).toEqual([0, 0]);
    expect(p.items.length).toBe(183); // every characteristic's numbers are there, by topic
    // a genre with enough stories: the topics count only the characteristics compared
    const all = realFile();
    const howTo = genreProfile(real, all, all.genres.indexOf("adult-how-to"));
    expect(howTo.compared).toBeLessThan(howTo.items.length); // the adverbs in speech tags: How To has 28 stories with them
    expect(howTo.topics.reduce((sum, t) => sum + t.compared, 0)).toBe(howTo.compared);
  });

  it.skipIf(!real)("writes the values as the copy does", () => {
    const file = realFile();
    const p = genreProfile(real, file, file.genres.indexOf("adult-romance"));
    const item = (id) => p.items.find((x) => x.id === id);
    expect(profileValues(item("sex_terms_per_1k"))).toBe("7.79 · all 19.3");
    expect(profileValues(item("rel_romance_per_1k"))).toBe("73% above 0 · all 43%");
    const howTo = genreProfile(real, file, file.genres.indexOf("adult-how-to"));
    expect(profileValues(howTo.items.find((x) => x.id === "pov_class"))).toBe("Second person (you) 55% · all 2%");
    expect(profileRowDescription(item("sex_terms_per_1k"), { name: "Romance" }, false)).toMatch(
      /^Romance median 7\.79 per 1,000 words, interquartile range [\d.]+–[\d.]+; all genres median 19\.3 per 1,000 words, interquartile range [\d.]+–[\d.]+; clearly less\. Opens every genre’s numbers\.$/,
    );
  });
});
