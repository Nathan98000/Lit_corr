// "One genre" (View 2) after its review (docs/stage2/ONE_GENRE_REVIEW.md, STAGE2_ONE_GENRE_IMPLEMENTATION_PROMPT.md):
// the row (concept R3: one grid, a stem and a dot, two number columns, the unit line, the row's name); the top of the
// answer (S1: the sample line, the takeaway in two directions, the key folded into the first list); the topics (T1);
// the way back from every genre's numbers (history.state).
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { plotWidth, profileAnnouncement } from "../components/GenreProfile.jsx";
import { clearCache } from "../lib/data.js";
import { mixColors } from "../lib/genreLayout.js";
import {
  genreProfile,
  noDifferenceZone,
  numberFormat,
  numberPlace,
  profileColumns,
  profileHeads,
  profileRowName,
  profileTakeaway,
  profileUnit,
  sharePair,
  takeawayLine,
  topicCount,
  trimZeros,
} from "../lib/genres.js";
import { fewStoriesFetch, fixtureFetch, fixtureFile, fixtureMeta, realMeta } from "./fixtures.js";
import { rowName } from "./rows.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const real = realMeta();
const realFile = (sub = "all") =>
  JSON.parse(readFileSync(path.join(here, "..", "..", "public", "aggregates", "genres", `${sub}.json`), "utf8"));
const css = readFileSync(path.join(here, "..", "comparison.css"), "utf8"); // "One genre"'s styles, shared with the Trends page
const styles = readFileSync(path.join(here, "..", "styles.css"), "utf8"); // the site's tokens (:root)
/** A fetch() that serves the site's real aggregates. */
const realFetch = async (url) => {
  const body = readFileSync(path.join(here, "..", "..", "public", "aggregates", String(url).split("aggregates/")[1]), "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};

/**
 * The test data with Romance standing out on purpose: less dialogue (r −0.32, a number), more anger (+0.24, mostly
 * zero), more often with dialogue (+0.21, yes/no) and a different mix of perspectives (0.27); Fetish stands out on
 * nothing, its rows inside the zone.
 */
function standOuts(body) {
  if (body.n[2] < body.rule.min_n) return body; // Romance with too few stories in the option: nothing compared, as built
  const set = (id, r, f) => Object.assign(body.c[id], { r, f });
  set("dlg_word_share", [null, 0.05, -0.32, null], [0, 0, -1, 0]);
  set("emo_anger_per_1k", [null, 0.02, 0.24, null], [0, 0, 1, 0]);
  set("dlg_has_dialogue", [null, -0.01, 0.21, null], [0, 0, 1, 0]);
  set("pov_class", [null, 0.03, 0.27, null], [0, 0, 1, 0]);
  return body;
}

// Romance with 15 stories published 2000–2009 (the small-sample state, F60), as it had 15 of 5,000 words or more
// before the Genres page dropped its Length options (the owner, 2026-10-20)
function profileFetch() {
  const serve = fewStoriesFetch("y2000", "romance", 15);
  return async (url) => {
    const res = await serve(url);
    if (!String(url).includes("genres/")) return res;
    const body = standOuts(await res.json());
    return { ok: true, status: 200, json: async () => body };
  };
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

/** Opens a View 2 address, with the chart `width` px wide (720 by default: stacked). */
async function openGenre(hash, width = 720) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width, height: 0, top: 0, left: 0, right: width, bottom: 0 });
  window.history.replaceState(window.history.state, "", `/${hash}`); // the entry's state stays (the way back)
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
  return user;
}

const openAllTopics = async (user) => {
  for (const s of document.querySelectorAll(".profile-topic summary")) await user.click(s);
};

/** An item as genreProfile() gives it, from a few fields. */
function itemOf({ kind = "num", label = "Sexual language", unit = "per 1,000 words", fmt, g, a, r = -0.48, f = -1, labels, more, less }) {
  const variable = { id: "x", label, unit, bins: { type: kind === "num" || kind === "zero" ? "ranges" : "levels", labels }, more_word: more, less_word: less };
  const entry = { k: kind, fmt, q: [[300, 1, 2, 19.3, 30, 40]], z: [[9000, 0.43, 0.1, 0.42, 1.2]] };
  return { id: "x", variable, entry, kind, nf: numberFormat(variable, entry), stats: g, all: a, r, f };
}

describe("the columns (profileColumns, F85, decision 6)", () => {
  it("drops trailing zeros, each number on its own, never inside a whole number", () => {
    expect(["1.720", "10.0", "0.780", "4,390", "2.0%", "0.05", "−0.30", "<0.1%", "13.50"].map(trimZeros)).toEqual([
      "1.72",
      "10",
      "0.78",
      "4,390",
      "2%",
      "0.05",
      "−0.3",
      "<0.1%",
      "13.5",
    ]);
  });

  it("gives the medians of a number with the same decimals (round 4's W1), with the unit for the line under the label", () => {
    const item = itemOf({ g: { n: 300, median: 1.72 }, a: { n: 9000, median: 10 } });
    item.nf = { ...item.nf, value: (v) => v.toFixed(3) }; // a chart with three decimals: "1.720", "10.000"
    // three significant digits for the larger, "10.0", and the smaller with that decimal, "1.7"
    expect(profileColumns(item)).toEqual({ genre: ["1.7"], all: ["10.0"], unit: "per 1,000 words" });
  });

  it("gives yes/no shares with no unit line, and mostly-zero shares with any", () => {
    const yes = itemOf({ kind: "bin", unit: "yes/no", g: { n: 300, share: 0.24 }, a: { n: 9000, share: 0.27 } });
    expect(profileColumns(yes)).toEqual({ genre: ["24%"], all: ["27%"], unit: "" });
    const zero = itemOf({ kind: "zero", g: { n: 300, share: 0.73, median: 0.709 }, a: { n: 9000, share: 0.43, median: 0.422 }, r: 0.4, f: 1 });
    expect(profileColumns(zero)).toEqual({ genre: ["73%"], all: ["43%"], unit: "stories with any" });
  });

  it("gives two shares that would print the same one decimal each, when they differ (section 4.2)", () => {
    expect(sharePair(0.184, 0.182)).toEqual(["18.4%", "18.2%"]);
    expect(sharePair(0.18, 0.18)).toEqual(["18%", "18%"]); // the same share
    expect(sharePair(0.24, 0.27)).toEqual(["24%", "27%"]);
    expect(sharePair(0.0004, 0.0003)).toEqual(["<0.1%", "<0.1%"]);
    const yes = itemOf({ kind: "bin", unit: "yes/no", g: { n: 300, share: 0.099 }, a: { n: 9000, share: 0.097 } });
    expect(profileColumns(yes)).toEqual({ genre: ["9.9%"], all: ["9.7%"], unit: "" });
    const zero = itemOf({ kind: "zero", g: { n: 300, share: 0.707, median: 0.7 }, a: { n: 9000, share: 0.714, median: 0.7 }, r: 0.02, f: 0 });
    expect(profileColumns(zero).genre).toEqual(["70.7%"]);
    const groups = itemOf({ kind: "grp", labels: ["A", "B"], g: { n: 300, shares: [0.502, 0.498] }, a: { n: 9000, shares: [0.498, 0.502] }, r: 0.1, f: 0 });
    expect([profileColumns(groups).genre, profileColumns(groups).all]).toEqual([["50.2%"], ["49.8%"]]);
  });

  it("adds the medians among those with any only for a stand-out whose share goes the other way from its dot", () => {
    const other = { kind: "zero", g: { n: 300, share: 0.76, median: 2.57 }, a: { n: 9000, share: 0.83, median: 1.19 }, r: 0.21, f: 1 };
    expect(profileColumns(itemOf(other))).toEqual({
      genre: ["76%", "2.57"],
      all: ["83%", "1.19"],
      unit: "with any\u00a0·\u00a0median among those, per 1,000 words",
    });
    // not a stand-out: the shares alone, whichever way they go
    expect(profileColumns(itemOf({ ...other, f: 0 })).genre).toEqual(["76%"]);
    // no median for the genre: "–"
    expect(profileColumns(itemOf({ ...other, g: { n: 300, share: 0.76 } })).genre).toEqual(["76%", "–"]);
    // a share unit: no unit after "median among those"
    expect(profileColumns(itemOf({ ...other, unit: "share (0–1)", fmt: "percent" })).unit).toBe("with any\u00a0·\u00a0median among those");
  });

  it("gives bands their median band, and named groups the shares of the group that differs most, under its name", () => {
    const labels = ["1 story", "2–5", "6–20", "21–50"];
    const band = itemOf({ kind: "band", unit: "stories", labels, g: { n: 300, shares: [0.1, 0.2, 0.4, 0.3] }, a: { n: 9000, shares: [0.3, 0.4, 0.2, 0.1] } });
    expect(profileColumns(band)).toEqual({ genre: ["6–20"], all: ["2–5"], unit: "median" });
    const groups = ["First person (I)", "Second person (you)", "Third person"];
    const grp = itemOf({ kind: "grp", unit: "first / second / third", labels: groups, g: { n: 300, shares: [0.31, 0.55, 0.14] }, a: { n: 9000, shares: [0.55, 0.02, 0.43] } });
    expect(profileColumns(grp)).toEqual({ genre: ["55%"], all: ["2%"], unit: "Second person (you)", group: 1, of: "% of stories" });
  });

  it("leaves a genre without its numbers (fewer than 10 stories with the characteristic) empty", () => {
    expect(profileColumns(itemOf({ g: null, a: { n: 9000, median: 4100 }, r: null, f: 0 }))).toMatchObject({ genre: null });
  });
});

