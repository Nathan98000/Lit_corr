import { useId } from "react";
import { conflictNote, subsetConflict } from "../lib/urlState.js";
import InlineSelect from "./InlineSelect.jsx";

/**
 * "Only include", with the options that cannot go with the characteristic turned off (as on the explorer): the Genres
 * page offers every option (meta.subsets), the Trends page All stories and the Length options (meta.trend.subsets).
 * With `omitConflicts` (the Trends page) those options are left out instead; when only one is left, it is plain text,
 * with a short note: "Only include: All stories · Length options don’t apply to word count".
 */
export default function IncludeSelect({ subsets: offered, value, variable, onChange, omitConflicts = false }) {
  const ids = useId();
  const left = omitConflicts && variable ? offered.filter((s) => subsetConflict(s, variable)) : [];
  const subsets = left.length ? offered.filter((s) => !left.includes(s)) : offered;
  if (left.length && subsets.length === 1) {
    const groups = [...new Set(left.map((s) => s.group))].join(" and ");
    return (
      <span className="include include-row include-fixed">
        <span className="include-label">Only include:</span> <span className="include-value">{subsets[0].label}</span>{" "}
        <span className="include-why">
          {groups} options don’t apply to {variable.label.toLowerCase()}
        </span>
      </span>
    );
  }
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
