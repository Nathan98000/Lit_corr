// How it works on narrow screens (F46, concept H3): a sticky section bar with a Contents panel; the desktop sidebar
// marks the section being read.
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { SECTIONS } from "../components/Methodology.jsx";
import { clearCache } from "../lib/data.js";
import { fixtureFetch } from "./fixtures.js";

let observers = [];
class FakeObserver {
  constructor(callback) {
    this.callback = callback;
    observers.push(this);
  }
  observe() {}
  disconnect() {}
}
/** Scroll so that the given section's heading has just crossed the line near the top (null: above every section). */
function readSection(id) {
  const order = SECTIONS.map(([sid]) => sid);
  const at = id == null ? -1 : order.indexOf(id);
  for (const [i, sid] of order.entries()) document.getElementById(sid).__top = i <= at ? 40 - (at - i) * 600 : 300 + (i - at) * 600;
  act(() => observers.forEach((o) => o.callback([])));
}

const original = window.matchMedia;
function screenWidth(px) {
  window.matchMedia = (q) => {
    const min = q.match(/min-width:\s*(\d+)px/);
    const max = q.match(/max-width:\s*(\d+)px/);
    return { matches: min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false, addEventListener() {}, removeEventListener() {} };
  };
}

beforeEach(() => {
  clearCache();
  observers = [];
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function rect() {
    const top = this.__top ?? 1000;
    return { top, bottom: top + 30, left: 0, right: 600, width: 600, height: 30 };
  });
});

afterEach(() => {
  window.matchMedia = original;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openPage(hash = "#/methodology") {
  window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { level: 1, name: "How it works" });
  // the section observer is made in an effect, which React may run a turn after the page is on screen (when the
  // render overruns its time slice, as under a full test run's load): scrolling before it exists would mark nothing
  await waitFor(() => expect(observers).not.toHaveLength(0));
  return user;
}
const where = () => document.querySelector(".section-bar-where").textContent;
const contentsNavs = () => screen.queryAllByRole("navigation", { name: "Contents" });

describe("the section bar below 1,000 px", () => {
  it("names the section being read", async () => {
    screenWidth(375);
    await openPage();
    readSection(null);
    expect(where()).toBe("How it works"); // the page's top: no "› Contents" beside the Contents button (round 4's F109)
    expect(screen.getByRole("button", { name: "Contents" })).toBeTruthy();
    readSection("age");
    expect(where()).toBe("How it works › Story age");
    readSection("tend-to");
    expect(where()).toBe("How it works › When a title says “tend to”");
    expect(contentsNavs()).toHaveLength(0); // the list waits behind its button
  });

  it("opens the contents under the bar, and closes them with Escape, the button or a tap outside", async () => {
    screenWidth(375);
    const user = await openPage();
    readSection("measures");
    const button = screen.getByRole("button", { name: "Contents" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await user.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const nav = screen.getByRole("navigation", { name: "Contents" });
    expect(button.getAttribute("aria-controls")).toBe(nav.id);
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(12); // no subsections under "How the characteristics were measured" (the owner, 2026-10-13)
    expect(links.filter((a) => a.getAttribute("aria-current") === "location").map((a) => a.textContent)).toEqual([
      "How the characteristics were measured",
    ]);
    expect(contentsNavs()).toHaveLength(1);
    await user.keyboard("{Escape}");
    expect(contentsNavs()).toHaveLength(0);
    expect(document.activeElement).toBe(button);
    await user.click(button);
    await user.click(button);
    expect(contentsNavs()).toHaveLength(0);
    await user.click(button);
    await user.click(screen.getByRole("heading", { level: 1 }));
    expect(contentsNavs()).toHaveLength(0);
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  it("goes to a chosen section, closes the panel and focuses the heading", async () => {
    screenWidth(375);
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const user = await openPage();
    await user.click(screen.getByRole("button", { name: "Contents" }));
    await user.click(screen.getByRole("link", { name: "Missing data and excluded stories" }));
    await waitFor(() => expect(window.location.hash).toBe("#/methodology/missing-data"));
    const heading = screen.getByRole("heading", { level: 2, name: "Missing data and excluded stories" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(scroll.mock.contexts).toContain(heading);
    expect(contentsNavs()).toHaveLength(0);
  });

  it("opens a section address at its heading", async () => {
    screenWidth(375);
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    await openPage("#/methodology/tend-to");
    const heading = screen.getByRole("heading", { level: 2, name: "When a title says “tend to”" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(scroll.mock.calls[scroll.mock.contexts.indexOf(heading)][0]).toMatchObject({ block: "start" });
  });
});

describe("the contents at 1,000 px and wider", () => {
  it("are one sidebar that marks the section being read; there is no bar", async () => {
    screenWidth(1440);
    await openPage();
    expect(document.querySelector(".section-bar")).toBeNull();
    expect(contentsNavs()).toHaveLength(1);
    readSection("charts");
    const current = within(contentsNavs()[0]).getAllByRole("link").filter((a) => a.getAttribute("aria-current"));
    expect(current.map((a) => a.textContent)).toEqual(["How the charts summarize stories"]);
  });
});
