import { useId, useState } from "react";
import {
  bandQuartiles,
  genreAgeNote,
  genreProfile,
  profileHeading,
  profileRowDescription,
  profileTakeaway,
  profileValues,
} from "../lib/genres.js";
import { mixColors, profileShapes } from "../lib/genreLayout.js";
import { PHONE, textWidth } from "../lib/rangeLayout.js";
import { AgeNote } from "./GenreAnswer.jsx";
import { ViewLink } from "./GenreDetails.jsx";
import useWidth from "./useWidth.js";

const SHOWN = 7; // rows of a list before "Show all"
const LABEL = 250; // the label column on wider screens
const GAP = 12;

const markOf = (item) => (item.kind === "grp" ? "≠" : item.f > 0 ? "▲" : "▼");
const characteristics = (n) => `${n} characteristic${n === 1 ? "" : "s"}`;

/** What the row's values say: "7.79 · all 19.3", after the mark of a stand-out in the topics' lists. */
function valuesText(item, mark, minN) {
  if (!item.stats) return `Fewer than ${minN} stories`;
  return `${mark ? `${mark} ` : ""}${profileValues(item)}`;
}

/** The values as drawn: the mark is for the eye (the description says the comparison in words). */
function Values({ item, mark, minN }) {
  if (!item.stats) return `Fewer than ${minN} stories`;
  return (
    <>
      {mark && <span aria-hidden="true">{mark} </span>}
      {profileValues(item)}
    </>
  );
}

/** The small plot of one row: the genre against all genres, on the row's own scale (aria-hidden). */
function RowPlot({ item, width, small, hatchId }) {
  const height = 20;
  const cy = height / 2;
  const s = profileShapes({ kind: item.kind, stats: item.stats, all: item.all, width, bandAt: bandQuartiles });
  if (item.kind === "grp") {
    const colors = mixColors("grp", item.all.shares);
    const bars = (segs, y) =>
      segs.map((seg) =>
        seg.width > 0 ? <rect key={seg.b} x={seg.x} y={y} width={seg.width} height={7} fill={colors[seg.b].fill} className="segment" /> : null,
      );
    return (
      <svg width={width} height={height} aria-hidden="true" className="profile-plot">
        {s.genre && bars(s.genre, 1)}
        {s.genre && small && <rect x={7} y={1} width={width - 14} height={7} fill={`url(#${hatchId})`} />}
        {bars(s.all, 11)}
      </svg>
    );
  }
  return (
    <svg width={width} height={height} aria-hidden="true" className="profile-plot">
      <line className="baseline" x1={7} x2={width - 7} y1={cy} y2={cy} />
      {s.gray && <rect className="all-range" x={s.gray.x} y={cy - 7} width={s.gray.width} height={14} rx={2} />}
      {s.tick != null && <line className="all-median" x1={s.tick} x2={s.tick} y1={cy - 9} y2={cy + 9} />}
      {s.capsule && (
        <rect
          className="genre-range"
          x={s.capsule.x}
          y={cy - 4}
          width={s.capsule.width}
          height={8}
          rx={4}
          fill={small ? `url(#${hatchId})` : undefined}
        />
      )}
      {s.dot != null && <circle className={small ? "genre-dot hollow" : "genre-dot"} cx={s.dot} cy={cy} r={5.5} />}
    </svg>
  );
}

/** One characteristic in "One genre": a link to every genre's numbers, with this genre highlighted (View 1). */
function ProfileRow({ item, genre, sub, minN, smallN, mark, plotW, hatchId, onNavigate }) {
  const small = Boolean(item.stats) && item.stats.n < smallN;
  return (
    <ViewLink className={`profile-row${small ? " small" : ""}`} to={{ v: item.id, sub, genre: genre.id }} onNavigate={onNavigate}>
      <span className="profile-label">{item.variable.label}</span>
      <span className="profile-plot-cell">
        <RowPlot item={item} width={plotW} small={small} hatchId={hatchId} />
      </span>
      <span className="profile-values">
        <Values item={item} mark={mark} minN={minN} />
      </span>
      <span className="visually-hidden">. {profileRowDescription(item, genre, small)}</span>
    </ViewLink>
  );
}

/**
 * The rows of a list or a topic, all with the same plot width: the list's widest values text decides it (`marks`:
 * the topics' lists mark their stand-outs).
 */
function ProfileRows({ id, items, marks = false, rowProps }) {
  const { width, phone, minN } = rowProps;
  const mark = (item) => (marks && item.f ? markOf(item) : "");
  const valuesW = Math.ceil(Math.max(70, ...items.map((item) => textWidth(valuesText(item, mark(item), minN), 13))) + 4);
  const plotW = Math.max(60, phone ? width - valuesW - GAP : width - LABEL - valuesW - 2 * GAP);
  return (
    <ul className="profile-rows" id={id} style={{ "--values-w": `${valuesW}px` }}>
      {items.map((item) => (
        <li key={item.id}>
          <ProfileRow item={item} mark={mark(item)} plotW={plotW} {...rowProps} />
        </li>
      ))}
    </ul>
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

/** The key of the rows: the genre's median and interquartile range against all genres'. */
function ProfileLegend({ genre }) {
  return (
    <ul className="legend genre-legend profile-legend">
      <li>
        <span className="key key-median" aria-hidden="true" /> {genre.name}: median
      </li>
      <li>
        <span className="key key-iqr" aria-hidden="true" /> {genre.name}: interquartile range
      </li>
      <li>
        <span>
          <span className="key key-all-range" aria-hidden="true" /> All genres: interquartile range,{" "}
          <span className="key key-all-median" aria-hidden="true" /> median
        </span>
      </li>
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
 * differences, the story-age note when its stories' median age and all genres' are 3 or more years apart (All stories
 * only), the characteristics lower and higher in the genre (ordered by the size of the difference: this ranks
 * characteristics within one genre, never genres), the named groups with a different mix, and every characteristic by
 * topic, folded (a topic's rows are drawn when it is opened). Every row opens that characteristic's chart with the
 * genre highlighted. With fewer stories than the rule needs, nothing is compared: the heading says so, then "Show all
 * stories" and the topics, whose rows give the numbers.
 */
export default function GenreProfile({ meta, state, file, busy, onSwitch, onNavigate, headingRef }) {
  const [ref, width] = useWidth(720, "genres");
  const [openTopics, setOpenTopics] = useState(() => new Set());
  const ids = useId();
  const hatchId = `${ids}-hatch`.replace(/:/g, "");
  const genre = meta.genres.find((g) => g.id === state.genre);
  const subset = meta.subsets.find((s) => s.id === state.sub);
  const gi = file.genres.indexOf(state.genre);
  const n = gi < 0 ? 0 : file.n[gi];
  const { min_n: minN, small_n: smallN } = meta;
  const panel = `chart-panel genre-profile${busy ? " is-busy" : ""}`;
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
  const ageNote = state.sub === "all" ? genreAgeNote(file, gi, genre, 3) : null;
  const rowProps = { genre, sub: state.sub, minN, smallN, hatchId, onNavigate, width, phone: width < PHONE };
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
      <svg width="0" height="0" aria-hidden="true" className="defs">
        <defs>
          <pattern id={hatchId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" fill="#fff" />
            <line x1="0" y1="0" x2="0" y2="5" className="hatch-line" />
          </pattern>
        </defs>
      </svg>
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
          {ageNote && <AgeNote meta={meta} variable={null} text={ageNote} onCompare={(sub) => onSwitch({ ...state, sub })} />}
          <ProfileLegend genre={genre} />
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
