import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { comparisonBar, noDifferenceZone, numberPlace } from "../lib/genres.js";
import { mixColors } from "../lib/genreLayout.js";
import { scrollBehavior } from "../lib/motion.js";
import { PHONE, STACKED, textWidth } from "../lib/rangeLayout.js";
import DownloadPng from "./DownloadPng.jsx";
import useMediaQuery from "./useMediaQuery.js";
import useWidth from "./useWidth.js";

// A comparison of two sides, characteristic by characteristic (D10): the Genres page's "One genre" (a genre's stories
// against all genres') and the Trends page's "What changed" (stories from 2020 or later against stories from
// 2000–2009). The rows (concept R3), the lists, the topics, the notes, the way back and "Download PNG" of the lists are
// here; each page gives its words (the two sides' names and short heads, the list titles, the axis title, the zone's
// words, the note, the topics' line) and its row (the columns' numbers, the row's name and where it leads). "What
// changed" opts in to its own row and lists (`changes`: values first, a zoomed scale, the note above the lists, marked
// titles, the bars in time's order, tags on the unit line); without it, "One genre" draws as it always has. The styles
// are in comparison.css, which genres.css and trends.css import (the opt-ins' in trends.css).

const SHOWN = 7; // rows of a list before "Show all"

const markOf = (item) => (item.kind === "grp" ? "≠" : item.f > 0 ? "▲" : "▼");
const characteristics = (n) => `${n} characteristic${n === 1 ? "" : "s"}`;

// The one grid of every list and open topic (F81; comparison.css draws it with the same numbers): wide, the label (with
// its unit under it) · the plot · the first side's number · the second's · "›"; stacked (a chart under STACKED), the
// label and the numbers on one line and the plot across the row under them. The plot keeps PAD px at each end for its
// dots.
const WIDE = { label: 250, n: 76, chev: 14, gap: 12 };
const NARROW = { n: 58, chev: 12, gap: 12 };
const PAD = 2;
const UNIT_KEPT = 18; // a unit line up to this long never breaks inside; a longer one takes a line of its own
const TICKS = [0, 25, 50, 75, 100];
const FULL = { lo: 0, hi: 100, ticks: TICKS }; // the whole 0–100 scale ("One genre")
const VALUES = { min: 120, max: 180, size: 13.5, room: 8 }; // the values' column: its widest value and some room
const DOT = { out: 5, quiet: 3.5 }; // radii: a 10 px dot for a stand-out, 7 px for a row that doesn't stand out
const HEADS_UNDER = 328; // a chart this narrow (a window under 360 px) puts a list's columns' heads under its title

/**
 * The plot's width in px, for the numbers' placement: the same in every list and open topic. With the values first
 * (`valuesW`: their column's width), wide: the label · the values · the plot · "›".
 */
export const plotWidth = (width, stacked, valuesW = null) => {
  if (stacked) return width - 2 * PAD;
  if (valuesW != null) return width - WIDE.label - valuesW - WIDE.chev - 3 * WIDE.gap - 2 * PAD;
  return width - WIDE.label - 2 * WIDE.n - WIDE.chev - 4 * WIDE.gap - 2 * PAD;
};

/** A place on the plot's scale as a percent of its width: itself on the whole scale, else within { lo, hi }. */
const placeOn = (scale) => (scale === FULL ? (v) => v : (v) => ((v - scale.lo) / (scale.hi - scale.lo)) * 100);

/**
 * The values' column for "What changed" (values first): as wide as its widest value on the page, every list and topic
 * alike, with some room, within VALUES' bounds.
 */
export const valuesWidth = (texts) =>
  Math.min(VALUES.max, Math.max(VALUES.min, Math.ceil(Math.max(0, ...texts.map((t) => textWidth(t, VALUES.size)))) + VALUES.room));

/**
 * The plot of one row (concept R3), on one scale for every row: how often a story from the first side is the higher
 * one against a story from the second, out of 100. The zone of no clear difference (the rule's 40 to 60) is shaded,
 * its edges drawn (they carry the rule's thresholds), with a line at 50; a stem runs from 50 to 50 × (1 + r) with a dot
 * at its end: a 10 px accent dot for a stand-out, a 7 px gray dot otherwise (a hollow dot means "fewer than 30
 * stories" elsewhere on the site, so these are filled). The number sits beside the dot (numberPlace). Named groups keep
 * their two thin 100% bars, the first side's above the second's (`thenAbove`: the second side's above, "What
 * changed"'s time order). The geometry is in percent of the plot, so the plot takes whatever width its cell has; a
 * zoomed `scale` shows part of the 0–100 scale. With the values first, every number is drawn alike, the values being
 * the row's main read (`plain`). Rows not compared say so instead.
 */
