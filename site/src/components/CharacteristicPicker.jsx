import { useEffect, useId, useMemo, useRef, useState } from "react";
import { prefetchVariable } from "../lib/data.js";
import { highlight, oneLine, searchCharacteristics } from "../lib/search.js";
import Overlay from "./Overlay.jsx";

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
 * The characteristic picker (concept 2A): a search box over a listbox, following the WAI-ARIA 1.2
 * combobox-with-listbox pattern. With the search box empty it shows a Popular set and the eight topics; a topic opens
 * its list (browsing never changes the chart); typing searches labels, descriptions, topics and synonyms.
 */
export default function CharacteristicPicker({ meta, value, sub, open, onClose, onPick, anchor }) {
  const [query, setQuery] = useState("");
  const [topicId, setTopicId] = useState(null);
  const [active, setActive] = useState(0);
  const input = useRef(null);
  const list = useRef(null);
  const base = useId().replace(/:/g, "");
  const byId = useMemo(() => new Map(meta.variables.map((v) => [v.id, v])), [meta]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTopicId(null);
      setActive(0);
    }
  }, [open]);

  // The options on screen, in order, as { kind: "var" | "topic" | "back", id, group }.
  const results = useMemo(() => searchCharacteristics(meta, query), [meta, query]);
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

  useEffect(() => {
    const opt = options[current];
    if (opt?.kind === "var") prefetchVariable(opt.id, sub);
    document.getElementById(optionId(current))?.scrollIntoView?.({ block: "nearest" });
  }, [current, mode, topicId, query]); // eslint-disable-line react-hooks/exhaustive-deps

  const activate = (opt) => {
    if (!opt) return;
    if (opt.kind === "var") onPick(opt.id);
    else if (opt.kind === "topic") {
      setQuery("");
      setTopicId(opt.id);
      setActive(1);
      input.current?.focus();
    } else {
      const from = topicId;
      setTopicId(null);
      setActive(Math.max(0, meta.popular.length + meta.topics.findIndex((t) => t.id === from)));
      input.current?.focus();
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
      if (opt.kind === "var") prefetchVariable(opt.id, sub);
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

  return (
    <Overlay
      open={open}
      onClose={onClose}
      anchor={anchor}
      title="Story characteristic"
      titleId={`${base}-title`}
      initialFocus={input}
      className="picker"
    >
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
      <div id={`${base}-list`} ref={list} role="listbox" aria-label="Story characteristics" className="pick-list">
        {content}
      </div>
    </Overlay>
  );
}
