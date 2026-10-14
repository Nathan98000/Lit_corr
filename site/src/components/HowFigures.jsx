import { useId } from "react";
import { formatCount } from "../lib/format.js";
import { textWidth } from "../lib/rangeLayout.js";
import { MARK, TEXT } from "../lib/tokens.js";
import { STRENGTH, typicalSample } from "../lib/wording.js";
import useWidth from "./useWidth.js";

// How it works' pictures (the owner, 2026-10-14: the page was "a big wall of text"). They draw with the charts' own
// marks and colors, and every number they show comes from the data (meta.json) or from the site's rules; the text
// around each one says the same in words, so a drawing without words of its own is hidden from screen readers.
// Styles: methodology.css.

/** A picture in a panel, with its title above it (none for the sampling steps, whose section names them). */
function Figure({ title, className, children }) {
  return (
    <figure className={`how-figure ${className}`}>
      {title && <figcaption className="figure-title">{title}</figcaption>}
      {children}
    </figure>
  );
}

// ------------------------------------------------------------------------------------------- how the stories were picked

// The pictures of the sampling: a genre's 16 listing pages; every 4th of them read, from the 2nd (the random start);
// eight stories found there, numbered in listing order, shuffled (SHUFFLED[k] is the story in place k of the random
// order); and the first places of that order collected.
const PAGES = 16;
const EVERY = 4;
const START = 1;
const SHUFFLED = [5, 2, 7, 0, 3, 6, 1, 4];
const LOST = 2; // the story in the third place couldn't be collected …
const TAKEN = 6; // … so the first six places give five stories; a dashed line marks where collecting stopped
const dotX = (k) => 10 + k * 20;
/** A story's dot, lighter the earlier it comes in the listing, so the shuffle shows as mixed shades. */
const shade = (story) => 0.3 + (0.7 * story) / (SHUFFLED.length - 1);

function Pages({ read = false }) {
  return (
    <svg className="step-pic" viewBox="0 0 160 40" aria-hidden="true" focusable="false">
      {Array.from({ length: PAGES }, (_, i) => {
        const kind = !read ? "" : i % EVERY === START ? " read" : " passed";
        return <rect key={i} className={`pg${kind}`} x={1.5 + i * 10} y={7.5} width={7} height={25} rx={1} />;
      })}
    </svg>
  );
}

/** A story in its shade, over a dot of the panel's color so that the lines under it don't show through. */
function Story({ story, cx, cy }) {
  return (
    <g>
      <circle className="story-under" cx={cx} cy={cy} r={5} />
      <circle className="story" cx={cx} cy={cy} r={5} style={{ fillOpacity: shade(story) }} />
    </g>
  );
}

function Shuffle() {
  return (
    <svg className="step-pic" viewBox="0 0 160 40" aria-hidden="true" focusable="false">
      <g>
        {SHUFFLED.map((story, k) => (
          <line key={story} className="shuffle-line" x1={dotX(story)} y1={7} x2={dotX(k)} y2={33} />
        ))}
      </g>
      <g>
        {SHUFFLED.map((_, story) => (
          <Story key={story} story={story} cx={dotX(story)} cy={7} />
        ))}
      </g>
      <g>
        {SHUFFLED.map((story, k) => (
          <Story key={story} story={story} cx={dotX(k)} cy={33} />
        ))}
      </g>
    </svg>
  );
}

function Collected() {
  return (
    <svg className="step-pic" viewBox="0 0 160 40" aria-hidden="true" focusable="false">
      {SHUFFLED.map((story, k) => {
        const cx = dotX(k);
        if (k === LOST) {
          return (
            <g key={story} className="lost">
              <line x1={cx - 4} y1={16} x2={cx + 4} y2={24} />
              <line x1={cx - 4} y1={24} x2={cx + 4} y2={16} />
            </g>
          );
        }
        if (k >= TAKEN) return <circle key={story} className="story-left" cx={cx} cy={20} r={4.5} />;
        return <Story key={story} story={story} cx={cx} cy={20} />;
      })}
      <line className="cut" x1={dotX(TAKEN) - 10} x2={dotX(TAKEN) - 10} y1={6} y2={34} />
    </svg>
  );
}

