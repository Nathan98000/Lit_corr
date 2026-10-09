import { lazyPart } from "./lazyPart.jsx";

// How it works and the Patterns page load their code when first visited, or ahead of time when a link to them is
// hovered or focused (F49).
export const Methodology = lazyPart(() => import("./Methodology.jsx"));
export const PatternBrowser = lazyPart(() => import("./PatternBrowser.jsx"));
