/**
 * A native <select> that looks like a word in a sentence: the chosen option is shown as text, and the select lies
 * transparent on top of it, so the phone's own picker opens on a tap and the sentence does not stretch to the
 * longest option.
 */
export default function InlineSelect({ id, label, value, text, onChange, children, describedBy }) {
  return (
    <span className="inline-select slot">
      <span className="slot-text" aria-hidden="true">
        {text}
        <Caret />
      </span>
      <select id={id} aria-label={label} aria-describedby={describedBy} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </span>
  );
}

export function Caret() {
  return (
    <svg className="caret" width="13" height="9" viewBox="0 0 13 9" aria-hidden="true">
      <path d="M1.5 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