function RowPlot({ item, zone, plotW, scale = FULL, thenAbove = false, plain = false }) {
  if (item.r == null) return <span className="profile-few">Too few stories to compare</span>;
  if (item.kind === "grp") {
    const colors = mixColors("grp", item.all.shares);
    const bar = (shares, y) => {
      let x = 0;
      return shares.map((share, b) => {
        const seg = { b, x, width: share * 100 };
        x += seg.width;
        return seg.width > 0 ? (
          <rect key={b} x={`${seg.x}%`} y={y} width={`${seg.width}%`} height={7} className={`segment ${colors[b].cls}`} />
        ) : null;
      });
    };
    const [top, under] = thenAbove ? [item.all.shares, item.stats.shares] : [item.stats.shares, item.all.shares];
    return (
      <svg width="100%" height={20} className="profile-plot">
        {bar(top, 1)}
        {bar(under, 12)}
      </svg>
    );
  }
  const b = comparisonBar(item.r, { flagged: Boolean(item.f), zone });
  const x = placeOn(scale);
  const quiet = item.f ? "" : " quiet";
  const dotR = item.f ? DOT.out : DOT.quiet;
  const textW = item.f && !plain ? textWidth(String(b.times), 13, 600) : textWidth(String(b.times), 12);
  const at = numberPlace(item.r, zone, { plotW, dotR, textW, scale: scale === FULL ? null : scale });
  return (
    <svg width="100%" height={22} className="profile-plot">
      <rect className="p2-zone" x={`${x(zone[0])}%`} y={2} width={`${x(zone[1]) - x(zone[0])}%`} height={18} />
      <line className="p2-edge" x1={`${x(zone[0])}%`} x2={`${x(zone[0])}%`} y1={2} y2={20} />
      <line className="p2-edge" x1={`${x(zone[1])}%`} x2={`${x(zone[1])}%`} y1={2} y2={20} />
      <line className="p2-mid" x1={`${x(50)}%`} x2={`${x(50)}%`} y1={0} y2={22} />
      {b.to > b.from && <line className={`p2-stem${quiet}`} x1={`${x(b.from)}%`} x2={`${x(b.to)}%`} y1={11} y2={11} />}
      <circle className={`p2-dot${quiet}`} cx={`${x(b.end)}%`} cy={11} r={dotR} />
      <text className={`p2-num${quiet}`} x={`${at.x}%`} dx={at.dx} y={15.5} textAnchor={at.anchor}>
        {b.times}
      </text>
    </svg>
  );
}

/** A number column's cell: the main number, and a second small line where there is one ("–" without the numbers). */
function Numbers({ col, all = false }) {
  return (
    <span className={`profile-n${all ? " all" : ""}`} aria-hidden="true">
      {col ? col[0] : "–"}
      {col?.[1] && <small>{col[1]}</small>}
    </span>
  );
}

/**
 * A named group's unit line: the name of the group whose numbers the row prints, after a swatch of its color in the
 * bars (`cls`), the swatch kept with the name's first word.
 */
function GroupName({ name, cls }) {
  const [first, ...rest] = name.split(" ");
  return (
    <>
      <span className="profile-swatch-lead">
        <span className={`profile-swatch ${cls}`} />
        {first}
      </span>
      {rest.length > 0 && ` ${rest.join(" ")}`}
    </>
  );
}

/**
 * A named group's key under its bars, as View 1's legend is: every group's swatch and name, in the bars' order
 * (`colors`: mixColors' classes). Hidden from screen readers, as the bars are: the row's name has every share.
 */
function GroupKey({ labels, colors }) {
  return (
    <span className="profile-key">
      {labels.map((label, b) => (
        <span key={label} className="profile-key-item">
          <span className={`profile-swatch ${colors[b].cls}`} />
          {label}
        </span>
      ))}
    </span>
  );
}

/**
 * A row's unit lines (F85, decision 7), with the page's tags at the end of the last one ("per 1,000 words ·
 * borderline"; `row.tags`): { unit, of, tags }, a line with tags given as its pieces (the line's words, then each tag;
 * `tags` alone when the row has no unit line). Without tags, the lines' words as before.
 */
