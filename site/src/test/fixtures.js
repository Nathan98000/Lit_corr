// Test data: aggregates built from a small synthetic handoff (invented numbers, no real stories) by
//   python -m litcorr.stage2.synthetic site/src/test/fixtures/aggregates
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(here, "fixtures", "aggregates");
const REAL = path.join(here, "..", "..", "public", "aggregates");

export const fixtureMeta = JSON.parse(readFileSync(path.join(FIXTURES, "meta.json"), "utf8"));

/** The site's real meta.json, if the aggregates have been generated. */
export function realMeta() {
  try {
    return JSON.parse(readFileSync(path.join(REAL, "meta.json"), "utf8"));
  } catch {
    return null;
  }
}

export function fixtureFile(rel) {
  return JSON.parse(readFileSync(path.join(FIXTURES, rel), "utf8"));
}

/** A fetch() that serves the fixture files and records every URL asked for. */
export function fixtureFetch() {
  const calls = [];
  const fn = async (url) => {
    calls.push(String(url));
    const rel = String(url).split("aggregates/")[1];
    try {
      const body = readFileSync(path.join(FIXTURES, rel), "utf8");
      return { ok: true, status: 200, json: async () => JSON.parse(body) };
    } catch {
      return { ok: false, status: 404, json: async () => ({}) };
    }
  };
  fn.calls = calls;
  return fn;
}
