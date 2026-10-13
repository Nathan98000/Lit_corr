// The Genres page, one genre against all genres (View 2): the heading and its 0 state, the takeaway,
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
import {
  comparisonBar,
  genreProfile,
  noDifferenceZone,
  profileColumns,
  profileHeading,
  profileRowName,
  profileTakeaway,
  takeawayLine,
} from "../lib/genres.js";
import { fixtureFetch, fixtureMeta, realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const real = realMeta();
const realFile = (sub = "all") =>
  JSON.parse(readFileSync(path.join(here, "..", "..", "public", "aggregates", "genres", `${sub}.json`), "utf8"));

/**
 * The test data with Romance standing out on purpose: less dialogue (r −0.32), more anger above 0 (+0.24), more
 * often with dialogue (+0.21) and a different mix of perspectives (0.27); Fetish stands out on nothing.
 */
function profileFetch() {
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

  it("name the stand-outs in each direction, as the lists word them (S1)", async () => {
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    expect(heading()).toBe("4 characteristics clearly set Romance apart from all genres");
    expect(document.querySelector(".profile-takeaway").textContent).toBe(
      "▼ Lower: dialogue share.▲ Higher: anger, has dialogue.≠ A different mix: narrative perspective.",
    );
    expect(profileTakeaway({ lower: [], higher: [], mix: [] })).toEqual([]);
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
    const names = (l) => [...l.querySelectorAll(".profile-label-text")].map((x) => x.textContent);
    expect(names(lists[0])).toEqual(["Dialogue share"]);
    expect(names(lists[1])).toEqual(["Anger", "Has dialogue"]); // 0.24 before 0.21
    expect(names(lists[2])).toEqual(["Narrative perspective"]);
    // stacked (the test's chart is 720 px): the count is for screen readers, the columns' heads take its place
    expect(lists[1].querySelector(".profile-list-head .visually-hidden").textContent).toBe("2 characteristics");
    expect(lists[1].querySelector(".profile-heads").getAttribute("aria-hidden")).toBe("true");
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
    expect([...list.querySelectorAll(".profile-label-text")].map((x) => x.textContent)[0]).toBe("Extra 0"); // |r| 0.30 first
  });

  it("are links to every genre's numbers, without a genre (decision 8), as a new history entry", async () => {
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all");
    // the row's link is its name, stretched over the row (round 4's I16)
    const row = document.querySelector(".profile-list .profile-row .profile-link");
    expect(row.getAttribute("href")).toBe("#/genres?var=dlg_word_share&include=all");
    for (const link of document.querySelectorAll(".profile-row .profile-link")) expect(link.getAttribute("href")).not.toMatch(/genre=/);
    // the name is the row's own content (F76, F92): the label, the dot's number, the numbers, how it compares
    expect(row.hasAttribute("aria-label")).toBe(false);
    expect(
      screen.getByRole("link", { name: "Dialogue share: 34 in 100; Romance 25%, all genres 23%; clearly less dialogue. Opens every genre’s numbers." }),
    ).toBe(row);
    await user.click(row);
    await waitFor(() => expect(window.location.hash).toBe("#/genres?var=dlg_word_share&include=all"));
    await waitFor(() => expect(document.querySelector(".genre-chart")).toBeTruthy());
    expect(document.querySelector(".row.repeat, .row.highlight, .band-highlight")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById("question")));
    window.history.back();
    await waitFor(() => expect(window.location.hash).toBe("#/genres?view=genre&genre=romance&include=all"));
  });
});

