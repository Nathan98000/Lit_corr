import { prefetchVariable } from "../lib/data.js";
import InfoTip from "./InfoTip.jsx";

function groupBy(list, key) {
  const out = new Map();
  for (const item of list) {
    const k = item[key] || "";
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(item);
  }
  return out;
}

/** The explorer's controls, in the order of the question: genre → popularity → story characteristic. */
export default function Controls({ meta, state, onChange }) {
  const set = (patch) => onChange({ ...state, ...patch });
  const variable = meta.variables.find((v) => v.id === state.v);
  const activeGroup = variable?.topic;
  const topic = meta.topics.find((t) => t.id === activeGroup);
  const byId = new Map(meta.variables.map((v) => [v.id, v]));
  const groupVars = (topic?.ids || []).map((id) => byId.get(id));
  const subgroups = groupBy(groupVars, "subgroup");
  const metricGroups = groupBy(meta.metrics, "group");
  const subsetGroups = groupBy(meta.subsets, "group");

  const pickGroup = (groupId) => {
    if (groupId === activeGroup) return;
    const first = meta.topics.find((t) => t.id === groupId)?.ids[0];
    if (first) set({ v: first });
  };

  return (
    <div className="controls">
      <div className="mode-toggle" role="group" aria-label="View">
        <button type="button" aria-pressed={state.mode === "one"} onClick={() => set({ mode: "one" })}>
          One genre
        </button>
        <button type="button" aria-pressed={state.mode === "compare"} onClick={() => set({ mode: "compare" })}>
          Compare genres
        </button>
      </div>

      <div className="control-grid">
        {state.mode === "one" ? (
          <label className="control">
            <span className="control-label">
              <span className="step">1</span> Genre
            </span>
            <select value={state.genre} onChange={(e) => set({ genre: e.target.value })}>
              {meta.genres.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="control control-static">
            <span className="control-label">
              <span className="step">1</span> Genre
            </span>
            <span className="static-value">All genres, one row each</span>
          </div>
        )}

        <div className="control">
          <span className="control-label">
            <label htmlFor="metric-select">
              <span className="step">2</span> Popularity
            </label>
            <InfoTip label="About the popularity measures">
              Totals such as views keep growing while a story is online, so older stories have had more time to
              collect them. “Per month” and “per 1,000 views” measures make old and new stories easier to compare.
            </InfoTip>
          </span>
          <select id="metric-select" value={state.metric} onChange={(e) => set({ metric: e.target.value })}>
            {meta.metric_groups.map((g) =>
              metricGroups.has(g) ? (
                <optgroup key={g} label={g}>
                  {metricGroups.get(g).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ) : null,
            )}
          </select>
        </div>

        <div className="control control-wide">
          <span className="control-label" id="characteristic-label">
            <span className="step">3</span> Story characteristic
          </span>
          <div className="group-tabs" role="group" aria-label="Kind of characteristic">
            {meta.topics.map((g) => (
              <button
                type="button"
                key={g.id}
                aria-pressed={g.id === activeGroup}
                onClick={() => pickGroup(g.id)}
                onMouseEnter={() => prefetchVariable(g.ids[0], state.sub)}
                onFocus={() => prefetchVariable(g.ids[0], state.sub)}
              >
                {g.label}
              </button>
            ))}
          </div>
          <select
            aria-labelledby="characteristic-label"
            value={state.v}
            onChange={(e) => set({ v: e.target.value })}
          >
            {[...subgroups.entries()].map(([sub, vars]) => (
              <optgroup key={sub} label={sub}>
                {vars.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <label className="control control-secondary">
          <span className="control-label">Stories included</span>
          <select value={state.sub} onChange={(e) => set({ sub: e.target.value })}>
            {[...subsetGroups.entries()].map(([grp, subs]) =>
              grp ? (
                <optgroup key={grp} label={grp}>
                  {subs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
              ) : (
                subs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))
              ),
            )}
          </select>
        </label>
      </div>
    </div>
  );
}
