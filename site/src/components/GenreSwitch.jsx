import { useId } from "react";

/**
 * A two-option segmented control: a radio group (the view switch; the order, drawn compact on its own line). The
 * compact switch is 36 px tall to the eye with a 44 px target (genres.css).
 */
export default function Segmented({ label, options, value, onChange, className = "" }) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={`segmented ${className}`}>
      {options.map(([id, text]) => (
        <label key={id} className={value === id ? "on" : undefined}>
          <input type="radio" name={name} value={id} checked={value === id} onChange={() => onChange(id)} />
          <span>{text}</span>
        </label>
      ))}
    </div>
  );
}
