// The simpler site (STAGE2_SIMPLIFY_AND_PNG_PROMPT.md): what that round removed stays removed, on every view.
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { clearCache } from "../lib/data.js";
import { fixtureFetch } from "./fixtures.js";

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function open(hash) {
  window.history.replaceState(null, "", `/${hash}`);
  render(<App />);
  await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
}

const VIEWS = [
  ["Explore", "#/explore?var=dlg_word_share"],
  ["Explore, a yes/no characteristic", "#/explore?var=dlg_has_dialogue"],
  ["Explore, named groups", "#/explore?var=pov_class"],
  ["One characteristic, numbers", "#/genres?var=dlg_word_share"],
  ["One characteristic, yes/no", "#/genres?var=dlg_has_dialogue"],
  ["One characteristic, mostly zero", "#/genres?var=emo_anger_per_1k"],
  ["One characteristic, named groups", "#/genres?var=pov_class"],
  ["One genre", "#/genres?view=genre&genre=romance&include=all"],
];

describe("no numbers tables (decision 5)", () => {
  it.each(VIEWS)("%s: no “Show the numbers” or “Hide the numbers”, and no table", async (_, hash) => {
    await open(hash);
    expect(screen.queryByRole("button", { name: /(Show|Hide) the numbers/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(/(Show|Hide) the numbers/);
    expect(document.querySelector("table")).toBeNull();
  });
});
