import { useEffect, useId, useRef, useState } from "react";

/**
 * The masthead's pages (D7, the owner's follow-up to round 4): Popularity, Genres, Trends and How it works, in a row on
 * a wider screen, the page being read underlined. On a phone (styles.css) one button names the page being read beside
 * a menu icon (☰) and opens every page in a panel under the masthead, the page being read marked; the panel lies over
 * the page, so opening it moves nothing, and it closes on a link, Escape (focus back on the button), a tap or click
 * outside it, or focus leaving it. Patterns, a part of Popularity, marks Popularity as the section it is in.
 *
 * `links`: [{ id, label, href, current: "page" | "section" | null, preload }]; `here`: the page being read's name.
 */
export default function SiteNav({ links, here }) {
  const [open, setOpen] = useState(false);
  const navRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => {
      if (!navRef.current?.contains(e.target)) setOpen(false);
    };
    const escape = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <nav
      aria-label="Pages"
      className={`site-nav${open ? " open" : ""}`}
      ref={navRef}
      onBlur={(e) => {
        if (open && !navRef.current?.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="menu-button"
        ref={buttonRef}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(!open)}
      >
        {/* its name starts with what it shows (label in name): "Popularity, menu" */}
        <span className="nav-here">{here}</span>
        <span className="visually-hidden">, menu</span>
        <svg className="menu-icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d="M3 5.5h14M3 10h14M3 14.5h14" />
        </svg>
      </button>
      <ul id={menuId} className="nav-links">
        {links.map((l) => (
          <li key={l.id}>
            <a
              className={`nav-${l.id}`}
              href={l.href}
              aria-current={l.current === "page" ? "page" : l.current ? "true" : undefined}
              onPointerEnter={l.preload}
              onFocus={l.preload}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
