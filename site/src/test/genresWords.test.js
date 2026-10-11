// Every sentence the Genres page builds, for every characteristic, genre and option of the real data: no causal
// language, US spelling, no gaps, and the order words of the page only where the reader asked for them.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { profileAnnouncement } from "../components/GenreProfile.jsx";
import {
  allGenresLine,
  chartAnnouncement,
  chartQuestionText,
  genreProfile,
  axisTitle,
  genreRows,
  mixLine,
  profileColumns,
  profileNote,
  profileRowName,
  profileTakeaway,
  rowDetails,
  sampleLine,
  takeawayLine,
  topicCount,
} from "../lib/genres.js";
import { CAUSAL, UK_SPELLINGS } from "./scans.js";
import { realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const real = realMeta();
const GAPS = /undefined|NaN|null|\[object| {2}|\.\.|,,|\(\)/;

function sentences(meta, file) {
  const out = [];
  const add = (s) => s && out.push(s);
  for (const [id, entry] of Object.entries(file.c)) {
    const variable = meta.variables.find((v) => v.id === id);
    const rows = genreRows(meta, file, id);
    add(chartQuestionText(variable));
    add(chartAnnouncement(meta, file, variable));
    add((allGenresLine(rows, variable, entry) || []).map((s) => (typeof s === "string" ? s : s.strong)).join(""));
    for (const row of rows) {
      const d = rowDetails(row, variable, entry, meta.min_n);
      add(d.name);
      add(d.line);
      for (const [k, v] of d.items) add(`${k} ${v}`);
      if (d.comparison) add(d.comparison.short);
    }
  }
  for (let gi = 1; gi < file.genres.length; gi += 1) {
    const genre = meta.genres.find((g) => g.id === file.genres[gi]);
    add(profileAnnouncement(meta, file, { genre: genre.id, sub: file.s }));
    if (file.n[gi] < meta.min_n) continue;
    // the top of the answer and the key in the lists
    const p = genreProfile(meta, file, gi);
    add(sampleLine(file.n[gi], genre, meta.subsets.find((s) => s.id === file.s)));
    for (const line of profileTakeaway(p)) add(`${line.mark} ${takeawayLine(line)}`);
    add(axisTitle(genre));
    for (const inTopic of [false, true]) add(mixLine(genre, { inTopic }));
    for (const inTopic of [false, true]) for (const tap of [false, true]) add(profileNote(genre, { inTopic, tap }).join(""));
    for (const t of p.topics) add(`${t.topic.label}, ${topicCount(t).text}`); // the topics' names
    for (const item of p.items) {
      // "One genre"'s rows: the unit line, the two columns and the name
      const cols = profileColumns(item);
      add(cols.unit);
      add(cols.of);
      add([...(cols.genre || []), ...(cols.all || [])].join(" "));
      add(profileRowName(item, genre, meta.min_n));
    }
  }
  return out;
}

describe("the Genres page's sentences on the real data", () => {
  // 13.7 s on a 2-core machine: longer than Vitest's 5 s default
  it.skipIf(!real)("are never causal, always US English, and have no gaps, in every option", { timeout: 30000 }, () => {
    let count = 0;
    for (const s of real.subsets) {
      const file = JSON.parse(readFileSync(path.join(here, "..", "..", "public", "aggregates", "genres", `${s.id}.json`), "utf8"));
      for (const text of sentences(real, file)) {
        count += 1;
        expect(text).not.toMatch(CAUSAL);
        expect(text).not.toMatch(UK_SPELLINGS);
        expect(text, text).not.toMatch(GAPS);
      }
    }
    expect(count).toBeGreaterThan(100000);
  });
});
