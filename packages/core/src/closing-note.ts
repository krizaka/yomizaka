import { z } from "zod";

/** The kinds of check that have a note. */
export const NOTE_KIND = { compliance: "compliance", authenticity: "authenticity" } as const;
export type NoteKind = (typeof NOTE_KIND)[keyof typeof NOTE_KIND];

/** Where a sentence of the note comes from: text written with the rules pack, or the report's own words (no plain text prepared). */
export const NOTE_SOURCE = { pack: "pack", report: "report" } as const;
export type NoteSource = (typeof NOTE_SOURCE)[keyof typeof NOTE_SOURCE];

/**
 * The closing note of a check, in plain words, for people who are not in IT: what was checked, how, what was not, the result in
 * one line, what to do, and who decides. Deterministic: a template filled from the run's structured result, with the text of
 * each rule written as data with its pack. The same note is shown in the web result, printed in the signed report and
 * shown again when a report is verified.
 */
export const closingNote = z.object({
  lang: z.enum(["fr", "en"]),
  kind: z.enum([NOTE_KIND.compliance, NOTE_KIND.authenticity]),
  title: z.string(),
  what: z.object({ heading: z.string(), text: z.string() }),
  how: z.object({ heading: z.string(), sentences: z.array(z.string()) }),
  notChecked: z.object({ heading: z.string(), items: z.array(z.string()) }),
  result: z.object({ heading: z.string(), text: z.string() }),
  next: z.object({ heading: z.string(), items: z.array(z.object({ problem: z.string(), advice: z.string(), important: z.boolean(), source: z.enum([NOTE_SOURCE.pack, NOTE_SOURCE.report]) })), none: z.string().nullable() }),
  decides: z.object({ heading: z.string(), text: z.string() }),
  disclaimer: z.string(),
  reviewPending: z.string().nullable(),
});
export type ClosingNote = z.infer<typeof closingNote>;
