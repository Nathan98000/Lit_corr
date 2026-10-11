import { lazyPart } from "./lazyPart.jsx";

// How it works, the Genres page, the Trends page and the Patterns page load their code when first visited, or ahead of
// time when a link to them is hovered or focused (F49).
export const Methodology = lazyPart(() => import("./Methodology.jsx"));
export const PatternBrowser = lazyPart(() => import("./PatternBrowser.jsx"));
export const GenresPage = lazyPart(() => import("./GenresPage.jsx"));
export const TrendsPage = lazyPart(() => import("./TrendsPage.jsx"));
