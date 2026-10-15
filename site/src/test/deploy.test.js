// The deployment (STAGE2_DEPLOY_PROMPT.md, D2): the site lives at https://literotica-data.vercel.app/, and
// index.html names that address, so that search engines and link previews use it rather than the address of each
// deployment.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(here, "..", "..", "index.html"), "utf8");
const ADDRESS = "https://literotica-data.vercel.app/";

describe("the live site's address in index.html", () => {
  it("is the canonical link and the link previews' og:url, once each and the same", () => {
    const canonical = [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]*)"/g)].map((m) => m[1]);
    const ogUrl = [...html.matchAll(/<meta\s+property="og:url"\s+content="([^"]*)"/g)].map((m) => m[1]);
    expect(canonical).toEqual([ADDRESS]);
    expect(ogUrl).toEqual([ADDRESS]);
  });
});
