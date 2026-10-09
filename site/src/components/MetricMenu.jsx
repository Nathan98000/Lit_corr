import { useEffect, useId, useLayoutEffect, useState } from "react";
import { keepInView } from "../lib/listScroll.js";

export const MEASURE_NOTE =
  "Totals keep growing while a story is online; per-month and per-1,000-views measures make old and new stories " +
  "easier to compare.";

/**
 * The popularity-measure menu (it replaces the old select and its "i"): a listbox grouped as meta.metric_groups says
 * ("Rating / Per 1,000 views / Per month online / Totals so far"), each option with its one-line help. Arrows,
 * Home/End, Enter; Escape closes.
 *
 * This is the body of the "Popularity measure" sheet or popover; it loads with its own code (F49), so it takes focus
 * itself when it arrives. `focusRef` is the listbox. `labelledBy` is the id of the sheet's title. `scrollRef` is the
 * box that scrolls the sheet's content: the active option is kept in view by scrolling it, never the page.
 */
export default function MetricMenu({ meta, value, onPick, focusRef, scrollRef, labelledBy }) {
  const base = useId().replace(/:/g, "");
  const listRef = focusRef;
  const ordered = meta.metric_groups.flatMap((g) => meta.metrics.filter((m) => m.group === g));
  const [active, setActive] = useState(() => Math.max(0, ordered.findIndex((m) => m.id === value)));

  useEffect(() => {
    listRef.current?.focus({ preventScroll: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    keepInView(scrollRef?.current, document.getElementById(`${base}-m-${active}`));
  }, [active, base, scrollRef]);

  const onKeyDown = (e) => {
    const last = ordered.length - 1;
    if (e.key === "ArrowDown") setActive((a) => Math.min(last, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Enter" || e.key === " ") onPick(ordered[active].id);
    else return;
    e.preventDefault();
  };

  return (
    <>
      <p className="menu-note">{MEASURE_NOTE}</p>
      <div
        ref={listRef}
        role="listbox"
        tabIndex={0}
        aria-labelledby={labelledBy}
        aria-activedescendant={`${base}-m-${active}`}
        className="pick-list"
        onKeyDown={onKeyDown}
      >
        {meta.metric_groups.map((g) => {
          const items = meta.metrics.filter((m) => m.group === g);
          if (!items.length) return null;
          return (
            <ul key={g} role="group" aria-labelledby={`${base}-g-${g.replace(/\W/g, "")}`} className="pick-group">
              <li role="presentation" id={`${base}-g-${g.replace(/\W/g, "")}`} className="pick-section">
                {g}
              </li>
              {items.map((m) => {
                const i = ordered.indexOf(m);
                return (
                  <li
                    key={m.id}
                    id={`${base}-m-${i}`}
                    role="option"
                    aria-selected={m.id === value}
                    className={`pick${i === active ? " active" : ""}${m.id === value ? " current" : ""}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => onPick(m.id)}
                  >
                    <span className="pick-label">
                      {m.label}
                      {m.id === value && <span className="pick-current"> · shown now</span>}
                    </span>
                    <span className="pick-desc">{m.help.split(/(?<=\.)\s/)[0]}</span>
                  </li>
                );
              })}
            </ul>
          );
        })}
      </div>
    </>
  );
}