describe("the unit line (profileUnit, decision 7)", () => {
  const unitOf = (label, unit, fmt = "num") => profileUnit(itemOf({ label, unit, fmt }));

  it("is the plain unit, or the data's own text where it explains a scale", () => {
    expect(unitOf("Sexual language", "per 1,000 words")).toBe("per 1,000 words");
    expect(unitOf("Word count", "words")).toBe("words");
    expect(unitOf("Everyday vocabulary", "Zipf scale (higher = more common)")).toBe("Zipf scale (higher = more common)");
    expect(unitOf("Dialogue/narration alternation", "ratio (1 = random order)")).toBe("ratio (1 = random order)");
    expect(unitOf("Reading difficulty (grade)", "US school grade")).toBe("US school grade");
  });

  it("says where in the story for a position", () => {
    expect(unitOf("Where the first sex scene starts", "position (0 = start, 1 = end)", "percent")).toBe("of the way through the story");
  });

  it("is left out when the label names it", () => {
    expect(unitOf("Sex scenes per 10,000 words", "per 10,000 words")).toBe("");
    expect(unitOf("Years online", "years")).toBe("");
    expect(unitOf("Publication year", "year", "year")).toBe("");
    expect(unitOf("Part number", "part")).toBe("");
  });

  it("is never a share, yes/no, “1 =”, a list of groups, or the month and weekday units", () => {
    expect(unitOf("Dialogue share", "share (0–1)", "percent")).toBe("");
    expect(unitOf("Has dialogue", "yes/no")).toBe("");
    expect(unitOf("First-person narration", "1 = first, 0 = third")).toBe("");
    expect(unitOf("Narration tense", "present / past / mixed / unknown")).toBe("");
    expect(unitOf("Publication month", "month (1–12)")).toBe("");
    expect(unitOf("Publication weekday", "0 = Monday … 6 = Sunday")).toBe("");
  });

  it.skipIf(!real)("follows the rule for every characteristic of the real data", () => {
    const file = realFile();
    const p = genreProfile(real, file, file.genres.indexOf("adult-romance"));
    const units = new Map(p.items.filter((x) => x.kind === "num").map((x) => [x.variable.label, profileUnit(x)]));
    expect(units.get("Sexual language")).toBe("per 1,000 words");
    expect(units.get("Name mentions per 1,000 words")).toBe("");
    expect(units.get("Where the first sex scene starts")).toBe("of the way through the story");
    expect(units.get("Dialogue share")).toBe("");
    for (const [label, unit] of units) if (unit) expect(label.toLowerCase(), label).not.toContain(unit.toLowerCase());
  });
});

describe("the number by the dot (numberPlace, F83)", () => {
  const zone = [40, 60];
  const at = (r, plotW = 339, dotR = 5, textW = 18) => numberPlace(r, zone, { plotW, dotR, textW });

  it("sits beside the dot on the side away from 50, 8 px from the dot's edge", () => {
    expect(at(-0.48)).toEqual({ x: 26, dx: -13, anchor: "end" });
    expect(at(0.4)).toEqual({ x: 70, dx: 13, anchor: "start" });
    expect(at(-0.48, 339, 3.5)).toEqual({ x: 26, dx: -11.5, anchor: "end" }); // a gray dot is smaller
    expect(at(-0.2)).toEqual({ x: 40, dx: -13, anchor: "end" }); // on the zone's edge: beside the dot
  });

  it("goes just outside the zone's edge on the dot's side when the dot is inside the zone", () => {
    expect(at(-0.1)).toEqual({ x: 40, dx: -8, anchor: "end" });
    expect(at(0.16)).toEqual({ x: 60, dx: 8, anchor: "start" });
    expect(at(0)).toEqual({ x: 60, dx: 8, anchor: "start" }); // at 50: on the higher side
  });

  it("goes on the dot's inner side near the scale's ends, rather than pass the plot's edge", () => {
    // 4 in 100 on a 284 px plot: the dot at 11 px, so 5 + 8 + 18 px to its left would leave the plot
    const near = (p, x) => [Math.round(p.x * 1e6) / 1e6, p.dx, p.anchor, x];
    expect(near(at(-0.92, 284), 4)).toEqual([4, 13, "start", 4]);
    expect(near(at(0.92, 284), 96)).toEqual([96, -13, "end", 96]);
    expect(near(at(-0.8, 564), 10)).toEqual([10, -13, "end", 10]); // 56 px of room on a wide plot
  });

  it("never sits on a line: every placement on the real data keeps its glyphs off the zone's edges and the 50 line", () => {
    if (!real) return;
    const file = realFile();
    for (let gi = 1; gi < file.genres.length; gi += 1) {
      if (file.n[gi] < file.rule.min_n) continue;
      for (const item of genreProfile(real, file, gi).items) {
        if (item.r == null || item.kind === "grp") continue;
        for (const plotW of [284, 339, 564, 716]) {
          const dotR = item.f ? 5 : 3.5;
          const textW = 20;
          const p = numberPlace(item.r, noDifferenceZone(file.rule), { plotW, dotR, textW });
          const x0 = (p.x / 100) * plotW + p.dx;
          const [lo, hi] = p.anchor === "end" ? [x0 - textW, x0] : [x0, x0 + textW];
          for (const line of [40, 50, 60].map((v) => (v / 100) * plotW)) expect(line > lo && line < hi).toBe(false);
          expect(lo).toBeGreaterThanOrEqual(-2);
          expect(hi).toBeLessThanOrEqual(plotW + 2);
        }
      }
    }
  });
});