function unitLines(cols, tags) {
  if (!tags.length) return { unit: cols.unit, of: cols.of, tags: null };
  if (cols.of) return { unit: cols.unit, of: [cols.of, ...tags], tags: null };
  if (cols.unit && cols.group == null) return { unit: [cols.unit, ...tags], of: null, tags: null };
  return { unit: cols.unit, of: null, tags };
}

/** A unit line's words as one string (the image's, which wraps them itself): "per 1,000 words · borderline". */
const lineWords = (line) => (Array.isArray(line) ? line.join("\u00a0·\u00a0") : line);

/**
 * A unit line with tags: each piece kept whole (a unit never breaks inside; a long tag wraps between its words), each
 * tag led by its "·", which is clipped when the tag starts a line, so no line starts or ends with it (trends.css, as the
 * kicker's separators).
 */
const TaggedLine = ({ pieces }) => (
  <span className="profile-tagged">
    {pieces.map((t, k) => (
      <span key={t} className={`profile-tag-piece${t.length > UNIT_KEPT ? " long" : ""}`}>
        {k > 0 && <span className="profile-tag-sep"> · </span>}
        {t}
      </span>
    ))}
  </span>
);

/**
 * One characteristic (concept R3, F85, F87, F92): a link (the page's `row.link`) to its numbers elsewhere. Its label,
 * with its unit line, the plot, the two columns' numbers (`row.columns`: { genre, all, unit, group, of }, the first
 * side's column and the second's) and "›"; with the values first ("What changed", `layout.valuesFirst`), the label,
 * the values (`row.values`: "51.6 → 38.8 (−25%)"), the plot and "›". Its accessible name is its content, with no aria-label: one visually hidden
 * line that says the label, the dot's number, the numbers in reading order, the unit and how it compares (`row.name`);
 * the visible parts are hidden from screen readers, since their words are all there in that order. (Visible text
 * followed by hidden text would read "Sexual language : 26 in 100" in Chrome, which puts a space before a box taken
 * out of the flow.) In a topic (`marks`), a stand-out's ▲ ▼ ≠ sits in a column before the label. A named group's unit
 * line names its printed group, then "% of stories" on a line of its own; where its bars are drawn (not with too few
 * stories to compare), the name follows a swatch of that group's color and the bars have a key of every group under
 * them.
 */
function ProfileRow({ item, row, zone, layout, marks }) {
  const { plotW, valuesFirst } = layout;
  const cols = row.columns(item);
  const lines = unitLines(cols, row.tags ? row.tags(item) : []);
  const values = valuesFirst && row.values(item);
  const colors = cols.group != null && item.r != null && mixColors("grp", item.all.shares);
  const plot = (
    <span className="profile-plot-cell" aria-hidden="true">
      <RowPlot item={item} zone={zone} plotW={plotW} scale={layout.scale} thenAbove={layout.thenAbove} plain={valuesFirst} />
      {colors && <GroupKey labels={item.variable.bins.labels} colors={colors} />}
    </span>
  );
  const children = (
    <>
      <span className={`profile-label${marks ? " has-mark" : ""}`}>
        {marks && (
          <span className="profile-mark" aria-hidden="true">
            {item.f ? markOf(item) : ""}
          </span>
        )}
        <span className="profile-name">
          <span className="profile-label-text" aria-hidden="true">
            {item.variable.label}
          </span>
          <span className="visually-hidden">{row.name(item)}</span>
          {lines.unit && (
            <>
              {" "}
              {Array.isArray(lines.unit) ? (
                <span className="profile-unit long" aria-hidden="true">
                  <TaggedLine pieces={lines.unit} />
                </span>
              ) : (
                <span className={`profile-unit${lines.unit.length > UNIT_KEPT ? " long" : ""}`} aria-hidden="true">
                  {colors ? <GroupName name={lines.unit} cls={colors[cols.group].cls} /> : lines.unit}
                </span>
              )}
            </>
          )}
          {lines.of && (
            <span className="profile-unit profile-of" aria-hidden="true">
              {Array.isArray(lines.of) ? <TaggedLine pieces={lines.of} /> : lines.of}
            </span>
          )}
          {lines.tags && (
            <span className="profile-unit profile-of" aria-hidden="true">
              <TaggedLine pieces={lines.tags} />
            </span>
          )}
        </span>
      </span>
      {values ? (
        <>
          <span className="profile-values" aria-hidden="true">
            {values.text}
            {values.second && <small>{values.second}</small>}
          </span>
          {plot}
        </>
      ) : (
        <>
          {plot}
          <Numbers col={cols.genre} />
          <Numbers col={cols.all} all />
        </>
      )}
      <span className="profile-chev" aria-hidden="true">
        ›
      </span>
    </>
  );
  return row.link({ item, className: `profile-row${item.r == null ? " few" : ""}`, children });
}

