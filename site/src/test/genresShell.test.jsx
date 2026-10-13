// The Genres page's shell: its addresses and their sanitizing, the masthead (D4, D9), the lazy page, loading and
// errors, and the default genre of "One genre" (D8).
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { GenresPage } from "../components/pages.js";
import { clearCache } from "../lib/data.js";
import { GENRE_PAGE_EXCLUDED, defaultGenre, parseHash, sanitizeGenres, toHash } from "../lib/urlState.js";
import { fixtureFetch, fixtureMeta, realMeta } from "./fixtures.js";

const real = realMeta();
let fetchMock;

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  fetchMock = fixtureFetch();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openGenres(hash = "#/genres") {
  window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
  return user;
}

describe("Genres addresses", () => {
  it("round-trip both views, in the documented order", () => {
    const chart = { v: "sex_terms_per_1k", sub: "y2020", sort: "value" };
    expect(toHash("genres", chart)).toBe("#/genres?var=sex_terms_per_1k&include=y2020&sort=value");
    expect(parseHash(toHash("genres", chart))).toEqual({ page: "genres", state: chart });
    // one characteristic no longer carries a genre (the highlight is gone, decision 8)
    expect(toHash("genres", { ...chart, genre: "adult-romance" })).toBe("#/genres?var=sex_terms_per_1k&include=y2020&sort=value");
    const one = { view: "genre", genre: "adult-romance", sub: "all" };
    expect(toHash("genres", { ...one, v: "story_words" })).toBe("#/genres?view=genre&genre=adult-romance&include=all");
    expect(parseHash("#/genres?view=genre&genre=adult-romance&include=all")).toEqual({ page: "genres", state: one });
    expect(parseHash("#/genres")).toEqual({ page: "genres", state: {} });
    expect(toHash("genres", {})).toBe("#/genres");
    // the other pages' addresses are unchanged
    expect(parseHash("#/explore?var=story_words").state).toEqual({ v: "story_words" });
    expect(parseHash("#/patterns?genre=all&metric=pop_views").page).toBe("patterns");
    expect(parseHash("#/methodology/genres")).toMatchObject({ page: "methodology", section: "genres" });
  });

  it("sanitizes: characteristic, option, order and view, and drops one characteristic's genre", () => {
    const meta = fixtureMeta;
    // the test data has no story length: the page's first characteristic stands in
    expect(sanitizeGenres({}, meta)).toEqual({ v: "dlg_word_share", sub: "all" });
    expect(sanitizeGenres({ v: "nope", sub: "nope", genre: "nope", sort: "nope", view: "nope" }, meta)).toEqual({
      v: "dlg_word_share",
      sub: "all",
    });
    expect(sanitizeGenres({ v: "pov_class", genre: "all" }, meta)).toEqual({ v: "pov_class", sub: "all" });
    // the order: by the values unless the address asks for A–Z (the owner, 2026-10-13); an old "value" is the default
    expect(sanitizeGenres({ v: "emo_anger_per_1k", sub: "y2020", genre: "romance", sort: "az" }, meta)).toEqual({
      v: "emo_anger_per_1k",
      sub: "y2020",
      sort: "az",
    });
    expect(sanitizeGenres({ v: "emo_anger_per_1k", sort: "value" }, meta)).toEqual({ v: "emo_anger_per_1k", sub: "all" });
    expect(sanitizeGenres({ v: "dlg_has_dialogue", sort: "az" }, meta).sort).toBe("az"); // yes/no: by share, or A–Z
    expect(sanitizeGenres({ v: "pov_class", sort: "az" }, meta).sort).toBeUndefined(); // named groups: A–Z only
    // one genre: an unknown genre falls back to the remembered one, else the largest genre (D8)
    expect(sanitizeGenres({ view: "genre", genre: "nope" }, meta)).toEqual({ view: "genre", genre: "fetish", sub: "all", v: "dlg_word_share" });
    expect(sanitizeGenres({ view: "genre" }, meta, "romance").genre).toBe("romance");
    expect(sanitizeGenres({ view: "genre", genre: "tiny" }, meta, "romance").genre).toBe("tiny");
    expect(sanitizeGenres({ view: "genre", genre: "all" }, meta).genre).toBe("fetish");
  });

  it.skipIf(!real)("sanitizes against the real data: story length, the excluded and conflicting options", () => {
    expect(sanitizeGenres({}, real).v).toBe("story_words");
    for (const id of GENRE_PAGE_EXCLUDED) expect(sanitizeGenres({ v: id }, real).v).toBe("story_words");
    expect(sanitizeGenres({ v: "story_words", sub: "short" }, real).sub).toBe("all");
    expect(sanitizeGenres({ v: "pub_year", sub: "y2000" }, real).sub).toBe("all");
    expect(sanitizeGenres({ v: "pub_year", sub: "long" }, real).sub).toBe("long");
    expect(sanitizeGenres({ v: "author_stories_count", sort: "az" }, real).sort).toBeUndefined(); // ordered bands: A–Z only
    expect(sanitizeGenres({ v: "rel_romance_per_1k", sort: "az" }, real).sort).toBe("az");
    expect(sanitizeGenres({ v: "rel_romance_per_1k", sort: "value" }, real).sort).toBeUndefined(); // by share with any
    // one genre has no characteristic, so no option conflicts with it
    expect(sanitizeGenres({ view: "genre", v: "story_words", sub: "short" }, real).sub).toBe("short");
  });

  it("defaults “One genre” to the largest genre, never by name (D8)", () => {
    expect(defaultGenre(fixtureMeta)).toBe("fetish"); // size 4,000 in the test data
    expect(defaultGenre(fixtureMeta, "romance")).toBe("romance");
    expect(defaultGenre(fixtureMeta, "all")).toBe("fetish");
    if (real) {
      const largest = real.genres.slice(1).reduce((a, b) => (b.size > a.size ? b : a));
      expect(defaultGenre(real)).toBe(largest.id);
      expect(largest.name).toBe("Erotic Couplings");
    }
  });
});

