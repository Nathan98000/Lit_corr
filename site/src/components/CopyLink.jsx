import { useEffect, useRef, useState } from "react";

/** "Copy link": copies the address; where the clipboard is unavailable, shows it selected in a read-only field. */
export default function CopyLink({ className = "btn" }) {
  const [state, setState] = useState("idle"); // idle | copied | manual
  const field = useRef(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (state === "manual") field.current?.select();
  }, [state]);

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(window.location.href);
      setState("copied");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("manual");
    }
  };

  return (
    <span className="copy-link">
      <button type="button" className={className} onClick={copy}>
        {state === "copied" ? "Link copied" : "Copy link"}
      </button>
      <span className="visually-hidden" role="status">
        {state === "copied" ? "Link copied" : ""}
      </span>
      {state === "manual" && (
        <label className="copy-manual">
          <span>Copy this link:</span>
          <input ref={field} type="text" readOnly value={window.location.href} onFocus={(e) => e.target.select()} />
        </label>
      )}
    </span>
  );
}
