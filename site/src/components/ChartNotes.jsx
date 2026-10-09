import { toHash } from "../lib/urlState.js";
import { RATE_FOR, howToRead, methodSection } from "../lib/wording.js";

/** A story-age warning as a visible box, with its one-tap action. */
function AgeBox({ note, action }) {
  return (
    <div className="agebox">
      <p>
        <b>{note.lead}</b> {note.text}
      </p>
      {action}
    </div>
  );
}

/**
 * The notes beside (wide screens, E2) or under (narrow screens, E1) a one-genre chart: story-age warnings first, as
 * boxes with an action; then how to read the chart, what the characteristic measures and what the measure means
 * (one-line disclosures on narrow screens, plain text in the margin on wide ones).
 */
export default function ChartNotes({ meta, d, view, wide, onChange, ageCheckOpen, onCheckAge, onAgeCheckHint, ageButton }) {
  const { variable, metric } = d;
  const rate = RATE_FOR[metric.id] && meta.metrics.find((m) => m.id === RATE_FOR[metric.id]);
  const boxes = d.ageNotes.map((note) => {
    let action = null;
    if (note.kind === "groups" && view.sub === "all" && !ageCheckOpen) {
      action = (
        <button
          type="button"
          className="link-button"
          ref={ageButton}
          onPointerEnter={onAgeCheckHint}
          onFocus={onAgeCheckHint}
          onClick={onCheckAge}
        >
          Check stories of similar age
        </button>
      );
    } else if (note.kind === "total" && rate) {
      action = (
        <button type="button" className="link-button" onClick={() => onChange({ ...view, metric: rate.id })}>
          Switch to {rate.label.toLowerCase()}
        </button>
      );
    }
    return <AgeBox key={note.kind} note={note} action={action} />;
  });

  const measured = (
    <>
      {variable.description}
      {variable.caveat ? <span className="caveat"> {variable.caveat}</span> : null}{" "}
      <a href={toHash("methodology", { section: methodSection(variable) })}>How was this measured?</a>
    </>
  );
  const sections = [
    { id: "read", title: "How to read this chart", body: howToRead({ smallN: meta.small_n }) },
    { id: "char", title: `What “${variable.label}” measures`, body: measured },
    { id: "measure", title: `What “${metric.label}” means`, body: metric.help },
  ];

  return (
    <div className={wide ? "notes notes-margin" : "notes notes-stack"}>
      {boxes}
      {wide
        ? sections.map((s) => (
            <div key={s.id} className="note-block">
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))
        : sections.map((s) => (
            <details key={s.id} className="disclosure">
              <summary>{s.title}</summary>
              <p>{s.body}</p>
            </details>
          ))}
    </div>
  );
}
