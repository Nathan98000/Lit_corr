// Code splitting (F49): the parts that load their code when first needed. This file runs in its own module
// registry, so the parts start "cold", as on a first visit.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { PartBoundary, lazyPart } from "../components/lazyPart.jsx";
import { clearCache } from "../lib/data.js";
import { fixtureFetch } from "./fixtures.js";

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parts that load on demand", () => {
  it("open the measure menu's sheet at once, with its title and Close, and fill it when the code arrives", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /^Popularity measure:/ }));
    const dialog = screen.getByRole("dialog", { name: "Popularity measure" });
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeTruthy();
    const list = await within(dialog).findByRole("listbox");
    await waitFor(() => expect(document.activeElement).toBe(list));
    expect(dialog.querySelector(".overlay-placeholder")).toBeNull();
    await user.keyboard("{End}{Enter}");
    await waitFor(() => expect(window.location.hash).toMatch(/metric=pop_rating_count/));
  });

  it("hold How it works' place with a placeholder until its code arrives", async () => {
    window.history.replaceState(null, "", "/#/methodology");
    render(<App />);
    await waitFor(() => expect(document.querySelector(".page-placeholder")).toBeTruthy());
    expect(await screen.findByRole("heading", { level: 1, name: "How it works" })).toBeTruthy();
    expect(document.querySelector(".page-placeholder")).toBeNull();
  });
});

describe("lazyPart", () => {
  it("draws a part at once, without a placeholder, once its code has been fetched", async () => {
    let resolve;
    const loaded = new Promise((r) => {
      resolve = r;
    });
    const Part = lazyPart(() => loaded);
    Part.preload();
    resolve({ default: () => <p>The part</p> });
    await loaded;
    await Promise.resolve();
    render(
      <PartBoundary fallback={<p>Waiting</p>}>
        <Part />
      </PartBoundary>,
    );
    expect(screen.getByText("The part")).toBeTruthy();
    expect(screen.queryByText("Waiting")).toBeNull();
  });

  it("shows a friendly error when the code cannot be loaded, and fetches it again on Try again", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {}); // React reports the caught error
    let online = false;
    let attempts = 0;
    const Part = lazyPart(() => {
      attempts += 1;
      return online ? Promise.resolve({ default: () => <p>Back</p> }) : Promise.reject(new Error("offline"));
    });
    render(
      <PartBoundary fallback={<p>Waiting</p>}>
        <Part />
      </PartBoundary>,
    );
    expect(await screen.findByText(/We couldn’t load the data/)).toBeTruthy();
    const failed = attempts;
    online = true;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Back")).toBeTruthy();
    expect(attempts).toBe(failed + 1); // fetched again, not served from a cached failure
  });
});
