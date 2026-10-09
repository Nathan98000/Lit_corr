import { useRef } from "react";
import { rowDetails, standsOutQuestion } from "../lib/genres.js";
import { toHash } from "../lib/urlState.js";
import useRowDetails from "./useRowDetails.js";

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

/** About how tall a details card is (its title, a line per number, the comparison and the link). */
export const cardHeight = (details) => 70 + 19 * details.items.length + (details.comparison ? 22 : 0);

/**
 * The details of a chart's genres (rows of the Genres page's charts): useRowDetails() for the keyboard and the
 * pointer, the shown genre's numbers, and what the card or the line needs.
 */
export function useGenreDetails({ ids, frame, phone, byIndex, variable, entry, minN }) {
  const detailsRef = useRef(null);
  const { shown, setShown, rowProps } = useRowDetails({ ids, frame, phone, within: detailsRef });
  const active = shown?.i ?? null;
  const row = active == null ? null : byIndex.get(active);
  return {
    shown,
    active,
    row,
    details: row ? rowDetails(row, variable, entry, minN) : null,
    rowProps,
    detailsRef,
    // focus leaving the details for somewhere outside the chart hides details that focus showed
    leave: (e) => {
      if (!frame.current?.contains(e.relatedTarget)) setShown((s) => (s?.by === "focus" ? null : s));
    },
    backToRow: () => {
      frame.current?.querySelector(".row[tabindex='0']")?.focus();
      setShown(null);
    },
  };
}

/**
 * The shown genre's details: a line under the chart on phones, else a card under its row (above it near the chart's
 * end), centered on `x` and kept inside the chart.
 */
export function GenreRowDetails({ d, phone, geom, x, height, width, sub, onNavigate }) {
  if (phone) {
    return (
      <DetailsLine
        row={d.row}
        details={d.details}
        by={d.shown?.by}
        lineRef={d.detailsRef}
        onLeave={d.leave}
        onEscape={d.backToRow}
        sub={sub}
        onNavigate={onNavigate}
      />
    );
  }
  if (!d.row || !geom) return null;
  const above = geom.y1 + cardHeight(d.details) > height;
  return (
    <DetailsCard
      row={d.row}
      details={d.details}
      pinned={d.shown.by === "tap"}
      above={above}
      cardRef={d.detailsRef}
      onLeave={d.leave}
      onEscape={d.backToRow}
      sub={sub}
      onNavigate={onNavigate}
      style={{ left: Math.min(Math.max(x, 140), width - 140), top: above ? geom.y0 - 2 : geom.y1 + 2 }}
    />
  );
}
