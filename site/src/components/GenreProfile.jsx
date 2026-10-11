import { useId, useState } from "react";
import {
  comparisonBar,
  genreProfile,
  noDifferenceZone,
  profileHeading,
  profileRowDescription,
  profileTakeaway,
  profileValueParts,
} from "../lib/genres.js";
import { mixColors } from "../lib/genreLayout.js";
import { PHONE, textWidth } from "../lib/rangeLayout.js";
import CopyLink from "./CopyLink.jsx";
import { HOW_DECIDED } from "./GenreAnswer.jsx";
import { ViewLink } from "./GenreDetails.jsx";
import useWidth from "./useWidth.js";

const SHOWN = 7; // rows of a list before "Show all"

const markOf = (item) => (item.kind === "grp" ? "≠" : item.f > 0 ? "▲" : "▼");
const characteristics = (n) => `${n} characteristic${n === 1 ? "" : "s"}`;

const LABEL = 250; // the label column on wider screens
const GAP = 12;
const MIN_PLOT = 200; // on wider screens the values take two lines rather than leave the plot narrower than this

/**
 * The values column of a list or a topic (each has its scale over its bars): { w, words }. The widest values (with a
 * mark) on one line when the plot keeps its room (MIN_PLOT, or half the row on narrower charts; 42% on phones); else
 * the widest of their two parts, which then sit on two lines; else at most that room, the parts breaking at their
 * spaces too (`words`).
 */
function valuesWidth(items, width, phone, minN, genre) {
  const mark = textWidth("▲ ", 13);
  const parts = items.map((item) => profileValueParts(item) || [`Fewer than ${minN} stories`, ""]);
  const head = textWidth(`${genre.name} · all genres`, 12.5, 600);
  const line = Math.max(head, ...parts.map((p) => textWidth(p.join(" · "), 13) + mark)) + 4;
  const part = Math.max(70, ...parts.map((p) => Math.max(textWidth(`${p[0]} ·`, 13) + mark, textWidth(p[1], 13)))) + 4;
  const room = phone ? width - GAP - 14 : width - LABEL - 2 * GAP - 14; // the plot's and the values' room together
  const max = Math.round(phone ? width * 0.58 : Math.max(room / 2, room - MIN_PLOT));
  if (line <= max) return { w: Math.ceil(line), words: false };
  if (part <= max) return { w: Math.ceil(part), words: false };
  return { w: max, words: true };
}

/** The values as drawn, in two parts a phone may put on two lines; the mark is for the eye (the name says it). */
function Values({ item, mark, minN }) {
  const parts = profileValueParts(item);
  if (!parts) return `Fewer than ${minN} stories`;
  return (
    <>
      <span className="v-part">
        {mark && <span aria-hidden="true">{mark} </span>}
        {parts[0]} ·
      </span>{" "}
      <span className="v-part">{parts[1]}</span>
    </>
  );
}

/**
 * The plot of one row (concept P2, F67), on one scale for every row: how often the genre's story is the higher one
 * against a story from all genres, out of 100. The zone of no clear difference (the rule's 40 to 60) is shaded, its
 * edges drawn (they carry the rule's thresholds), with a line at 50; the bar runs from 50 to 50 × (1 + r) with its
 * number at its end. Named groups keep their two thin 100% bars, the genre's above all genres'. The geometry is in
 * percent of the plot, so the plot takes whatever width its cell has. Rows not compared say so instead.
 */
function RowPlot({ item, zone }) {
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
      <svg width="100%" height={20} aria-hidden="true" className="profile-plot">
        {bar(item.stats.shares, 1)}
        {bar(item.all.shares, 12)}
      </svg>
    );
  }
  const b = comparisonBar(item.r);
  const left = b.lower !== b.inside; // the number sits left of the bar's end (outside a lower bar, inside a higher one)
  return (
    <svg width="100%" height={20} aria-hidden="true" className="profile-plot">
      <rect className="p2-zone" x={`${zone[0]}%`} y={2} width={`${zone[1] - zone[0]}%`} height={16} />
      <line className="p2-edge" x1={`${zone[0]}%`} x2={`${zone[0]}%`} y1={2} y2={18} />
      <line className="p2-edge" x1={`${zone[1]}%`} x2={`${zone[1]}%`} y1={2} y2={18} />
      <line className="p2-mid" x1="50%" x2="50%" y1={0} y2={20} />
      {b.to > b.from && <rect className="p2-bar" x={`${b.from}%`} y={5} width={`${b.to - b.from}%`} height={10} rx={2} />}
      <text className={`p2-num${b.inside ? " inside" : ""}`} x={`${b.end}%`} dx={left ? -4 : 4} y={14} textAnchor={left ? "end" : "start"}>
        {b.times}
      </text>
    </svg>
  );
}

