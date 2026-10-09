import { useState } from "react";
import { cellDetail, stepFill } from "../lib/compare.js";
import { formatRatio, formatValue } from "../lib/format.js";

const STEPS = [
  ["#eea877", "≤0.67×"],
  ["#f6cfb1", "≤0.8×"],
  ["#fbe7d7", "≤0.91×"],
  [null, "about the same"],
  ["#e1ebfd", "≥1.1×"],
  ["#bcd3fa", "≥1.25×"],
  ["#8fb4f4", "≥1.5×"],
];

/**
 * The numbers behind the genre cards (concept D1, repaired): each group's median as a multiple of its genre's
 * median, in stepped colors with no fill between 0.91× and 1.1× and none for groups under 30 stories; the verdict
 * next to the sticky genre names. Tapping or focusing a cell shows its median, size and the genre's median.
 */
export default function CompareTable({ rows, variable, metric, smallN, minN, id }) {
  const fmt = (v) => formatValue(v, metric.format);
  const showVerdict = variable.bins.ordered || Boolean(variable.yes_subject);
  const [detail, setDetail] = useState("");

  return (
    <div className="compare-numbers" id={id}>
      <div className="compare-scroll">
        <table className="compare-table">
          <caption className="visually-hidden">
            {metric.label} by {variable.noun}: each group’s median as a multiple of its genre’s median
          </caption>
          <thead>
            <tr>
              <th scope="col" className="genre-col">
                Genre
              </th>
              {showVerdict && (
                <th scope="col" className="verdict-col">
                  Pattern
                </th>
              )}
              {variable.bins.labels.map((label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.genre.id} className={row.genre.id === "all" ? "all-row" : undefined}>
                <th scope="row" className="genre-col">
                  {row.genre.name}
                </th>
                {showVerdict && (
                  <td className={`verdict-col verdict ${row.verdict?.kind || ""}`}>
                    {row.verdict ? `${row.verdict.arrow ? `${row.verdict.arrow} ` : ""}${row.verdict.text}` : ""}
                  </td>
                )}
                {row.cells.map((c) => {
                  const text = cellDetail(row, c, fmt, minN);
                  return (
                    <td
                      key={c.label}
                      tabIndex={0}
                      className={`cell${c.hidden ? " empty" : ""}${c.small ? " small" : ""}`}
                      style={{ background: stepFill(c.ratio, c.small) || undefined }}
                      aria-label={text}
                      onFocus={() => setDetail(text)}
                      onClick={() => setDetail(text)}
                    >
                      {c.hidden ? "–" : formatRatio(c.ratio)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* after the table and sticky at the bottom of the screen, so a tapped cell's numbers are always in view (F53) */}
      <p className="cell-detail" aria-live="polite">
        {detail || "Tap or focus a cell for its numbers."}
      </p>
      <ul className="step-legend" aria-label="Colors">
        {STEPS.map(([color, text]) => (
          <li key={text}>
            <span className="swatch" style={{ background: color || "transparent" }} />
            {text}
          </li>
        ))}
        <li>
          <span className="swatch small" />
          fewer than {smallN} stories: not colored
        </li>
      </ul>
    </div>
  );
}
