// The fingerprint of "One genre" (STAGE2_TRENDS_PAGE_PROMPT.md, section 4.2): its markup on the real data for Romance,
// How To, Fetish and Chain Stories, with all stories and with "Published 2020 or later", wide and stacked, with every
// topic closed and then one open. Moving its rows, lists, topics, notes, way back and "Copy link" into
// ComparisonProfile.jsx must leave it unchanged. The markup is stored one tag per line, React's ids numbered in order
// of appearance; for the open topic, its own markup (nothing else changes).
import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { clearCache } from "../lib/data.js";
import { realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const real = realMeta();
/** A fetch() that serves the site's real aggregates. */
const realFetch = async (url) => {
  const body = readFileSync(path.join(here, "..", "..", "public", "aggregates", String(url).split("aggregates/")[1]), "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};

// each genre opens a topic of its own, so the open topics hold every kind of row: named groups and their mix lines,
// bands, mostly-zero characteristics, numbers and yes/no
const GENRES = [
  ["adult-romance", "narration"],
  ["adult-how-to", "pacing"],
  ["fetish-stories", "emotion"],
  ["chain-stories", "length"],
];
const SUBS = ["all", "y2020"];
const WIDTHS = [1032, 720]; // wide, and stacked (under 900 px)

/** The answer's markup, one tag per line, with React's ids (_r_1g_) numbered in order of appearance. */
function fingerprint(el) {
  const ids = new Map();
  return el.outerHTML
    .replace(/_r_[0-9a-z]+_/g, (id) => {
      if (!ids.has(id)) ids.set(id, `_id${ids.size}_`);
      return ids.get(id);
    })
    .replace(/></g, ">\n<");
}

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", realFetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.skipIf(!real)("“One genre”'s fingerprint", () => {
  for (const [genre, topic] of GENRES) {
    for (const sub of SUBS) {
      for (const width of WIDTHS) {
        it(`${genre}, ${sub}, ${width} px`, { timeout: 30000 }, async () => {
          vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width, height: 0, top: 0, left: 0, right: width, bottom: 0 });
          window.history.replaceState(null, "", `/#/genres?view=genre&genre=${genre}&include=${sub}`);
          const user = userEvent.setup();
          render(<App />);
          await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false'] h2")).toBeTruthy());
          const answer = () => document.querySelector(".genres-page article.chart-panel");
          const closed = fingerprint(answer());
          const name = real.topics.find((t) => t.id === topic).label;
          const summary = [...document.querySelectorAll(".profile-topic summary")].find((s) => s.textContent.startsWith(name));
          if (summary) {
            await user.click(summary);
            await waitFor(() => expect(summary.closest("details").querySelector(".profile-row")).toBeTruthy());
          }
          const open = summary ? fingerprint(summary.closest("details")) : "(no topics)";
          await expect(`<!-- every topic closed -->\n${closed}\n<!-- ${name} open -->\n${open}\n`).toMatchFileSnapshot(
            `./__fingerprints__/one-genre/${genre}-${sub}-${width}.html`,
          );
        });
      }
    }
  }
});