/**
 * The zone's bracket ("40–60: no clear difference", from the rule's thresholds and the page's words) over a block's
 * plots: wide, in the block's head row with the tick labels under it (`ticks`); stacked, over the first row.
 */
function Bracket({ zone, words, ticks = false, scale = FULL }) {
  const [lo, hi] = zone;
  const x = placeOn(scale);
  const y = ticks ? 14 : 13; // the bracket's line, its ends 5 px down
  const under = ticks ? tickDrop(scale, zone) : 0;
  return (
    <svg width="100%" height={ticks ? 30 + under : 18} className="profile-axis">
      <text className="zone-label" x={`${x(50)}%`} y={y - 3} textAnchor="middle">
        {lo}–{hi}: {words}
      </text>
      <line className="zone-bracket" x1={`${x(lo)}%`} x2={`${x(hi)}%`} y1={y} y2={y} />
      <line className="zone-bracket" x1={`${x(lo)}%`} x2={`${x(lo)}%`} y1={y} y2={y + 5} />
      <line className="zone-bracket" x1={`${x(hi)}%`} x2={`${x(hi)}%`} y1={y} y2={y + 5} />
      {ticks && <TickLabels y={28 + under} scale={scale} />}
    </svg>
  );
}

/**
 * How much lower the head row's tick labels go, clear of the bracket's ends: 4 px where a tick is at the zone's edge (a
 * zoomed scale's 40 and 60, under the ends), else none ("One genre"'s 0, 25, 50, 75 and 100). The image does the same.
 */
export const tickDrop = (scale, zone) => (scale.ticks.some((t) => zone.includes(t)) ? 4 : 0);

/** The scale's labels: "0" to "100" (or a zoomed scale's, every 10), the end ones kept inside the plot. */
const TickLabels = ({ y, scale = FULL }) => {
  const x = placeOn(scale);
  return scale.ticks.map((t) => (
    <text key={t} className="tick-label" x={`${x(t)}%`} y={y} textAnchor={x(t) === 0 ? "start" : x(t) === 100 ? "end" : "middle"}>
      {t}
    </text>
  ));
};

/** The scale under a stacked block's last row: "0" to "100" (never "in 100", F96) on 4 px tick marks. */
function Ticks({ scale = FULL }) {
  const x = placeOn(scale);
  return (
    <svg width="100%" height={20} className="profile-axis">
      {scale.ticks.map((t) => (
        <line key={t} className="zone-bracket" x1={`${x(t)}%`} x2={`${x(t)}%`} y1={0} y2={4} />
      ))}
      <TickLabels y={16} scale={scale} />
    </svg>
  );
}

/**
 * Which of a named group's two bars is the first side's (quick win 5), only where named groups are compared: over the
 * "A different mix" list's rows, and in an open topic right over each named-group row, shorter (`inTopic`).
 */
const MixLine = ({ words, inTopic = false }) => (
  <p className={`profile-caption profile-mix-line${inTopic ? " over-row" : ""}`}>{words.mixLine({ inTopic })}</p>
);

/**
 * The rows of a list or a topic, on the page's one grid (F81): wide, a head row with the zone's bracket over the tick
 * labels and the two columns' heads; stacked, the bracket over the first row and the ticks under the last, with the
 * heads in a head row of their own in a topic (`headRow`; a list has them on its title line). A block with no dot
 * (named groups only, or nothing compared) has no bracket and no ticks; its heads stay. In a topic (`mixLines`), the
 * mix line sits right over each compared named-group row, in its list item.
 */
function ProfileBlock({ id, items, marks = false, headRow = false, mixLines = false, layout, rowProps }) {
  const { stacked, heads, scale, valuesFirst } = layout;
  const dots = items.some((x) => x.r != null && x.kind !== "grp");
  const bracket = (ticks) => <Bracket zone={rowProps.zone} words={rowProps.words.zone} ticks={ticks} scale={scale} />;
  return (
    <div className={`profile-block${marks ? " marks" : ""}`}>
      {(!stacked || headRow) && (
        <div className="profile-head" aria-hidden="true">
          {valuesFirst && (
            <span className="profile-values-head">
              <HeadLines head={layout.valuesHead} />
            </span>
          )}
          {!stacked && <span className="profile-plot-cell">{dots && bracket(true)}</span>}
          {!valuesFirst && (
            <>
              <span className="profile-n-head g">{heads[0]}</span>
              <span className="profile-n-head a">{heads[1]}</span>
            </>
          )}
        </div>
      )}
      {stacked && dots && (
        <div className="profile-bracket" aria-hidden="true">
          {bracket(false)}
        </div>
      )}
      <ul className="profile-rows" id={id}>
        {items.map((item) => (
          <li key={item.id}>
            {mixLines && item.kind === "grp" && item.r != null && <MixLine words={rowProps.words} inTopic />}
            <ProfileRow item={item} marks={marks} layout={layout} row={rowProps.row} zone={rowProps.zone} />
          </li>
        ))}
      </ul>
      {stacked && dots && (
        <div className="profile-ticks" aria-hidden="true">
          <Ticks scale={scale} />
        </div>
      )}
    </div>
  );
}

