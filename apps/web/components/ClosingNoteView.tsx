import { Alert } from "@krizaka/ui/alert";

import type { ClosingNote } from "@/lib/closing-note/build";
import { LINE, noteLines } from "@/lib/closing-note/render";

/** « Ce que nous avons vérifié »: the closing note of a check, drawn from the same lines the signed report prints. */
export function ClosingNoteView({ note }: { note: ClosingNote }) {
  const groups: { heading: string; lines: { kind: string; text: string }[] }[] = [];
  for (const line of noteLines(note)) {
    if (line.kind === LINE.title) continue;
    if (line.kind === LINE.heading) groups.push({ heading: line.text, lines: [] });
    else groups[groups.length - 1]?.lines.push(line);
  }
  return (
    <section aria-labelledby="closing-note-title" className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-1 p-4" data-testid="closing-note">
      <h3 id="closing-note-title" className="m-0 font-display text-lg font-bold text-fg">
        {note.title}
      </h3>
      {groups.map((g) => {
        const items = g.lines.filter((l) => l.kind === LINE.item);
        const paragraphs = g.lines.filter((l) => l.kind === LINE.text);
        const asides = g.lines.filter((l) => l.kind === LINE.note);
        return (
          <div key={g.heading} className="flex flex-col gap-1">
            <h4 className="m-0 text-sm font-semibold text-fg">{g.heading}</h4>
            {paragraphs.map((p) => (
              <p key={p.text} className="m-0 text-sm text-fg-secondary">
                {p.text}
              </p>
            ))}
            {items.length ? (
              <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-fg-secondary">
                {items.map((i) => (
                  <li key={i.text}>{i.text}</li>
                ))}
              </ul>
            ) : null}
            {asides.map((a) => (
              <Alert key={a.text} tone="info">
                {a.text}
              </Alert>
            ))}
          </div>
        );
      })}
    </section>
  );
}
