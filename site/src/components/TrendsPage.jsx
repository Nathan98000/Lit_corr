import { useEffect, useId, useMemo, useRef, useState } from "react";
import { loadTrends } from "../lib/data.js";
import { breakable } from "../lib/genres.js";
import {
  changesAnnouncement,
  changesQuestion,
  changesQuestionStart,
  genreWords,
  pickerChanges,
  trendAnnouncement,
  trendQuestion,
  trendQuestionText,
} from "../lib/trends.js";
import { TREND_PAGE_EXCLUDED, onTrendsPage, subsetConflict } from "../lib/urlState.js";
import { BodyPlaceholder, CharacteristicPicker, SlotButton } from "./Controls.jsx";
import { ChartPlaceholder } from "./Explorer.jsx";
import Segmented from "./GenreSwitch.jsx";
import IncludeSelect from "./IncludeSelect.jsx";
import InlineSelect, { SlotWords } from "./InlineSelect.jsx";
import { PartBoundary } from "./lazyPart.jsx";
import LoadError from "./LoadError.jsx";
import Overlay from "./Overlay.jsx";
import TrendAnswer from "./TrendAnswer.jsx";
import TrendChanges from "./TrendChanges.jsx";
import "../trends.css";

// the picker's Length & structure topic keeps its own blurb ("Word count, paragraphs, series, titles"): without the
// number of tags and the author's story count it still fits
const KEEP_BLURBS = ["length"];

/**
 * Keeps the file on screen until the next one has loaded (another genre or "Only include" option), as the Genres page
 * does: while it loads, the answer stays, dimmed and marked busy, so nothing is worded from data that is not there yet.
 */
