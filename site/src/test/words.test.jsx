// Round 2's words: F40 (the takeaway), F44 (what weak, moderate and strong mean), F55 (story counts) and F56 (the
// rating axis).
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import RangeChart from "../components/RangeChart.jsx";
import { clearCache } from "../lib/data.js";
import { fixtureFetch, fixtureMeta } from "./fixtures.js";

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
});

async function renderApp(hash = "") {
  if (hash) window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
  return user;
}

/** The fixtures, with the pattern of dialogue share in Romance not computed (too few stories at an end). */
function tooFewFetch() {
  const serve = fixtureFetch();
  return async (url) => {
    const res = await serve(url);
    if (!String(url).includes("v/dlg_word_share/all.json")) return res;
    const body = await res.json();
    body.g.romance.p = body.g.romance.p.map(() => [0, null]);
    return { ok: true, status: 200, json: async () => body };
  };
}

const takeaway = () => document.querySelector(".takeaway");

describe("F40, F44: the takeaway", () => {
  it("names the strength of a clear pattern in one short sentence and links the word to its definition", async () => {
    await renderApp("#/explore?var=dlg_word_share");
    expect(takeaway().textContent).toMatch(
      /^Median: [\d.]+ for “Under 10%”, [\d.]+ for “40%\+”\. A strong pattern; individual stories vary a lot within every group\.$/,
    );
    const link = within(takeaway()).getByRole("link", { name: "strong" });
    expect(link.getAttribute("href")).toBe("#/methodology/tend-to");
  });

  it("says briefly why there is no clear pattern, with the existing link", async () => {
    await renderApp("#/explore?genre=romance&var=dlg_word_share");
    expect(document.querySelector(".chart-title").textContent).toBe("No clear pattern");
    expect(takeaway().textContent).toMatch(/\. The groups differ only a little, or not consistently\. Why no clear pattern\?$/);
    expect(within(takeaway()).getByRole("link", { name: "Why no clear pattern?" }).getAttribute("href")).toBe("#/methodology/tend-to");
  });

  it("says when a pattern is judged, instead of repeating the heading", async () => {
    vi.stubGlobal("fetch", tooFewFetch());
    await renderApp("#/explore?genre=romance&var=dlg_word_share");
    expect(document.querySelector(".chart-title").textContent).toBe("Too few stories to judge a pattern");
    expect(takeaway().textContent).toMatch(/\. A pattern is judged only when the groups at both ends have at least 30 stories\.$/);
  });

  it("has no note for groups without an order; the heading says it, and How to read is the usual paragraph", async () => {
    await renderApp("#/explore?var=pov_class");
    expect(document.querySelector(".chart-title").textContent).toBe("Each group on its own");
    expect(takeaway()).toBeNull();
    const howTo = screen.getByText("How to read this chart", { selector: "summary" }).parentElement;
    expect(howTo.textContent).toMatch(/deserve less trust\.$/);
    expect(howTo.textContent).not.toMatch(/without an order|summed up|one trend/); // the owner's follow-up
  });

  it("defines weak, moderate and strong in How it works", async () => {
    window.history.replaceState(null, "", "/#/methodology/tend-to");
    render(<App />);
    expect(
      await screen.findByText(
        "Weak, moderate and strong describe how consistently popularity rises or falls across the groups, on a rank " +
          "correlation from 0 (no consistent order) to 1 (a perfectly consistent one): weak below 0.2, moderate from " +
          "0.2 to 0.4, strong 0.4 or more. Even a strong pattern leaves individual stories varying widely.",
      ),
    ).toBeTruthy();
  });
});

describe("F41: the notes beside the chart on wide screens (concept N1)", () => {
  it("folds the three explanations into one-line disclosures, with no story-age box", async () => {
    const original = window.matchMedia;
    window.matchMedia = (q) => ({ matches: q === "(min-width: 900px)", addEventListener() {}, removeEventListener() {} });
    try {
      await renderApp("#/explore?var=dlg_word_share&metric=pop_views");
      const margin = document.querySelector(".notes-margin");
      expect(margin).toBeTruthy();
      expect(within(margin).queryByText(/Totals grow with time online/)).toBeNull();
      const folded = [...margin.querySelectorAll("details.disclosure")];
      expect(folded.map((d) => d.querySelector("summary").textContent)).toEqual([
        "How to read this chart",
        "What “Dialogue share” measures",
        "What “Views” means",
      ]);
      expect(folded.every((d) => !d.open)).toBe(true);
      expect(margin.querySelector("h3")).toBeNull(); // no headed blocks of text any more
    } finally {
      window.matchMedia = original;
    }
  });
});

describe("F55: story counts", () => {
  it("links the chart's story count to Missing data", async () => {
    await renderApp("#/explore?var=dlg_word_share");
    const sub = document.querySelector(".chart-sub");
    expect(sub.textContent).toBe("All genres · 278 stories");
    expect(within(sub).getByRole("link", { name: "278 stories" }).getAttribute("href")).toBe("#/methodology/missing-data");
  });

  it("says “about 13,000 stories” in the kicker before and after the data arrives", async () => {
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) => {
      if (String(url).endsWith("meta.json")) {
        await gate;
        const meta = { ...fixtureMeta, counts: { ...fixtureMeta.counts, included: 12568 } };
        return { ok: true, status: 200, json: async () => meta };
      }
      return serve(url);
    });
    render(<App />);
    const kicker = screen.getByRole("heading", { level: 1 });
    expect(kicker.textContent).toBe("What do popular Literotica stories have in common? · about 13,000 stories · 30 genres");
    release();
    await waitFor(() => expect(kicker.textContent).toMatch(/· about 13,000 stories · 3 genres$/));
  });
});

describe("F56: the rating axis", () => {
  const rating = { id: "pop_rating", label: "Average rating", format: "rating" };
  const variable = fixtureMeta.variables.find((v) => v.id === "dlg_word_share");
  const stats = (median) => ({ n: 100, median, p25: median - 0.15, p75: median + 0.1, mean: median });
  const rows = [4.19, 4.4, 4.65].map((m, index) => ({ index, label: `Group ${index + 1}`, stats: stats(m) }));

  it("starts a zoomed axis on a labeled tick, and its title is the measure's name with its scale (round 4's L1)", () => {
    const { container } = render(
      <RangeChart rows={rows} overall={stats(4.4)} metric={rating} variable={variable} smallN={30} minN={10} title="T" n={300} />,
    );
    // never "(the axis starts at X)" (the owner's follow-up, 4); the stars are the scale's words, kept in wording.js
    expect(container.querySelector(".axis-title").textContent).toBe("Average rating (1 to 5 stars)");
    const first = container.querySelector(".tick-mark");
    const start = Number(first.getAttribute("data-v"));
    expect(start).toBeGreaterThan(3);
    expect(start).toBeLessThan(4.04);
    expect(Number(first.querySelector("text").textContent)).toBeCloseTo(start); // where the axis starts is printed
    expect(container.textContent).not.toMatch(/axis starts/);
  });

  it("says nothing more for axes that start at zero", () => {
    const fav = fixtureMeta.metrics.find((m) => m.id === "pop_fav_per_1k_views");
    const { container } = render(
      <RangeChart rows={rows} overall={stats(4.4)} metric={fav} variable={variable} smallN={30} minN={10} title="T" n={300} />,
    );
    expect(container.querySelector(".axis-title").textContent).toBe("Favorites per 1,000 views");
  });
});