/** One characteristic in "One genre": a link to every genre's numbers (View 1). */
function ProfileRow({ item, genre, sub, minN, mark, zone, onNavigate }) {
  const few = item.r == null; // not compared: fewer than the rule's min_n stories
  return (
    <ViewLink className={`profile-row${few ? " small" : ""}`} to={{ v: item.id, sub }} onNavigate={onNavigate}>
      <span className="profile-label">{item.variable.label}</span>
      <span className="profile-plot-cell">
        <RowPlot item={item} zone={zone} />
      </span>
      <span className="profile-values">
        <Values item={item} mark={mark} minN={minN} />
      </span>
      <span className="visually-hidden">. {profileRowDescription(item, genre, few, minN)}</span>
    </ViewLink>
  );
}

/**
 * The scale over a list or an open topic: its ticks over the plots ("0" to "100 in 100"; on phones, or a plot too narrow
 * for five labels, "0", "50" and "100"), where any of its rows has a bar, and what the values are.
 */
function ProfileScale({ genre, short, bars }) {
  const ticks = short ? [0, 50, 100] : [0, 25, 50, 75, 100];
  return (
    <div className="profile-scale" aria-hidden="true">
      <span className="profile-plot-cell">
        {bars && (
          <svg width="100%" height={16} className="profile-ticks">
            {ticks.map((t) => (
              <text key={t} x={`${t}%`} y={12} textAnchor={t === 0 ? "start" : t === 100 ? "end" : "middle"}>
                {t === 100 && !short ? "100 in 100" : t}
              </text>
            ))}
          </svg>
        )}
      </span>
      <span className="profile-values">{genre.name} · all genres</span>
    </div>
  );
}

