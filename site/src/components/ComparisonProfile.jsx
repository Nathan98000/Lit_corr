import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { comparisonBar, noDifferenceZone, numberPlace } from "../lib/genres.js";
import { mixColors } from "../lib/genreLayout.js";
import { scrollBehavior } from "../lib/motion.js";
import { PHONE, STACKED, textWidth } from "../lib/rangeLayout.js";
import useMediaQuery from "./useMediaQuery.js";
import useWidth from "./useWidth.js";

// A comparison of two sides, characteristic by characteristic (D10): the Genres page's "One genre" (a genre's stories
// against all genres') and the Trends page's "What changed" (stories from 2020 or later against stories from
// 2000–2009). The rows (concept R3), the lists, the topics, the notes and the way back are here; each page
// gives its words (the two sides' names and short heads, the list titles, the axis title, the zone's words, the note,
// the topics' line) and its row (the columns' numbers, the row's name and where it leads). The styles are in
// comparison.css, which genres.css and trends.css import.

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
const DOT = { out: 5, quiet: 3.5 }; // radii: a 10 px dot for a stand-out, 7 px for a row that doesn't stand out
const HEADS_UNDER = 328; // a chart this narrow (a window under 360 px) puts a list's columns' heads under its title

/** The plot's width in px, for the numbers' placement: the same in every list and open topic. */
export const plotWidth = (width, stacked) =>
  stacked ? width - 2 * PAD : width - WIDE.label - 2 * WIDE.n - WIDE.chev - 4 * WIDE.gap - 2 * PAD;

/**
 * The plot of one row (concept R3), on one scale for every row: how often a story from the first side is the higher
 * one against a story from the second, out of 100. The zone of no clear difference (the rule's 40 to 60) is shaded,
 * its edges drawn (they carry the rule's thresholds), with a line at 50; a stem runs from 50 to 50 × (1 + r) with a dot
 * at its end: a 10 px accent dot for a stand-out, a 7 px gray dot otherwise (a hollow dot means "fewer than 30
 * stories" elsewhere on the site, so these are filled). The number sits beside the dot (numberPlace). Named groups keep
 * their two thin 100% bars, the first side's above the second's. The geometry is in percent of the plot, so the plot
 * takes whatever width its cell has. Rows not compared say so instead.
 */