/** "Where the stories come from": the random sample in four steps, each with its picture. */
export function SampleSteps({ meta }) {
  const steps = [
    ["Every story, A to Z", <Pages />, "A genre’s listing by title names every story in it, popular or not."],
    ["Pages at even steps", <Pages read />, "Pages of that listing were picked at even steps, from a random first page."],
    ["A random order", <Shuffle />, "The stories on those pages were shuffled into a random order."],
    [
      `About ${formatCount(typicalSample(meta))} per genre`,
      <Collected />,
      "Stories were collected in that order. One that couldn’t be (it had been removed, or the site kept returning an " +
        "error for it) was replaced by the next.",
    ],
  ];
  return (
    <Figure className="steps-figure">
      <ol className="sample-steps" role="list">
        {steps.map(([title, picture, text], i) => (
          <li key={title}>
            <p className="step-title">
              <span className="step-num" aria-hidden="true">
                {i + 1}
              </span>
              {title}
            </p>
            {picture}
            <p className="step-text">{text}</p>
          </li>
        ))}
      </ol>
    </Figure>
  );
}

// ------------------------------------------------------------------------------------------------------- the measures

/**
 * "How the story characteristics were measured": a made-up passage marked as the rules see it, with a key. Pronouns
 * and words are the ones the pipeline uses (litcorr/text/features.py's pronoun sets; "happy" is in
 * lexicons/emotion_positive.txt).
 */
export function ExamplePassage() {
  return (
    <Figure title="What the rules see in a made-up passage" className="example-figure">
      <p className="example-text">
        <span className="ex-pron">I</span> was not <span className="ex-word">happy</span>.{" "}
        <span className="ex-dialogue">“We should go,”</span> <span className="ex-pron">she</span> said.{" "}
        <span className="ex-pron">I</span> nodded, reaching for <span className="ex-pron">my</span> coat.
      </p>
      <ul className="figure-key example-key" role="list">
        <li>
          <span className="key-sample">
            <span className="ex-dialogue">“We should go,”</span>
          </span>{" "}
          <span>
            <strong>Dialogue</strong> is the words inside quotation marks; everything else is narration.
          </span>
        </li>
        <li>
          <span className="key-sample">
            <span className="ex-pron">I</span> <span className="ex-pron">she</span> <span className="ex-pron">my</span>
          </span>{" "}
          <span>
            <strong>Point of view</strong> is read from the narration’s pronouns; the “We” in the dialogue doesn’t count.
          </span>
        </li>
        <li>
          <span className="key-sample">
            <span className="ex-word">happy</span>
          </span>{" "}
          <span>
            <strong>Word lists</strong>: “happy” is on the positive-emotion list, so it counts, even after “not”.
          </span>
        </li>
      </ul>
    </Figure>
  );
}

// ------------------------------------------------------------------------------------------------------- the charts

const SWATCH = { w: 48, h: 16 };

/**
 * "How the charts summarize stories": the range chart's marks (RangeChart.jsx), each drawn at its size on the chart,
 * with what it shows; the group sizes below which a group is hatched or hidden come from the data.
 */
export function ChartKey({ meta }) {
  const hatch = `${useId()}-hatch`.replace(/:/g, "");
  const cy = SWATCH.h / 2;
  const bar = { x: 4, y: cy - MARK.bar / 2, width: SWATCH.w - 8, height: MARK.bar, rx: MARK.bar / 2 };
  const items = [
    [
      "median",
      <circle className="key-dot" cx={SWATCH.w / 2} cy={cy} r={MARK.dot} />,
      <>
        <strong>Median</strong> of each group, with its value printed beside it
      </>,
    ],
    [
      "iqr",
      <rect className="key-bar" {...bar} />,
      <>
        <strong>Interquartile range</strong> of each group
      </>,
    ],
    [
      "small",
      <>
        <rect className="key-small-bar" {...bar} style={{ fill: `url(#${hatch})` }} />
        <circle className="key-small-dot" cx={SWATCH.w / 2} cy={cy} r={MARK.dot} />
      </>,
      <>
        <strong>Fewer than {meta.small_n} stories</strong>: drawn hatched, with a hollow dot. They deserve less trust.
      </>,
    ],
    [
      "none",
      null,
      <>
        <strong>Fewer than {meta.min_n} stories</strong>: not shown; the row says “Too few stories to show”.
      </>,
    ],
    [
      "ref",
      <line className="key-ref" x1={SWATCH.w / 2} x2={SWATCH.w / 2} y1={0} y2={SWATCH.h} />,
      <>
        <strong>Median of all stories</strong>: the dashed line, with its value under the chart
      </>,
    ],
  ];
  return (
    <Figure title="What a chart draws" className="marks-figure">
      <ul className="figure-key chart-key" role="list">
        {items.map(([id, mark, words]) => (
          <li key={id}>
            <svg width={SWATCH.w} height={SWATCH.h} aria-hidden="true" focusable="false">
              {id === "small" && (
                <defs>
                  <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="5" height="5" fill="#fff" />
                    <line x1="0" y1="0" x2="0" y2="5" className="key-hatch-line" />
                  </pattern>
                </defs>
              )}
              {mark}
            </svg>
            <span>{words}</span>
          </li>
        ))}
      </ul>
    </Figure>
  );
}

