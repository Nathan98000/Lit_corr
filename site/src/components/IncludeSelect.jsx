import { useId } from "react";
import { conflictNote, subsetConflict } from "../lib/urlState.js";
import InlineSelect from "./InlineSelect.jsx";

/**
 * "Only include", always a menu, with the options that cannot go with the characteristic turned off inside it (as on
 * the explorer: "Under 2,000 words (not with word count)"): the Genres page offers every option (meta.subsets), the
 * Trends page All stories and the Length options (meta.trend.subsets; with word count, "All stories ▾" and its Length
 * options turned off, round 4's U1, where it was plain words and a note).
 */
export default function IncludeSelect({ subsets, value, variable, onChange }) {
  const ids = useId();
  const groups = new Map();
  for (const s of subsets) {
    if (!groups.has(s.group)) groups.set(s.group, []);
    groups.get(s.group).push(s);
  }
  const anyConflict = Boolean(variable) && subsets.some((s) => subsetConflict(s, variable));
  const option = (s) => {
    const reason = variable ? subsetConflict(s, variable) : null;
    return (
      <option key={s.id} value={s.id} disabled={Boolean(reason)}>
        {s.label}
        {reason ? ` (${reason})` : ""}
      </option>
    );
  };
  const subset = subsets.find((s) => s.id === value);
  return (
    <span className="include include-row">
      <span className="include-label">Only include:</span>{" "}
      <InlineSelect
        id={`${ids}-include`}
        label="Only include"
        value={value}
        text={subset.label}
        onChange={onChange}
        describedBy={anyConflict ? `${ids}-note` : undefined}
      >
        {[...groups.entries()].map(([grp, subs]) =>
          grp ? (
            <optgroup key={grp} label={grp}>
              {subs.map(option)}
            </optgroup>
          ) : (
            subs.map(option)
          ),
        )}
      </InlineSelect>
      {anyConflict && (
        <span className="visually-hidden" id={`${ids}-note`}>
          {conflictNote(variable)}
        </span>
      )}
    </span>
  );
}
