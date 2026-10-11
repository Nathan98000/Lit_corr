import { forwardRef, useCallback, useEffect, useId, useRef, useState } from "react";
import { prefetchVariable } from "../lib/data.js";
import { scrollBehavior } from "../lib/motion.js";
import { subsetConflict } from "../lib/urlState.js";
import { questionParts, questionText } from "../lib/wording.js";
import InlineSelect, { SlotWords } from "./InlineSelect.jsx";
import { PartBoundary, lazyPart } from "./lazyPart.jsx";
import Overlay from "./Overlay.jsx";
import useMediaQuery from "./useMediaQuery.js";

// The picker and the measure menu load their code when first needed; the explorer fetches it once the first chart is
// on screen and the browser is idle, and the words fetch it when hovered or focused.
export const CharacteristicPicker = lazyPart(() => import("./CharacteristicPicker.jsx"));
const MetricMenu = lazyPart(() => import("./MetricMenu.jsx"));
export function preloadMenus() {
  CharacteristicPicker.preload();
  MetricMenu.preload();
}

/** What a sheet or popover shows until its body's code has arrived: the same size, so nothing moves. */
export function BodyPlaceholder({ search = null }) {
  return (
    <div className="overlay-placeholder" aria-busy="true">
      {search && (
        <div className="search" aria-hidden="true">
          <svg width="18" height="18">
            <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M12.5 12.5l4 4" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span className="search-placeholder">{search}</span>
        </div>
      )}
    </div>
  );
}

function groupBy(list, key) {
  const out = new Map();
  for (const item of list) {
    const k = item[key] || "";
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(item);
  }
  return out;
}

/**
 * The question bar on phones (idea I8): once the question sentence has scrolled above the screen, a 44 px bar at the
 * top keeps the question in view ("Word count · Favorites per 1,000 views · All genres"); tapping it scrolls back up
 * to the sentence and focuses it. Hidden while a sheet is open; it fades in and out (not under reduced motion).
 */
function QuestionBar({ text, question, sheetOpen }) {
  const [away, setAway] = useState(false);
  useEffect(() => {
    const sentence = document.getElementById("question");
    if (!sentence || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([e]) => {
      setAway(!e.isIntersecting && e.boundingClientRect.bottom <= (e.rootBounds?.top ?? 0));
    });
    io.observe(sentence);
    return () => io.disconnect();
  }, []);
  const shown = away && !sheetOpen;
  const back = () => {
    const sentence = document.getElementById("question");
    sentence?.scrollIntoView?.({ behavior: scrollBehavior(), block: "start" });
    sentence?.focus({ preventScroll: true });
  };
  return (
    <button
      type="button"
      className="question-bar"
      data-shown={shown}
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      aria-label={`Back to the question: ${question}`}
      onClick={back}
    >
      <span className="question-bar-text">{text}</span>
      <span className="question-bar-up" aria-hidden="true">
        ↑
      </span>
    </button>
  );
}

/**
 * A word of the sentence that opens a menu. A real <button> cannot wrap like text, so this is an inline span with
 * the button role and the keyboard behavior of a button.
 */
export const SlotButton = forwardRef(function SlotButton({ expanded, onPress, children, onHint = preloadMenus }, ref) {
  return (
    <span
      ref={ref}
      role="button"
      tabIndex={0}
      className="slot slot-button"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      onPointerEnter={onHint}
      onFocus={onHint}
      onClick={onPress}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPress();
        }
      }}
    >
      {children}
    </span>
  );
});

/**
 * The controls are the question itself (concept B): "In [All genres], how do [favorites per 1,000 views] vary with
 * [story length]?", then "Only include: [All stories]". Genre and "only include" are native selects styled as words;
 * the measure and the characteristic open a menu and a picker. Comparing genres: "Genre by genre, how do …".
 */