describe("the rows (concept R3)", () => {
  it("draw a stand-out's 10 px dot in the accent, a quiet row's 7 px gray dot, and their numbers", async () => {
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    const out = document.querySelector(".profile-list .profile-row");
    expect(out.querySelector(".p2-dot").getAttribute("r")).toBe("5");
    expect(out.querySelector(".p2-dot.quiet, .p2-stem.quiet, .p2-num.quiet")).toBeNull();
    cleanup();
    const user = await openGenre("#/genres?view=genre&genre=fetish&include=all"); // nothing stands out
    await openAllTopics(user);
    const quiet = [...document.querySelectorAll(".profile-topic .profile-row")].find((r) => r.querySelector(".p2-dot.quiet"));
    expect(quiet.querySelector(".p2-dot.quiet").getAttribute("r")).toBe("3.5");
    expect(quiet.querySelector(".p2-num").classList.contains("quiet")).toBe(true);
    // the one gray for marks and controls (round 4's X1): --control, #857f75
    expect(css).toMatch(/--quiet-mark: var\(--control\);/);
    expect(styles).toMatch(/--control: #857f75;/);
    expect(css).toMatch(/\.p2-dot\.quiet \{\s*fill: var\(--quiet-mark\);/);
    expect(css).toMatch(/\.p2-num \{[^}]*paint-order: stroke;[^}]*stroke: var\(--bg\);[^}]*stroke-width: 4px;[^}]*stroke-linejoin: round;/);
  });

  it("put a quiet dot's number outside the zone (Fetish's rows are all inside it)", async () => {
    const user = await openGenre("#/genres?view=genre&genre=fetish&include=all");
    await openAllTopics(user);
    const nums = [...document.querySelectorAll(".profile-topic .p2-num")];
    expect(nums.length).toBeGreaterThan(0);
    for (const t of nums) expect(["40%", "60%"]).toContain(t.getAttribute("x"));
  });

  it("are one grid: the same columns in every list and open topic, with no width per list (F81)", async () => {
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all", 1032);
    await openAllTopics(user);
    const blocks = [...document.querySelectorAll(".profile-block")];
    expect(blocks.length).toBeGreaterThan(3);
    for (const el of document.querySelectorAll(".genre-profile [style]")) expect(el.getAttribute("style")).not.toMatch(/--values-w/);
    expect(css).not.toMatch(/--values-w|wrap-words/);
    expect(css).toMatch(/\.profile-row,\n\.profile-head \{\s*display: grid;\s*grid-template-columns: 250px minmax\(0, 1fr\) 76px 76px 14px;\s*column-gap: 12px;/);
    expect(css).toMatch(/\.genre-profile\.stacked \.profile-row \{\s*grid-template-columns: minmax\(0, 1fr\) 58px 58px 12px;/);
    // the plot's width the numbers are placed by, held from the approved mock-up
    expect([plotWidth(288, true), plotWidth(343, true), plotWidth(720, true), plotWidth(1032, false)]).toEqual([284, 339, 716, 564]);
    // a topic's mix line starts where its row's bars do: wide, after the label's 250 px, the gap and the plot's 2 px
    expect(css).toMatch(/\.profile-mix-line\.over-row \{\s*padding-left: 264px;\s*\}\s*\.genre-profile\.stacked \.profile-mix-line\.over-row \{\s*padding-left: 0;/);
  });

  it("stack under a chart of 900 px", async () => {
    await openGenre("#/genres?view=genre&genre=romance&include=all", 899);
    expect(document.querySelector(".genre-profile").classList.contains("stacked")).toBe(true);
    cleanup();
    vi.restoreAllMocks();
    await openGenre("#/genres?view=genre&genre=romance&include=all", 900);
    expect(document.querySelector(".genre-profile.stacked")).toBeNull();
  });

  it("end with “›”, hidden from their names, in lists and topics (F87)", async () => {
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all");
    await openAllTopics(user);
    const rows = [...document.querySelectorAll(".profile-row")];
    for (const row of rows) {
      // the last cell, before the definition the "?" opens (round 4's I16)
      const chev = [...row.children].filter((el) => !el.classList.contains("profile-def")).pop();
      expect(chev.textContent).toBe("›");
      expect(chev.getAttribute("aria-hidden")).toBe("true");
    }
    expect(rows.some((r) => r.closest(".profile-topic"))).toBe(true);
  });

  it("are named by their own content: the label first, then every visible number in reading order (F92)", async () => {
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all");
    await openAllTopics(user);
    const meta = fixtureMeta;
    const file = standOuts(fixtureFile("genres/all.json"));
    const p = genreProfile(meta, file, file.genres.indexOf("romance"));
    const romance = meta.genres.find((g) => g.id === "romance");
    const rows = [...document.querySelectorAll(".profile-row")];
    for (const row of rows) {
      const link = row.querySelector(".profile-link"); // the name, stretched over the row (round 4's I16)
      expect(link.hasAttribute("aria-label")).toBe(false);
      const label = rowName(row);
      const name = profileRowName(p.items.find((x) => x.variable.label === label), romance, meta.min_n);
      expect(screen.getAllByRole("link", { name }).includes(link)).toBe(true);
      expect(name.startsWith(`${label}:`) || name.startsWith(`${label}, % of stories:`)).toBe(true); // named groups say their unit
      // the name is one visually hidden line; what the row shows (the label, the unit line, the cells and "›") is hidden
      // from screen readers, and its words are all in the name: the dot's number and the cells' numbers in reading order
      expect(link.querySelector(".visually-hidden").textContent).toBe(name);
      for (const el of row.querySelectorAll(".profile-label-text, .profile-unit, .profile-n, .profile-chev, .profile-plot-cell, .profile-mark")) {
        expect(el.getAttribute("aria-hidden")).toBe("true");
      }
      let from = 0;
      const shown = [row.querySelector(".p2-num")?.textContent, ...[...row.querySelectorAll(".profile-n")].map((n) => n.firstChild.textContent)];
      for (const v of shown.filter((t) => t && t !== "–")) {
        const i = name.indexOf(v, from);
        expect(i, `${v} in ${name}`).toBeGreaterThan(0);
        from = i + v.length;
      }
    }
  });
});

describe("the row names (profileRowName, F92)", () => {
  const romance = { name: "Romance" };

  it("give the dot's number, the numbers and the unit once, after all genres' (singular after exactly 1)", () => {
    const item = itemOf({ g: { n: 300, median: 7.8 }, a: { n: 9000, median: 19.3 } });
    expect(profileRowName(item, romance, 10)).toBe(
      "Sexual language: 26 in 100; Romance 7.8, all genres 19.3 per 1,000 words; clearly lower. Opens every genre’s numbers.",
    );
    const pages = itemOf({ label: "Length on site", unit: "pages", g: { n: 300, median: 2 }, a: { n: 9000, median: 1 }, r: 0.1, f: 0 });
    pages.nf = numberFormat(pages.variable, { k: "num", q: [[9000, 1, 1, 1, 2, 3]] });
    expect(profileRowName(pages, romance, 10)).toBe("Length on site: 55 in 100; Romance 2, all genres 1 page; no clear difference. Opens every genre’s numbers.");
  });

  it("say “too few stories to compare” without the dot's number, and “fewer than 10 stories” without the numbers", () => {
    const item = itemOf({ label: "Word count", unit: "words", g: { n: 24, median: 3660 }, a: { n: 9000, median: 4100 }, r: null, f: 0 });
    expect(profileRowName(item, { name: "Chain Stories" }, 10)).toBe(
      "Word count: Chain Stories 3,660, all genres 4,100 words; too few stories to compare. Opens every genre’s numbers.",
    );
    const none = itemOf({ label: "Word count", unit: "words", g: null, a: { n: 9000, median: 4100 }, r: null, f: 0 });
    expect(profileRowName(none, { name: "Chain Stories" }, 10)).toBe(
      "Word count: Chain Stories fewer than 10 stories, all genres 4,100 words; too few stories to compare. Opens every genre’s numbers.",
    );
  });

  it("give mostly-zero shares with any, the medians among those where they show, bands' medians and every group's share", () => {
    const zero = itemOf({ kind: "zero", label: "Romance language", g: { n: 300, share: 0.73 }, a: { n: 9000, share: 0.43 }, r: 0.4, f: 1, more: "More", less: "Less" });
    expect(profileRowName(zero, romance, 10)).toBe(
      "Romance language: 70 in 100; Romance 73% with any, all genres 43%; clearly more. Opens every genre’s numbers.",
    );
    const other = itemOf({ kind: "zero", label: "Repeated phrases", g: { n: 300, share: 0.76, median: 2.57 }, a: { n: 9000, share: 0.83, median: 1.19 }, r: 0.21, f: 1 });
    expect(profileRowName(other, { name: "How To" }, 10)).toBe(
      "Repeated phrases: 61 in 100; How To 76% with any, all genres 83%; among those, median 2.57 and 1.19 per 1,000 words; clearly higher. Opens every genre’s numbers.",
    );
    const band = itemOf({ kind: "band", label: "Author’s story count", unit: "stories", labels: ["1 story", "2–5", "6–20"], g: { n: 300, shares: [0.1, 0.2, 0.7] }, a: { n: 9000, shares: [0.3, 0.4, 0.3] }, r: -0.2, f: 0 });
    expect(profileRowName(band, romance, 10)).toBe(
      "Author’s story count: 40 in 100; Romance median 6–20, all genres median 2–5; no clear difference. Opens every genre’s numbers.",
    );
    const grp = itemOf({ kind: "grp", label: "Narrative perspective", unit: "first / third", labels: ["First person", "Third person"], g: { n: 300, shares: [0.3, 0.7] }, a: { n: 9000, shares: [0.6, 0.4] }, r: 0.3, f: 1 });
    expect(profileRowName(grp, romance, 10)).toBe(
      "Narrative perspective, % of stories: Romance First person 30%, Third person 70%; all genres First person 60%, Third person 40%; a clearly different mix. Opens every genre’s numbers.",
    );
  });

  it("put a comma before a scale's text that starts with a number", () => {
    const item = itemOf({ label: "Emotional tone", unit: "−1 (all negative) to +1 (all positive)", g: { n: 300, median: 0.5 }, a: { n: 9000, median: 0.468 }, r: 0.06, f: 0 });
    item.nf = { ...item.nf, value: (v) => String(v) };
    // the same decimals as all genres' "0.468" (round 4's W1)
    expect(profileRowName(item, romance, 10)).toBe(
      "Emotional tone: 53 in 100; Romance 0.500, all genres 0.468, −1 (all negative) to +1 (all positive); no clear difference. Opens every genre’s numbers.",
    );
  });
});

describe("the columns' heads", () => {
  it("are the genre's name in up to two lines (wide) or one (stacked), else “Genre”", () => {
    expect(profileHeads({ name: "Romance" }, false, 76)).toEqual(["Romance", "All genres"]);
    expect(profileHeads({ name: "Romance" }, true, 58)).toEqual(["Romance", "All"]);
    expect(profileHeads({ name: "Letters & Transcripts" }, false, 76)).toEqual(["Letters & Transcripts", "All genres"]);
    expect(profileHeads({ name: "Letters & Transcripts" }, true, 58)[0]).toBe("Genre");
    expect(profileHeads({ name: "Fan Fiction & Celebrities" }, false, 76)[0]).toBe("Genre"); // three lines
    expect(profileHeads({ name: "Taboo/Incest" }, false, 76)[0]).toBe("Taboo/​Incest"); // a line may break after the slash
  });

  it("sit on a stacked list's title line, and in a stacked topic's head row", async () => {
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all");
    const head = document.querySelector(".profile-list .profile-list-head");
    expect([...head.querySelectorAll(".profile-heads > span")].map((s) => s.textContent)).toEqual(["Romance", "All"]);
    await openAllTopics(user);
    const topicHead = document.querySelector(".profile-topic .profile-head");
    expect([...topicHead.querySelectorAll(".profile-n-head")].map((s) => s.textContent)).toEqual(["Romance", "All"]);
    expect(topicHead.getAttribute("aria-hidden")).toBe("true");
  });
});

// ------------------------------------------------------------------------------------------- the top of the answer
/** Serves the test data through `edit(body)` for the genres files (and `editMeta(meta)` for meta.json). */
function serveWith(edit, editMeta = (m) => m) {
  const serve = fixtureFetch();
  vi.stubGlobal("fetch", async (url) => {
    const res = await serve(url);
    if (String(url).endsWith("meta.json")) {
      const meta = editMeta(await res.json());
      return { ok: true, status: 200, json: async () => meta };
    }
    if (!String(url).includes("genres/")) return res;
    const body = edit(standOuts(await res.json()));
    return { ok: true, status: 200, json: async () => body };
  });
}

/** Nine more characteristics like dialogue share, each lower in Romance, so the first list has "Show all 10". */
const nineMore = [
  (body) => {
    for (let i = 0; i < 9; i += 1) body.c[`x${i}`] = { ...body.c.dlg_word_share, r: [null, 0, -0.3 + i / 100, null], f: [0, 0, -1, 0] };
    return body;
  },
  (meta) => {
    const extra = Array.from({ length: 9 }, (_, i) => ({ ...meta.variables[0], id: `x${i}`, label: `Extra ${i}` }));
    meta.variables.push(...extra);
    meta.topics[0].ids.push(...extra.map((v) => v.id));
    return meta;
  },
];

const sample = () => document.querySelector(".profile-sample")?.textContent ?? null;

describe("the sample line (F93)", () => {
  it("says how many stories, and which, under the heading", async () => {
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    expect(sample()).toBe("120 stories in Romance.");
    expect(document.querySelector(".chart-head").lastElementChild.className).toBe("profile-sample");
    cleanup();
    await openGenre("#/genres?view=genre&genre=romance&include=y2020");
    expect(sample()).toBe("41 stories in Romance match “Published 2020 or later”.");
  });

  it("is under the small-sample heading too, and left out under 10 stories", async () => {
    await openGenre("#/genres?view=genre&genre=romance&include=y2000"); // 15 stories
    expect(document.querySelector(".chart-title").textContent).toBe("Fewer than 30 stories in Romance match “Published 2000–2009”: too few to compare.");
    expect(sample()).toBe("15 stories in Romance match “Published 2000–2009”.");
    cleanup();
    await openGenre("#/genres?view=genre&genre=tiny&include=all"); // 8 stories
    expect(sample()).toBeNull();
  });
});

describe("the takeaway (S1, F90)", () => {
  const item = (id, label, f, kind = "num") => ({ id, kind, f, variable: { label } });
  const lines = (p) => profileTakeaway({ lower: [], higher: [], mix: [], ...p }).map((l) => `${l.mark} ${takeawayLine(l)}`);

  it("is a line per list: its first three, in its order, as the list words them", async () => {
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    const box = document.querySelector(".profile-takeaway");
    // higher first, as the lists are (the owner, 2026-10-13)
    expect([...box.querySelectorAll("p")].map((p) => p.textContent)).toEqual([
      "▲ Higher: anger, has dialogue.",
      "▼ Lower: dialogue share.",
      "≠ A different mix: narrative perspective.",
    ]);
    for (const p of box.querySelectorAll("p")) {
      expect(p.firstElementChild.getAttribute("aria-hidden")).toBe("true"); // the mark
      expect(p.querySelector("b").textContent).toMatch(/^(Lower|Higher|A different mix):$/);
    }
    const four = ["Sexual language", "Sentences with sexual language", "I / me / my in narration", "Anatomical terms"].map((l, i) => item(`v${i}`, l, -1));
    expect(lines({ lower: four })).toEqual(["▼ Lower: sexual language, sentences with sexual language, I / me / my in narration."]);
  });

  it("leaves story age out when publication year is shown, and takes the next one; a line left with nothing goes", () => {
    const year = item("pub_year", "Publication year", -1);
    const age = item("age_years", "Years online", 1);
    expect(lines({ lower: [year], higher: [age, item("b", "Anger", 1)] })).toEqual(["▲ Higher: anger.", "▼ Lower: publication year."]);
    expect(lines({ lower: [year], higher: [age] })).toEqual(["▼ Lower: publication year."]);
    // publication year not among the three shown: story age stays
    const three = ["Alpha", "Beta", "Gamma"].map((l, i) => item(`l${i}`, l, -1));
    expect(lines({ lower: [...three, year], higher: [age] })).toEqual(["▲ Higher: years online.", "▼ Lower: alpha, beta, gamma."]);
  });

  it("is left out when nothing stands out, and the sentence about all genres stays", async () => {
    expect(profileTakeaway({ lower: [], higher: [], mix: [] })).toEqual([]);
    await openGenre("#/genres?view=genre&genre=fetish&include=all");
    expect(document.querySelector(".profile-takeaway")).toBeNull();
    expect(document.querySelector(".profile-none").textContent).toMatch(/^Its stories are close to those of all genres/);
  });

  it("is what screen readers hear after the heading, without its marks", () => {
    const file = standOuts(fixtureFile("genres/all.json"));
    expect(profileAnnouncement(fixtureMeta, file, { genre: "romance", sub: "all" })).toBe(
      "4 characteristics clearly set Romance apart from all genres. Higher: anger, has dialogue. Lower: dialogue share. " +
        "A different mix: narrative perspective.",
    );
    expect(profileAnnouncement(fixtureMeta, file, { genre: "fetish", sub: "all" })).toBe("No characteristic clearly sets Fetish apart from all genres.");
  });
});

describe("the key, in the lists (F86)", () => {
  it("is no list of its own: the axis title is over the first list's rows only, from the genre's name", async () => {
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    expect(document.querySelector(".profile-legend, .genre-profile .legend")).toBeNull();
    const titles = [...document.querySelectorAll(".profile-axis-title")];
    expect(titles).toHaveLength(1);
    // what a dot is, "50 is a tie", the link and where a row leads, right over the rows (the owner, 2026-10-19)
    expect(titles[0].textContent).toBe(
      "Each dot shows how often a story in Romance comes out higher than a story from all genres, out\u00a0of\u00a0100 (50\u00a0is\u00a0a\u00a0tie; how\u00a0this\u00a0is\u00a0decided). " +
        "Click a row for every genre’s numbers.",
    );
    const first = document.querySelector(".profile-list");
    expect(first.contains(titles[0])).toBe(true);
    expect(titles[0].nextElementSibling.classList.contains("profile-block")).toBe(true);
  });

  it("goes over the Lower list when there is no Higher list (the Higher list comes first: the owner, 2026-10-13)", async () => {
    serveWith((body) => {
      body.c.emo_anger_per_1k.f = [0, 0, 0, 0];
      body.c.dlg_has_dialogue.f = [0, 0, 0, 0];
      return body;
    });
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    expect(document.querySelector(".profile-list h3").textContent).toBe("Lower in Romance than in all genres");
    const title = document.querySelector(".profile-axis-title");
    expect(title.closest(".profile-list").querySelector("h3").textContent).toBe("Lower in Romance than in all genres");
  });

  it("draws the bracket from the rule's zone, never from literals", async () => {
    serveWith((body) => {
      body.rule.min_r = 0.3;
      return body;
    });
    await openGenre("#/genres?view=genre&genre=romance&include=all", 1032);
    const head = document.querySelector(".profile-list .profile-head");
    expect(head.querySelector(".zone-label").textContent).toBe("35–65: no clear difference");
    expect([...head.querySelectorAll(".zone-bracket")].map((l) => l.getAttribute("x1"))).toEqual(["35%", "35%", "65%"]);
    expect(document.querySelector(".profile-row .p2-zone").getAttribute("x")).toBe("35%");
  });

  it("says where a row leads under what a dot is, right over the first list's rows, as the Trends page does, with its link", async () => {
    // a note above the first list before, too far from its dots (the owner, 2026-10-19)
    serveWith(...nineMore);
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    const [list, lower] = document.querySelectorAll(".profile-list");
    expect(document.querySelector(".profile-note")).toBeNull();
    expect(list.previousElementSibling.classList.contains("profile-takeaway")).toBe(true);
    expect(list.querySelector("h3").textContent).toBe("Higher in Romance than in all genres");
    expect(lower.lastElementChild.textContent).toBe("Show all 10"); // a list ends with its "Show all"
    const caption = list.querySelector(".profile-axis-title");
    expect(caption.querySelector(".profile-hint").textContent).toBe("Click a row for every genre’s numbers.");
    expect(caption.textContent).not.toMatch(/Gray dots/); // the topics' line says it, over the topics
    expect(caption.querySelector("a").getAttribute("href")).toBe("#/methodology/genres");
    expect(caption.querySelector("a").textContent).toBe("how\u00a0this\u00a0is\u00a0decided");
    expect(css).toMatch(/\.profile-axis-title a::after \{[^}]*height: max\(100%, var\(--target\)\);/);
    expect(css).toMatch(/\.profile-hint \{\s*display: block;\s*font-weight: 400;/);
  });

  it("says “Tap” on a device that can't hover", async () => {
    vi.stubGlobal("matchMedia", (q) => ({ matches: q === "(hover: none)", media: q, addEventListener() {}, removeEventListener() {} }));
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    expect(document.querySelector(".profile-hint").textContent).toBe("Tap a row for every genre’s numbers.");
  });

  it("goes with every open topic that has dots when no list is shown, in the same words", async () => {
    const user = await openGenre("#/genres?view=genre&genre=fetish&include=all");
    expect(document.querySelector(".profile-list, .profile-axis-title, .profile-note")).toBeNull();
    await openAllTopics(user);
    const topics = [...document.querySelectorAll(".profile-topic")].filter((t) => t.querySelector(".p2-dot"));
    expect(topics.length).toBeGreaterThan(1);
    for (const t of topics) {
      expect(t.querySelector(".profile-axis-title").textContent).toBe(
        "Each dot shows how often a story in Fetish comes out higher than a story from all genres, out\u00a0of\u00a0100 (50\u00a0is\u00a0a\u00a0tie; how\u00a0this\u00a0is\u00a0decided). " +
          "Click a row for every genre’s numbers.",
      );
      expect(t.querySelector(".profile-note")).toBeNull();
    }
  });

  it("is left out in the small-sample state: no axis title, note or bracket", async () => {
    const user = await openGenre("#/genres?view=genre&genre=romance&include=y2000");
    await openAllTopics(user);
    expect(document.querySelector(".profile-axis-title, .profile-note, .profile-mix-line, .zone-label, .profile-bracket, .profile-ticks")).toBeNull();
    expect(document.querySelectorAll(".profile-topic .profile-row").length).toBeGreaterThan(0);
  });

  it("says which bar is which only where named groups are compared: over the mix list, and over the row in a topic (quick win 5)", async () => {
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all");
    const mix = [...document.querySelectorAll(".profile-list")].find((l) => l.querySelector("h3").textContent === "A different mix");
    expect(mix.querySelector(".profile-mix-line").textContent).toBe("A different mix: Romance above, all genres below");
    expect(mix.querySelector(".profile-mix-line").nextElementSibling.className).toBe("profile-block");
    expect(document.querySelectorAll(".profile-mix-line")).toHaveLength(1);
    await openAllTopics(user);
    const lines = [...document.querySelectorAll(".profile-topic .profile-mix-line")];
    expect(lines.map((p) => p.closest(".profile-topic").querySelector("summary").textContent)).toEqual([expect.stringMatching(/^Narration/)]);
    expect(lines[0].textContent).toBe("Romance above, all genres below");
    expect(lines[0].parentElement.tagName).toBe("LI"); // in the row's list item, right over it
    expect(lines[0].nextElementSibling.querySelector(".segment")).toBeTruthy();
  });

  it.skipIf(!real)("sits right over each of Romance's named-group rows, never at a topic's top (the real data)", { timeout: 15000 }, async () => {
    vi.stubGlobal("fetch", realFetch);
    const user = await openGenre("#/genres?view=genre&genre=adult-romance&include=all");
    expect(document.querySelector(".profile-mix-line")).toBeNull(); // no "A different mix" list
    await openAllTopics(user);
    const lines = [...document.querySelectorAll(".profile-topic .profile-mix-line")];
    const barred = [...document.querySelectorAll(".profile-topic .profile-row")].filter((row) => row.querySelector(".segment"));
    expect(lines.map((p) => p.nextElementSibling)).toEqual(barred);
    expect(barred.map(rowName)).toEqual([
      "Person of the blurb", // the story's description is its blurb on the site (meta.json, the owner's changes)
      "Narrative perspective",
      "Narration tense",
      "Pronoun composition",
    ]);
    for (const p of lines) expect(p.textContent).toBe("Romance above, all genres below");
    // "Pronoun composition" is the last of "Dialogue & characters"' 18 rows
    const dialogue = [...document.querySelectorAll(".profile-topic")].find((t) => t.querySelector("summary").textContent.startsWith("Dialogue"));
    const items = dialogue.querySelectorAll(".profile-rows > li");
    expect(items).toHaveLength(18);
    expect([...items].findIndex((li) => li.querySelector(".profile-mix-line"))).toBe(17);
  });

  it.skipIf(!real)("puts a swatch of the printed group's color before its name, kept with its first word (the real data)", { timeout: 15000 }, async () => {
    vi.stubGlobal("fetch", realFetch);
    const user = await openGenre("#/genres?view=genre&genre=adult-romance&include=all");
    await openAllTopics(user);
    const file = realFile();
    const named = genreProfile(real, file, file.genres.indexOf("adult-romance")).items.filter((x) => x.kind === "grp");
    expect(named).toHaveLength(4);
    const rows = [...document.querySelectorAll(".profile-topic .profile-row")];
    for (const item of named) {
      const row = rows.find((r) => rowName(r) === item.variable.label);
      const { unit, group } = profileColumns(item);
      const cls = mixColors("grp", item.all.shares)[group].cls;
      const swatch = row.querySelector(".profile-unit .profile-swatch");
      expect(swatch.classList.contains(cls)).toBe(true);
      expect(row.querySelectorAll(`.segment.${cls}`)).toHaveLength(2); // its color in both bars
      expect(row.querySelector(".profile-unit").textContent).toBe(unit);
      expect(swatch.parentElement.className).toBe("profile-swatch-lead");
      expect(swatch.parentElement.textContent).toBe(unit.split(" ")[0]);
      expect(row.querySelector(".profile-unit").getAttribute("aria-hidden")).toBe("true"); // the row's name has every share
    }
    expect(document.querySelectorAll(".profile-unit .profile-swatch")).toHaveLength(4); // no other row has one
    expect(css).toMatch(/\.profile-swatch \{[^}]*border: 1px solid var\(--control\);/);
    expect(css).toMatch(/\.profile-swatch-lead \{\s*white-space: nowrap;/);
  });

  it.skipIf(!real)("leaves the swatch and the mix line out where a named group has no bars: too few stories to compare", { timeout: 15000 }, async () => {
    // Chain Stories' stories of 2020 or later made 12 (19 with the 20261013 handoff, 30 with the 20261021 one, which no
    // longer has a genre too few to compare in any option the page offers): nothing compared
    vi.stubGlobal("fetch", fewStoriesFetch("y2020", "chain-stories", 12, realFetch));
    const user = await openGenre("#/genres?view=genre&genre=chain-stories&include=y2020");
    await openAllTopics(user);
    const named = ["Person of the blurb", "Narrative perspective", "Narration tense", "Pronoun composition"];
    const rows = [...document.querySelectorAll(".profile-row")].filter((r) => named.includes(rowName(r)));
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.querySelector(".profile-few").textContent).toBe("Too few stories to compare");
      expect(row.querySelector(".profile-unit").textContent).not.toBe(""); // the printed group's name stays
      expect(row.querySelector(".profile-of").textContent).toBe("% of stories"); // with the numbers
    }
    expect(document.querySelector(".profile-swatch, .profile-mix-line, .profile-key")).toBeNull();
  });

  it.skipIf(!real)("keys every group under a named group's bars, as View 1's legend, and says the shares are of stories (the real data)", { timeout: 15000 }, async () => {
    vi.stubGlobal("fetch", realFetch);
    const user = await openGenre("#/genres?view=genre&genre=adult-romance&include=all");
    await openAllTopics(user);
    const file = realFile();
    const named = genreProfile(real, file, file.genres.indexOf("adult-romance")).items.filter((x) => x.kind === "grp");
    const rows = [...document.querySelectorAll(".profile-topic .profile-row")];
    for (const item of named) {
      const row = rows.find((r) => rowName(r) === item.variable.label);
      const colors = mixColors("grp", item.all.shares);
      // under the bars, in the plot's cell (hidden from screen readers, as the bars are): every group in the bars' order
      const key = row.querySelector(".profile-plot-cell[aria-hidden='true'] .profile-plot + .profile-key");
      const items = [...key.querySelectorAll(".profile-key-item")];
      expect(items.map((x) => x.textContent)).toEqual(item.variable.bins.labels);
      items.forEach((x, b) => expect(x.querySelector(".profile-swatch").classList.contains(colors[b].cls)).toBe(true));
      // "% of stories" on a line of its own under the group's name, and in the row's name
      const of = row.querySelector(".profile-unit + .profile-of");
      expect(of.textContent).toBe("% of stories");
      expect(of.getAttribute("aria-hidden")).toBe("true");
      expect(row.querySelector(".visually-hidden").textContent).toMatch(new RegExp(`^${item.variable.label}, % of stories: Romance `));
    }
    expect(document.querySelectorAll(".profile-key")).toHaveLength(4);
    expect(document.querySelectorAll(".profile-of")).toHaveLength(4); // named groups only
    // every unit is on a line of its own (round 4's W1), on every chart
    expect(css).toMatch(/\.profile-unit \{\s*display: block;/);
    expect(css).not.toMatch(/\.profile-unit[^{]*\{[^}]*display: inline/);
    expect(css).toMatch(/\.profile-key-item \{\s*white-space: nowrap;/);
  });

  it("never says “a Romance story”: always “a story in Romance”", async () => {
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all");
    await openAllTopics(user);
    for (const g of fixtureMeta.genres) expect(document.body.textContent).not.toMatch(new RegExp(`\\b(a|the) ${g.name} stor(y|ies)`));
    const src = readFileSync(path.join(here, "..", "components", "GenreProfile.jsx"), "utf8");
    expect(src).not.toMatch(/a \{genre\.name\} story/);
  });
});

describe("the heading (F94)", () => {
  it("may run to 62ch from a 1,000 px window", () => {
    expect(css).toMatch(/@media \(min-width: 1000px\) \{\s*\.genre-profile \.chart-title \{\s*max-width: 62ch;/);
  });
});

// ------------------------------------------------------------------------------------------------------- the topics
describe("the topics (T1, F84, F89, F92)", () => {
  const counts = () => [...document.querySelectorAll(".profile-topic-count")].map((c) => c.textContent);

  it("say how many stand out of those compared, “0 of …” included, else how many characteristics", async () => {
    expect(topicCount({ count: 1, compared: 28, items: Array(28) })).toEqual({ k: 1, m: 28, text: "1 of 28 stand out" });
    expect(topicCount({ count: 0, compared: 13, items: Array(13) })).toEqual({ k: 0, m: 13, text: "0 of 13 stand out" });
    expect(topicCount({ count: 0, compared: 0, items: Array(13) })).toEqual({ n: 13, text: "13 characteristics" });
    expect(topicCount({ count: 0, compared: 0, items: Array(1) }).text).toBe("1 characteristic");
    await openGenre("#/genres?view=genre&genre=fetish&include=all");
    expect(counts()).toEqual(["0 of 1 stand out", "0 of 2 stand out", "0 of 1 stand out"]);
    cleanup();
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    expect(counts()).toEqual(["1 of 1 stand out", "2 of 2 stand out", "1 of 1 stand out"]);
    expect(document.querySelector(".profile-topic-count b").textContent).toBe("1");
    expect(css).toMatch(/\.profile-topic-count \{[^}]*white-space: nowrap;/);
    expect(css).toMatch(/\.profile-topic-count b \{\s*font-weight: 650;/);
    cleanup();
    await openGenre("#/genres?view=genre&genre=romance&include=y2000"); // nothing compared
    expect(counts()).toEqual(["1 characteristic", "2 characteristics", "1 characteristic"]);
  });

  it("are named by their text, with no heading inside the summary: “Narration, 1 of 1 stand out”", async () => {
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    const summary = document.querySelector(".profile-topic summary");
    expect(document.querySelector(".profile-topic summary h1, .profile-topic summary h2, .profile-topic summary h3, .profile-topic summary h4")).toBeNull();
    expect(summary.querySelector(".visually-hidden").textContent).toBe("Narration, 1 of 1 stand out");
    for (const el of summary.querySelectorAll(".profile-topic-name, .profile-topic-count")) expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(summary.querySelector(".profile-topic-name").textContent).toBe("Narration");
    expect(css).toMatch(/\.profile-topic-name \{\s*font-size: var\(--text-16\);\s*font-weight: 600;/);
    // the lists' titles' size, as the answer's other h3s (round 4's type scale: 23 → 20)
    expect(css).toMatch(/\.profile-topics > h3 \{\s*margin: 0 0 var\(--space-4\);\s*font-size: var\(--serif-20\);/);
  });

  it("have a line under their heading, left out when nothing was compared", async () => {
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    const line = document.querySelector(".profile-topics > h3").nextElementSibling;
    expect(line.textContent).toBe(
      "How many characteristics in each topic stand out. Open a topic to see them all: blue dots stand out, gray dots show no clear difference.",
    );
    cleanup();
    await openGenre("#/genres?view=genre&genre=romance&include=y2000");
    expect(document.querySelector(".profile-topics-line")).toBeNull();
    expect(document.querySelectorAll(".profile-topic").length).toBeGreaterThan(0);
  });

  it("mark only their stand-outs, in a column before the label; the lists' rows have no mark column", async () => {
    serveWith((body) => {
      body.c.dlg_has_dialogue.f = [0, 0, 0, 0]; // a quiet row beside a stand-out in "Dialogue & characters"
      return body;
    });
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all");
    expect(document.querySelector(".profile-list .profile-mark, .profile-list .has-mark")).toBeNull();
    await openAllTopics(user);
    for (const row of document.querySelectorAll(".profile-topic .profile-row")) {
      const mark = row.querySelector(".profile-label.has-mark > .profile-mark");
      const quiet = row.querySelector(".p2-dot.quiet");
      expect(mark.textContent).toEqual(quiet ? "" : expect.stringMatching(/^[▲▼≠]$/));
      expect(mark.getAttribute("aria-hidden")).toBe("true");
    }
    const quiet = [...document.querySelectorAll(".profile-topic .profile-row")].filter((r) => r.querySelector(".p2-dot.quiet"));
    expect(quiet).toHaveLength(1);
  });
});

// ------------------------------------------------------------------------------------------------------ the way back
describe("the way back (F88, quick win 6)", () => {
  const kept = () => window.history.state?.oneGenre;

  it("keeps the open topics and the lists shown in full in the entry's state, and restores them on the same entry", async () => {
    serveWith(...nineMore);
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all");
    await user.click(document.querySelectorAll(".profile-topic summary")[1]);
    await user.click(screen.getByRole("button", { name: "Show all 10" }));
    await waitFor(() => expect(kept()).toMatchObject({ topics: ["dialogue"], all: ["lower"] }));
    expect(window.location.hash).toBe("#/genres?view=genre&genre=romance&include=all"); // the address doesn't change
    cleanup(); // a remount, as after View 1 and Back
    render(<App />);
    // read before the first paint: open as soon as the answer is drawn
    await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
    expect([...document.querySelectorAll(".profile-topic")].map((t) => t.open)).toEqual([false, true, false]);
    expect(screen.getByRole("button", { name: "Show fewer" })).toBeTruthy();
  });

  it("starts with nothing open on a new entry", async () => {
    window.history.replaceState({ oneGenre: { topics: ["dialogue"], all: ["lower"], y: 0 } }, "", "/#/genres?var=dlg_word_share");
    window.history.pushState(null, "", "/#/genres?view=genre&genre=romance&include=all");
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    expect(document.querySelector(".profile-topic[open]")).toBeNull();
  });

  it("keeps them when the genre or the option changes (App's address changes in place keep the entry's state)", async () => {
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all");
    await user.click(document.querySelectorAll(".profile-topic summary")[1]);
    await waitFor(() => expect(kept()).toMatchObject({ topics: ["dialogue"] }));
    await user.selectOptions(screen.getByLabelText("Only include"), "y2020");
    await waitFor(() => expect(window.location.hash).toBe("#/genres?view=genre&genre=romance&include=y2020"));
    await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
    expect(kept()).toMatchObject({ topics: ["dialogue"] });
    expect(document.querySelectorAll(".profile-topic")[1].open).toBe(true);
    await user.selectOptions(screen.getByLabelText("Genre"), "fetish");
    await waitFor(() => expect(window.location.hash).toBe("#/genres?view=genre&genre=fetish&include=y2020"));
    expect(kept()).toMatchObject({ topics: ["dialogue"] });
    const src = readFileSync(path.join(here, "..", "App.jsx"), "utf8");
    expect(src).not.toMatch(/replaceState\(null/);
  });

  it("restores the scroll position when the browser's own restoration was clamped, at once", async () => {
    const scrolls = [];
    vi.stubGlobal("scrollTo", (...args) => scrolls.push(args));
    window.history.replaceState({ oneGenre: { topics: ["dialogue"], all: [], y: 2315 } }, "", "/#/genres?view=genre&genre=romance&include=all");
    vi.spyOn(window, "scrollY", "get").mockReturnValue(1794); // clamped to a shorter page
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    expect(scrolls).toContainEqual([{ top: 2315, behavior: "instant" }]);
    cleanup();
    scrolls.length = 0;
    vi.spyOn(window, "scrollY", "get").mockReturnValue(2315); // restored by the browser: nothing to do
    window.history.replaceState({ oneGenre: { topics: ["dialogue"], all: [], y: 2315 } }, "", "/#/genres?view=genre&genre=romance&include=all");
    await openGenre("#/genres?view=genre&genre=romance&include=all");
    expect(scrolls.filter(([to]) => typeof to === "object")).toEqual([]); // (the page's own scrollTo(0, 0) aside)
  });

  it("keeps the scroll position before a row's link adds the next entry", async () => {
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all");
    vi.spyOn(window, "scrollY", "get").mockReturnValue(640);
    await user.click(document.querySelector(".profile-list .profile-row .profile-link"));
    await waitFor(() => expect(window.location.hash).toBe("#/genres?var=emo_anger_per_1k&include=all")); // the Higher list's first
    expect(window.history.state).toBeNull(); // the new entry starts empty
    window.history.back();
    await waitFor(() => expect(window.location.hash).toBe("#/genres?view=genre&genre=romance&include=all"));
    expect(kept()).toMatchObject({ y: 640 });
  });
});

describe("another genre or option (layout shift)", () => {
  it("draws the takeaway and lists anew, so rows of the last answer don't count as moving; the topics stay", async () => {
    const user = await openGenre("#/genres?view=genre&genre=romance&include=all");
    await user.click(document.querySelectorAll(".profile-topic summary")[1]);
    const [list, takeaway, topics, heading] = [".profile-list", ".profile-takeaway", ".profile-topics", ".chart-title"].map((s) => document.querySelector(s));
    await user.selectOptions(screen.getByLabelText("Only include"), "y2020");
    await waitFor(() => expect(window.location.hash).toBe("#/genres?view=genre&genre=romance&include=y2020"));
    await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
    expect(document.querySelector(".profile-list")).not.toBe(list);
    expect(document.querySelector(".profile-takeaway")).not.toBe(takeaway);
    expect(document.querySelector(".profile-topics")).toBe(topics);
    expect(document.querySelector(".chart-title")).toBe(heading); // focus after "Show all stories" goes here
    expect(document.querySelectorAll(".profile-topic")[1].open).toBe(true);
  });
});
