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

/**
 * A fetch() like fixtureFetch() whose genres/<sub>.json gives `genre` only `n` stories, compared with nothing (r null,
 * f 0, as the pipeline writes a genre under the rule's 30): "One genre"'s small-sample states (F60). The test data's
 * genres reached them only with options the Genres page no longer offers (Romance's 15 stories of 5,000 words or more,
 * until the owner's 2026-10-20). `serve` is the fetch() it changes (fixtureFetch() by default).
 */
export function fewStoriesFetch(sub, genre, n, serve = fixtureFetch()) {
  const fn = async (url) => {
    const res = await serve(url);
    if (!String(url).endsWith(`genres/${sub}.json`)) return res;
    const body = await res.json();
    const gi = body.genres.indexOf(genre);
    body.n[gi] = n;
    for (const e of Object.values(body.c)) {
      if (e.q[gi]) e.q[gi][0] = n;
      if (e.z?.[gi]) {
        // its stories with any, and their quartiles only from 10 of them (meta.min_n)
        const above = Math.min(e.z[gi][0], n);
        e.z[gi] = above >= 10 ? [above, ...e.z[gi].slice(1)] : [above];
      }
      e.r[gi] = null;
      e.f[gi] = 0;
    }
    return { ok: true, status: 200, json: async () => body };
  };
  fn.calls = serve.calls;
  return fn;
}
