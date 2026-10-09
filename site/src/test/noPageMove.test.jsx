// Round 3, change 1: opening, using or picking from the measure menu or the characteristic picker never moves the
// page. The menus scroll only their own box, every focus() prevents scrolling, the popover fits on the screen, and a
// shorter chart keeps the scroll position.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import Explorer from "../components/Explorer.jsx";
import { popoverPlace } from "../components/Overlay.jsx";
import useScrollFloor from "../components/useScrollFloor.js";
import useWidth from "../components/useWidth.js";
import { clearCache } from "../lib/data.js";
import { keepInView } from "../lib/listScroll.js";
import { sanitize } from "../lib/urlState.js";
import { fixtureFetch, fixtureMeta } from "./fixtures.js";

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function renderApp(hash = "") {
  if (hash) window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
  return user;
}

const rect = (top, height, width = 560) => ({ top, bottom: top + height, left: 0, right: width, width, height, x: 0, y: top });

/**
 * A menu's geometry: its scrolling box is 200 px tall at the top of the screen; option i is 50 px tall and starts
 * 100 + 60·i px below the box's top, minus how far the box has scrolled.
 */
function menuGeometry() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function getRect() {
    if (this.classList?.contains("overlay-body")) return rect(0, 200);
    const i = [...document.querySelectorAll("[role=option]")].indexOf(this);
    if (i >= 0) return rect(100 + 60 * i - (this.closest(".overlay-body")?.scrollTop ?? 0), 50);
    return rect(0, 0, 0);
  });
}

describe("the menus scroll only their own box", () => {
  it("measure menu: the active option is kept in view by the menu's box, never with scrollIntoView", async () => {
    const user = await renderApp();
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    menuGeometry();
    await user.click(screen.getByRole("button", { name: /^Popularity measure:/ }));
    const dialog = screen.getByRole("dialog", { name: "Popularity measure" });
    const list = await within(dialog).findByRole("listbox");
    await waitFor(() => expect(document.activeElement).toBe(list));
    const box = dialog.querySelector(".overlay-body");
    expect(box.scrollTop).toBe(0); // the measure shown is the first option, already in view
    const n = within(dialog).getAllByRole("option").length;
    await user.keyboard("{End}");
    expect(box.scrollTop).toBe(100 + 60 * (n - 1) + 50 - 200); // just enough to show the last option
    await user.keyboard("{Home}");
    expect(box.scrollTop).toBe(100); // the first option at the box's top edge
    expect(scroll).not.toHaveBeenCalled();
  });

  it("picker: the same, and another list (a topic, a new search) starts at the box's top", async () => {
    const user = await renderApp();
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    menuGeometry();
    await user.click(screen.getByRole("button", { name: /^Story characteristic:/ }));
    const dialog = screen.getByRole("dialog", { name: "Story characteristic" });
    const search = await within(dialog).findByRole("combobox");
    await waitFor(() => expect(document.activeElement).toBe(search));
    const box = dialog.querySelector(".overlay-body");
    expect(box.scrollTop).toBe(0);
    const n = within(dialog).getAllByRole("option").length;
    await user.keyboard("{End}"); // the last topic
    expect(box.scrollTop).toBe(100 + 60 * (n - 1) + 50 - 200);
    await user.keyboard("{Enter}"); // opens it: its list starts at the top, with its first characteristic in view
    expect(within(dialog).getByText("‹ All topics")).toBeTruthy();
    expect(box.scrollTop).toBe(100 + 60 * 1 + 50 - 200);
    await user.type(search, "d"); // a new search starts at the top too
    expect(box.scrollTop).toBe(0);
    expect(scroll).not.toHaveBeenCalled();
  });

  it("keepInView leaves elements outside the box, and the page, alone", () => {
    document.body.innerHTML = '<div class="box"><p class="in"></p></div><button class="out"></button>';
    const box = document.querySelector(".box");
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function getRect() {
      return this === box ? rect(0, 200) : rect(500, 50);
    });
    keepInView(box, document.querySelector(".out"));
    expect(box.scrollTop).toBe(0);
    keepInView(box, document.querySelector(".in"));
    expect(box.scrollTop).toBe(350);
  });
});

describe("focus never scrolls the page", () => {
  it("opening, browsing a topic, the focus trap and closing all focus with preventScroll", async () => {
    await renderApp();
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const trigger = screen.getByRole("button", { name: /^Story characteristic:/ });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Story characteristic" });
    const search = await within(dialog).findByRole("combobox");
    await waitFor(() => expect(document.activeElement).toBe(search));
    const topic = within(dialog).getAllByRole("option").find((o) => o.textContent.includes("Emotion & relationships"));
    fireEvent.click(topic); // into a topic …
    fireEvent.keyDown(search, { key: "Home" });
    fireEvent.keyDown(search, { key: "Enter" }); // … and back
    expect(document.activeElement).toBe(search);
    const close = within(dialog).getByRole("button", { name: "Close" });
    close.focus({ preventScroll: true });
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true }); // the trap wraps to the last control
    expect(document.activeElement).not.toBe(close);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(focus.mock.calls.length).toBeGreaterThanOrEqual(5);
    for (const args of focus.mock.calls) expect(args[0]).toEqual({ preventScroll: true });
  });
});

