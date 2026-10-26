/**
 * A filename that says nothing (scan, IMG_2041, a hash): the title then comes from the (normalised) first line of the text.
 * Three patterns whose parts never compete for the same character (the optional word, then digits and separators), so
 * none backtracks; `lib/generic-name.test.ts` compares them with the single pattern they replace.
 */
const WORD_AND_NUMBER = /^(?:document|doc|scan|scanner|image|img|photo|file|fichier|untitled|sans titre|download)?[\d\s_()-]*$/i;
/** « Téléchargement (2) »: the word, the rest of the word, then (once something that is not part of a word is met) digits and separators. */
const DOWNLOAD = /^télécharg\w*(?:[\s()-][\d\s_()-]*)?$/i;
const HASH = /^[a-f0-9-]{16,}$/i;

export const isGenericName = (name: string): boolean => WORD_AND_NUMBER.test(name) || DOWNLOAD.test(name) || HASH.test(name);
