import { useEffect, useId, useRef, useState } from "react";
import { loadGenres } from "../lib/data.js";
import { chartAnnouncement, chartQuestion, chartQuestionText, orderWords, standsOutQuestion } from "../lib/genres.js";
import { GENRE_PAGE_EXCLUDED, defaultGenre, onGenresPage, sortable, subsetConflict, toHash } from "../lib/urlState.js";
import { BodyPlaceholder, CharacteristicPicker, SlotButton } from "./Controls.jsx";
import { ChartPlaceholder } from "./Explorer.jsx";
import GenreAnswer from "./GenreAnswer.jsx";
import GenreProfile, { profileAnnouncement } from "./GenreProfile.jsx";
import Segmented from "./GenreSwitch.jsx";
import InlineSelect, { SlotWords } from "./InlineSelect.jsx";
import { PartBoundary } from "./lazyPart.jsx";
import LoadError from "./LoadError.jsx";
import Overlay from "./Overlay.jsx";
import "../genres.css";

/**
 * Keeps the file on screen until the next one has loaded (another "Only include" option), like the explorer: while
 * it loads, the answer stays, dimmed and marked busy, so nothing is worded from data that is not there yet.
 */
function useShownGenres(sub) {
  const [shown, setShown] = useState(null); // { sub, file }
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setError(null);
    loadGenres(sub).then(
      (file) => live && setShown({ sub, file }),
      (e) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [sub, attempt]);
  return {
    file: shown?.file ?? null,
    sub: shown?.sub ?? null,
    busy: !error && (!shown || shown.sub !== sub),
    error,
    retry: () => setAttempt((a) => a + 1),
  };
}

/**
 * What the polite live region says: `text` once the file is on screen, said again when `key` (the question shown)
 * changes even if the words are the same; when only the order of the genres changes (`orderKey`), only its words,
 * `orderText` ("Genres by median, highest first.", F75).
 */
