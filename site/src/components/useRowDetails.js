import { useEffect, useRef, useState } from "react";

const KEYS = ["ArrowDown", "ArrowUp", "Home", "End"];

/**
 * The rows of a chart as one tab stop with details on demand (F54, concept K1), shared by the explorer's chart and the
 * Genres page's charts. `ids` are the rows' identities in display order; `frame` is the element that holds the chart
 * and its details (a pointer down outside it hides them); `phone`: no details on hover (a line appearing under the
 * chart would move the page under the pointer). `within` (optional) is the element of the details a row's focus may
 * move to (a link in them), so that the details stay while it does.
 *
 * Returns `shown` ({ i, by: "hover" | "focus" | "tap" } or null), `hide()` and `rowProps(position, id)`: the tab stop
 * (the focused row's, ↑/↓, Home and End move it), hover, focus, and a tap that keeps the details until the same row is
 * tapped again; Escape hides them.
 */
export default function useRowDetails({ ids, frame, phone, within = null }) {
  const [shown, setShown] = useState(null);
  const [focusIdx, setFocusIdx] = useState(0); // the row that holds the chart's tab stop
  const rowEls = useRef([]);

  useEffect(() => {
    if (shown == null) return undefined;
    const away = (e) => {
      if (!frame.current?.contains(e.target)) setShown(null);
    };
    const esc = (e) => {
      if (e.key === "Escape") setShown(null);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [shown, frame]);

  const tabRow = Math.min(focusIdx, Math.max(0, ids.length - 1));

  const onRowKey = (e, ri) => {
    if (!KEYS.includes(e.key)) return;
    e.preventDefault();
    const last = ids.length - 1;
    const next = { ArrowDown: Math.min(last, ri + 1), ArrowUp: Math.max(0, ri - 1), Home: 0, End: last }[e.key];
    setShown({ i: ids[next], by: "focus" });
    setFocusIdx(next);
    rowEls.current[next]?.focus();
  };

  const rowProps = (ri, i) => ({
    ref: (el) => {
      rowEls.current[ri] = el;
    },
    tabIndex: ri === tabRow ? 0 : -1,
    onPointerEnter: (e) => {
      if (e.pointerType === "mouse" && !phone && shown?.by !== "tap") setShown({ i, by: "hover" });
    },
    onPointerLeave: (e) => {
      if (e.pointerType === "mouse") setShown((s) => (s?.by === "hover" ? null : s));
    },
    onFocus: () => {
      setFocusIdx(ri);
      setShown((s) => (s?.by === "tap" ? s : { i, by: "focus" }));
    },
    onBlur: (e) => {
      if (within?.current && e.relatedTarget && within.current.contains(e.relatedTarget)) return;
      setShown((s) => (s?.by === "focus" && s.i === i ? null : s));
    },
    onClick: () => setShown((s) => (s?.by === "tap" && s.i === i ? null : { i, by: "tap" })),
    onKeyDown: (e) => onRowKey(e, ri),
  });

  return { shown, setShown, hide: () => setShown(null), rowProps };
}
