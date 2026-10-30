/** The longest explanation of a trace, in characters. */
// @fixed: a short note beside a trace, not a letter; the column's CHECK says the same
export const ANSWER_MAX = 600;

/** The explanation as stored: spaces collapsed, trimmed. Empty means « remove my answer ». */
export const cleanAnswer = (raw: string): string => raw.replaceAll(/\s+/g, " ").trim();
