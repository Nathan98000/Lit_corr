// A comparison row's visible name ("One genre", "What changed"): its pieces joined, the words in the row's link and its
// last word, which is kept with the "?" in a copy of the link (ComparisonProfile's nameEnd).
export const rowName = (row) => [...row.querySelectorAll(".profile-label-text")].map((e) => e.textContent).join("");

/** Every row's visible name under `root` (a selector or an element), in order. */
export const rowNames = (root = document, rows = ".profile-row") =>
  [...(typeof root === "string" ? document.querySelectorAll(`${root} ${rows}`) : root.querySelectorAll(rows))].map(rowName);