/** The rows of a list or a topic, under their scale (`marks`: the topics' lists mark their stand-outs). */
function ProfileRows({ id, items, marks = false, rowProps }) {
  const { width, phone, minN } = rowProps;
  const mark = (item) => (marks && item.f ? markOf(item) : "");
  const values = valuesWidth(items, width, phone, minN, rowProps.genre);
  const plotW = (phone ? width - values.w - GAP : width - LABEL - values.w - 2 * GAP) - 14; // the plot cell, less its room
  return (
    <div className={`profile-block${values.words ? " wrap-words" : ""}`} style={{ "--values-w": `${values.w}px` }}>
      <ProfileScale genre={rowProps.genre} short={phone || plotW < 320} bars={items.some((item) => item.r != null && item.kind !== "grp")} />
      <ul className="profile-rows" id={id}>
        {items.map((item) => (
          <li key={item.id}>
            <ProfileRow item={item} mark={mark(item)} {...rowProps} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Lower in Romance than in all genres": the first seven, then "Show all 18" / "Show fewer". */
function ProfileList({ title, items, all = false, rowProps }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const shown = all || open ? items : items.slice(0, SHOWN);
  return (
    <section className="profile-list" aria-labelledby={`${id}-h`}>
      <div className="profile-list-head">
        <h3 id={`${id}-h`}>{title}</h3>
        <span className="list-count">
          <span className="long">{characteristics(items.length)}</span>
          <span className="short" aria-hidden="true">
            {items.length}
          </span>
        </span>
      </div>
      <ProfileRows id={`${id}-list`} items={shown} rowProps={rowProps} />
      {!all && items.length > SHOWN && (
        <button
          type="button"
          className="link-button show-all"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          onClick={() => setOpen((x) => !x)}
        >
          {open ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </section>
  );
}

/**
 * The key of the rows (concept P2, with P1's mix line): what the bar measures, the zone of no clear difference with
 * the link to how it is decided, and, where named groups' rows can be shown, which of their two bars is the genre.
 */
function ProfileLegend({ genre, zone, mix }) {
  return (
    <ul className="legend genre-legend profile-legend">
      <li className="legend-text">
        <span className="key key-p2-bar" aria-hidden="true" /> How often a {genre.name} story is the higher one, against a story from
        all genres (times in 100)
      </li>
      <li className="legend-text">
        <span>
          <span className="key key-p2-zone" aria-hidden="true" /> No clear difference: {zone[0]} to {zone[1]} in 100 (
          <a href={HOW_DECIDED}>how this is decided</a>)
        </span>
      </li>
      {mix && (
        <li className="legend-text">
          <span className="key key-p2-mix" aria-hidden="true" /> A different mix: {genre.name} above, all genres below
        </li>
      )}
    </ul>
  );
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
  const [openTopics, setOpenTopics] = useState(() => new Set());
  const ids = useId();
  const genre = meta.genres.find((g) => g.id === state.genre);
  const subset = meta.subsets.find((s) => s.id === state.sub);
  const gi = file.genres.indexOf(state.genre);
  const n = gi < 0 ? 0 : file.n[gi];
  const { min_n: minN } = meta;
  // the phone layout follows the chart's own width, as the other forms do (below PHONE: the label on its own line)
  const panel = `chart-panel genre-profile${width < PHONE ? " phone" : ""}${busy ? " is-busy" : ""}`;
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
  const takeaway = profileTakeaway(p.flagged);
  const phone = width < PHONE;
  const zone = noDifferenceZone(file.rule);
  const rowProps = { genre, sub: state.sub, minN, zone, onNavigate, phone, width };
  const setTopic = (id, isOpen) =>
    setOpenTopics((prev) => {
      if (prev.has(id) === isOpen) return prev;
      const next = new Set(prev);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <article className={panel} aria-busy={busy} ref={ref}>
      <header className="chart-head">
        <h2 className="chart-title" ref={headingRef} tabIndex={-1}>
          {few ? tooFewText(genre, subset, file.rule.min_n) : profileHeading(count, genre)}
        </h2>
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
          {takeaway && <p className="takeaway profile-takeaway">{takeaway}</p>}
          <ProfileLegend genre={genre} zone={zone} mix={p.items.some((x) => x.kind === "grp")} />
          {p.lower.length > 0 && (
            <ProfileList title={`Lower in ${genre.name} than in all genres`} items={p.lower} rowProps={rowProps} />
          )}
          {p.higher.length > 0 && (
            <ProfileList title={`Higher in ${genre.name} than in all genres`} items={p.higher} rowProps={rowProps} />
          )}
          {p.mix.length > 0 && <ProfileList title="A different mix" items={p.mix} all rowProps={rowProps} />}
        </>
      )}
      <section className="profile-topics" aria-labelledby={`${ids}-topics`}>
        <h3 id={`${ids}-topics`}>Every characteristic, by topic</h3>
        {p.topics.map(({ topic, items, count: k, compared }) => {
          const open = openTopics.has(topic.id);
          return (
            <details key={topic.id} className="profile-topic" open={open} onToggle={(e) => setTopic(topic.id, e.currentTarget.open)}>
              <summary className="profile-topic-head">
                <h4>{topic.label}</h4>
                <span className="profile-topic-count">{k ? `${k} of ${compared} stand out` : characteristics(items.length)}</span>
              </summary>
              {open && <ProfileRows items={items} marks rowProps={rowProps} />}
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

/** What screen readers hear for one genre: the heading, then the biggest differences (or the "too few" sentence). */
export function profileAnnouncement(meta, file, state) {
  const genre = meta.genres.find((g) => g.id === state.genre);
  const gi = file.genres.indexOf(state.genre);
  const n = gi < 0 ? 0 : file.n[gi];
  const subset = meta.subsets.find((s) => s.id === state.sub);
  if (n < meta.min_n) return tooFewText(genre, subset, meta.min_n);
  if (n < file.rule.min_n) return tooFewText(genre, subset, file.rule.min_n);
  const p = genreProfile(meta, file, gi);
  const takeaway = profileTakeaway(p.flagged);
  return [`${profileHeading(p.flagged.length, genre)}.`, takeaway].filter(Boolean).join(" ");
}
