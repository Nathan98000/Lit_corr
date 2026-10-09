// The Genres page adds options to rangeLayout(); Explore's charts must stay exactly as they were. This fingerprint
// of Explore's layouts (every real characteristic, measure and two genres at four widths, plus the test data) was
// taken before the options were added.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cellStats, groupRows } from "../lib/data.js";
import { rangeLayout } from "../lib/rangeLayout.js";
import { fixtureFile, fixtureMeta, realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const REAL = path.join(here, "..", "..", "public", "aggregates");
const real = realMeta();

function fingerprint(meta, read, genres, widths) {
  const hash = createHash("sha256");
  let count = 0;
  for (const variable of meta.variables) {
    const data = read(variable.id);
    if (!data) continue;
    for (const g of genres) {
      const gd = data.g[g];
      meta.metrics.forEach((metric, k) => {
        const rows = groupRows(variable, gd, k);
        const overall = cellStats(gd?.o, k);
        for (const width of widths) {
          const layout = rangeLayout({ rows, overall, format: metric.format, width, smallN: meta.small_n, minN: meta.min_n });
          hash.update(JSON.stringify(layout));
          hash.update(layout.ticks.map((t) => t.text).join("|") + layout.valueText(1.2345) + layout.x(0.5));
          count += 1;
        }
      });
    }
  }
  return { digest: hash.digest("hex").slice(0, 16), count };
}

describe("Explore's chart layout is unchanged by the Genres page's options", () => {
  it("on the test data", () => {
    const out = fingerprint(fixtureMeta, (id) => fixtureFile(`v/${id}/all.json`), ["all", "romance", "tiny"], [288, 343, 600, 1000]);
    expect(out).toEqual({ digest: "de8c0a718c21dc44", count: 192 });
  });

  it.skipIf(!real)("on the real data", () => {
    const read = (id) => JSON.parse(readFileSync(path.join(REAL, "v", id, "all.json"), "utf8"));
    const out = fingerprint(real, read, ["all", "adult-romance"], [288, 343, 720, 1000]);
    expect(out).toEqual({ digest: "fa78f0dc311af78d", count: 14960 });
  });
});