/**
 * "Lower in Romance than in all genres": the first seven, then "Show all 18" / "Show fewer" (`open`, `onOpen`: kept by
 * the page, F88). Wide, its title line ends with the count; stacked, with the two columns' heads, the count left to
 * screen readers ("Show all 18" keeps it). The first list carries the key (F86): the axis title over its rows
 * (`caption`) and the note after its "Show all" (`note`); "A different mix" says which bar is which over its rows
 * (`caption`). "Show fewer" is the one control on the page that moves it, on purpose: when the rows it hides take the
 * button off the screen, the list's heading is brought into view (smoothly, or at once under reduced motion), and focus
 * stays on the button.
 */
function ProfileList({ title, items, all = false, open = false, onOpen, caption = null, note = null, more = null, layout, rowProps }) {
  const id = useId();
  const heading = useRef(null);
  const button = useRef(null);
  const fewer = useRef(false);
  useLayoutEffect(() => {
    if (!fewer.current) return;
    fewer.current = false;
    const box = button.current?.getBoundingClientRect();
    if (box && (box.bottom < 0 || box.top > window.innerHeight)) {
      heading.current?.scrollIntoView?.({ behavior: scrollBehavior(), block: "start" });
    }
  }, [open]);
  const shown = all || open ? items : items.slice(0, SHOWN);
  const count = characteristics(items.length);
  return (
    <section className="profile-list" aria-labelledby={`${id}-h`}>
      <div className="profile-list-head">
        <h3 id={`${id}-h`} ref={heading}>
          {typeof title === "string" ? (
            title
          ) : (
            // "▼ Fell" on screen; its name the whole title, as one hidden line (as a row's)
            <>
              <span className="visually-hidden">{title.full}</span>
              <span aria-hidden="true">
                <span className="profile-title-mark">{title.mark}</span> {title.word}
              </span>
            </>
          )}
        </h3>
        {layout.stacked ? (
          <>
            <span className="visually-hidden">{count}</span>
            {layout.valuesFirst ? (
              <span className="profile-heads values-heads" aria-hidden="true">
                <span>
                  <HeadLines head={layout.valuesHead} />
                </span>
              </span>
            ) : (
              <span className="profile-heads" aria-hidden="true">
                <span>{layout.heads[0]}</span>
                <span>{layout.heads[1]}</span>
              </span>
            )}
          </>
        ) : (
          <span className="list-count">{count}</span>
        )}
      </div>
      {caption}
      <ProfileBlock id={`${id}-list`} items={shown} layout={layout} rowProps={rowProps} />
      {!all && items.length > SHOWN && (
        <button
          ref={button}
          type="button"
          className="link-button show-all"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          onClick={() => {
            fewer.current = open;
            onOpen(!open);
          }}
        >
          {open ? "Show fewer" : more ? more(items.length) : `Show all ${items.length}`}
        </button>
      )}
      {note}
    </section>
  );
}

/** A head of one line, or of several (["Median or share", "2000–09 → 2020+"]), each line a block. */
const HeadLines = ({ head }) =>
  Array.isArray(head)
    ? head.map((line) => (
        <span key={line} className="head-line">
          {line}
        </span>
      ))
    : head;

/** The axis title over the first list's rows (F86, S1). */
const AxisTitle = ({ words }) => <p className="profile-caption profile-axis-title">{words.axisTitle}</p>;

/**
 * The note under the first list (F84, F86, F87): what a dot compares, with the link to how a difference is decided
 * (a 44 px target, never broken inside its parentheses), what the gray dots in the topics say, and where a row leads
 * ("Tap" on a device that can't hover, else "Click"). In an open topic, when no list is shown, the gray dots are right
 * there (`inTopic`).
 */
