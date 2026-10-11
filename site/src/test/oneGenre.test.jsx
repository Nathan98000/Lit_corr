// "One genre" (View 2) after its review (docs/stage2/ONE_GENRE_REVIEW.md, STAGE2_ONE_GENRE_IMPLEMENTATION_PROMPT.md):
// the row (concept R3: one grid, a stem and a dot, two number columns, the unit line, the row's name).
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { plotWidth } from "../components/GenreProfile.jsx";
import { clearCache } from "../lib/data.js";
import {
  genreProfile,
  noDifferenceZone,
  numberFormat,
  numberPlace,
  profileColumns,
  profileHeads,
  profileRowName,
  profileUnit,
  trimZeros,
} from "../lib/genres.js";
import { fixtureFetch, fixtureFile, fixtureMeta, realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const real = realMeta();
const realFile = (sub = "all") =>
  JSON.parse(readFileSync(path.join(here, "..", "..", "public", "aggregates", "genres", `${sub}.json`), "utf8"));
const css = readFileSync(path.join(here, "..", "genres.css"), "utf8");

/**
 * The test data with Romance standing out on purpose: less dialogue (r −0.32, a number), more anger (+0.24, mostly
 * zero), more often with dialogue (+0.21, yes/no) and a different mix of perspectives (0.27); Fetish stands out on
 * nothing, its rows inside the zone.
 */
function standOuts(body) {
  const set = (id, r, f) => Object.assign(body.c[id], { r, f });
  set("dlg_word_share", [null, 0.05, -0.32, null], [0, 0, -1, 0]);
  set("emo_anger_per_1k", [null, 0.02, 0.24, null], [0, 0, 1, 0]);
  set("dlg_has_dialogue", [null, -0.01, 0.21, null], [0, 0, 1, 0]);
  set("pov_class", [null, 0.03, 0.27, null], [0, 0, 1, 0]);
  return body;
}

function profileFetch() {
  const serve = fixtureFetch();
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
  window.history.replaceState(null, "", `/${hash}`);
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

  it("gives the medians of a number, trimmed, with the unit for the line under the label", () => {
    const item = itemOf({ g: { n: 300, median: 1.72 }, a: { n: 9000, median: 10 } });
    item.nf = { ...item.nf, value: (v) => v.toFixed(3) }; // a chart with three decimals: "1.720", "10.000"
    expect(profileColumns(item)).toEqual({ genre: ["1.72"], all: ["10"], unit: "per 1,000 words" });
  });

  it("gives yes/no shares with no unit line, and mostly-zero shares with any", () => {
    const yes = itemOf({ kind: "bin", unit: "yes/no", g: { n: 300, share: 0.24 }, a: { n: 9000, share: 0.27 } });
    expect(profileColumns(yes)).toEqual({ genre: ["24%"], all: ["27%"], unit: "" });
    const zero = itemOf({ kind: "zero", g: { n: 300, share: 0.73, median: 0.709 }, a: { n: 9000, share: 0.43, median: 0.422 }, r: 0.4, f: 1 });
    expect(profileColumns(zero)).toEqual({ genre: ["73%"], all: ["43%"], unit: "stories with any" });
  });

  it("adds the medians among those with any only for a stand-out whose share goes the other way from its dot", () => {
    const other = { kind: "zero", g: { n: 300, share: 0.76, median: 2.57 }, a: { n: 9000, share: 0.83, median: 1.19 }, r: 0.21, f: 1 };
    expect(profileColumns(itemOf(other))).toEqual({
      genre: ["76%", "2.57"],
      all: ["83%", "1.19"],
      unit: "with any · median among those, per 1,000 words",
    });
    // not a stand-out: the shares alone, whichever way they go
    expect(profileColumns(itemOf({ ...other, f: 0 })).genre).toEqual(["76%"]);
    // no median for the genre: "–"
    expect(profileColumns(itemOf({ ...other, g: { n: 300, share: 0.76 } })).genre).toEqual(["76%", "–"]);
    // a share unit: no unit after "median among those"
    expect(profileColumns(itemOf({ ...other, unit: "share (0–1)", fmt: "percent" })).unit).toBe("with any · median among those");
  });

  it("gives bands their median band, and named groups the shares of the group that differs most, under its name", () => {
    const labels = ["1 story", "2–5", "6–20", "21–50"];
    const band = itemOf({ kind: "band", unit: "stories", labels, g: { n: 300, shares: [0.1, 0.2, 0.4, 0.3] }, a: { n: 9000, shares: [0.3, 0.4, 0.2, 0.1] } });
    expect(profileColumns(band)).toEqual({ genre: ["6–20"], all: ["2–5"], unit: "median" });
    const groups = ["First person (I)", "Second person (you)", "Third person"];
    const grp = itemOf({ kind: "grp", unit: "first / second / third", labels: groups, g: { n: 300, shares: [0.31, 0.55, 0.14] }, a: { n: 9000, shares: [0.55, 0.02, 0.43] } });
    expect(profileColumns(grp)).toEqual({ genre: ["55%"], all: ["2%"], unit: "Second person (you)" });
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
    expect(css).toMatch(/--quiet-mark: #857f75;/);
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
      const chev = row.lastElementChild;
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
      expect(row.hasAttribute("aria-label")).toBe(false);
      const label = row.querySelector(".profile-label-text").textContent;
      const name = profileRowName(p.items.find((x) => x.variable.label === label), romance, meta.min_n);
      expect(screen.getAllByRole("link", { name }).includes(row)).toBe(true);
      expect(name.startsWith(`${label}:`)).toBe(true);
      // the unit line, the cells and "›" are hidden from the name; the dot's number and the cells' numbers are in it
      for (const el of row.querySelectorAll(".profile-unit, .profile-n, .profile-chev, .profile-plot-cell, .profile-mark")) {
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
      "Narrative perspective: Romance First person 30%, Third person 70%; all genres First person 60%, Third person 40%; a clearly different mix. Opens every genre’s numbers.",
    );
  });

  it("put a comma before a scale's text that starts with a number", () => {
    const item = itemOf({ label: "Emotional tone", unit: "−1 (all negative) to +1 (all positive)", g: { n: 300, median: 0.5 }, a: { n: 9000, median: 0.468 }, r: 0.06, f: 0 });
    item.nf = { ...item.nf, value: (v) => String(v) };
    expect(profileRowName(item, romance, 10)).toBe(
      "Emotional tone: 53 in 100; Romance 0.5, all genres 0.468, −1 (all negative) to +1 (all positive); no clear difference. Opens every genre’s numbers.",
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
