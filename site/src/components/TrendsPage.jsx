import { useEffect, useId, useRef, useState } from "react";
import { loadTrends } from "../lib/data.js";
import { breakable } from "../lib/genres.js";
import { changesAnnouncement, changesQuestion, trendAnnouncement, trendQuestion, trendQuestionText } from "../lib/trends.js";
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
export default function TrendsPage({ meta, state, onChange, onNavigate, onHoldScroll, lastChart }) {
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
  // while another genre's or option's file loads, the answer on screen keeps describing its own file (its genre, its
  // option, and a characteristic it has)
  const shownV = useRef(state.v);
  if (file?.c[state.v]) shownV.current = state.v;
  const view = file ? { ...state, genre: file.g, sub: file.s, v: file.c[state.v] ? state.v : shownV.current } : state;
  const announcement = useAnnouncement(
    !file || busy || error ? "" : changes ? changesAnnouncement(meta, file, view) : trendAnnouncement(meta, file, view),
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

  const genreSlot = (
    <InlineSelect
      id={`${ids}-genre`}
      label="Genre"
      value={genre.id}
      text={breakable(genre.name)}
      onChange={(g) => keepPlace({ ...state, genre: g })}
    >
      {meta.genres.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </InlineSelect>
  );

  let sentence;
  if (changes) {
    sentence = (
      <p className="sentence">
        What has changed in stories in {genreSlot}
        {"⁠?"}
      </p>
    );
  } else {
    const q = trendQuestion(variable);
    sentence = (
      <p className="sentence">
        {q.before}
        {genreSlot}
        {q.middle}
        <SlotButton ref={varBtn} expanded={menu} onPress={() => setMenu((m) => !m)} onHint={CharacteristicPicker.preload}>
          <span className="visually-hidden">Story characteristic: </span>
          <SlotWords text={q.slot} />
        </SlotButton>
        {q.after}
        {"⁠?"}
      </p>
    );
  }

  return (
    <section className="trends-page" aria-label="Trends">
      <div className="controls">
        <fieldset className="question" id="question" tabIndex={-1}>
          <legend className="visually-hidden">Choose what to show</legend>
          {sentence}
        </fieldset>
        <div className="genres-controls trends-controls">
          <Segmented
            label="Show"
            className="view-switch"
            options={[
              ["chart", "One characteristic"],
              ["changes", "What changed"],
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
      ) : changes ? (
        <TrendChanges meta={meta} state={view} file={file} busy={busy} onSwitch={switchFromAnswer} onNavigate={onNavigate} headingRef={heading} />
      ) : (
        <TrendAnswer meta={meta} state={view} file={file} busy={busy} onSwitch={switchFromAnswer} headingRef={heading} />
      )}
    </section>
  );
}
