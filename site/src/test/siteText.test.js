// The site's own text (everything a visitor can read in the source) is US English and never causal.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CAUSAL, UK_SPELLINGS } from "./scans.js";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const HTML = path.join(SRC, "..", "index.html");

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return name === "test" ? [] : sources(p);
    return /\.(jsx?|css)$/.test(name) ? [p] : [];
  });
}

/** Source text without comments (comments are for developers, not visitors). */
function visible(file) {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
    .replace(/<!--[\s\S]*?-->/g, "");
}

describe("the site's own text", () => {
  const files = [...sources(SRC), HTML];
  it("is written in US English", () => {
    for (const f of files) expect(visible(f), path.relative(SRC, f)).not.toMatch(UK_SPELLINGS);
  });
  it("uses no causal language", () => {
    for (const f of files) expect(visible(f), path.relative(SRC, f)).not.toMatch(CAUSAL);
  });
});
