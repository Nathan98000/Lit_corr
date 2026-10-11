import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { keepInView } from "../lib/listScroll.js";
import { highlight, measureNamed, oneLine, searchCharacteristics } from "../lib/search.js";
import { lowerFirst } from "../lib/wording.js";

/** A label with the matched part marked. */
function Marked({ label, query }) {
  const parts = highlight(label, query);
  if (!parts) return label;
  return (
    <>
      {parts[0]}
      <mark>{parts[1]}</mark>
      {parts[2]}
    </>
  );
}

/**
 * The data without the characteristics a page leaves out: in Popular, the topics and search alike. A topic that loses
 * some lists its remaining characteristics' labels as its blurb ("Publication year, published on a weekend, years
 * online"), since its own blurb names the others too (F77); one in `keepBlurbs` keeps its own, which still fits (the
 * Trends page's Length & structure: "Word count, paragraphs, series, titles", without the tags and the author's count).
 */
function withoutExcluded(meta, exclude, keepBlurbs = []) {
  if (!exclude?.length) return meta;
  const keep = (id) => !exclude.includes(id);
  const label = new Map(meta.variables.map((v) => [v.id, v.label]));
  const blurb = (ids) => ids.map((id, k) => (k ? lowerFirst(label.get(id)) : label.get(id))).join(", ");
  return {
    ...meta,
    variables: meta.variables.filter((v) => keep(v.id)),
    popular: meta.popular.filter(keep),
    topics: meta.topics
      .map((t) => {
        const ids = t.ids.filter(keep);
        if (ids.length === t.ids.length) return t;
        return { ...t, ids, blurb: keepBlurbs.includes(t.id) ? t.blurb : blurb(ids) };
      })
      .filter((t) => t.ids.length),
  };
}

/**
 * The characteristic picker (concept 2A): a search box over a listbox, following the WAI-ARIA 1.2
 * combobox-with-listbox pattern. With the search box empty it shows a Popular set and the eight topics; a topic opens
 * its list (browsing never changes the chart); typing searches labels, descriptions, topics and synonyms.
 *
 * A query that names a popularity measure ("rating") says so above any results, with a button that switches the
 * measure instead (F45), where the page has measures (`onPickMetric`), or a link to see it on another page
 * (`metricHref(id)`, the Genres page's "See it in Explore →", F77). A query that names a characteristic the page leaves
 * out says so (`excludedNote`).
 *
 * While a query is typed in the phone's sheet, results are one line each (the label, then the topic) and Close moves
 * into the search row, so that more results stay above the on-screen keyboard (F57; styles.css does the folding).
 *
 * This is the body of the "Story characteristic" sheet or popover; it loads with its own code (F49), so it takes
 * focus itself when it arrives. `focusRef` is the search box. `scrollRef` is the box that scrolls the sheet's
 * content: the active option is kept in view by scrolling it, never the page, and another list (a topic, the results
 * of a new query) starts at its top.
 *
 * `exclude` lists characteristics a page does not offer (the Genres page leaves out publication month and weekday), and
 * `keepBlurbs` the topics that keep their own blurb when some of theirs are left out;
 * `onPreview(id)` is told which characteristic is active or hovered, so the page can fetch its file ahead of time.
 */