function Note({ words, inTopic = false }) {
  const tap = useMediaQuery("(hover: none)");
  const [before, link, after] = words.note({ inTopic, tap });
  return (
    <p className="profile-note">
      {before}
      <a href={words.decided}>{link}</a>
      {after}
    </p>
  );
}

/**
 * An open topic's rows: the axis title over them and the note under them when no list carries them (`lead`, nothing
 * stands out) and the topic has dots; the mix line right over each compared named-group row (quick win 5).
 */
function TopicRows({ items, lead, layout, rowProps }) {
  const dots = lead && items.some((x) => x.r != null && x.kind !== "grp");
  return (
    <>
      {dots && <AxisTitle words={rowProps.words} />}
      <ProfileBlock items={items} marks headRow mixLines layout={layout} rowProps={rowProps} />
      {dots && <Note words={rowProps.words} inTopic />}
    </>
  );
}

/** The lists shown, as the page shows them: [{ id, items }], each list's first seven or all of them ("Show all"). */
function listsShown(p, open) {
  return [
    ["lower", p.lower],
    ["higher", p.higher],
    ["mix", p.mix],
  ]
    .filter(([, items]) => items.length)
    .map(([id, items]) => ({ id, items: id === "mix" || open.has(id) ? items : items.slice(0, SHOWN), all: items.length }));
}

/**
 * What "Download PNG" draws of the lists (O2), as plain data (the image is made from the data, not from the page's
 * rows): each list's visible title and count, its caption (the axis title over the first list with dots, the mix line
 * over "A different mix"), and its rows as shown: the label, the unit lines (with the page's tags), the values (values
 * first) or the two columns' numbers, the dot (its place on the scale, its number, stand-out or not) or a named group's
 * two bars in their order with the key of every group, or "Too few stories to compare"; and the scale, the zone and its
 * words, the heads.
 */
export function listsPlan({ lists, lead, words, row, zone, layout }) {
  const title = (t) => (typeof t === "string" ? t : `${t.mark} ${t.word}`);
  const rows = (items) =>
    items.map((item) => {
      const cols = row.columns(item);
      const lines = unitLines(cols, row.tags ? row.tags(item) : []);
      const grp = item.kind === "grp" && item.r != null;
      const colors = grp ? mixColors("grp", item.all.shares) : null;
      const bar = item.r != null && !grp ? comparisonBar(item.r, { flagged: Boolean(item.f), zone }) : null;
      return {
        label: item.variable.label,
        unit: lineWords(lines.unit) || null,
        of: lineWords(lines.of) || null,
        tags: lineWords(lines.tags) || null,
        swatch: colors && cols.group != null ? colors[cols.group].cls : null,
        values: layout.valuesFirst ? row.values(item) : null,
        numbers: layout.valuesFirst ? null : [cols.genre, cols.all],
        few: item.r == null,
        dot: bar && { r: item.r, end: bar.end, from: bar.from, to: bar.to, times: bar.times, flagged: Boolean(item.f) },
        bars: grp ? (layout.thenAbove ? [item.all.shares, item.stats.shares] : [item.stats.shares, item.all.shares]) : null,
        colors: colors ? colors.map((c) => c.cls) : null,
        key: grp ? item.variable.bins.labels : null,
      };
    });
  const { scale } = layout;
  return {
    valuesFirst: layout.valuesFirst,
    valuesHead: layout.valuesHead,
    heads: words.heads(false, WIDE.n),
    scale,
    zone,
    zoneWords: words.zone,
    tickDrop: tickDrop(scale, zone),
    // where a dot's number goes on a plot `plotW` px wide (numberPlace, as on the page)
    place: (r, opts) => numberPlace(r, zone, { ...opts, scale: scale === FULL ? null : scale }),
    lists: lists.map((l) => ({
      title: title(words.lists[l.id]),
      count: characteristics(l.all),
      caption: l.id === "mix" ? words.mixLine({}) : l.id === lead ? words.axisTitle : null,
      rows: rows(l.items),
    })),
  };
}

/** The place in this history entry's state ({ topics, all, y }) under `key`, or null: a new entry starts with nothing open. */
function keptPlace(key) {
  try {
    return window.history.state?.[key] ?? null;
  } catch {
    return null;
  }
}

/** Keeps `patch` in this history entry's state, in place: the address doesn't change, so every address keeps working. */
function keepPlace(key, patch) {
  try {
    const state = window.history.state;
    window.history.replaceState({ ...state, [key]: { ...state?.[key], ...patch } }, "");
  } catch {
    // a browser that limits how often the state may change: the next change keeps it
  }
}

