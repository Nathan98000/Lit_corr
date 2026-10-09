import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { focusWithin } from "../lib/listScroll.js";
import useMediaQuery from "./useMediaQuery.js";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
const GAP = 6; // between the trigger and the popover
const MARGIN = 10; // between the popover and the edge of the screen
const MIN_BELOW = 320; // with less room than this under the trigger (and more over it), the popover opens above

/**
 * Where the popover goes (in page coordinates, for `position: absolute`): under its trigger, or over it when there is
 * less than 320 px under it and more room over it, never taller than the room it has, so it always fits on the screen
 * and opening it never scrolls the page; its body scrolls inside instead. Above, it is placed by its bottom edge (the
 * initial containing block is one screen tall at the top of the page), so it keeps hugging the trigger whatever its
 * height. A trigger scrolled off the screen counts from the screen's edge.
 */
export function popoverPlace(r, { screenW, screenH, scrollX, scrollY }) {
  const width = Math.min(560, screenW - 16);
  const left = Math.max(8, Math.min(r.left + scrollX, scrollX + screenW - width - 8));
  const below = screenH - Math.max(r.bottom, 0);
  const above = Math.min(r.top, screenH);
  const up = below < MIN_BELOW && above > below;
  const maxHeight = Math.max(0, Math.min(620, (up ? above : below) - GAP - MARGIN));
  if (up) return { up, left, width, maxHeight, bottom: screenH - (scrollY + above - GAP) };
  return { up, left, width, maxHeight, top: scrollY + Math.max(r.bottom, 0) + GAP };
}

/**
 * A dialog that is a bottom sheet on phones (below 700 px: top at 56 px, scroll locked) and a 560 px popover
 * anchored to its trigger on wider screens. Focus stays inside while it is open; Escape, the close button or a tap
 * outside closes it, and focus goes back to the trigger. Nothing here scrolls the page: every focus() prevents it,
 * and `bodyRef` (the box that scrolls the content) lets the content keep its active option in view inside it.
 */
export default function Overlay({ open, onClose, anchor, title, titleId, children, initialFocus, bodyRef, className = "" }) {
  const phone = useMediaQuery("(max-width: 699px)");
  const panel = useRef(null);
  const body = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open || phone || !anchor?.current) return undefined;
    const place = () =>
      setPos(
        popoverPlace(anchor.current.getBoundingClientRect(), {
          screenW: window.innerWidth,
          screenH: document.documentElement.clientHeight || window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
        }),
      );
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, phone, anchor]);

  // focus the first control on opening, and give focus back to the trigger on closing
  useEffect(() => {
    if (!open) return undefined;
    const trigger = anchor?.current;
    const first = initialFocus?.current || panel.current?.querySelector(FOCUSABLE);
    first?.focus({ preventScroll: true });
    return () => trigger?.focus({ preventScroll: true });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // scroll lock for the sheet (on html as well as body: iOS scrolls the page behind otherwise, F57)
  useEffect(() => {
    if (!open || !phone) return undefined;
    const root = document.documentElement;
    const prev = [root.style.overflow, document.body.style.overflow];
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      [root.style.overflow, document.body.style.overflow] = prev;
    };
  }, [open, phone]);

  // Escape and taps outside close the popover
  useEffect(() => {
    if (!open) return undefined;
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    const away = (e) => {
      if (!panel.current?.contains(e.target) && !anchor?.current?.contains(e.target)) onClose();
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", away);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", away);
    };
  }, [open, onClose, anchor]);

  if (!open) return null;

  const trap = (e) => {
    if (e.key !== "Tab") return;
    const items = [...panel.current.querySelectorAll(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      focusWithin(body.current, last);
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      focusWithin(body.current, first);
    }
  };

  const dialog = (
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`${phone ? "sheet" : "popover"} ${className}`}
      data-placement={phone || !pos ? undefined : pos.up ? "above" : "below"}
      style={
        phone || !pos
          ? undefined
          : { left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight }
      }
      onKeyDown={trap}
    >
      <div className="overlay-head">
        {phone && <div className="grabber" aria-hidden="true" />}
        <div className="overlay-title-row">
          <h2 id={titleId} className="overlay-title">
            {title}
          </h2>
          <button type="button" className="link-button overlay-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div
        className="overlay-body"
        ref={(el) => {
          body.current = el;
          if (bodyRef) bodyRef.current = el;
        }}
      >
        {children}
      </div>
    </div>
  );

  return createPortal(
    <>
      {phone && <div className="scrim" aria-hidden="true" />}
      {dialog}
    </>,
    document.body,
  );
}