describe("the masthead (D4, D9; with the Trends page, D7)", () => {
  it("lists Popularity, Genres, Trends and How it works (Patterns is a part of Popularity); the footer has no link", async () => {
    await openGenres();
    const nav = screen.getByRole("navigation", { name: "Pages" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["Popularity", "Genres", "Trends", "How it works"]);
    expect(within(nav).getByRole("link", { name: "Genres" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: "How it works" }).classList.contains("nav-how")).toBe(true);
    expect(within(screen.getByRole("contentinfo")).queryAllByRole("link")).toHaveLength(0);
    // on a phone, one button names the page being read and opens every page (the owner, 2026-10-13)
    const menu = within(nav).getByRole("button", { name: "Genres, menu" });
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(menu.getAttribute("aria-controls"))).toBe(links[0].closest("ul"));
  });

  it("puts the pages in a menu below 548 px, where they don't fit in a row beside the name (measured)", () => {
    const css = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "styles.css"), "utf8");
    // every block of a media query, joined
    const block = (q) =>
      css
        .split(`@media (${q}) {`)
        .slice(1)
        .map((b) => b.split(/\n}\n/)[0])
        .join("\n");
    const phone = block("max-width: 547px");
    expect(phone).toMatch(/\.menu-button \{\s*display: inline-flex;/);
    expect(phone).toMatch(/\.nav-links \{\s*display: none;/);
    expect(phone).toMatch(/\.site-nav\.open \.nav-links \{\s*position: absolute;/);
    expect(phone).toMatch(/\.site-nav\.open \.nav-links a \{[^}]*min-height: 48px;/);
    expect(css).toMatch(/\.menu-button \{\s*display: none;\s*\}/); // a row of links above it
    // the earlier rule (links leaving the phone's masthead one by one) is gone
    expect(css).not.toMatch(/drop-(602|414|352)/);
    for (const old of ["601px", "483px", "413px", "351px"]) expect(block(`max-width: ${old}`)).not.toMatch(/\.masthead|\.brand|\.nav-links/);
  });

  it("links Genres to the last Genres address of the visit and fetches the page's code and file ahead", async () => {
    window.history.replaceState(null, "", "/#/explore?genre=romance&var=dlg_word_share");
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
    const preload = vi.spyOn(GenresPage, "preload");
    const genres = within(screen.getByRole("navigation", { name: "Pages" })).getByRole("link", { name: "Genres" });
    expect(genres.getAttribute("href")).toBe("#/genres");
    await user.hover(genres);
    expect(preload).toHaveBeenCalled();
    await waitFor(() => expect(fetchMock.calls.some((u) => u.endsWith("genres/all.json"))).toBe(true));
    await user.click(genres);
    await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
    window.location.hash = "#/genres?var=pov_class&include=y2020";
    await waitFor(() => expect(screen.getByLabelText("Only include").value).toBe("y2020"));
    window.location.hash = "#/patterns";
    await screen.findByRole("heading", { level: 1, name: /^Clear patterns in / }); // the question, its h1 (round 4's X2)
    const back = within(screen.getByRole("navigation", { name: "Pages" })).getByRole("link", { name: "Genres" });
    expect(back.getAttribute("href")).toBe("#/genres?var=pov_class&include=y2020");
  });
});

