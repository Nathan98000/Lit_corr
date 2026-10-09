import { useEffect, useId, useRef, useState } from "react";
import { loadGenres } from "../lib/data.js";
import {
  chartHeading,
  chartQuestion,
  genreProfile,
  genreRows,
  orderLabel,
  profileHeading,
} from "../lib/genres.js";
import { GENRE_PAGE_EXCLUDED, defaultGenre, onGenresPage, sortable, subsetConflict } from "../lib/urlState.js";
import { BodyPlaceholder, CharacteristicPicker, SlotButton } from "./Controls.jsx";
import { ChartPlaceholder } from "./Explorer.jsx";
import InlineSelect, { SlotWords } from "./InlineSelect.jsx";
import { PartBoundary } from "./lazyPart.jsx";
import LoadError from "./LoadError.jsx";
import Overlay from "./Overlay.jsx";

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

/** A two-option segmented control: a radio group (the view switch, the order). */
export function Segmented({ label, options, value, onChange, className = "" }) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={`segmented ${className}`}>
      {options.map(([id, text]) => (
        <label key={id} className={value === id ? "on" : undefined}>
          <input type="radio" name={name} value={id} checked={value === id} onChange={() => onChange(id)} />
          <span>{text}</span>
        </label>
      ))}
    </div>
  );
}

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
    <span className="include">
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
export default function GenresPage({ meta, state, onChange, onNavigate, onHoldScroll, chosenGenre, lastChart }) {
  const { file, sub: fileSub, busy, error, retry } = useShownGenres(state.sub);
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
          text={genre.name}
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
    const fileKind = file?.c[state.v]?.k;
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
            text={state.genre ? meta.genres.find((g) => g.id === state.genre).name : "None"}
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
        {sortable(variable) && (
          <Segmented
            label="Order"
            className="order-switch"
            options={[
              ["az", "A–Z"],
              ["value", orderLabel(fileKind || (variable.yes_subject ? "bin" : "num"))],
            ]}
            value={state.sort === "value" ? "value" : "az"}
            onChange={(o) => keepPlace({ ...state, sort: o === "value" ? "value" : undefined })}
          />
        )}
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
      {error ? (
        <article className="chart-panel">
          <LoadError onRetry={retry} detail={error} />
        </article>
      ) : !file ? (
        <ChartPlaceholder />
      ) : (
        <Answer meta={meta} state={state} file={file} fileSub={fileSub} busy={busy} />
      )}
    </section>
  );
}

/** The answer panel for the file on screen. */
function Answer({ meta, state, file, busy }) {
  const total = meta.genres.length - 1;
  let heading;
  if (state.view === "genre") {
    const gi = file.genres.indexOf(state.genre);
    const p = genreProfile(meta, file, gi);
    heading = profileHeading(p.flagged.length, meta.genres.find((g) => g.id === state.genre));
  } else {
    const rows = genreRows(meta, file, state.v);
    heading = rows ? chartHeading(rows.filter((r) => !r.all && r.f).length, total) : "";
  }
  return (
    <article className={`chart-panel${busy ? " is-busy" : ""}`} aria-busy={busy}>
      <header className="chart-head">
        <h2 className="chart-title">{heading}</h2>
      </header>
    </article>
  );
}
