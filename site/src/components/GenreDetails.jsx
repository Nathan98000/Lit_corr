import { standsOutQuestion } from "../lib/genres.js";
import { toHash } from "../lib/urlState.js";

const plainClick = (e) => !(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);

/** A link that opens another view of the Genres page as a new history entry (Back returns). */
export function ViewLink({ to, onNavigate, className, children, ...rest }) {
  return (
    <a
      className={className}
      href={toHash("genres", to)}
      onClick={(e) => {
        if (!plainClick(e)) return;
        e.preventDefault();
        onNavigate(to, { focus: true });
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

/** "What stands out about stories in Romance? →": one genre against all genres (View 2). */
export function StandsOutLink({ genre, sub, onNavigate }) {
  return (
    <ViewLink className="stands-out" to={{ view: "genre", genre: genre.id, sub }} onNavigate={onNavigate}>
      {standsOutQuestion(genre)} →
    </ViewLink>
  );
}

/**
 * A genre's details on wider charts: a card under its row with the numbers (hidden from screen readers, as the row's
 * name says them) and the link to the genre's own view. A tap keeps it, and it can then be clicked; from the keyboard,
 * Tab moves from the row to the link, and Escape goes back to the row.
 */
export function DetailsCard({ row, details, pinned, above, style, cardRef, onLeave, onEscape, sub, onNavigate }) {
  return (
    <div
      ref={cardRef}
      className={`chart-tip genre-tip${pinned ? " pinned" : ""}${above ? " above" : ""}`}
      style={style}
      onBlur={onLeave}
      onKeyDown={(e) => {
        if (e.key === "Escape") onEscape();
      }}
    >
      <div aria-hidden="true">
        <strong>{row.genre.name}</strong>
        {details.items.length ? (
          <dl>
            {details.items.map(([k, v]) => (
              <div key={k} className="tip-item">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>{details.line[0].toUpperCase() + details.line.slice(1)}</p>
        )}
        {details.comparison && (
          <p className="tip-compare">
            Compared with all genres: <b>{details.comparison.short}</b>
          </p>
        )}
      </div>
      {!row.all && <StandsOutLink genre={row.genre} sub={sub} onNavigate={onNavigate} />}
    </div>
  );
}

/**
 * A genre's details in the phone layout (concept K1): a line under the chart with the same numbers as the row's name,
 * then the link. A tap's details are announced; a focused row's name already says the same, so its line is not.
 */
export function DetailsLine({ row, details, by, lineRef, onLeave, onEscape, sub, onNavigate }) {
  const text = row && (
    <>
      <b>{row.genre.name}</b> {details.line}
    </>
  );
  return (
    <div
      ref={lineRef}
      className={`row-details genre-line${row ? "" : " empty"}`}
      onBlur={onLeave}
      onKeyDown={(e) => {
        if (e.key === "Escape") onEscape();
      }}
    >
      <span aria-live="polite">{by === "tap" ? text : null}</span>
      <span aria-hidden="true">{row && by !== "tap" ? text : null}</span>
      {row && !row.all && (
        <>
          {" "}
          <StandsOutLink genre={row.genre} sub={sub} onNavigate={onNavigate} />
        </>
      )}
      {by === "tap" && <span className="muted"> Tap again to close.</span>}
    </div>
  );
}
