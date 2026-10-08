import { useCallback, useId, useRef, useState } from "react";
import { subsetConflict } from "../lib/urlState.js";
import { questionParts } from "../lib/wording.js";
import CharacteristicPicker from "./CharacteristicPicker.jsx";
import InlineSelect, { Caret } from "./InlineSelect.jsx";
import MetricMenu from "./MetricMenu.jsx";

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
  const ids = useId();
  const close = useCallback(() => setMenu(null), []);
  const subsetGroups = groupBy(meta.subsets, "group");
  const anyConflict = meta.subsets.some((s) => subsetConflict(s, variable));

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
              ,{" "}
            </>
          )}
          how {p.aux}{" "}
          <button
            ref={metricBtn}
            type="button"
            className="slot slot-button"
            aria-haspopup="dialog"
            aria-expanded={menu === "metric"}
            onClick={() => setMenu(menu === "metric" ? null : "metric")}
          >
            <span className="visually-hidden">Popularity measure: </span>
            {p.measure}
            <Caret />
          </button>{" "}
          {p.verb}{" "}
          <button
            ref={varBtn}
            type="button"
            className="slot slot-button"
            aria-haspopup="dialog"
            aria-expanded={menu === "variable"}
            onClick={() => setMenu(menu === "variable" ? null : "variable")}
          >
            <span className="visually-hidden">Story characteristic: </span>
            {p.characteristic}
            <Caret />
          </button>
          ?
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
            onChange={(sub) => set({ sub, check: undefined })}
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
        <p className="include-note" id={`${ids}-include-note`}>
          Options that would leave only one group of {variable.label.toLowerCase()} are turned off.
        </p>
      )}

      <MetricMenu
        meta={meta}
        value={state.metric}
        open={menu === "metric"}
        anchor={metricBtn}
        onClose={close}
        onPick={(id) => {
          setMenu(null);
          set({ metric: id });
        }}
      />
      <CharacteristicPicker
        meta={meta}
        value={state.v}
        sub={state.sub}
        open={menu === "variable"}
        anchor={varBtn}
        onClose={close}
        onPick={(id) => {
          setMenu(null);
          const next = { ...state, v: id, check: undefined };
          const nextVar = meta.variables.find((v) => v.id === id);
          if (subsetConflict(meta.subsets.find((s) => s.id === state.sub), nextVar)) next.sub = "all";
          onChange(next);
        }}
      />
    </div>
  );
}
