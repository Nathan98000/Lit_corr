/**
 * A native <select> that looks like a word in a sentence: the chosen option is shown as text, and the select lies
 * transparent on top of it, so the phone's own picker opens on a tap and the sentence does not stretch to the
 * longest option.
 */
export default function InlineSelect({ id, label, value, text, onChange, children, describedBy }) {
  return (
    <span className="inline-select slot">
      <span className="slot-text" aria-hidden="true">
        <SlotWords text={text} />
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

/**
 * A slot's words with its caret; the last word and the caret never part, so the caret never starts a line (F59). A
 * zero-width space counts as a word's end too (the Genres page puts one after a genre name's slash).
 */
export function SlotWords({ text }) {
  const cut = Math.max(text.lastIndexOf(" "), text.lastIndexOf("\u200b")) + 1;
  return (
    <>
      {text.slice(0, cut)}
      <span className="slot-end">
        {text.slice(cut)}
        <Caret />
      </span>
    </>
  );
}
