// Searching the story characteristics (the picker and the glossary): case- and accent-insensitive, over the label,
// the noun, the description, the topic and a few synonyms ("POV", "explicit", "typos" …). Results are ranked only by
// how the words match (label prefix > a word of the label > anything else), then kept in the topics' own order:
// never by any result.

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

/** Characteristics in browsing order: topic by topic, each topic in its own order. */
export function browsingOrder(meta) {
  const byId = new Map(meta.variables.map((v) => [v.id, v]));
  return meta.topics.flatMap((t) => t.ids.map((id) => byId.get(id)).filter(Boolean));
}

/** Search results: [{ variable, topic, rank }] with rank 3 (label starts with the query), 2 (a word of the label
 * does) or 1 (every word is found somewhere). */
export function searchCharacteristics(meta, query) {
  const q = fold(query).trim().replace(/\s+/g, " ");
  if (!q) return [];
  const words = q.split(" ");
  const topics = new Map(meta.topics.map((t) => [t.id, t]));
  const out = [];
  browsingOrder(meta).forEach((variable, order) => {
    const topic = topics.get(variable.topic);
    const label = fold(variable.label);
    const hay = fold(
      [variable.label, variable.noun, variable.description, topic?.label, variable.syn, topic?.syn].join(" "),
    );
    let rank = 0;
    if (label.startsWith(q)) rank = 3;
    else if (label.split(/[\s/(‘'"-]+/).some((w) => w.startsWith(q)) || label.includes(` ${q}`)) rank = 2;
    else if (words.every((w) => hay.includes(w))) rank = 1;
    if (rank) out.push({ variable, topic, rank, order });
  });
  return out.sort((a, b) => b.rank - a.rank || a.order - b.order);
}

/** Where the query appears in a label, for highlighting: [before, match, after], or null. */
export function highlight(label, query) {
  const q = fold(query).trim();
  if (!q) return null;
  const i = fold(label).indexOf(q);
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
