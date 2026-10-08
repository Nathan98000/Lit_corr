import { useId, useState } from "react";

/** A small "i" button that shows a short explanation on hover, focus or tap. */
export default function InfoTip({ label, children }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="infotip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="infotip-button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      {open && (
        <span role="tooltip" id={id} className="infotip-body">
          {children}
        </span>
      )}
    </span>
  );
}