/** A Set's copy with `id` in it or not. */
const toggled = (set, id, on) => {
  if (set.has(id) === on) return set;
  const next = new Set(set);
  if (on) next.add(id);
  else next.delete(id);
  return next;
};

/**
 * The way back from a row's link (F88, quick win 6): the open topics and the lists shown in full are kept in this
 * history entry's state (under `key`), with the scroll position (when scrolling stops, and when a link inside is
 * followed). They are read before the first paint, so the page is as tall as it was; then, if the browser's own
 * restoration of the scroll position was clamped (the page was shorter when it restored it), the position is restored
 * here, at once.
 */
function useWayBack(ref, key) {
  const [kept] = useState(() => keptPlace(key));
  const [topics, setTopics] = useState(() => new Set(kept?.topics ?? []));
  const [lists, setLists] = useState(() => new Set(kept?.all ?? []));
  const back = useRef(kept?.y ?? null);
  useLayoutEffect(() => {
    const y = back.current;
    back.current = null;
    if (y != null && window.scrollY < y - 1) window.scrollTo?.({ top: y, behavior: "instant" });
  }, []);
  useEffect(() => {
    keepPlace(key, { topics: [...topics], all: [...lists], y: Math.round(window.scrollY) });
  }, [topics, lists, key]);
  useEffect(() => {
    let timer;
    const now = () => keepPlace(key, { y: Math.round(window.scrollY) });
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(now, 300);
    };
    const el = ref.current;
    window.addEventListener("scroll", later, { passive: true });
    el?.addEventListener("click", now, true); // before a row's link adds the next entry
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", later);
      el?.removeEventListener("click", now, true);
    };
  }, [ref, key]);
  return {
    topics,
    setTopic: (id, on) => setTopics((prev) => toggled(prev, id, on)),
    lists,
    setList: (id, on) => setLists((prev) => toggled(prev, id, on)),
  };
}

/**
 * The comparison (D10): its header (the page's `header`), then, when the sides were compared, the page's `top` (the
 * takeaway) and the lists, each ordered by the size of the difference ("lower" and "higher": flagged numbers, yes/no,
 * mostly-zero and band characteristics; "mix": flagged named groups), then every characteristic by topic, folded (a
 * topic's rows are drawn when it is opened). With `few` (fewer stories than the rule needs),
 * nothing was compared: `showAll`, then the topics, whose rows give the numbers. With `tooFew`, only `showAll`.
 *
 * - `profile`: { lower, higher, mix, topics: [{ topic, items, count, compared }] }; items as genreProfile() gives them.
 * - `rule`: the rule's thresholds (its zone of no clear difference). `answerKey`: another answer is drawn anew (its open
 *   topics and lists in full are kept above), so its rows don't count as rows that moved.
 * - `words`: { heads(stacked, width), lists: { lower, higher, mix }, axisTitle, zone, note({ inTopic, tap }), decided
 *   (the note's link), mixLine({ inTopic }), topicsLine, topicCount(t), countWord }, and optionally showAll(n, list)
 *   ("Show all 21 that rose"; "Show all 21" without it).
 * - `row`: { columns(item), name(item), link({ item, className, children }) (the row's link element), and with the
 *   values first values(item) ({ text, second }), tags(item) (words for the end of the unit line) }.
 * - `className`: the article's own class; `placeKey`: where the way back keeps its place in history.state;
 *   `widthKey`: useWidth's.
 * - `png`: { label, image(panel, lists) }: "Download PNG" of the lists as shown, right after them (both pages);
 *   `image` gets the panel and the lists' plan (listsPlan) and gives what the image draws.
 * - "What changed"'s opt-ins (each off for "One genre"): `valuesFirst` (the values right after the label, its head
 *   `words.valuesHead`, every dot's number alike), `scale` (a zoomed { lo, hi, ticks }), `noteFirst` (the note above
 *   the first list, under the takeaway), `thenAbove` (a named group's second side's bar above the first's); list
 *   titles given as { mark, word, full } ("▼ Fell", named "Fell from 2000–2009 to 2020 or later").
 */