function RowPlot({ item, zone, plotW }) {
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
    return (
      <svg width="100%" height={20} className="profile-plot">
        {bar(item.stats.shares, 1)}
        {bar(item.all.shares, 12)}
      </svg>
    );
  }
  const b = comparisonBar(item.r, { flagged: Boolean(item.f), zone });
  const quiet = item.f ? "" : " quiet";
  const dotR = item.f ? DOT.out : DOT.quiet;
  const textW = item.f ? textWidth(String(b.times), 13, 600) : textWidth(String(b.times), 12);
  const at = numberPlace(item.r, zone, { plotW, dotR, textW });
  return (
    <svg width="100%" height={22} className="profile-plot">
      <rect className="p2-zone" x={`${zone[0]}%`} y={2} width={`${zone[1] - zone[0]}%`} height={18} />
      <line className="p2-edge" x1={`${zone[0]}%`} x2={`${zone[0]}%`} y1={2} y2={20} />
      <line className="p2-edge" x1={`${zone[1]}%`} x2={`${zone[1]}%`} y1={2} y2={20} />
      <line className="p2-mid" x1="50%" x2="50%" y1={0} y2={22} />
      {b.to > b.from && <line className={`p2-stem${quiet}`} x1={`${b.from}%`} x2={`${b.to}%`} y1={11} y2={11} />}
      <circle className={`p2-dot${quiet}`} cx={`${b.end}%`} cy={11} r={dotR} />
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
 * One characteristic (concept R3, F85, F87, F92): a link (the page's `row.link`) to its numbers elsewhere. Its label,
 * with its unit line, the plot, the two columns' numbers (`row.columns`: { genre, all, unit, group, of }, the first
 * side's column and the second's) and "›". Its accessible name is its content, with no aria-label: one visually hidden
 * line that says the label, the dot's number, the numbers in reading order, the unit and how it compares (`row.name`);
 * the visible parts are hidden from screen readers, since their words are all there in that order. (Visible text
 * followed by hidden text would read "Sexual language : 26 in 100" in Chrome, which puts a space before a box taken
 * out of the flow.) In a topic (`marks`), a stand-out's ▲ ▼ ≠ sits in a column before the label. A named group's unit
 * line names its printed group, then "% of stories" on a line of its own; where its bars are drawn (not with too few
 * stories to compare), the name follows a swatch of that group's color and the bars have a key of every group under
 * them.
 */
function ProfileRow({ item, row, zone, plotW, marks }) {
  const cols = row.columns(item);
  const colors = cols.group != null && item.r != null && mixColors("grp", item.all.shares);
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
          {cols.unit && (
            <>
              {" "}
              <span className={`profile-unit${cols.unit.length > UNIT_KEPT ? " long" : ""}`} aria-hidden="true">
                {colors ? <GroupName name={cols.unit} cls={colors[cols.group].cls} /> : cols.unit}
              </span>
            </>
          )}
          {cols.of && (
            <span className="profile-unit profile-of" aria-hidden="true">
              {cols.of}
            </span>
          )}
        </span>
      </span>
      <span className="profile-plot-cell" aria-hidden="true">
        <RowPlot item={item} zone={zone} plotW={plotW} />
        {colors && <GroupKey labels={item.variable.bins.labels} colors={colors} />}
      </span>
      <Numbers col={cols.genre} />
      <Numbers col={cols.all} all />
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
function Bracket({ zone, words, ticks = false }) {
  const [lo, hi] = zone;
  const y = ticks ? 14 : 13; // the bracket's line, its ends 5 px down
  return (
    <svg width="100%" height={ticks ? 30 : 18} className="profile-axis">
      <text className="zone-label" x="50%" y={y - 3} textAnchor="middle">
        {lo}–{hi}: {words}
      </text>
      <line className="zone-bracket" x1={`${lo}%`} x2={`${hi}%`} y1={y} y2={y} />
      <line className="zone-bracket" x1={`${lo}%`} x2={`${lo}%`} y1={y} y2={y + 5} />
      <line className="zone-bracket" x1={`${hi}%`} x2={`${hi}%`} y1={y} y2={y + 5} />
      {ticks && <TickLabels y={28} />}
    </svg>
  );
}

const TickLabels = ({ y }) =>
  TICKS.map((t) => (
    <text key={t} className="tick-label" x={`${t}%`} y={y} textAnchor={t === 0 ? "start" : t === 100 ? "end" : "middle"}>
      {t}
    </text>
  ));

/** The scale under a stacked block's last row: "0" to "100" (never "in 100", F96) on 4 px tick marks. */
function Ticks() {
  return (
    <svg width="100%" height={20} className="profile-axis">
      {TICKS.map((t) => (
        <line key={t} className="zone-bracket" x1={`${t}%`} x2={`${t}%`} y1={0} y2={4} />
      ))}
      <TickLabels y={16} />
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
  const { stacked, heads } = layout;
  const dots = items.some((x) => x.r != null && x.kind !== "grp");
  return (
    <div className={`profile-block${marks ? " marks" : ""}`}>
      {(!stacked || headRow) && (
        <div className="profile-head" aria-hidden="true">
          {!stacked && <span className="profile-plot-cell">{dots && <Bracket zone={rowProps.zone} words={rowProps.words.zone} ticks />}</span>}
          <span className="profile-n-head g">{heads[0]}</span>
          <span className="profile-n-head a">{heads[1]}</span>
        </div>
      )}
      {stacked && dots && (
        <div className="profile-bracket" aria-hidden="true">
          <Bracket zone={rowProps.zone} words={rowProps.words.zone} />
        </div>
      )}
      <ul className="profile-rows" id={id}>
        {items.map((item) => (
          <li key={item.id}>
            {mixLines && item.kind === "grp" && item.r != null && <MixLine words={rowProps.words} inTopic />}
            <ProfileRow item={item} marks={marks} plotW={layout.plotW} row={rowProps.row} zone={rowProps.zone} />
          </li>
        ))}
      </ul>
      {stacked && dots && (
        <div className="profile-ticks" aria-hidden="true">
          <Ticks />
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
function ProfileList({ title, items, all = false, open = false, onOpen, caption = null, note = null, layout, rowProps }) {
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
          {title}
        </h3>
        {layout.stacked ? (
          <>
            <span className="visually-hidden">{count}</span>
            <span className="profile-heads" aria-hidden="true">
              <span>{layout.heads[0]}</span>
              <span>{layout.heads[1]}</span>
            </span>
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
          {open ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
      {note}
    </section>
  );
}

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
 *   (the note's link), mixLine({ inTopic }), topicsLine, topicCount(t), countWord }.
 * - `row`: { columns(item), name(item), link({ item, className, children }) (the row's link element) }.
 * - `className`: the article's own class; `placeKey`: where the way back keeps its place in history.state;
 *   `widthKey`: useWidth's.
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
  const layout = { stacked, plotW: plotWidth(width, stacked), heads: words.heads(stacked, stacked ? NARROW.n : WIDE.n) };
  const rowProps = { zone, words, row };
  const listProps = (id) => ({ open: place.lists.has(id), onOpen: (on) => place.setList(id, on), layout, rowProps });

  return (
    <article className={panel} aria-busy={busy} ref={ref}>
      {header}
      {few ? (
        showAll
      ) : (
        <Fragment key={answerKey}>
          {top}
          {p.lower.length > 0 && (
            <ProfileList
              title={words.lists.lower}
              items={p.lower}
              caption={lead === "lower" && <AxisTitle words={words} />}
              note={lead === "lower" && <Note words={words} />}
              {...listProps("lower")}
            />
          )}
          {p.higher.length > 0 && (
            <ProfileList
              title={words.lists.higher}
              items={p.higher}
              caption={lead === "higher" && <AxisTitle words={words} />}
              note={lead === "higher" && <Note words={words} />}
              {...listProps("higher")}
            />
          )}
          {p.mix.length > 0 && <ProfileList title={words.lists.mix} items={p.mix} all caption={<MixLine words={words} />} {...listProps("mix")} />}
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
