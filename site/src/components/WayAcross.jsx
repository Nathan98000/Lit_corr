import { prefetchGenres, prefetchTrends, prefetchVariable } from "../lib/data.js";
import { genresSub, onGenresPage, overTimeState, toHash } from "../lib/urlState.js";
import { GenresPage, TrendsPage } from "./pages.js";

/**
 * One way across (round 4's I15): under each one-characteristic chart, one line of links to the same characteristic on
 * the other pages, named the same way and in the same order everywhere: "By genre →" (the Genres page, with this "Only
 * include" option where it offers it, genresSub), "Over time →" (the Trends page, with this genre, overTimeState)
 * and "With popularity →" (Explore, with this genre and `metric`, the measure last used there). A link shows only where
 * its page has the characteristic (the Genres page leaves out month and weekday; the Trends page, meta.trend.excluded),
 * and the page being read (`page`) drops out. Each link's name says the characteristic ("Word count by genre"), its
 * visible words last (label in name); hovering or focusing one fetches its page's code and file ahead of time.
 */
export default function WayAcross({ meta, page, variable, genre = "all", sub = "all", metric = null }) {
  const links = [];
  if (page !== "genres" && onGenresPage(variable)) {
    const offered = genresSub(sub);
    links.push({
      id: "genres",
      words: "By genre",
      href: toHash("genres", { v: variable.id, sub: offered }),
      preload: () => {
        GenresPage.preload();
        prefetchGenres(offered);
      },
    });
  }
  const trends = page !== "trends" && overTimeState(meta, variable, genre);
  if (trends) {
    links.push({
      id: "trends",
      words: "Over time",
      href: toHash("trends", trends),
      preload: () => {
        TrendsPage.preload();
        prefetchTrends(trends.genre);
      },
    });
  }
  if (page !== "explore") {
    links.push({
      id: "explore",
      words: "With popularity",
      href: toHash("explore", { genre, metric, v: variable.id, sub }),
      preload: () => prefetchVariable(variable.id, sub),
    });
  }
  if (!links.length) return null;
  return (
    <p className="way-across">
      {links.map((l) => (
        // a no-break space keeps the "→" with its word
        <a key={l.id} href={l.href} aria-label={`${variable.label} ${l.words.toLowerCase()}`} onPointerEnter={l.preload} onFocus={l.preload}>
          {l.words}
          {" →"}
        </a>
      ))}
    </p>
  );
}
