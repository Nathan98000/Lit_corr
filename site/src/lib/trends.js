// The Trends page (STAGE2_TRENDS_PAGE_PROMPT.md, docs/stage2/TRENDS_PAGE_PROPOSAL.md): reading the trends/<included>/
// <genre>.json files and every sentence of the page. The years are meta.trend's, never written here.

import { lowerFirst } from "./wording.js";

/**
 * View 1's question, in parts around its two slots: "In [All genres], how has [story length in words] changed over
 * time?"; for yes/no characteristics the share of its stories: "…, how has the share of [stories with an author's note]
 * changed over time?".
 */
export function trendQuestion(variable) {
  if (variable.yes_subject) {
    return { before: "In ", middle: ", how has the share of ", slot: lowerFirst(variable.yes_subject), after: " changed over time" };
  }
  return { before: "In ", middle: ", how has ", slot: variable.noun, after: " changed over time" };
}

export function trendQuestionText(variable, genre) {
  const q = trendQuestion(variable);
  return `${q.before}${genre.name}${q.middle}${q.slot}${q.after}?`;
}

/** View 2's question: "What has changed in stories in All genres?" */
export const changesQuestion = (genre) => `What has changed in stories in ${genre.name}?`;
