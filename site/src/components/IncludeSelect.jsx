import { useId } from "react";
import { conflictNote, subsetConflict } from "../lib/urlState.js";
import InlineSelect from "./InlineSelect.jsx";

/**
 * The Genres page's "Only include", always a menu, with the options that cannot go with the characteristic turned off
 * inside it (as on the explorer: "Published 2020 or later (not with publication year)"). Both views offer All stories
 * and the year published (onGenresPageSubset: the owner, 2026-10-20, no Length or Readership); the Trends page has no
 * "Only include" at all.
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