function useShownTrends(sub, genre) {
  const [shown, setShown] = useState(null); // { key, file }
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${sub}/${genre}`;
  useEffect(() => {
    let live = true;
    setError(null);
    loadTrends(sub, genre).then(
      (file) => live && setShown({ key, file }),
      (e) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [sub, genre, attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    file: shown?.file ?? null,
    busy: !error && (!shown || shown.key !== key),
    error,
    retry: () => setAttempt((a) => a + 1),
  };
}

/**
 * What the polite live region says: `text` once the file is on screen, said again when `key` (the question shown)
 * changes even if the words are the same (as on the Genres page).
 */
function useAnnouncement(text, key) {
  const [said, setSaid] = useState("");
  const last = useRef(null);
  useEffect(() => {
    if (!text) return undefined;
    if (last.current === key) {
      setSaid((s) => (s === "" ? s : text));
      return undefined;
    }
    last.current = key;
    setSaid("");
    const t = setTimeout(() => setSaid(text), 60);
    return () => clearTimeout(t);
  }, [text, key]);
  return said;
}

/**
 * The Trends page (R1): how one characteristic changed over time (View 1), or what changed in a genre's stories (View
 * 2), stories from 2020 or later compared with stories from 2000-2009 by the rule in meta.trend (D2). Controls change
 * the address in place; the view switch and the links between the views add a history entry, so Back returns. The page
 * opens on All genres (D9).
 */
export default function TrendsPage({ meta, state, onChange, onNavigate, onHoldScroll, lastChart, lastExplore }) {
  const { file, busy, error, retry } = useShownTrends(state.sub, state.genre);
  const changes = state.view === "changes";
  const variable = meta.variables.find((v) => v.id === state.v);
  const genre = meta.genres.find((g) => g.id === state.genre);
  const subsets = meta.subsets.filter((s) => meta.trend.subsets.includes(s.id));
  const [menu, setMenu] = useState(false);
  const varBtn = useRef(null);
  const pickerFocus = useRef(null);
  const pickerBody = useRef(null);
  const ids = useId();
  const keepPlace = (next) => {
    onHoldScroll?.();
    onChange(next);
  };
  // a button inside the answer that changes it ("Show all stories") goes away with the change, so focus moves to the
  // answer's heading, without scrolling, and again once the new file is drawn; "Try again" too
  const heading = useRef(null);
  const focusHeading = useRef(false);
  const toHeading = () => heading.current?.focus({ preventScroll: true });
  const switchFromAnswer = (next) => {
    focusHeading.current = true;
    keepPlace(next);
    toHeading();
  };
  useEffect(() => {
    if (!focusHeading.current || busy || !file) return;
    focusHeading.current = false;
    toHeading();
  }, [file, busy]);
  // while another genre's or option's file loads, the answer on screen keeps describing its own file: its genre, its
  // option, and an answer it can draw. A characteristic the file lacks (word count, after a Length option) keeps the
  // answer last drawn from it, a characteristic or "What changed" (the page opens on it, with no characteristic).
  const fits = Boolean(file) && (changes || Boolean(file.c[state.v]));
  const drawn = useRef({ changes, v: state.v });
  if (fits) drawn.current = { changes, v: state.v };
  const answer = !file || fits ? { changes, v: state.v } : drawn.current;
  const view = file ? { ...state, genre: file.g, sub: file.s, v: answer.v } : state;
  const announcement = useAnnouncement(
    !file || busy || error ? "" : answer.changes ? changesAnnouncement(meta, file, view) : trendAnnouncement(meta, file, view),
    `${state.view || "chart"}|${state.v}|${state.genre}|${state.sub}`,
  );

  // the tab's title is the question on screen, once its file is (as on the Genres page)
  const question = changes ? changesQuestion(genre) : trendQuestionText(variable, genre);
  useEffect(() => {
    if (file && !busy && !error) document.title = question;
  }, [question, file, busy, error]);

  // the view switch keeps the genre and the option; back, the characteristic it came from
  const switchView = (to) => {
    if (to === "changes") {
      onNavigate({ view: "changes", genre: state.genre, sub: state.sub });
    } else {
      const back = lastChart?.current?.v;
      const v = back && meta.variables.some((x) => x.id === back && onTrendsPage(x)) ? back : state.v;
      const next = { v, genre: state.genre, sub: state.sub };
      if (subsetConflict(meta.subsets.find((s) => s.id === next.sub), meta.variables.find((x) => x.id === v))) next.sub = "all";
      onNavigate(next);
    }
  };

  // a genre whose two windows can't be compared with this option says so in the list (it stays selectable: its chart
  // over time still draws its periods)
  const tooFew = new Set(meta.trend.too_few?.[state.sub] ?? []);
  const genreSlot = (
    <InlineSelect
      id={`${ids}-genre`}
      label="Genre"
      value={genre.id}
      text={breakable(genreWords(genre))}
      onChange={(g) => keepPlace({ ...state, genre: g })}
    >
      {meta.genres.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
          {tooFew.has(g.id) ? " (too few to compare)" : ""}
        </option>
      ))}
    </InlineSelect>
  );
  // the picker's group of what clearly changed in the file on screen (View 1)
  const changed = useMemo(() => (file && !changes ? pickerChanges(meta, file) : null), [meta, file, changes]);

  // the question is the page's h1 (the kicker isn't, here); its name is the question as words, so a screen reader that
  // lists headings says it plainly rather than with its controls' labels ("Story characteristic: …")
  const named = { className: "sentence", "aria-labelledby": `${ids}-question` };
  let sentence;
  if (changes) {
    sentence = (
      <h1 {...named}>
        {changesQuestionStart(genre)}
        {genreSlot}
        {"⁠?"}
      </h1>
    );
  } else {
    const q = trendQuestion(variable, genre);
    sentence = (
      <h1 {...named}>
        {q.before}
        {genreSlot}
        {q.middle}
        <SlotButton ref={varBtn} expanded={menu} onPress={() => setMenu((m) => !m)} onHint={CharacteristicPicker.preload}>
          <span className="visually-hidden">Story characteristic: </span>
          <SlotWords text={q.slot} />
        </SlotButton>
        {q.after}
        {"⁠?"}
      </h1>
    );
  }

  return (
    <section className="trends-page" aria-label="Trends">
      <div className="controls">
        <fieldset className="question" id="question" tabIndex={-1}>
          <legend className="visually-hidden">Choose what to show</legend>
          <span id={`${ids}-question`} hidden>
            {question}
          </span>
          {sentence}
        </fieldset>
        <div className="genres-controls trends-controls">
          <Segmented
            label="Show"
            className="view-switch"
            options={[
              ["changes", "All changes"],
              ["chart", "One characteristic"],
            ]}
            value={changes ? "changes" : "chart"}
            onChange={switchView}
          />
          <IncludeSelect
            subsets={subsets}
            value={state.sub}
            variable={changes ? undefined : variable}
            onChange={(s) => keepPlace({ ...state, sub: s })}
          />
        </div>
      </div>
      {!changes && (
        <Overlay
          open={menu}
          onClose={() => setMenu(false)}
          anchor={varBtn}
          title="Story characteristic"
          titleId={`${ids}-picker-title`}
          initialFocus={pickerFocus}
          bodyRef={pickerBody}
          className="picker"
        >
          <PartBoundary
            fallback={<BodyPlaceholder search={`Search ${meta.variables.filter(onTrendsPage).length} characteristics`} />}
          >
            <CharacteristicPicker
              meta={meta}
              value={state.v}
              exclude={TREND_PAGE_EXCLUDED}
              keepBlurbs={KEEP_BLURBS}
              changed={changed}
              focusRef={pickerFocus}
              scrollRef={pickerBody}
              onClose={() => setMenu(false)}
              onPick={(id) => {
                setMenu(false);
                const next = { ...state, v: id };
                const nextVar = meta.variables.find((v) => v.id === id);
                if (subsetConflict(meta.subsets.find((s) => s.id === state.sub), nextVar)) next.sub = "all";
                keepPlace(next);
              }}
            />
          </PartBoundary>
        </Overlay>
      )}
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
      {error ? (
        <article className="chart-panel">
          <LoadError
            onRetry={() => {
              focusHeading.current = true;
              retry();
            }}
            detail={error}
          />
        </article>
      ) : !file ? (
        <ChartPlaceholder />
      ) : answer.changes ? (
        <TrendChanges meta={meta} state={view} file={file} busy={busy} onSwitch={switchFromAnswer} onNavigate={onNavigate} headingRef={heading} />
      ) : (
        <TrendAnswer
          meta={meta}
          state={view}
          file={file}
          busy={busy}
          onSwitch={switchFromAnswer}
          onNavigate={onNavigate}
          lastExplore={lastExplore}
          headingRef={heading}
        />
      )}
    </section>
  );
}
