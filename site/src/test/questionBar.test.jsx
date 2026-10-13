// The question bar on phones (idea I8): it keeps the question in view once the sentence has scrolled away.
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { clearCache } from "../lib/data.js";
import { fixtureFetch } from "./fixtures.js";

let observers = [];
const original = window.matchMedia;

/** An IntersectionObserver whose callback the test calls: away() scrolls the sentence above the screen. */
class FakeObserver {
  constructor(callback) {
    this.callback = callback;
    observers.push(this);
  }
  observe(el) {
    this.el = el;
  }
  disconnect() {}
}
const scrollSentence = (above) =>
  act(() => {
    for (const o of observers.filter((x) => x.el?.id === "question")) {
      o.callback([{ isIntersecting: !above, boundingClientRect: { top: above ? -160 : 120, bottom: above ? -12 : 270 }, rootBounds: { top: 0 } }]);
    }
  });

function screenWidth(px) {
  window.matchMedia = (q) => {
    const max = q.match(/max-width:\s*(\d+)px/);
    const min = q.match(/min-width:\s*(\d+)px/);
    const matches = max ? px <= Number(max[1]) : min ? px >= Number(min[1]) : false;
    return { matches, media: q, addEventListener() {}, removeEventListener() {} };
  };
}

beforeEach(() => {
  clearCache();
  observers = [];
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});

afterEach(() => {
  window.matchMedia = original;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function renderApp(hash) {
  window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
  return user;
}

const bar = () => screen.queryByRole("button", { name: /^Back to the question:/ });

describe("the question bar", () => {
  it("appears when the sentence leaves the screen, says the question, and takes you back to it", async () => {
    screenWidth(375);
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const user = await renderApp("#/explore?var=dlg_word_share&include=y2020");
    expect(bar()).toBeNull(); // the sentence is on screen
    scrollSentence(true);
    const button = bar();
    expect(button.getAttribute("aria-label")).toBe(
      "Back to the question: In all genres, how do favorites per 1,000 views vary with dialogue share?",
    );
    expect(button.querySelector(".question-bar-text").textContent).toBe(
      "Dialogue share · Favorites per 1,000 views · All genres · Published 2020 or later",
    );
    await user.click(button);
    const sentence = document.getElementById("question");
    expect(document.activeElement).toBe(sentence);
    expect(scroll.mock.contexts).toContain(sentence);
    scrollSentence(false);
    expect(bar()).toBeNull();
  });

  it("hides while a sheet is open", async () => {
    screenWidth(375);
    const user = await renderApp("#/explore?genre=romance&var=dlg_word_share");
    scrollSentence(true);
    expect(bar().textContent).toMatch(/^Dialogue share · Favorites per 1,000 views · Romance/);
    await user.click(screen.getByRole("button", { name: /^Popularity measure:/ }));
    expect(screen.getByRole("dialog", { name: "Popularity measure" })).toBeTruthy();
    expect(bar()).toBeNull();
  });

  it("is never there at 700 px and wider", async () => {
    screenWidth(700);
    await renderApp("#/explore?var=dlg_word_share");
    scrollSentence(true);
    expect(document.querySelector(".question-bar")).toBeNull();
  });
});