describe("the popover fits on the screen", () => {
  const at = (screenW, screenH, scrollY = 0) => ({ screenW, screenH, scrollX: 0, scrollY });

  it("opens under its trigger, no taller than the room there", () => {
    // the default sentence at 1440 × 900 and 1280 × 720: the words end 202 px down
    expect(popoverPlace({ top: 99, bottom: 202, left: 300 }, at(1440, 900))).toMatchObject({ up: false, top: 208, maxHeight: 620 });
    expect(popoverPlace({ top: 99, bottom: 202, left: 300 }, at(1280, 720))).toMatchObject({ up: false, top: 208, maxHeight: 502 });
    // a trigger scrolled above the screen counts from the screen's top
    expect(popoverPlace({ top: -200, bottom: -97, left: 300 }, at(1440, 900, 300))).toMatchObject({ up: false, top: 306, maxHeight: 620 });
  });

  it("opens above when there is less than 320 px under the trigger and more over it, placed by its bottom edge", () => {
    const p = popoverPlace({ top: 500, bottom: 540, left: 300 }, at(1280, 720, 1000));
    expect(p).toMatchObject({ up: true, maxHeight: 484 });
    expect(p.bottom).toBe(720 - (1000 + 500 - 6)); // its bottom edge 6 px over the trigger, in page coordinates
    expect(popoverPlace({ top: 150, bottom: 190, left: 0 }, at(1280, 400))).toMatchObject({ up: false, maxHeight: 194 });
  });

  it("is drawn where popoverPlace says", async () => {
    const user = await renderApp();
    const trigger = screen.getByRole("button", { name: /^Popularity measure:/ });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(rect(600, 40, 200));
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Popularity measure" });
    // jsdom's window is 768 px tall: 128 px under the trigger, 600 over it
    expect(dialog.dataset.placement).toBe("above");
    expect(dialog.style.maxHeight).toBe("584px");
    expect(dialog.style.bottom).toBe(`${768 - (600 - 6)}px`);
    expect(dialog.style.top).toBe("");
  });
});

describe("a shorter chart keeps the scroll position", () => {
  function Page({ out }) {
    const [ref, hold] = useScrollFloor();
    out.hold = hold;
    return (
      <>
        <main style={{ minHeight: "768px" }} />
        <div ref={ref} className="scroll-floor" />
        <footer />
      </>
    );
  }

  it("holds the page tall enough for the scroll position, and lets go once the spacer is out of sight", () => {
    const out = {};
    vi.spyOn(window, "scrollY", "get").mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function height() {
      return this.tagName === "FOOTER" ? 114 : parseFloat(this.style.height) || 0;
    });
    let floorTop = 500;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function getRect() {
      if (this.tagName === "MAIN") return rect(53 - 300, 1000);
      return rect(floorTop, parseFloat(this.style.height) || 0);
    });
    const { container } = render(<Page out={out} />);
    const floor = container.querySelector(".scroll-floor");
    act(() => out.hold());
    // the screen reaches 300 + 768 px down; the page is at least 53 + 768 (main) + the spacer + 114 (footer)
    expect(floor.style.height).toBe(`${300 + 768 - 53 - 768 - 114}px`);
    fireEvent.scroll(window); // the spacer is in view: it stays
    expect(floor.style.height).toBe("133px");
    floorTop = 800; // scrolled up: it is below the screen now
    fireEvent.scroll(window);
    expect(floor.style.height).toBe("");
  });

  it("is held for a new question from the sentence or an age box's switch, not for another view", async () => {
    const hold = vi.fn();
    const state = sanitize({ v: "dlg_word_share", metric: "pop_views" }, fixtureMeta);
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Explorer meta={fixtureMeta} state={state} onChange={onChange} onAsk={() => {}} onHoldScroll={hold} />);
    await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
    await user.selectOptions(screen.getByLabelText("Genre"), "romance");
    expect([hold.mock.calls.length, onChange.mock.calls.length]).toEqual([1, 1]);
    await user.click(screen.getByRole("button", { name: "Switch to views per month" }));
    expect([hold.mock.calls.length, onChange.mock.calls.length]).toEqual([2, 2]);
    await user.click(screen.getByRole("button", { name: "See this pattern in every genre →" }));
    expect([hold.mock.calls.length, onChange.mock.calls.length]).toEqual([2, 3]);
  });
});

describe("a chart drawn again starts at its real width", () => {
  function Probe({ out }) {
    const [ref, width] = useWidth(720, "probe");
    const first = useRef(width);
    out.first = first.current;
    out.width = width;
    return <div ref={ref} />;
  }

  it("remembers the last width measured, and never guesses wider than the window", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(375);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(rect(0, 0, 343));
    const out = {};
    const a = render(<Probe out={out} />);
    expect(out.first).toBe(375 - 32); // not 720: wider than a phone's screen
    expect(out.width).toBe(343);
    a.unmount();
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1440);
    render(<Probe out={out} />);
    expect(out.first).toBe(343); // remembered
  });
});
