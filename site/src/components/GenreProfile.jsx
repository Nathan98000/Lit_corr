import {
  axisTitle,
  breakable,
  genreProfile,
  mixLine,
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
import ComparisonProfile from "./ComparisonProfile.jsx";
import { HOW_DECIDED } from "./GenreAnswer.jsx";
import { ViewLink } from "./GenreDetails.jsx";

export { plotWidth } from "./ComparisonProfile.jsx";

/**
 * "Fewer than 10 stories in Chain Stories match “Published 2020 or later”: too few to compare.", or with the rule's
 * min_n ("Fewer than 30 …") when the genre has its numbers but too few stories to be compared (F60).
 */
export const tooFewText = (genre, subset, minN) =>
  `Fewer than ${minN} stories in ${genre.name} match “${subset.label}”: too few to compare.`;

/**
 * One genre against all genres (View 2), drawn by ComparisonProfile: how many characteristics clearly set the genre
 * apart, the three biggest differences, the characteristics lower and higher in the genre (ordered by the size of the
 * difference: this ranks characteristics within one genre, never genres), the named groups with a different mix, and
 * every characteristic by topic, folded (a topic's rows are drawn when it is opened). Every row opens that
 * characteristic's chart in every genre. With fewer stories than the rule needs, nothing is compared: the heading says
 * so, then "Show all stories" and the topics, whose rows give the numbers. Under the topics, Copy link (F80).
 */
export default function GenreProfile({ meta, state, file, busy, onSwitch, onNavigate, headingRef }) {
  const genre = meta.genres.find((g) => g.id === state.genre);
  const subset = meta.subsets.find((s) => s.id === state.sub);
  const gi = file.genres.indexOf(state.genre);
  const n = gi < 0 ? 0 : file.n[gi];
  const { min_n: minN } = meta;
  const showAll = state.sub !== "all" && (
    <p className="inline-actions">
      <button type="button" className="btn" onClick={() => onSwitch({ ...state, sub: "all" })}>
        Show all stories
      </button>
    </p>
  );
  const common = { className: "genre-profile", busy, showAll, placeKey: "oneGenre", widthKey: "genres" };

  if (n < minN) {
    const header = (
      <header className="chart-head">
        <h2 className="chart-title" ref={headingRef} tabIndex={-1}>
          {tooFewText(genre, subset, minN)}
        </h2>
      </header>
    );
    return <ComparisonProfile {...common} header={header} tooFew />;
  }

  // fewer stories than the rule needs: nothing was compared, but every characteristic's numbers are there (F60)
  const few = n < file.rule.min_n;
  const p = genreProfile(meta, file, gi);
  const count = p.flagged.length;
  const takeaway = profileTakeaway(p);
  const header = (
    <header className="chart-head">
      <h2 className="chart-title" ref={headingRef} tabIndex={-1}>
        {few ? tooFewText(genre, subset, file.rule.min_n) : profileHeading(count, genre)}
      </h2>
      <p className="profile-sample">{sampleLine(n, genre, subset)}</p>
    </header>
  );
  const top = (
    <>
      {count === 0 && (
        <p className="profile-none">Its stories are close to those of all genres on each of the {p.compared} characteristics compared.</p>
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
    </>
  );
  const words = {
    heads: (stacked, width) => profileHeads(genre, stacked, width),
    lists: {
      lower: `Lower in ${breakable(genre.name)} than in all genres`,
      higher: `Higher in ${breakable(genre.name)} than in all genres`,
      mix: "A different mix",
    },
    axisTitle: axisTitle(genre),
    zone: "no clear difference",
    note: (opts) => profileNote(genre, opts),
    decided: HOW_DECIDED,
    mixLine: (opts) => mixLine(genre, opts),
    topicsLine:
      "How many characteristics in each topic stand out. Open a topic to see them all: blue dots stand out, gray dots show no clear difference.",
    topicCount,
    countWord: "stand out",
  };
  const row = {
    columns: profileColumns,
    name: (item) => profileRowName(item, genre, minN),
    link: ({ item, className, children }) => (
      <ViewLink className={className} to={{ v: item.id, sub: state.sub }} onNavigate={onNavigate}>
        {children}
      </ViewLink>
    ),
  };

  return (
    <ComparisonProfile
      {...common}
      header={header}
      top={top}
      few={few}
      profile={p}
      rule={file.rule}
      answerKey={`${state.genre}|${state.sub}`}
      words={words}
      row={row}
    />
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