describe("every characteristic, by topic", () => {
  it("folds the topics with their counts and draws a topic's rows only when it is opened", async () => {
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all");
    const topics = [...document.querySelectorAll(".profile-topic")];
    const heads = topics.map((t) => [t.querySelector(".profile-topic-name").textContent, t.querySelector(".profile-topic-count").textContent]);
    const expected = fixtureMeta.topics.map((t) => {
      const k = { dialogue: 2, narration: 1, emotion: 1 }[t.id] ?? 0;
      return [t.label, `${k} of ${t.ids.length} stand out`]; // every characteristic of the test data is compared
    });
    expect(heads).toEqual(expected);
    expect(topics.every((t) => !t.open && !t.querySelector(".profile-row"))).toBe(true);
    await user.click(topics[0].querySelector("summary"));
    await waitFor(() => expect(topics[0].querySelectorAll(".profile-row").length).toBe(fixtureMeta.topics[0].ids.length));
    // in a topic, the stand-outs carry their marks
    const marks = [...topics[0].querySelectorAll(".profile-mark")].map((v) => v.textContent);
    expect(marks.some((v) => /^[▲▼≠]$/.test(v))).toBe(true);
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
    await waitFor(() => expect(document.querySelector(".profile-row.few")).toBeTruthy());
    expect(document.querySelector(".profile-row.few .visually-hidden").textContent).toMatch(/; too few stories to compare\. Opens/);
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

  it("has no story-age note, in the full and the small-sample states (decision 3; the files have no median age, O18)", async () => {
    const noNote = () => {
      expect(document.querySelector(".genre-age, .agebox")).toBeNull();
      expect(document.querySelector(".genres-page").textContent).not.toMatch(/Story age|median ages?/);
      expect(screen.queryByRole("button", { name: /^Compare stories/ })).toBeNull();
    };
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    expect(heading()).toMatch(/clearly set Romance apart/);
    noNote();
    window.location.hash = "#/genres?view=genre&genre=romance&include=long"; // Romance: 15 stories
    await waitFor(() => expect(heading()).toBe("Fewer than 30 stories in Romance match “5,000 words or more”: too few to compare."));
    noNote();
    expect(screen.getByRole("button", { name: "Show all stories" })).toBeTruthy();
  });
});

describe("one scale for every row (concepts P2 and R3)", () => {
  it("puts the dot at 50 × (1 + r), its stem from 50, its number rounded away from 50", () => {
    expect(comparisonBar(-0.48)).toEqual({ times: 26, from: 26, to: 50, end: 26, lower: true });
    expect(comparisonBar(0.4)).toMatchObject({ times: 70, from: 50, to: 70, lower: false });
    expect([comparisonBar(0.25).times, comparisonBar(-0.25).times]).toEqual([63, 37]); // rounded away from 50
    expect(comparisonBar(-0.93).end).toBeCloseTo(3.5);
    expect(comparisonBar(0)).toMatchObject({ times: 50, from: 50, to: 50 });
    expect(comparisonBar(null)).toBeNull(); // not compared: no dot
    expect(noDifferenceZone({ min_r: 0.2 })).toEqual([40, 60]);
  });

  it("never prints a clear difference on the zone's edge: one step outward, 39 or 61 (section 4.2)", () => {
    const zone = [40, 60];
    expect(comparisonBar(-0.2, { flagged: true, zone }).times).toBe(39);
    expect(comparisonBar(0.2, { flagged: true, zone }).times).toBe(61);
    expect(comparisonBar(-0.206, { flagged: true, zone }).times).toBe(39); // the Trends page's build-up of sexual language
    expect(comparisonBar(-0.2, { zone }).times).toBe(40); // not a clear difference: as it rounds
    expect(comparisonBar(-0.25, { flagged: true, zone }).times).toBe(37);
    expect(comparisonBar(-0.2, { flagged: true, zone }).end).toBe(40); // the dot stays where r puts it
  });

  it.skipIf(!real)("prints no clear difference as 40 or 60, in any genre or option of the real data", () => {
    let edges = 0;
    for (const s of real.subsets) {
      const file = realFile(s.id);
      for (let gi = 1; gi < file.genres.length; gi += 1) {
        if (file.n[gi] < real.min_n) continue;
        const genre = real.genres.find((g) => g.id === file.genres[gi]);
        for (const item of genreProfile(real, file, gi).items) {
          if (item.r == null || !item.f || item.kind === "grp") continue;
          const { times } = comparisonBar(item.r, { flagged: true, zone: item.zone });
          expect(item.zone).not.toContain(times);
          expect(profileRowName(item, genre, real.min_n)).toContain(`: ${times} in 100;`);
          if (comparisonBar(item.r).times !== times) edges += 1;
        }
      }
    }
    expect(edges).toBe(264); // r of ±0.20, two decimals on this page
  });

  it("draws the zone of no clear difference with its edges, and the stem and dot, on each row; named groups keep two bars", async () => {
    // a wide screen: the row's own grid
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: 1032, height: 0, top: 0, left: 0, right: 1032, bottom: 0 });
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    const row = document.querySelector(".profile-list .profile-row"); // dialogue share, r −0.32
    expect(row.querySelector(".p2-zone").getAttribute("x")).toBe("40%");
    expect(row.querySelector(".p2-zone").getAttribute("width")).toBe("20%");
    expect([...row.querySelectorAll(".p2-edge")].map((l) => l.getAttribute("x1"))).toEqual(["40%", "60%"]);
    const stem = row.querySelector(".p2-stem");
    expect([stem.getAttribute("x1"), stem.getAttribute("x2")]).toEqual(["34%", "50%"]);
    expect(row.querySelector(".p2-dot").getAttribute("cx")).toBe("34%");
    expect(row.querySelector(".p2-num").textContent).toBe("34");
    // each list's head row: the zone's bracket over the five tick labels (never "in 100", F96), and the columns' heads
    const head = document.querySelector(".profile-list .profile-head");
    expect([...head.querySelectorAll(".tick-label")].map((t) => t.textContent)).toEqual(["0", "25", "50", "75", "100"]);
    expect(head.querySelector(".zone-label").textContent).toBe("40–60: no clear difference");
    expect([...head.querySelectorAll(".profile-n-head")].map((h) => h.textContent)).toEqual(["Romance", "All genres"]);
    // named groups: the genre's 100% bar over all genres'
    const mix = [...document.querySelectorAll(".profile-list")].find((l) => l.querySelector("h3").textContent === "A different mix");
    expect(mix.querySelector(".p2-dot")).toBeNull();
    expect(mix.querySelectorAll(".profile-row .segment").length).toBeGreaterThan(2);
    expect(mix.querySelector(".zone-label, .tick-label")).toBeNull(); // no dot, no bracket or ticks; its heads stay
    expect(mix.querySelectorAll(".profile-n-head")).toHaveLength(2);
  });

  it("puts the five tick labels under a phone's rows, and the bracket over them", async () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: 343, height: 0, top: 0, left: 0, right: 343, bottom: 0 });
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    const block = document.querySelector(".profile-list .profile-block");
    expect([...block.querySelectorAll(".profile-ticks .tick-label")].map((t) => t.textContent)).toEqual(["0", "25", "50", "75", "100"]);
    expect(block.querySelectorAll(".profile-ticks line")).toHaveLength(5); // 4 px tick marks
    expect(block.firstElementChild.classList.contains("profile-bracket")).toBe(true);
    expect(block.lastElementChild.classList.contains("profile-ticks")).toBe(true);
    expect(block.querySelector(".profile-head")).toBeNull(); // a list's heads are on its title line
  });

  it("says “Too few stories to compare” where a row has no r, with no dot", async () => {
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) => {
      const res = await serve(url);
      if (!String(url).includes("genres/")) return res;
      const body = await res.json();
      body.c.dlg_word_share.q[2][0] = 24; // Romance: 24 stories with it
      body.c.dlg_word_share.r[2] = null;
      body.c.dlg_word_share.f[2] = 0;
      return { ok: true, status: 200, json: async () => body };
    });
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all");
    await user.click(document.querySelector(".profile-topic:nth-of-type(2) summary") || document.querySelectorAll(".profile-topic summary")[1]);
    const row = await waitFor(() => {
      const r = [...document.querySelectorAll(".profile-topic .profile-row")].find((x) => x.querySelector(".profile-label-text").textContent === "Dialogue share");
      expect(r).toBeTruthy();
      return r;
    });
    expect(row.querySelector(".profile-few").textContent).toBe("Too few stories to compare");
    expect(row.querySelector("svg")).toBeNull();
    expect(row.classList.contains("few")).toBe(true);
  });

  it("names every row by what is on screen first (F76, F92)", async () => {
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    for (const row of document.querySelectorAll(".profile-row")) {
      const label = row.querySelector(".profile-label-text").textContent;
      // (a named group's name says its unit after the label: "Narrative perspective, % of stories: …")
      const name = screen.getByRole("link", { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(, % of stories)?: \\S`) });
      expect(name).toBe(row.querySelector(".profile-link"));
    }
  });

  it("ends with its topics: Copy link is gone from the site (the trends review, O2)", async () => {
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    expect(screen.queryByRole("button", { name: /Copy link/ })).toBeNull();
    const answer = document.querySelector(".genres-page article.chart-panel");
    expect(answer.lastElementChild.className).toBe("profile-topics");
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
    // where a thing starts is "Later", not "Higher" (round 4's W1): its own line, after Higher's
    expect(profileAnnouncement(real, file, { genre: "adult-romance", sub: "all" })).toBe(
      "28 characteristics clearly set Romance apart from all genres. Lower: sexual language, sentences with sexual " +
        "language, anatomical terms. Higher: romance language, everyday vocabulary, affection & love. Later: where the " +
        "first sex scene starts, words before first explicit term.",
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

  it.skipIf(!real)("skips story age in the takeaway when publication year is shown (F78)", () => {
    const file = realFile();
    const chain = genreProfile(real, file, file.genres.indexOf("chain-stories"));
    expect(chain.lower[0].id).toBe("pub_year");
    expect(chain.higher[0].id).toBe("age_years");
    expect(profileTakeaway(chain).map(takeawayLine)).toEqual([
      "Lower: publication year, sexual language, sexual language in the last fifth.",
      "Higher: italics, author’s story count, vocabulary variety (moving average).", // the next one is taken
      "Later: where the first sex scene starts, words before first explicit term.",
      "A different mix: narrative perspective.",
    ]);
    // "5,000 words or more": Fetish's only lower item is story age, so that line goes
    const long = realFile("long");
    const fetish = genreProfile(real, long, long.genres.indexOf("fetish-stories"));
    expect(fetish.lower.map((x) => x.id)).toEqual(["age_years"]);
    expect(profileTakeaway(fetish).map(takeawayLine)).toEqual(["Higher: shame & embarrassment, number of tags, publication year."]);
  });

  it.skipIf(!real)("writes the columns as the copy does (F85, decision 6)", () => {
    const file = realFile();
    const romance = { name: "Romance" };
    const p = genreProfile(real, file, file.genres.indexOf("adult-romance"));
    const item = (id) => p.items.find((x) => x.id === id);
    // the medians, each trimmed of trailing zeros on its own; the unit once, under the label
    expect(profileColumns(item("sex_terms_per_1k"))).toEqual({ genre: ["7.8"], all: ["19.3"], unit: "per 1,000 words" });
    expect(profileColumns(item("emo_affection_per_1k"))).toEqual({ genre: ["1.72"], all: ["1.05"], unit: "per 1,000 words" });
    // mostly zero: the shares with any
    expect(profileColumns(item("rel_romance_per_1k"))).toEqual({ genre: ["73%"], all: ["43%"], unit: "stories with any" });
    expect(profileColumns(item("sex_sentence_share"))).toEqual({ genre: ["9%"], all: ["20%"], unit: "" });
    const howTo = genreProfile(real, file, file.genres.indexOf("adult-how-to"));
    const howToItem = (id) => howTo.items.find((x) => x.id === id);
    expect(profileColumns(howToItem("pov_class"))).toEqual({ genre: ["55%"], all: ["2%"], unit: "Second person (you)", group: 2, of: "% of stories" });
    // How To's repeated five-word phrases: lower in its share with any, higher among those with any, marked higher
    expect(howToItem("rep_repeated_5gram_per_1k").f).toBe(1);
    expect(profileColumns(howToItem("rep_repeated_5gram_per_1k"))).toEqual({
      genre: ["76%", "2.57"],
      all: ["83%", "1.19"],
      unit: "with any\u00a0·\u00a0median among those, per 1,000 words",
    });
    expect(profileColumns(howToItem("author_stories_count"))).toMatchObject({ unit: "median" });
    expect(profileRowName(item("sex_terms_per_1k"), romance, 10)).toBe(
      "Sexual language: 26 in 100; Romance 7.8, all genres 19.3 per 1,000 words; clearly less. Opens every genre’s numbers.",
    );
    expect(profileRowName(item("rel_romance_per_1k"), romance, 10)).toBe(
      "Romance language: 70 in 100; Romance 73% with any, all genres 43%; clearly more. Opens every genre’s numbers.",
    );
    expect(profileRowName(howToItem("rep_repeated_5gram_per_1k"), { name: "How To" }, 10)).toBe(
      "Repeated five-word phrases: 61 in 100; How To 76% with any, all genres 83%; among those, median 2.57 and 1.19 per " +
        "1,000 words; clearly higher. Opens every genre’s numbers.",
    );
  });
});