export default function CharacteristicPicker({
  meta: fullMeta,
  value,
  onPick,
  onPickMetric,
  metricHref,
  excludedNote = "",
  onPreview,
  onClose,
  focusRef,
  scrollRef,
  exclude = null,
  keepBlurbs = null,
}) {
  const [query, setQuery] = useState("");
  const [topicId, setTopicId] = useState(null);
  const [active, setActive] = useState(0);
  const input = focusRef;
  const base = useId().replace(/:/g, "");
  const meta = useMemo(() => withoutExcluded(fullMeta, exclude, keepBlurbs || []), [fullMeta, exclude, keepBlurbs]);
  const byId = useMemo(() => new Map(meta.variables.map((v) => [v.id, v])), [meta]);

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The options on screen, in order, as { kind: "var" | "topic" | "back", id, group }.
  const results = useMemo(() => searchCharacteristics(meta, query), [meta, query]);
  // a measure is named against every characteristic, the page's left-out ones included ("month" stays a characteristic)
  const named = useMemo(
    () => (onPickMetric || metricHref ? measureNamed(fullMeta, query) : null),
    [fullMeta, query, onPickMetric, metricHref],
  );
  // does the query name a left-out characteristic? (searched among those alone, so typing stays as quick as before)
  const leftOut = useMemo(
    () => (excludedNote && exclude?.length ? { ...fullMeta, variables: fullMeta.variables.filter((v) => exclude.includes(v.id)) } : null),
    [fullMeta, exclude, excludedNote],
  );
  const excludedHit = useMemo(
    () => Boolean(leftOut) && Boolean(query.trim()) && searchCharacteristics(leftOut, query).some((r) => r.rank >= 2),
    [leftOut, query],
  );
  const topic = topicId ? meta.topics.find((t) => t.id === topicId) : null;
  let options;
  let mode;
  if (query.trim()) {
    mode = results.length ? "search" : "none";
    options = results.length
      ? results.map((r) => ({ kind: "var", id: r.variable.id, group: "results" }))
      : meta.topics.map((t) => ({ kind: "topic", id: t.id, group: "topics" }));
  } else if (topic) {
    mode = "topic";
    options = [{ kind: "back", id: "back", group: "back" }, ...topic.ids.map((id) => ({ kind: "var", id, group: byId.get(id).subgroup }))];
  } else {
    mode = "home";
    options = [
      ...meta.popular.map((id) => ({ kind: "var", id, group: "popular" })),
      ...meta.topics.map((t) => ({ kind: "topic", id: t.id, group: "topics" })),
    ];
  }
  const current = Math.min(active, options.length - 1);
  const optionId = (i) => `${base}-opt-${i}`;
  const listKey = `${mode}|${topicId}|${query}`;
  const shownList = useRef(listKey);

  useEffect(() => {
    const opt = options[current];
    if (opt?.kind === "var") onPreview?.(opt.id);
  }, [current, listKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const box = scrollRef?.current;
    if (box && shownList.current !== listKey) box.scrollTop = 0;
    shownList.current = listKey;
    keepInView(box, document.getElementById(optionId(current)));
  }, [current, listKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const activate = (opt) => {
    if (!opt) return;
    if (opt.kind === "var") onPick(opt.id);
    else if (opt.kind === "topic") {
      setQuery("");
      setTopicId(opt.id);
      setActive(1);
      input.current?.focus({ preventScroll: true });
    } else {
      const from = topicId;
      setTopicId(null);
      setActive(Math.max(0, meta.popular.length + meta.topics.findIndex((t) => t.id === from)));
      input.current?.focus({ preventScroll: true });
    }
  };

  const onKeyDown = (e) => {
    const last = options.length - 1;
    if (e.key === "ArrowDown") setActive(Math.min(last, current + 1));
    else if (e.key === "ArrowUp") setActive(Math.max(0, current - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Enter") activate(options[current]);
    else return;
    e.preventDefault();
  };

  const optionProps = (opt, i) => ({
    id: optionId(i),
    role: "option",
    "aria-selected": i === current,
    onMouseEnter: () => {
      setActive(i);
      if (opt.kind === "var") onPreview?.(opt.id);
    },
    onMouseDown: (e) => e.preventDefault(), // keep focus in the search box
    onClick: () => activate(opt),
  });

  const varOption = (opt, i, { chip = false, showTopic = false } = {}) => {
    const v = byId.get(opt.id);
    const isCurrent = v.id === value;
    const t = showTopic ? meta.topics.find((x) => x.id === v.topic) : null;
    if (chip) {
      return (
        <li key={opt.id} {...optionProps(opt, i)} className={`chip${i === current ? " active" : ""}${isCurrent ? " current" : ""}`}>
          {v.label}
          {isCurrent && <span className="visually-hidden"> (current)</span>}
        </li>
      );
    }
    // named by the label only; the topic and the description describe it (F59)
    const id = optionId(i);
    return (
      <li
        key={opt.id}
        {...optionProps(opt, i)}
        aria-labelledby={`${id}-label`}
        aria-describedby={t ? `${id}-topic ${id}-desc` : `${id}-desc`}
        className={`pick${i === current ? " active" : ""}${isCurrent ? " current" : ""}`}
      >
        {t && (
          <span className="pick-topic" id={`${id}-topic`}>
            {t.label}
          </span>
        )}
        <span className="pick-label" id={`${id}-label`}>
          <Marked label={v.label} query={query} />
          {isCurrent && <span className="pick-current"> · shown now</span>}
        </span>
        <span className="pick-desc" id={`${id}-desc`}>
          {oneLine(v.description)}
        </span>
      </li>
    );
  };

  const topicOption = (opt, i) => {
    const t = meta.topics.find((x) => x.id === opt.id);
    return (
      <li key={opt.id} {...optionProps(opt, i)} className={`topic-row${i === current ? " active" : ""}`}>
        <span>
          <span className="topic-name">{t.label}</span>
          <span className="topic-blurb">{t.blurb}</span>
        </span>
        <span className="topic-count" aria-hidden="true">
          {t.ids.length} ›
        </span>
        <span className="visually-hidden">, {t.ids.length} characteristics</span>
      </li>
    );
  };

  let content;
  if (mode === "home") {
    const pop = options.filter((o) => o.group === "popular");
    content = (
      <>
        <ul role="group" aria-labelledby={`${base}-pop`} className="pick-group chips-wrap">
          <li role="presentation" id={`${base}-pop`} className="pick-section">
            Popular
          </li>
          {pop.map((o, i) => varOption(o, i, { chip: true }))}
        </ul>
        <ul role="group" aria-labelledby={`${base}-topics`} className="pick-group">
          <li role="presentation" id={`${base}-topics`} className="pick-section">
            Browse by topic
          </li>
          {options.slice(pop.length).map((o, j) => topicOption(o, pop.length + j))}
        </ul>
      </>
    );
  } else if (mode === "topic") {
    const groups = [];
    options.slice(1).forEach((o, j) => {
      if (!groups.length || groups[groups.length - 1].name !== o.group) groups.push({ name: o.group, items: [] });
      groups[groups.length - 1].items.push({ o, i: j + 1 });
    });
    content = (
      <>
        <ul role="group" aria-label="Back" className="pick-group">
          <li {...optionProps(options[0], 0)} className={`back-row${current === 0 ? " active" : ""}`}>
            ‹ All topics
          </li>
        </ul>
        <p className="topic-heading" aria-hidden="true">
          <span className="topic-name">{topic.label}</span>
          <span className="topic-blurb">{topic.blurb}</span>
        </p>
        {groups.map((g) => (
          <ul key={g.name} role="group" aria-label={`${topic.label}: ${g.name}`} className="pick-group">
            {groups.length > 1 && (
              <li role="presentation" className="pick-section">
                {g.name}
              </li>
            )}
            {g.items.map(({ o, i }) => varOption(o, i))}
          </ul>
        ))}
      </>
    );
  } else if (mode === "search") {
    content = (
      <ul role="group" aria-label="Matches" className="pick-group">
        <li role="presentation" className="pick-section">
          {results.length} {results.length === 1 ? "match" : "matches"}
        </li>
        {options.map((o, i) => varOption(o, i, { showTopic: true }))}
      </ul>
    );
  } else {
    content = (
      <ul role="group" aria-label="Topics" className="pick-group">
        <li role="presentation" className="pick-section no-matches">
          No matches. Browse a topic instead:
        </li>
        {options.map((o, i) => topicOption(o, i))}
      </ul>
    );
  }

  const typing = Boolean(query.trim());
  return (
    <div className={typing ? "pick-body pick-typing" : "pick-body"}>
      <div className="search-row">
      <div className="search">
        <svg width="18" height="18" aria-hidden="true">
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12.5 12.5l4 4" stroke="currentColor" strokeWidth="2" />
        </svg>
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-label={`Search ${meta.variables.length} characteristics`}
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls={`${base}-list`}
          aria-activedescendant={options.length ? optionId(current) : undefined}
          placeholder={`Search ${meta.variables.length} characteristics`}
          value={query}
          autoComplete="off"
          spellCheck="false"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {typing && onClose && (
        <button type="button" className="link-button search-close" onClick={onClose}>
          Close
        </button>
      )}
      </div>
      <div className="pick-measure-note" aria-live="polite">
        {named && (
          <p className="pick-measure">
            “{named.label}” is a popularity measure, not a story characteristic.{" "}
            {metricHref ? (
              <a href={metricHref(named.id)}>See it in Explore{"\u00a0"}→</a>
            ) : (
              <button type="button" className="link-button" onClick={() => onPickMetric(named.id)}>
                Show {named.label.toLowerCase()}
              </button>
            )}
          </p>
        )}
        {excludedHit && <p className="pick-measure">{excludedNote}</p>}
      </div>
      <div id={`${base}-list`} role="listbox" aria-label="Story characteristics" className="pick-list">
        {content}
      </div>
    </div>
  );
}