/** One 100% bar, a segment per genre in the given order; the first (the largest genre) in the accent. */
function ShareBar({ parts }) {
  const total = parts.reduce((sum, p) => sum + p, 0);
  let at = 0;
  return (
    <svg className="share-bar" width="100%" height={16} aria-hidden="true" focusable="false">
      {parts.map((p, i) => {
        const x = (100 * at) / total;
        at += p;
        const cls = i === 0 ? "seg top" : i % 2 ? "seg odd" : "seg";
        return <rect key={i} className={cls} x={`${x}%`} y={0} width={`${(100 * p) / total}%`} height={16} />;
      })}
    </svg>
  );
}

/**
 * Why "All genres" weights each story by its genre's size: each genre's share of the stories on Literotica (the
 * genres' sizes, meta.genres[].size, the site's own counts) and in the sample (the stories each genre has here), in
 * the same order, largest genre first.
 */
export function GenreSizes({ meta }) {
  const genres = meta.genres
    .filter((g) => g.id !== "all" && g.size)
    .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
  if (genres.length < 2) return null;
  const onSite = genres.reduce((sum, g) => sum + g.size, 0);
  const sampled = genres.reduce((sum, g) => sum + g.n, 0);
  const [top] = genres;
  const pct = (part, whole) => `${Math.round((100 * part) / whole)}%`;
  // "about the same as every genre" only where the samples are within a tenth of each other (417–420 stories each)
  const ns = genres.map((g) => g.n);
  const even = Math.max(...ns) <= 1.1 * Math.min(...ns);
  return (
    <Figure title="Each genre’s share of the stories, largest first" className="sizes-figure">
      <div className="sizes-row">
        <p className="sizes-label">
          On Literotica, in these {genres.length} genres: {formatCount(onSite)} stories
        </p>
        <ShareBar parts={genres.map((g) => g.size)} />
        <p className="sizes-note">
          {top.name}, the largest genre: {pct(top.size, onSite)}
        </p>
      </div>
      <div className="sizes-row">
        <p className="sizes-label">In the sample: {formatCount(sampled)} stories</p>
        <ShareBar parts={genres.map((g) => g.n)} />
        <p className="sizes-note">
          {top.name}: {pct(top.n, sampled)}
          {even && ", about the same as every genre"}
        </p>
      </div>
    </Figure>
  );
}

// ----------------------------------------------------------------------------------------------------------- "tend to"

