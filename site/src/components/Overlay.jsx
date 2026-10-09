import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useMediaQuery from "./useMediaQuery.js";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * A dialog that is a bottom sheet on phones (below 700 px: top at 56 px, scroll locked) and a 560 px popover
 * anchored to its trigger on wider screens. Focus stays inside while it is open; Escape, the close button or a tap
 * outside closes it, and focus goes back to the trigger.
 */
export default function Overlay({ open, onClose, anchor, title, titleId, children, initialFocus, className = "" }) {
  const phone = useMediaQuery("(max-width: 699px)");
  const panel = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open || phone || !anchor?.current) return;
    const place = () => {
      const r = anchor.current.getBoundingClientRect();
      const width = Math.min(560, window.innerWidth - 16);
      setPos({
        left: Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + window.innerWidth - width - 8)),
        top: r.bottom + window.scrollY + 6,
        width,
      });
    };
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
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const body = (
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`${phone ? "sheet" : "popover"} ${className}`}
      style={phone || !pos ? undefined : { left: pos.left, top: pos.top, width: pos.width }}
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
      <div className="overlay-body">{children}</div>
    </div>
  );

  return createPortal(
    <>
      {phone && <div className="scrim" aria-hidden="true" />}
      {body}
    </>,
    document.body,
  );
}