export default function Controls({ meta, state, onChange }) {
  const set = (patch) => onChange({ ...state, ...patch });
  const variable = meta.variables.find((v) => v.id === state.v);
  const metric = meta.metrics.find((m) => m.id === state.metric);
  const genre = meta.genres.find((g) => g.id === state.genre);
  const subset = meta.subsets.find((s) => s.id === state.sub);
  const compare = state.mode === "compare";
  const p = questionParts({ variable, metric });
  const [menu, setMenu] = useState(null); // "metric" | "variable" | null
  const metricBtn = useRef(null);
  const varBtn = useRef(null);
  const menuFocus = useRef(null);
  const pickerFocus = useRef(null);
  const menuBody = useRef(null); // the boxes that scroll the sheets' content
  const pickerBody = useRef(null);
  const ids = useId();
  const close = useCallback(() => setMenu(null), []);
  const subsetGroups = groupBy(meta.subsets, "group");
  const anyConflict = meta.subsets.some((s) => subsetConflict(s, variable));
  const narrow = useMediaQuery("(max-width: 699px)");
  const barText = [variable.label, metric.label, compare ? "Genre by genre" : genre.name, subset.id !== "all" && subset.label]
    .filter(Boolean)
    .join(" · ");

  const option = (s) => {
    const reason = subsetConflict(s, variable);
    return (
      <option key={s.id} value={s.id} disabled={Boolean(reason)}>
        {s.label}
        {reason ? ` (${reason})` : ""}
      </option>
    );
  };

  return (
    <div className="controls">
      {narrow && (
        <QuestionBar
          text={barText}
          question={questionText({ variable, metric, genre, compare })}
          sheetOpen={menu != null}
        />
      )}
      <fieldset className="question" id="question" tabIndex={-1}>
        <legend className="visually-hidden">Choose what to compare</legend>
        <p className="sentence">
          {compare ? (
            "Genre by genre, "
          ) : (
            <>
              In{" "}
              <InlineSelect
                id={`${ids}-genre`}
                label="Genre"
                value={state.genre}
                text={genre.name}
                onChange={(g) => set({ genre: g })}
              >
                {meta.genres.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </InlineSelect>
              {"\u2060,"}{" "}
            </>
          )}
          how {p.aux} {p.article}
          <SlotButton
            ref={metricBtn}
            expanded={menu === "metric"}
            onPress={() => setMenu(menu === "metric" ? null : "metric")}
          >
            <span className="visually-hidden">Popularity measure: </span>
            <SlotWords text={p.measure} />
          </SlotButton>{" "}
          {p.verb}{" "}
          <SlotButton
            ref={varBtn}
            expanded={menu === "variable"}
            onPress={() => setMenu(menu === "variable" ? null : "variable")}
          >
            <span className="visually-hidden">Story characteristic: </span>
            <SlotWords text={p.characteristic} />
          </SlotButton>
          {/* a word joiner keeps the question mark on the caret's line */}
          {"\u2060?"}
        </p>
      </fieldset>

      <div className="question-after">
        <span className="include">
          <span className="include-label" id={`${ids}-include-label`}>
            Only include:
          </span>{" "}
          <InlineSelect
            id={`${ids}-include`}
            label="Only include"
            value={state.sub}
            text={subset.label}
            onChange={(sub) => set({ sub })}
            describedBy={anyConflict ? `${ids}-include-note` : undefined}
          >
            {[...subsetGroups.entries()].map(([grp, subs]) =>
              grp ? (
                <optgroup key={grp} label={grp}>
                  {subs.map(option)}
                </optgroup>
              ) : (
                subs.map(option)
              ),
            )}
          </InlineSelect>
        </span>
        {compare && (
          <button type="button" className="btn" onClick={() => set({ mode: "one" })}>
            ← Back to one genre
          </button>
        )}
      </div>
      {anyConflict && (
        <p className="include-note visually-hidden" id={`${ids}-include-note`}>
          Options that would leave only one group of {variable.label.toLowerCase()} are turned off.
        </p>
      )}

      <Overlay
        open={menu === "metric"}
        onClose={close}
        anchor={metricBtn}
        title="Popularity measure"
        titleId={`${ids}-metric-title`}
        initialFocus={menuFocus}
        bodyRef={menuBody}
        className="metric-menu"
      >
        <PartBoundary fallback={<BodyPlaceholder />}>
          <MetricMenu
            meta={meta}
            value={state.metric}
            focusRef={menuFocus}
            scrollRef={menuBody}
            labelledBy={`${ids}-metric-title`}
            onPick={(id) => {
              setMenu(null);
              set({ metric: id });
            }}
          />
        </PartBoundary>
      </Overlay>
      <Overlay
        open={menu === "variable"}
        onClose={close}
        anchor={varBtn}
        title="Story characteristic"
        titleId={`${ids}-picker-title`}
        initialFocus={pickerFocus}
        bodyRef={pickerBody}
        className="picker"
      >
        <PartBoundary fallback={<BodyPlaceholder search={`Search ${meta.variables.length} characteristics`} />}>
          <CharacteristicPicker
            meta={meta}
            value={state.v}
            onPreview={(id) => prefetchVariable(id, state.sub)}
            focusRef={pickerFocus}
            scrollRef={pickerBody}
            onClose={close}
            onPickMetric={(id) => {
              setMenu(null);
              set({ metric: id });
            }}
            onPick={(id) => {
              setMenu(null);
              const next = { ...state, v: id };
              const nextVar = meta.variables.find((v) => v.id === id);
              if (subsetConflict(meta.subsets.find((s) => s.id === state.sub), nextVar)) next.sub = "all";
              onChange(next);
            }}
          />
        </PartBoundary>
      </Overlay>
    </div>
  );
}
