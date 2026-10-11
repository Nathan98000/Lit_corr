import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  axisTitle,
  breakable,
  comparisonBar,
  genreProfile,
  mixLine,
  noDifferenceZone,
  numberPlace,
  profileColumns,
  profileHeading,
  profileHeads,
  profileNote,
  profileRowName,
  profileTakeaway,
  sampleLine,
  takeawayLine,
  topicCount,
} from "../lib/genres.js";
import { mixColors } from "../lib/genreLayout.js";
import { scrollBehavior } from "../lib/motion.js";
import { PHONE, STACKED, textWidth } from "../lib/rangeLayout.js";
import CopyLink from "./CopyLink.jsx";
import { HOW_DECIDED } from "./GenreAnswer.jsx";
import { ViewLink } from "./GenreDetails.jsx";
import useMediaQuery from "./useMediaQuery.js";
import useWidth from "./useWidth.js";

const SHOWN = 7; // rows of a list before "Show all"

const markOf = (item) => (item.kind === "grp" ? "≠" : item.f > 0 ? "▲" : "▼");
const characteristics = (n) => `${n} characteristic${n === 1 ? "" : "s"}`;

// The one grid of every list and open topic (F81; genres.css draws it with the same numbers): wide, the label (with its
// unit under it) · the plot · the genre's number · all genres' number · "›"; stacked (a chart under STACKED), the label
// and the numbers on one line and the plot across the row under them. The plot keeps PAD px at each end for its dots.
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
 * The plot of one row (concept R3), on one scale for every row: how often the genre's story is the higher one against
 * a story from all genres, out of 100. The zone of no clear difference (the rule's 40 to 60) is shaded, its edges drawn
 * (they carry the rule's thresholds), with a line at 50; a stem runs from 50 to 50 × (1 + r) with a dot at its end: a
 * 10 px accent dot for a stand-out, a 7 px gray dot otherwise (a hollow dot means "fewer than 30 stories" elsewhere on
 * the site, so these are filled). The number sits beside the dot (numberPlace). Named groups keep their two thin 100%
 * bars, the genre's above all genres'. The geometry is in percent of the plot, so the plot takes whatever width its
 * cell has. Rows not compared say so instead.
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
  const b = comparisonBar(item.r);
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
 * One characteristic in "One genre" (concept R3, F85, F87, F92): a link to every genre's numbers (View 1). Its label,
 * with its unit line, the plot, the genre's and all genres' numbers and "›". Its accessible name is its content, with
 * no aria-label: one visually hidden line that says the label, the dot's number, the numbers in reading order, the
 * unit and how it compares (profileRowName); the visible parts are hidden from screen readers, since their words are
 * all there in that order. (Visible text followed by hidden text would read "Sexual language : 26 in 100" in Chrome,
 * which puts a space before a box taken out of the flow.) In a topic (`marks`), a stand-out's ▲ ▼ ≠ sits in a column
 * before the label.
 */
function ProfileRow({ item, genre, sub, minN, zone, plotW, marks, onNavigate }) {
  const cols = profileColumns(item);
  return (
    <ViewLink className={`profile-row${item.r == null ? " few" : ""}`} to={{ v: item.id, sub }} onNavigate={onNavigate}>
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
          <span className="visually-hidden">{profileRowName(item, genre, minN)}</span>
          {cols.unit && (
            <>
              {" "}
              <span className={`profile-unit${cols.unit.length > UNIT_KEPT ? " long" : ""}`} aria-hidden="true">
                {cols.unit}
              </span>
            </>
          )}
        </span>
      </span>
      <span className="profile-plot-cell" aria-hidden="true">
        <RowPlot item={item} zone={zone} plotW={plotW} />
      </span>
      <Numbers col={cols.genre} />
      <Numbers col={cols.all} all />
      <span className="profile-chev" aria-hidden="true">
        ›
      </span>
    </ViewLink>
  );
}

/**
 * The zone's bracket ("40–60: no clear difference", from the rule's thresholds) over a block's plots: wide, in the
 * block's head row with the tick labels under it (`ticks`); stacked, over the first row.
 */
function Bracket({ zone, ticks = false }) {
  const [lo, hi] = zone;
  const y = ticks ? 14 : 13; // the bracket's line, its ends 5 px down
  return (
    <svg width="100%" height={ticks ? 30 : 18} className="profile-axis">
      <text className="zone-label" x="50%" y={y - 3} textAnchor="middle">
        {lo}–{hi}: no clear difference
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
 * The rows of a list or a topic, on the page's one grid (F81): wide, a head row with the zone's bracket over the tick
 * labels and the two columns' heads; stacked, the bracket over the first row and the ticks under the last, with the
 * heads in a head row of their own in a topic (`headRow`; a list has them on its title line). A block with no dot
 * (named groups only, or nothing compared) has no bracket and no ticks; its heads stay.
 */
function ProfileBlock({ id, items, marks = false, headRow = false, layout, rowProps }) {
  const { stacked, heads } = layout;
  const dots = items.some((x) => x.r != null && x.kind !== "grp");
  return (
    <div className={`profile-block${marks ? " marks" : ""}`}>
      {(!stacked || headRow) && (
        <div className="profile-head" aria-hidden="true">
          {!stacked && <span className="profile-plot-cell">{dots && <Bracket zone={rowProps.zone} ticks />}</span>}
          <span className="profile-n-head g">{heads[0]}</span>
          <span className="profile-n-head a">{heads[1]}</span>
        </div>
      )}
      {stacked && dots && (
        <div className="profile-bracket" aria-hidden="true">
          <Bracket zone={rowProps.zone} />
        </div>
      )}
      <ul className="profile-rows" id={id}>
        {items.map((item) => (
          <li key={item.id}>
            <ProfileRow item={item} marks={marks} plotW={layout.plotW} {...rowProps} />
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
const AxisTitle = ({ genre }) => <p className="profile-caption profile-axis-title">{axisTitle(genre)}</p>;

/** Which of a named group's two bars is the genre's (quick win 5): only over rows where named groups are compared. */
const MixLine = ({ genre }) => <p className="profile-caption profile-mix-line">{mixLine(genre)}</p>;

/**
 * The note under the first list (F84, F86, F87): what a dot compares, with the link to how a difference is decided
 * (a 44 px target, never broken inside its parentheses), what the gray dots in the topics say, and that a row opens
 * every genre's numbers ("Tap" on a device that can't hover, else "Click"). In an open topic, when no list is shown,
 * the gray dots are right there (`inTopic`).
 */
function Note({ genre, inTopic = false }) {
  const tap = useMediaQuery("(hover: none)");
  const [before, link, after] = profileNote(genre, { inTopic, tap });
  return (
    <p className="profile-note">
      {before}
      <a href={HOW_DECIDED}>{link}</a>
      {after}
    </p>
  );
}

/**
 * An open topic's rows: the axis title over them and the note under them when no list carries them (`lead`, nothing
 * stands out) and the topic has dots; the mix line where its named-group row is compared (quick win 5).
 */
function TopicRows({ items, lead, genre, layout, rowProps }) {
  const dots = lead && items.some((x) => x.r != null && x.kind !== "grp");
  return (
    <>
      {dots && <AxisTitle genre={genre} />}
      {items.some((x) => x.kind === "grp" && x.r != null) && <MixLine genre={genre} />}
      <ProfileBlock items={items} marks headRow layout={layout} rowProps={rowProps} />
      {dots && <Note genre={genre} inTopic />}
    </>
  );
}

const PLACE = "oneGenre"; // View 2's key in history.state

/** View 2's place in this history entry ({ topics, all, y }), or null: a new entry starts with nothing open. */
function keptPlace() {
  try {
    return window.history.state?.[PLACE] ?? null;
  } catch {
    return null;
  }
}

/** Keeps `patch` in this history entry's state, in place: the address doesn't change, so every address keeps working. */
function keepPlace(patch) {
  try {
    const state = window.history.state;
    window.history.replaceState({ ...state, [PLACE]: { ...state?.[PLACE], ...patch } }, "");
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
 * The way back from every genre's numbers (F88, quick win 6): the open topics and the lists shown in full are kept in
 * this history entry's state, with the scroll position (when scrolling stops, and when a link inside is followed). They
 * are read before the first paint, so the page is as tall as it was; then, if the browser's own restoration of the
 * scroll position was clamped (the page was shorter when it restored it), the position is restored here, at once.
 */
function useWayBack(ref) {
  const [kept] = useState(keptPlace);
  const [topics, setTopics] = useState(() => new Set(kept?.topics ?? []));
  const [lists, setLists] = useState(() => new Set(kept?.all ?? []));
  const back = useRef(kept?.y ?? null);
  useLayoutEffect(() => {
    const y = back.current;
    back.current = null;
    if (y != null && window.scrollY < y - 1) window.scrollTo?.({ top: y, behavior: "instant" });
  }, []);
  useEffect(() => {
    keepPlace({ topics: [...topics], all: [...lists], y: Math.round(window.scrollY) });
  }, [topics, lists]);
  useEffect(() => {
    let timer;
    const now = () => keepPlace({ y: Math.round(window.scrollY) });
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
  }, [ref]);
  return {
    topics,
    setTopic: (id, on) => setTopics((prev) => toggled(prev, id, on)),
    lists,
    setList: (id, on) => setLists((prev) => toggled(prev, id, on)),
  };
}

/**
 * "Fewer than 10 stories in Chain Stories match “Published 2020 or later”: too few to compare.", or with the rule's
 * min_n ("Fewer than 30 …") when the genre has its numbers but too few stories to be compared (F60).
 */
export const tooFewText = (genre, subset, minN) =>
  `Fewer than ${minN} stories in ${genre.name} match “${subset.label}”: too few to compare.`;

/**
 * One genre against all genres (View 2): how many characteristics clearly set the genre apart, the three biggest
 * differences, the characteristics lower and higher in the genre (ordered by the size of the difference: this ranks
 * characteristics within one genre, never genres), the named groups with a different mix, and every characteristic by
 * topic, folded (a topic's rows are drawn when it is opened). Every row opens that characteristic's chart in every
 * genre. With fewer stories than the rule needs, nothing is compared: the heading says so, then "Show all
 * stories" and the topics, whose rows give the numbers. Under the topics, Copy link (F80).
 */
export default function GenreProfile({ meta, state, file, busy, onSwitch, onNavigate, headingRef }) {
  const [ref, width] = useWidth(720, "genres");
  const place = useWayBack(ref);
  const ids = useId();
  const genre = meta.genres.find((g) => g.id === state.genre);
  const subset = meta.subsets.find((s) => s.id === state.sub);
  const gi = file.genres.indexOf(state.genre);
  const n = gi < 0 ? 0 : file.n[gi];
  const { min_n: minN } = meta;
  // the rows stack under a chart width of STACKED; a phone's chart (under PHONE) has smaller list titles, and a
  // narrower one puts the heads of a list's columns under its title
  const stacked = width < STACKED;
  const panel = `chart-panel genre-profile${stacked ? " stacked" : ""}${width < PHONE ? " phone" : ""}${width < HEADS_UNDER ? " narrow" : ""}${
    busy ? " is-busy" : ""
  }`;
  const showAll = state.sub !== "all" && (
    <p className="inline-actions">
      <button type="button" className="btn" onClick={() => onSwitch({ ...state, sub: "all" })}>
        Show all stories
      </button>
    </p>
  );

  if (n < minN) {
    return (
      <article className={panel} aria-busy={busy} ref={ref}>
        <header className="chart-head">
          <h2 className="chart-title" ref={headingRef} tabIndex={-1}>
            {tooFewText(genre, subset, minN)}
          </h2>
        </header>
        {showAll}
      </article>
    );
  }

  // fewer stories than the rule needs: nothing was compared, but every characteristic's numbers are there (F60)
  const few = n < file.rule.min_n;
  const p = genreProfile(meta, file, gi);
  const count = p.flagged.length;
  const takeaway = profileTakeaway(p);
  const zone = noDifferenceZone(file.rule);
  // the first list with dots carries the axis title and the note; with none (nothing stands out), every open topic
  // with dots carries them
  const lead = p.lower.length ? "lower" : p.higher.length ? "higher" : null;
  const layout = { stacked, plotW: plotWidth(width, stacked), heads: profileHeads(genre, stacked, stacked ? NARROW.n : WIDE.n) };
  const rowProps = { genre, sub: state.sub, minN, zone, onNavigate };
  const listProps = (id) => ({ open: place.lists.has(id), onOpen: (on) => place.setList(id, on), layout, rowProps });

  return (
    <article className={panel} aria-busy={busy} ref={ref}>
      <header className="chart-head">
        <h2 className="chart-title" ref={headingRef} tabIndex={-1}>
          {few ? tooFewText(genre, subset, file.rule.min_n) : profileHeading(count, genre)}
        </h2>
        <p className="profile-sample">{sampleLine(n, genre, subset)}</p>
      </header>
      {few ? (
        showAll
      ) : (
        <>
          {count === 0 && (
            <p className="profile-none">
              Its stories are close to those of all genres on each of the {p.compared} characteristics compared.
            </p>
          )}
          {takeaway.length > 0 && (
            <div className="takeaway profile-takeaway">
              {takeaway.map((line) => (
                <p key={line.word}>
                  <span aria-hidden="true">{line.mark} </span>
                  <b>{line.word}:</b> {line.items.join(", ")}.
                </p>
              ))}
            </div>
          )}
          {p.lower.length > 0 && (
            <ProfileList
              title={`Lower in ${breakable(genre.name)} than in all genres`}
              items={p.lower}
              caption={lead === "lower" && <AxisTitle genre={genre} />}
              note={lead === "lower" && <Note genre={genre} />}
              {...listProps("lower")}
            />
          )}
          {p.higher.length > 0 && (
            <ProfileList
              title={`Higher in ${breakable(genre.name)} than in all genres`}
              items={p.higher}
              caption={lead === "higher" && <AxisTitle genre={genre} />}
              note={lead === "higher" && <Note genre={genre} />}
              {...listProps("higher")}
            />
          )}
          {p.mix.length > 0 && (
            <ProfileList title="A different mix" items={p.mix} all caption={<MixLine genre={genre} />} {...listProps("mix")} />
          )}
        </>
      )}
      <section className="profile-topics" aria-labelledby={`${ids}-topics`}>
        <h3 id={`${ids}-topics`}>Every characteristic, by topic</h3>
        {!few && (
          <p className="profile-topics-line">
            How many characteristics in each topic stand out. Open a topic to see them all: blue dots stand out, gray dots
            show no clear difference.
          </p>
        )}
        {p.topics.map((t) => {
          const { topic, items } = t;
          const open = place.topics.has(topic.id);
          const c = topicCount(t);
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
                      <b>{c.k}</b> of {c.m} stand out
                    </>
                  ) : (
                    c.text
                  )}
                </span>
              </summary>
              {open && <TopicRows items={items} lead={!lead} genre={genre} layout={layout} rowProps={rowProps} />}
            </details>
          );
        })}
      </section>
      <div className="chart-actions">
        <CopyLink />
      </div>
    </article>
  );
}

/**
 * What screen readers hear for one genre: the heading, then the takeaway's lines without their marks ("Lower: …."), or
 * the "too few" sentence.
 */
export function profileAnnouncement(meta, file, state) {
  const genre = meta.genres.find((g) => g.id === state.genre);
  const gi = file.genres.indexOf(state.genre);
  const n = gi < 0 ? 0 : file.n[gi];
  const subset = meta.subsets.find((s) => s.id === state.sub);
  if (n < meta.min_n) return tooFewText(genre, subset, meta.min_n);
  if (n < file.rule.min_n) return tooFewText(genre, subset, file.rule.min_n);
  const p = genreProfile(meta, file, gi);
  return [`${profileHeading(p.flagged.length, genre)}.`, ...profileTakeaway(p).map(takeawayLine)].join(" ");
}
