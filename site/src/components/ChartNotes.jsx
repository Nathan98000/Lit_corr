import { toHash } from "../lib/urlState.js";
import { RATE_FOR, howToRead, methodSection } from "../lib/wording.js";

/**
 * The notes beside (wide screens, E2) or under (narrow screens, E1) a one-genre chart: for a total, the story-age box
 * first, open, with its one-tap switch to the per-month or per-1,000-views measure; then how to read the chart, what
 * the characteristic measures and what the measure means, as one-line disclosures at every width (concept N1 of the
 * second review), so the margin is about the chart shown.
 */
export default function ChartNotes({ meta, d, view, wide, onChange }) {
  const { variable, metric, totalsNote: note } = d;
  const rate = RATE_FOR[metric.id] && meta.metrics.find((m) => m.id === RATE_FOR[metric.id]);

  const measured = (
    <>
      {variable.description}
      {variable.caveat ? <span className="caveat"> {variable.caveat}</span> : null}{" "}
      <a href={toHash("methodology", { section: methodSection(variable) })}>How was this measured?</a>
    </>
  );
  const sections = [
    {
      id: "read",
      title: "How to read this chart",
      body: howToRead({ smallN: meta.small_n }),
    },
    { id: "char", title: `What “${variable.label}” measures`, body: measured },
    { id: "measure", title: `What “${metric.label}” means`, body: metric.help },
  ];

  return (
    <div className={wide ? "notes notes-margin" : "notes notes-stack"}>
      {note && (
        <div className="agebox">
          <p>
            <b>{note.lead}</b> {note.text}
          </p>
          {rate && (
            <button type="button" className="link-button" onClick={() => onChange({ ...view, metric: rate.id })}>
              Switch to {rate.label.toLowerCase()}
            </button>
          )}
        </div>
      )}
      {sections.map((s) => (
        <details key={s.id} className="disclosure">
          <summary>{s.title}</summary>
          <p>{s.body}</p>
        </details>
      ))}
    </div>
  );
}
