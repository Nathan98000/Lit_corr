// Searching the story characteristics (the picker and the glossary): case- and accent-insensitive, over the label,
// the noun, the description, the topic and a few synonyms ("POV", "explicit", "typos" …). Results are ranked only by
// how the words match (the label or noun starts with the query > a word of the label or noun does > every word of the
// query starts a word somewhere), then kept in the topics' own order: never by any result.

/** Lower case without accents, with typographic quotes made plain, one character for one character. */
export function fold(text) {
  return Array.from(String(text || ""), (ch) => {
    const f = ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    if (/[’‘]/.test(ch)) return "'";
    if (/[“”]/.test(ch)) return '"';
    if (/[–—]/.test(ch)) return "-";
    return f.length === 1 ? f : f[0] || ch;
  }).join("");
}

/** The words of a (folded) text: runs of letters and digits ("first-person" → "first", "person"). */
export const wordsOf = (text) => text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Characteristics in browsing order: topic by topic, each topic in its own order. */
export function browsingOrder(meta) {
  const byId = new Map(meta.variables.map((v) => [v.id, v]));
  return meta.topics.flatMap((t) => t.ids.map((id) => byId.get(id)).filter(Boolean));
}

/** How well a label or noun matches: 3 when it starts with the query, 2 when one of its words does, else 0. */
function nameRank(name, q) {
  if (name.startsWith(q)) return 3;
  if (name.split(/[\s/(‘'"-]+/).some((w) => w.startsWith(q)) || name.includes(` ${q}`)) return 2;
  return 0;
}

/**
 * Search results: [{ variable, topic, rank }] with rank 3 (the label or noun starts with the query), 2 (a word of the
 * label or noun does) or 1 (every word of the query starts a word of the label, noun, description, topic or
 * synonyms: "age" finds "story age", not "page", "language" or "average").
 */
export function searchCharacteristics(meta, query) {
  const q = fold(query).trim().replace(/\s+/g, " ");
  if (!q) return [];
  const qWords = wordsOf(q);
  const topics = new Map(meta.topics.map((t) => [t.id, t]));
  const out = [];
  browsingOrder(meta).forEach((variable, order) => {
    const topic = topics.get(variable.topic);
    let rank = Math.max(nameRank(fold(variable.label), q), nameRank(fold(variable.noun), q));
    if (!rank && qWords.length) {
      const hay = wordsOf(
        fold([variable.label, variable.noun, variable.description, topic?.label, variable.syn, topic?.syn].join(" ")),
      );
      if (qWords.every((w) => hay.some((h) => h.startsWith(w)))) rank = 1;
    }
    if (rank) out.push({ variable, topic, rank, order });
  });
  return out.sort((a, b) => b.rank - a.rank || a.order - b.order);
}

const characteristicWords = new WeakMap();

/** Every word of the characteristics' labels and nouns ("month" of "Publication month", "number" of "Number of tags"). */
function wordsOfCharacteristics(meta) {
  if (!characteristicWords.has(meta)) {
    characteristicWords.set(meta, new Set(meta.variables.flatMap((v) => wordsOf(fold(`${v.label} ${v.noun}`)))));
  }
  return characteristicWords.get(meta);
}

/**
 * The popularity measure a query names, if it names one ("rating", "views", "reading list"), or null: its label or
 * noun equals the query, or holds every word of it (a plural counts: "favorite" names Favorites), and one of those
 * words belongs to the measures only (so "month" and "number" stay characteristic searches). When several measures
 * fit equally well ("per 1,000 views"), none is named.
 */
export function measureNamed(meta, query) {
  const q = fold(query).trim().replace(/\s+/g, " ");
  const qWords = wordsOf(q);
  const own = wordsOfCharacteristics(meta);
  if (!qWords.some((w) => !own.has(w) && !own.has(`${w}s`))) return null;
  const fits = [];
  for (const metric of meta.metrics) {
    let best = null;
    for (const name of [metric.label, metric.noun]) {
      const text = fold(name);
      const words = wordsOf(text);
      let score = 0;
      if (text === q) score = 3;
      else if (qWords.every((w) => words.includes(w))) score = 2;
      else if (qWords.every((w) => words.includes(w) || words.includes(`${w}s`))) score = 1;
      if (score && (!best || score > best.score || (score === best.score && words.length < best.size))) {
        best = { metric, score, size: words.length };
      }
    }
    if (best) fits.push(best);
  }
  fits.sort((a, b) => b.score - a.score || a.size - b.size);
  if (!fits.length || (fits[1] && fits[1].score === fits[0].score && fits[1].size === fits[0].size)) return null;
  return fits[0].metric;
}

/** Where the query appears in a label, for highlighting (at the start of a word if it can): [before, match, after]. */
export function highlight(label, query) {
  const q = fold(query).trim();
  if (!q) return null;
  const text = fold(label);
  let i = -1;
  for (let at = text.indexOf(q); at >= 0; at = text.indexOf(q, at + 1)) {
    if (at === 0 || /[^\p{L}\p{N}]/u.test(text[at - 1])) {
      i = at;
      break;
    }
  }
  if (i < 0) i = text.indexOf(q);
  if (i < 0) return null;
  const chars = Array.from(label);
  return [chars.slice(0, i).join(""), chars.slice(i, i + q.length).join(""), chars.slice(i + q.length).join("")];
}

/** A description cut to one line (at most `max` characters, at a word boundary). */
export function oneLine(text, max = 110) {
  const t = String(text || "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[\s,;:.]+$/, "")}…`;
}