function useAnnouncement(text, key, orderText = "", orderKey = "") {
  const [said, setSaid] = useState("");
  const last = useRef({ key: null, orderKey: null });
  useEffect(() => {
    if (!text) return undefined;
    const prev = last.current;
    last.current = { key, orderKey };
    let say = text;
    if (prev.key === key) {
      if (prev.orderKey === orderKey || !orderText) {
        setSaid((s) => (s === "" ? s : text));
        return undefined;
      }
      say = orderText;
    }
    setSaid("");
    const t = setTimeout(() => setSaid(say), 60);
    return () => clearTimeout(t);
  }, [text, key, orderKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return said;
}

/** A genre's name that a narrow line may break after its slash ("Reluctance/NonConsent"): the slot's text is hidden from screen readers. */
const breakable = (name) => name.replace(/\//g, "/\u200b");

/** "Only include", with the options that cannot go with the characteristic turned off (as on the explorer). */
function IncludeSelect({ meta, value, variable, onChange }) {
  const ids = useId();
  const groups = new Map();
  for (const s of meta.subsets) {
    if (!groups.has(s.group)) groups.set(s.group, []);
    groups.get(s.group).push(s);
  }
  const anyConflict = Boolean(variable) && meta.subsets.some((s) => subsetConflict(s, variable));
  const option = (s) => {
    const reason = variable ? subsetConflict(s, variable) : null;
    return (
      <option key={s.id} value={s.id} disabled={Boolean(reason)}>
        {s.label}
        {reason ? ` (${reason})` : ""}
      </option>
    );
  };
  const subset = meta.subsets.find((s) => s.id === value);
  return (
    <span className="include include-row">
      <span className="include-label">Only include:</span>{" "}
      <InlineSelect
        id={`${ids}-include`}
        label="Only include"
        value={value}
        text={subset.label}
        onChange={onChange}
        describedBy={anyConflict ? `${ids}-note` : undefined}
      >
        {[...groups.entries()].map(([grp, subs]) =>
          grp ? (
            <optgroup key={grp} label={grp}>
              {subs.map(option)}
            </optgroup>
          ) : (
            subs.map(option)
          ),
        )}
      </InlineSelect>
      {anyConflict && (
        <span className="visually-hidden" id={`${ids}-note`}>
          Options that would leave only one group of {variable.label.toLowerCase()} are turned off.
        </span>
      )}
    </span>
  );
}

/**
 * The Genres page (D9): how one characteristic differs between the genres (View 1), or what stands out about one
 * genre's stories (View 2), each genre compared with all genres by the rule in meta.genre_rule (D2). Controls change
 * the address in place; the view switch and the links between the views add a history entry, so Back returns.
 */
export default function GenresPage({ meta, state, onChange, onNavigate, onHoldScroll, chosenGenre, lastChart, lastExplore }) {
  const { file, busy, error, retry } = useShownGenres(state.sub);
  const profile = state.view === "genre";
  const variable = meta.variables.find((v) => v.id === state.v);
  const genre = profile ? meta.genres.find((g) => g.id === state.genre) : null;
  const genres = meta.genres.filter((g) => g.id !== "all");
  const [menu, setMenu] = useState(false);
  const varBtn = useRef(null);
  const pickerFocus = useRef(null);
  const pickerBody = useRef(null);
  const ids = useId();
  const keepPlace = (next) => {
    onHoldScroll?.();
    onChange(next);
  };
  // A button inside the answer that changes it (the story-age note's comparison, "Show all stories") goes away with
  // the change, so focus moves to the answer's heading, without scrolling (F64); again once the new file is drawn,
  // since one genre's answer can be drawn anew. "Try again" goes away too: focus moves to the heading it brings.
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
  // while another option's file loads, the answer on screen keeps describing its own file (its option, and a
  // characteristic it has)
  const shownV = useRef(state.v);
  if (file?.c[state.v]) shownV.current = state.v;
  const view = file ? { ...state, sub: file.s, v: file.c[state.v] ? state.v : shownV.current } : state;
  const shownVariable = meta.variables.find((v) => v.id === view.v);
  const shownKind = file?.c[view.v]?.k;
  const announcement = useAnnouncement(
    !file || busy || error
      ? ""
      : profile
        ? profileAnnouncement(meta, file, state)
        : chartAnnouncement(meta, file, shownVariable),
    profile ? `genre|${state.genre}|${state.sub}` : `${view.v}|${state.sub}`,
    profile || !shownKind ? "" : `${orderWords(shownKind, state.sort)}.`,
    profile ? "" : state.sort || "",
  );

  // the tab's title is the question on screen, once its file is (F73), as Explore's is its chart's heading
  const question = profile ? standsOutQuestion(genre) : chartQuestionText(shownVariable);
  useEffect(() => {
    if (file && !busy && !error) document.title = question;
  }, [question, file, busy, error]);

  // the view switch carries the genre across: the highlighted genre becomes "one genre", and back (D8 when none)
  const switchView = (to) => {
    if (to === "genre") {
      onNavigate({ view: "genre", genre: state.genre || defaultGenre(meta, chosenGenre?.current), sub: state.sub });
    } else {
      const back = lastChart?.current || {};
      const v = back.v && meta.variables.some((x) => x.id === back.v && onGenresPage(x)) ? back.v : state.v;
      onNavigate({ v, sub: state.sub, genre: state.genre, sort: back.sort });
    }
  };

  const viewSwitch = (
    <Segmented
      label="Compare"
      className="view-switch"
      options={[
        ["chart", "One characteristic"],
        ["genre", "One genre"],
      ]}
      value={profile ? "genre" : "chart"}
      onChange={switchView}
    />
  );

  let sentence;
  let controls;
  if (profile) {
    sentence = (
      <p className="sentence">
        What stands out about stories in{" "}
        <InlineSelect
          id={`${ids}-genre`}
          label="Genre"
          value={genre.id}
          text={breakable(genre.name)}
          onChange={(g) => keepPlace({ ...state, genre: g })}
        >
          {genres.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </InlineSelect>
        {"⁠?"}
      </p>
    );
    controls = (
      <>
        {viewSwitch}
        <IncludeSelect meta={meta} value={state.sub} onChange={(s) => keepPlace({ ...state, sub: s })} />
      </>
    );
  } else {
    const q = chartQuestion(variable);
    sentence = (
      <p className="sentence">
        {q.before}
        <SlotButton ref={varBtn} expanded={menu} onPress={() => setMenu((m) => !m)} onHint={CharacteristicPicker.preload}>
          <span className="visually-hidden">Story characteristic: </span>
          <SlotWords text={q.slot} />
        </SlotButton>
        {q.after}
        {"⁠?"}
      </p>
    );
    controls = (
      <>
        {viewSwitch}
        <IncludeSelect
          meta={meta}
          value={state.sub}
          variable={variable}
          onChange={(s) => keepPlace({ ...state, sub: s })}
        />
        <span className="include">
          <span className="include-label">Highlight:</span>{" "}
          <InlineSelect
            id={`${ids}-highlight`}
            label="Highlight"
            value={state.genre || ""}
            text={state.genre ? breakable(meta.genres.find((g) => g.id === state.genre).name) : "None"}
            onChange={(g) => keepPlace({ ...state, genre: g || undefined })}
          >
            <option value="">None</option>
            {genres.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </InlineSelect>
        </span>
      </>
    );
  }

  return (
    <section className="genres-page" aria-label="Genres">
      <div className="controls">
        <fieldset className="question" id="question" tabIndex={-1}>
          <legend className="visually-hidden">Choose what to compare</legend>
          {sentence}
        </fieldset>
        <div className="genres-controls">{controls}</div>
      </div>
      {!profile && (
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
            fallback={
              <BodyPlaceholder search={`Search ${meta.variables.filter(onGenresPage).length} characteristics`} />
            }
          >
            <CharacteristicPicker
              meta={meta}
              value={state.v}
              exclude={GENRE_PAGE_EXCLUDED}
              excludedNote="Publication month and weekday aren’t compared on this page."
              metricHref={(metric) =>
                toHash("explore", { mode: "one", genre: state.genre || "all", metric, v: state.v, sub: state.sub })
              }
              focusRef={pickerFocus}
              scrollRef={pickerBody}
              onClose={() => setMenu(false)}
              onPick={(id) => {
                setMenu(false);
                const next = { ...state, v: id };
                const nextVar = meta.variables.find((v) => v.id === id);
                if (subsetConflict(meta.subsets.find((s) => s.id === state.sub), nextVar)) next.sub = "all";
                if (!sortable(nextVar)) delete next.sort;
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
      ) : profile ? (
        <GenreProfile
          meta={meta}
          state={view}
          file={file}
          busy={busy}
          onSwitch={switchFromAnswer}
          onNavigate={onNavigate}
          headingRef={heading}
        />
      ) : (
        <GenreAnswer
          meta={meta}
          state={view}
          file={file}
          busy={busy}
          onChange={keepPlace}
          onSwitch={switchFromAnswer}
          onNavigate={onNavigate}
          lastExplore={lastExplore}
          headingRef={heading}
        />
      )}
    </section>
  );
}

