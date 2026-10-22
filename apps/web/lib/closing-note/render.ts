import type { ClosingNote } from "./build";
import { type Bilingual, say, template } from "./data";

/** The note as a flat list of lines, in reading order: what the signed HTML and the signed PDF print, and what a signature covers. */
export const LINE = { title: "title", heading: "heading", text: "text", item: "item", note: "note" } as const;
export type LineKind = (typeof LINE)[keyof typeof LINE];
export interface NoteLine {
  kind: LineKind;
  text: string;
}

export function noteLines(note: ClosingNote): NoteLine[] {
  const important = say(template("importantTag") as Bilingual, note.lang);
  const section = (heading: string, body: NoteLine[]): NoteLine[] => [{ kind: LINE.heading, text: heading }, ...body];
  const texts = (kind: LineKind, items: readonly string[]): NoteLine[] => items.map((text) => ({ kind, text }));
  return [
    { kind: LINE.title, text: note.title },
    ...section(note.what.heading, texts(LINE.text, [note.what.text])),
    ...section(note.how.heading, texts(LINE.text, note.how.sentences)),
    ...section(note.notChecked.heading, texts(LINE.item, note.notChecked.items)),
    ...(note.reviewPending ? texts(LINE.note, [note.reviewPending]) : []),
    ...section(note.result.heading, texts(LINE.text, [note.result.text])),
    ...section(note.next.heading, note.next.none ? texts(LINE.text, [note.next.none]) : note.next.items.map((i) => ({ kind: LINE.item, text: `${i.important ? important : ""}${i.problem} ${i.advice}` }))),
    ...section(note.decides.heading, texts(LINE.text, [note.decides.text])),
    ...texts(LINE.note, [note.disclaimer]),
  ];
}