export default function ComparisonProfile({
  className,
  busy,
  header,
  top = null,
  few = false,
  tooFew = false,
  showAll = null,
  profile,
  rule,
  answerKey,
  words,
  row,
  placeKey,
  widthKey,
  png = null,
  valuesFirst = false,
  scale = FULL,
  noteFirst = false,
  thenAbove = false,
}) {
  const [ref, width] = useWidth(720, widthKey);
  const place = useWayBack(ref, placeKey);
  const ids = useId();
  // the rows stack under a chart width of STACKED; a phone's chart (under PHONE) has smaller list titles, and a
  // narrower one puts the heads of a list's columns under its title
  const stacked = width < STACKED;
  const panel = `chart-panel ${className}${stacked ? " stacked" : ""}${width < PHONE ? " phone" : ""}${width < HEADS_UNDER ? " narrow" : ""}${
    busy ? " is-busy" : ""
  }`;

  if (tooFew) {
    return (
      <article className={panel} aria-busy={busy} ref={ref}>
        {header}
        {showAll}
      </article>
    );
  }

  const p = profile;
  const zone = noDifferenceZone(rule);
  // the first list with dots carries the axis title and the note; with none (nothing stands out), every open topic
  // with dots carries them
  const lead = p.lower.length ? "lower" : p.higher.length ? "higher" : null;
  // the values' column fits the widest value on the page, so every list and topic has the same grid
  const valuesW = valuesFirst ? valuesWidth(p.items.map((x) => row.values(x).text)) : null;
  const layout = {
    stacked,
    plotW: plotWidth(width, stacked, valuesW),
    heads: words.heads(stacked, stacked ? NARROW.n : WIDE.n),
    scale,
    valuesFirst,
    valuesHead: words.valuesHead,
    thenAbove,
  };
  const rowProps = { zone, words, row };
  const listProps = (id) => ({
    open: place.lists.has(id),
    onOpen: (on) => place.setList(id, on),
    more: words.showAll ? (n) => words.showAll(n, id) : null,
    layout,
    rowProps,
  });
  const lists = few ? [] : listsShown(p, place.lists);
  const plan = () => listsPlan({ lists, lead, words, row, zone, layout });

  return (
    <article className={panel} aria-busy={busy} ref={ref} style={valuesW ? { "--values-w": `${valuesW}px` } : undefined}>
      {header}
      {few ? (
        showAll
      ) : (
        <Fragment key={answerKey}>
          {top}
          {noteFirst && lead && <Note words={words} />}
          {p.lower.length > 0 && (
            <ProfileList
              title={words.lists.lower}
              items={p.lower}
              caption={lead === "lower" && <AxisTitle words={words} />}
              note={lead === "lower" && !noteFirst && <Note words={words} />}
              {...listProps("lower")}
            />
          )}
          {p.higher.length > 0 && (
            <ProfileList
              title={words.lists.higher}
              items={p.higher}
              caption={lead === "higher" && <AxisTitle words={words} />}
              note={lead === "higher" && !noteFirst && <Note words={words} />}
              {...listProps("higher")}
            />
          )}
          {p.mix.length > 0 && <ProfileList title={words.lists.mix} items={p.mix} all caption={<MixLine words={words} />} {...listProps("mix")} />}
          {/* the image of the lists, by them (O2): the page's question, heading and sample line, then the lists as shown */}
          {png && lists.length > 0 && (
            <div className="chart-actions profile-png">
              <DownloadPng label={png.label} busy={busy} image={(el) => ({ ...png.image(el, plan()), panel: el })} />
            </div>
          )}
        </Fragment>
      )}
      <section className="profile-topics" aria-labelledby={`${ids}-topics`}>
        <h3 id={`${ids}-topics`}>Every characteristic, by topic</h3>
        {!few && <p className="profile-topics-line">{words.topicsLine}</p>}
        {p.topics.map((t) => {
          const { topic, items } = t;
          const open = place.topics.has(topic.id);
          const c = words.topicCount(t);
          return (
            <details key={topic.id} className="profile-topic" open={open} onToggle={(e) => place.setTopic(topic.id, e.currentTarget.open)}>
              {/* named by its text, "Length & structure, 1 of 28 stand out" (F92): one hidden line, as a row's name */}
              <summary className="profile-topic-head">
                <span className="visually-hidden">{`${topic.label}, ${c.text}`}</span>
                <span className="profile-topic-name" aria-hidden="true">
                  {topic.label}
                </span>
                <span className="profile-topic-count" aria-hidden="true">
                  {c.n == null ? (
                    <>
                      <b>{c.k}</b> of {c.m} {words.countWord}
                    </>
                  ) : (
                    c.text
                  )}
                </span>
              </summary>
              {open && <TopicRows items={items} lead={!lead} layout={layout} rowProps={rowProps} />}
            </details>
          );
        })}
      </section>
    </article>
  );
}
