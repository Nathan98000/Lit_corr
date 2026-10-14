import { useLayoutEffect, useRef } from "react";
import { rowDetails, standsOutQuestion } from "../lib/genres.js";
import { REF_SLACK, textWidth } from "../lib/rangeLayout.js";
import { TEXT } from "../lib/tokens.js";
import { toHash } from "../lib/urlState.js";
import TipBody from "./TipBody.jsx";
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
 * name says them) and the link to the genre's own view: the genre and its stories, then its numbers (TipBody, two
 * pairs to a line), the comparison and the link. A tap keeps it, and it can then be clicked; from the keyboard, Tab
 * moves from the row to the link, and Escape goes back to the row.
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
        <TipBody title={row.genre.name} details={details} order={gridOrder} />
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
 * then the link; while the chart is on screen it sticks to the screen's bottom (concept Q1, genres.css). A tap's
 * details are announced; a focused row's name already says the same, so its line is not.
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

export const CARD_MAX = 420; // the card follows its content, up to this width (F70)
const LINK = (genre) => `${standsOutQuestion(genre)} →`;

/**
 * A block's pairs in the order the card's grid places them, two to a line: a block of shares reads down the columns,
 * in the bars' order ("1 story", "2–5", "6–20" down the first column, then "51–100", "101–200" …).
 */
export function gridOrder(block) {
  if (!block.columns) return block.items;
  const down = Math.ceil(block.items.length / 2);
  return block.items.slice(0, down).flatMap((item, j) => (block.items[down + j] ? [item, block.items[down + j]] : [item]));
}

/**
 * About how wide a details card's numbers are: two pairs of columns (label, value, label, value), each block's pairs
 * from its first column, with the gaps and the space after the first pair's value.
 */
export function numbersWidth(details) {
  const cols = [[], [], [], []];
  for (const b of details.blocks) {
    gridOrder(b).forEach(([k, v], j) => {
      cols[(j % 2) * 2].push(textWidth(k, TEXT.note));
      cols[(j % 2) * 2 + 1].push(textWidth(v, TEXT.note));
    });
  }
  const widest = (col) => (col.length ? Math.max(...col) : 0);
  return cols.reduce((sum, col) => sum + widest(col), 0) + 3 * 10 + (cols[1].length ? 12 : 0);
}

/**
 * About how wide a details card is: its first line (the genre and its stories), its numbers and their captions, the
 * comparison and the link, up to CARD_MAX, with its padding and border.
 */
export function cardWidth(row, details) {
  const lines = [
    numbersWidth(details),
    textWidth(row.genre.name, TEXT.note, 700) + (details.stories ? 16 + textWidth(details.stories, TEXT.note) : 0),
    ...details.blocks.map((b) => (b.caption ? textWidth(b.caption.join(" "), TEXT.tick) : 0)),
    details.comparison ? textWidth(`Compared with all genres: ${details.comparison.short}`, TEXT.note, 600) : 0,
    row.all ? 0 : textWidth(LINK(row.genre), TEXT.secondary),
    details.blocks.length ? 0 : Math.min(CARD_MAX, textWidth(details.line, TEXT.note)),
  ];
  return Math.min(CARD_MAX, Math.ceil(Math.max(...lines)) + 26);
}

/**
 * About how tall a details card is (genres.css): its padding and first line, 20 px a line of numbers (or the line of a
 * genre with too few stories) and 22 a caption, 2 apart, 4 more over a block without a caption after another block,
 * then the comparison and the link (two lines when a wider font could wrap it).
 */
export function cardHeight(row, details) {
  const linkLines = row.all ? 0 : textWidth(LINK(row.genre), TEXT.secondary) * REF_SLACK > CARD_MAX - 26 ? 2 : 1;
  const { blocks } = details;
  const numberLines = blocks.length ? blocks.reduce((sum, b) => sum + Math.ceil(b.items.length / 2), 0) : 1;
  const captions = blocks.filter((b) => b.caption).length;
  const spaced = blocks.filter((b, i) => i > 0 && !b.caption && b.items.length && blocks[i - 1].items.length).length;
  const numbers = 20 * numberLines + 22 * captions + 4 * spaced - 2; // no space after the last line
  return 40 + numbers + (details.comparison ? 22 : 0) + (linkLines ? 11 + 20 * linkLines : 0);
}

/**
 * The details of a chart's genres (rows of the Genres page's charts): useRowDetails() for the keyboard and the
 * pointer, the shown genre's numbers, and what the card or the line needs.
 */
export function useGenreDetails({ ids, frame, phone, byIndex, variable, entry, minN }) {
  const detailsRef = useRef(null);
  const { shown, setShown, rowProps } = useRowDetails({ ids, frame, phone, within: detailsRef });
  const active = shown?.i ?? null;
  // on phones the line sticks to the bottom of the screen: a row focused from the keyboard is never left under it
  // (WCAG 2.4.11); a tap leaves the page where it is
  useLayoutEffect(() => {
    if (!phone || shown?.by !== "focus") return;
    const row = document.activeElement;
    const line = detailsRef.current;
    if (!row || !line || !frame.current?.contains(row)) return;
    const box = line.getBoundingClientRect();
    if (!box.height || box.top >= window.innerHeight) return;
    const covered = row.getBoundingClientRect().bottom + 4 - box.top;
    if (covered > 0) window.scrollBy?.(0, covered);
  }, [phone, shown?.i, shown?.by]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const above = geom.y1 + 2 + cardHeight(d.row, d.details) > height;
  // kept inside the chart in a wider font too, as its labels are (REF_SLACK)
  const half = Math.min(CARD_MAX, cardWidth(d.row, d.details) * REF_SLACK) / 2;
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
      style={{ left: Math.min(Math.max(x, half + 4), width - half - 4), top: above ? geom.y0 - 2 : geom.y1 + 2 }}
    />
  );
}