describe("the page shell", () => {
  it("has its own title, kicker and page marker, and the skip link goes to the question", async () => {
    window.history.replaceState(null, "", "/#/genres");
    render(<App />);
    expect(document.title).toBe("How do the genres’ stories differ?"); // while the page and its file load (F73)
    await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
    const user = userEvent.setup();
    // then the question on screen
    await waitFor(() => expect(document.title).toBe("How do genres differ in dialogue share?"));
    expect(document.documentElement.dataset.page).toBe("genres");
    // the question is the page's h1, named by its words; the kicker names the page and the source (round 4's U1)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "How do genres differ in dialogue share?" })).toBeTruthy();
    expect(document.querySelector(".kicker").tagName).toBe("P");
    expect(document.querySelector(".kicker").textContent).toBe(`Genres · ${fixtureMeta.counts.included} Literotica stories · 3 genres`);
    await user.click(screen.getByRole("link", { name: "Skip to content" }));
    expect(document.activeElement).toBe(document.getElementById("question"));
  });

  it("names the tab after the question on screen, in both views (F73)", async () => {
    await openGenres("#/genres?var=dlg_has_dialogue");
    await waitFor(() => expect(document.title).toBe("How common are stories with dialogue in each genre?"));
    window.location.hash = "#/genres?view=genre&genre=romance&include=all";
    await waitFor(() => expect(document.title).toBe("What stands out about stories in Romance?"));
  });

  it("loads the page's code on demand, holding its place meanwhile", async () => {
    window.history.replaceState(null, "", "/#/genres");
    render(<App />);
    expect(document.querySelector(".chart-placeholder")).toBeTruthy();
    await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
    expect(GenresPage.isLoaded()).toBe(true);
    const viteConfig = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "vite.config.js"), "utf8");
    expect(viteConfig).toMatch(/Genre\\w\*/); // the page's components are lazy parts, not in the first load
    expect(viteConfig).toMatch(/genres\|genreLayout/);
  });

  it("shows a friendly error when the file cannot be loaded, and loads it again on Try again", async () => {
    let fail = true;
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) =>
      fail && String(url).includes("genres/") ? { ok: false, status: 503, json: async () => ({}) } : serve(url),
    );
    window.history.replaceState(null, "", "/#/genres");
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/We couldn’t load the data/)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
  });

  it("keeps the old answer, marked busy, while another option's file loads", async () => {
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) => {
      if (String(url).includes("genres/y2020")) await gate;
      return serve(url);
    });
    const user = await openGenres("#/genres?var=dlg_word_share");
    const before = document.querySelector(".chart-title").textContent;
    await user.selectOptions(screen.getByLabelText("Only include"), "y2020");
    expect(document.querySelector(".genres-page .chart-panel").getAttribute("aria-busy")).toBe("true");
    expect(document.querySelector(".chart-title").textContent).toBe(before);
    release();
    await waitFor(() => expect(document.querySelector(".genres-page .chart-panel").getAttribute("aria-busy")).toBe("false"));
    expect(window.location.hash).toBe("#/genres?var=dlg_word_share&include=y2020");
  });
});

describe("the default genre of “One genre” (D8)", () => {
  it("is the genre last chosen on any page in this visit", async () => {
    window.history.replaceState(null, "", "/#/explore?genre=romance&var=dlg_word_share");
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
    await user.click(within(screen.getByRole("navigation", { name: "Pages" })).getByRole("link", { name: "Genres" }));
    await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
    await user.click(screen.getByRole("radio", { name: "One genre" }));
    await waitFor(() => expect(window.location.hash).toBe("#/genres?view=genre&genre=romance&include=all"));
    expect(screen.getByLabelText("Genre").value).toBe("romance");
  });

  it("is the largest genre when none was chosen; the switch back opens the characteristic, and again the genre chosen", async () => {
    const user = await openGenres("#/genres?var=pov_class");
    await user.click(screen.getByRole("radio", { name: "One genre" }));
    await waitFor(() => expect(window.location.hash).toBe("#/genres?view=genre&genre=fetish&include=all"));
    await user.selectOptions(screen.getByLabelText("Genre"), "tiny");
    await user.click(screen.getByRole("radio", { name: "One characteristic" }));
    // back to the characteristic it came from, with no genre in the address (decision 8)
    await waitFor(() => expect(window.location.hash).toBe("#/genres?var=pov_class&include=all"));
    await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
    expect(document.querySelector(".row.repeat, .row.highlight")).toBeNull();
    // the switch to one genre opens the genre last chosen (D8)
    await user.click(screen.getByRole("radio", { name: "One genre" }));
    await waitFor(() => expect(window.location.hash).toBe("#/genres?view=genre&genre=tiny&include=all"));
    window.history.back();
    await waitFor(() => expect(window.location.hash).toBe("#/genres?var=pov_class&include=all"));
    window.history.back();
    await waitFor(() => expect(window.location.hash).toBe("#/genres?view=genre&genre=tiny&include=all"));
  });
});
