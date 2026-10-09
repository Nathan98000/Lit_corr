// Keeping a menu's active option in view without moving the page (round 3). scrollIntoView() scrolls every
// scrollable ancestor, the window included, so a menu that opened partly below the screen made the whole page jump;
// these scroll only the box that holds the list.

/**
 * Scroll `box` (and nothing else) just enough that `el` is inside it, like scrollIntoView's "nearest": an option
 * above the box's top comes down to it, one below its bottom comes up to it (its top first, if it is taller than the
 * box). Elements outside the box (a dialog's Close button) are left alone.
 */
export function keepInView(box, el) {
  if (!box || !el || !box.contains(el)) return;
  const b = box.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (r.top < b.top) box.scrollTop -= b.top - r.top;
  else if (r.bottom > b.bottom) box.scrollTop += Math.min(r.bottom - b.bottom, r.top - b.top);
}

/** Move focus to `el` without scrolling the page, then bring it into view inside `box`. */
export function focusWithin(box, el) {
  if (!el) return;
  el.focus({ preventScroll: true });
  keepInView(box, el);
}
