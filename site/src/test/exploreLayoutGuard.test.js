// The Genres page adds options to rangeLayout(); Explore's charts must stay exactly as they were. This fingerprint
// of Explore's layouts (every real characteristic, measure and two genres at four widths, plus the test data) was
// taken before the options were added, and is taken anew, with what moved, when Explore's chart changes on purpose.
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
    // round 4's type scale (X1): the counts' estimated boxes at 13 px (12.5 before) and the value labels 8 px from a dot
    // of radius 6 (7 before): with the layouts before it the digest is de8c0a718c21dc44; then round 4's L1, "100 stories"
    // in words on phones, the short labels' column as wide as its stories, a value the dashed line would run through
    // starting 6 px right of it (d845be43b0ab6e85 before L1). The owner's changes of 2026-10-13 named the dashed line
    // "Median of all stories: …" ("All stories shown: …" before, 7fb18ef1ff7cdf3c): only its label's text and box
    // differ, and in 5 layouts its x, to keep the longer label inside the chart (a75794f5095dbe4f). Then the label keeps
    // room for a wider font (REF_SLACK, 10%): in 7 layouts it sits up to 8.4 px further in (e19305e83b7adc57). Then the
    // owner's changes of 2026-10-19: no row prints its stories, so a label beside its plot sits level with its value
    // (5 px under the row's center, 1 px over it before) and the short labels' column on phones is as wide as its labels
    expect(out).toEqual({ digest: "7326e48c4f61711a", count: 192 });
  });

  it.skipIf(!real)("on the real data", () => {
    const read = (id) => JSON.parse(readFileSync(path.join(REAL, "v", id, "all.json"), "utf8"));
    const out = fingerprint(real, read, ["all", "adult-romance"], [288, 343, 720, 1000]);
    // the owner's meta.json change (2026-10-12) renamed "Explicit description"'s groups ("Explicit blurb", "Non-explicit
    // blurb"): with the meta.json before it the digest is still fa78f0dc311af78d, and only that characteristic's differ.
    // Round 4's type scale (X1) changed only the estimated boxes of the 13 px counts and, in 31 of these layouts, a value
    // label's x by 1 px (8 px from a dot of radius 6, 7 before): every row, tick and height is as before (912c2d47bb675e32).
    // Then round 4's L1 (d940822bbc6c5207 before it): the stories in words on phones ("2,631 stories"), the short labels'
    // column as wide as its stories (1,760 of these layouts: their plot narrower), and a value the dashed line would run
    // through starting 6 px right of it. The data update 20261013 (litcorr_stage2_handoff_20261013.zip, no code change)
    // moved the medians, counts and some groups' edges: b026d24a6ef5724a on the 20261008 handoff. Then the owner's
    // changes of 2026-10-13 named the dashed line "Median of all stories: …" (4c2d87eddc236323 before): only its label's
    // text and box differ (14,960 layouts), and in 1,807 of them its x, to keep the longer label inside the chart
    // (1ee8247423dfed55). Then the label keeps room for a wider font (REF_SLACK, 10%): in 2,477 layouts it sits up to
    // 8.4 px further in, and nothing else moves (caf9ec7cbabc0775). Then the owner's changes of 2026-10-19: no row
    // prints its stories; every label beside its plot sits level with its value (44,040 rows: 5 px under the row's
    // center, 1 px over it before), and the short labels' column on phones is as wide as its labels (1,760 layouts:
    // their plot wider, and its ticks, dashed line, bars, dots and values with it); stacked rows are as they were
    // (03357ab4c6dda450). The data update 20261021 (litcorr_stage2_handoff_20261021.zip, the finished collection, no code
    // change) moved the medians and some groups' edges: 03357ab4c6dda450 on the 20261013 handoff
    expect(out).toEqual({ digest: "cad91fdb07078923", count: 14960 });
  });
});
