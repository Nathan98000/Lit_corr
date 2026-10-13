import { toHash } from "../lib/urlState.js";
import { howToRead, methodSection } from "../lib/wording.js";

/**
 * The notes beside (wide screens, E2) or under (narrow screens, E1) a one-genre chart: how to read the chart, what the
 * characteristic measures and what the measure means, as one-line disclosures at every width (concept N1 of the second
 * review), so the margin is about the chart shown. (The story-age box of totals, "Totals grow with time online.", is
 * gone: the owner, 2026-10-13.)
 */
export default function ChartNotes({ meta, d, wide }) {
  const { variable, metric } = d;

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
      {sections.map((s) => (
        <details key={s.id} className="disclosure">
          <summary>{s.title}</summary>
          <p>{s.body}</p>
        </details>
      ))}
    </div>
  );
}
