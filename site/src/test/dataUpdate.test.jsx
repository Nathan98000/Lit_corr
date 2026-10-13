// The data update of 2026-10-13 (STAGE2_DATA_UPDATE_PROMPT.md): How it works words every exclusion reason in the data.
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { clearCache } from "../lib/data.js";
import { fixtureFetch, fixtureMeta, realMeta } from "./fixtures.js";

const real = realMeta();

/** A fetch() that serves the test data with this meta.json. */
const withMeta = (meta) => {
  const serve = fixtureFetch();
  return async (url) => (String(url).split("?")[0].endsWith("meta.json") ? { ok: true, status: 200, json: async () => meta } : serve(url));
};

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function missingData(meta) {
  vi.stubGlobal("fetch", withMeta(meta));
  window.history.replaceState(null, "", "/#/methodology/missing-data");
  render(<App />);
  const heading = await screen.findByRole("heading", { level: 2, name: "Missing data and excluded stories" });
  return heading.nextElementSibling.textContent;
}

describe("Missing data and excluded stories", () => {
  it("words a story left out as a duplicate as the copy does, not by its code", async () => {
    const counts = { sampled: 12, with_text: 11, included: 9, excluded_reasons: { no_text: 1, possibly_not_english: 1, duplicate_of_another_story: 1 } };
    const text = await missingData({ ...fixtureMeta, counts });
    expect(text).toMatch(/^Of the 12 sampled stories, 9 are used in the charts\. 3 were left out: 1 had no story text that could be collected, 1 did not look like English and 1 had the same text as another story\. /);
  });

  it.skipIf(!real)("has words for every reason in the real data", async () => {
    const text = await missingData({ ...fixtureMeta, counts: real.counts });
    expect(Object.keys(real.counts.excluded_reasons).length).toBeGreaterThan(0);
    expect(text).not.toMatch(/left out \(/);
  });
});