/** The strength words on the rank correlation, 0 to 1, from the thresholds the titles use (STRENGTH, lib/wording.js). */
export function StrengthScale() {
  const [ref, w] = useWidth(480, "how-figure");
  const x = (v) => v * w;
  const bands = [
    ["Weak", 0, STRENGTH.moderate],
    ["Moderate", STRENGTH.moderate, STRENGTH.strong],
    ["Strong", STRENGTH.strong, 1],
  ];
  const ticks = [0, STRENGTH.moderate, STRENGTH.strong, 1];
  const anchor = (i) => (i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle");
  return (
    <Figure title="Weak, moderate and strong, on the rank correlation" className="strength-figure">
      <div ref={ref} className="figure-plot">
        <svg width={w} height={56} aria-hidden="true" focusable="false">
          {bands.map(([word, from, to], i) => (
            <g key={word}>
              {/* 2 px of white between the bands */}
              <rect
                className={`band band-${i}`}
                x={x(from) + (i ? 1 : 0.5)}
                y={22}
                width={x(to) - x(from) - (i ? 1 : 0.5) - (i < bands.length - 1 ? 1 : 0.5)}
                height={12}
              />
              <text className="fig-label" x={(x(from) + x(to)) / 2} y={14} textAnchor="middle">
                {word}
              </text>
            </g>
          ))}
          {ticks.map((t, i) => (
            <text key={t} className="fig-tick" x={x(t)} y={51} textAnchor={anchor(i)}>
              {t}
            </text>
          ))}
        </svg>
      </div>
    </Figure>
  );
}

// ---------------------------------------------------------------------------------------- comparing genres, over time

/**
 * "Comparing genres": the One genre view's row (ComparisonProfile's RowPlot) for three made-up results, on the 0–100
 * scale with the rule's zone of no clear difference (as noDifferenceZone in lib/genres.js, which stays out of this
 * page's code): a clear difference each way and one inside the zone. The labels go left of the plots, or above them
 * where the plots would get narrower than 260 px.
 */
export function ComparisonScale({ rule }) {
  const [ref, width] = useWidth(560, "how-figure");
  const zone = [Math.round(50 * (1 - rule.min_r)), Math.round(50 * (1 + rule.min_r))];
  const rows = [
    { label: "Higher in the genre", times: Math.min(98, zone[1] + 4), clear: true },
    { label: "No clear difference", times: Math.round((50 + zone[1]) / 2), clear: false },
    { label: "Lower in the genre", times: Math.max(2, zone[0] - 3), clear: true },
  ];
  const labelW = Math.ceil(Math.max(...rows.map((r) => textWidth(r.label, TEXT.secondary)))) + 16;
  const stacked = width - labelW < 260;
  const left = stacked ? 0 : labelW;
  const x = (v) => left + (v / 100) * (width - left);
  const zoneWords = `${zone[0]}–${zone[1]}: no clear difference`;
  const zoneW = textWidth(zoneWords, TEXT.tick);
  const zoneX = Math.min(Math.max(x(50), left + zoneW / 2), width - zoneW / 2);
  const head = 40; // the zone's bracket and the tick labels
  const rowH = stacked ? 44 : 32;
  const ticks = [0, 25, 50, 75, 100];
  return (
    <Figure title="How the One genre view draws it, out of 100" className="compare-figure">
      <div ref={ref} className="figure-plot">
        <svg width={width} height={head + rows.length * rowH} aria-hidden="true" focusable="false">
          <text className="fig-tick" x={zoneX} y={11} textAnchor="middle">
            {zoneWords}
          </text>
          <line className="cmp-bracket" x1={x(zone[0])} x2={x(zone[1])} y1={15} y2={15} />
          <line className="cmp-bracket" x1={x(zone[0])} x2={x(zone[0])} y1={15} y2={20} />
          <line className="cmp-bracket" x1={x(zone[1])} x2={x(zone[1])} y1={15} y2={20} />
          {ticks.map((t, i) => (
            <text key={t} className="fig-tick" x={x(t)} y={33} textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}>
              {t}
            </text>
          ))}
          {rows.map((r, i) => {
            const top = head + i * rowH;
            const cy = stacked ? top + 31 : top + 16;
            const quiet = r.clear ? "" : " quiet";
            const dotR = r.clear ? MARK.score : MARK.quiet;
            // the number beside the dot, away from 50; a dot inside the zone has it just outside the zone's edge
            const inside = r.times > zone[0] && r.times < zone[1];
            const up = r.times >= 50;
            const numX = inside ? x(up ? zone[1] : zone[0]) + (up ? 8 : -8) : x(r.times) + (up ? dotR + 8 : -dotR - 8);
            return (
              <g key={r.label}>
                <text className="cmp-row-label" x={0} y={stacked ? top + 14 : cy + 5}>
                  {r.label}
                </text>
                <rect className="cmp-zone" x={x(zone[0])} y={cy - 9} width={x(zone[1]) - x(zone[0])} height={18} />
                <line className="cmp-edge" x1={x(zone[0])} x2={x(zone[0])} y1={cy - 9} y2={cy + 9} />
                <line className="cmp-edge" x1={x(zone[1])} x2={x(zone[1])} y1={cy - 9} y2={cy + 9} />
                <line className="cmp-mid" x1={x(50)} x2={x(50)} y1={cy - 11} y2={cy + 11} />
                <line className={`cmp-stem${quiet}`} x1={x(50)} x2={x(r.times)} y1={cy} y2={cy} />
                <circle className={`cmp-dot${quiet}`} cx={x(r.times)} cy={cy} r={dotR} />
                <text className={`cmp-num${quiet}`} x={numX} y={cy + 4.5} textAnchor={up ? "start" : "end"}>
                  {r.times}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="figure-note">
        Each dot: out of 100 random pairs, one story from the genre and one from all genres, how often the genre’s story
        is the higher one. 50 is a tie. The Trends page draws its changes the same way.
      </p>
    </Figure>
  );
}

/** "2000–04"; "1998–2003" across a century. */
const yearsLabel = ([a, b]) => `${a}–${Math.floor(a / 100) === Math.floor(b / 100) ? String(b).slice(-2) : b}`;

/**
 * "Changes over time": the Trends page's periods (meta.trend.periods) on a line of years, the two windows it compares
 * (then and now) in the accent and named above, the periods between in gray ("drawn, not compared" where the words
 * fit between the windows' names). The periods' names go on two lines where one would not fit a period.
 */
export function TrendWindows({ trend }) {
  const [ref, width] = useWidth(560, "how-figure");
  const { periods, then, now } = trend;
  const lo = periods[0][0];
  const hi = periods[periods.length - 1][1] + 1;
  const x = (year) => ((year - lo) / (hi - lo)) * width;
  const compared = (p) => (p[0] >= then[0] && p[1] <= then[1]) || p[0] >= now[0];
  /** A name centered over [from, to], kept inside the picture: its center and its ends. */
  const place = (text, from, to, size, weight = 400) => {
    const half = textWidth(text, size, weight) / 2;
    const c = Math.min(Math.max((from + to) / 2, half), width - half);
    return { text, c, l: c - half, r: c + half };
  };
  const windows = [
    { ...place(`${then[0]}–${then[1]}`, x(then[0]), x(then[1] + 1), TEXT.note, 600), from: x(then[0]), to: x(then[1] + 1) },
    { ...place(`${now[0]} or later`, x(now[0]), x(hi), TEXT.note, 600), from: x(now[0]), to: x(hi) },
  ];
  const between =
    periods.some((p) => !compared(p)) &&
    ["drawn, not compared", "not compared"]
      .map((text) => place(text, windows[0].to, windows[1].from, TEXT.tick))
      .find((m) => m.l >= windows[0].r + 8 && m.r <= windows[1].l - 8);
  const oneLine = periods.every((p) => textWidth(yearsLabel(p), TEXT.tick) + 6 <= x(p[1] + 1) - x(p[0]));
  const barY = 28;
  return (
    <Figure title="The Trends page’s periods, and the two windows it compares" className="trends-figure">
      <div ref={ref} className="figure-plot">
        <svg width={width} height={oneLine ? 74 : 88} aria-hidden="true" focusable="false">
          {windows.map((win) => (
            <g key={win.text}>
              <text className="fig-label window" x={win.c} y={13} textAnchor="middle">
                {win.text}
              </text>
              <line className="window-bracket" x1={win.from + 1} x2={win.to - 1} y1={19} y2={19} />
              <line className="window-bracket" x1={win.from + 1} x2={win.from + 1} y1={19} y2={24} />
              <line className="window-bracket" x1={win.to - 1} x2={win.to - 1} y1={19} y2={24} />
            </g>
          ))}
          {between && (
            <text className="fig-label aside" x={between.c} y={13} textAnchor="middle">
              {between.text}
            </text>
          )}
          {periods.map((p) => {
            const from = x(p[0]);
            const to = x(p[1] + 1);
            const c = (from + to) / 2;
            const [first, rest] = yearsLabel(p).split("–");
            return (
              <g key={p[0]}>
                <rect className={`period${compared(p) ? " compared" : ""}`} x={from + 1} y={barY} width={to - from - 2} height={24} />
                {oneLine ? (
                  <text className="fig-tick" x={c} y={barY + 40} textAnchor="middle">
                    {yearsLabel(p)}
                  </text>
                ) : (
                  <text className="fig-tick" x={c} y={barY + 38} textAnchor="middle">
                    <tspan x={c}>{first}</tspan>
                    <tspan x={c} dy={14}>
                      –{rest}
                    </tspan>
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </Figure>
  );
}
