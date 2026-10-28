import { Badge } from "@krizaka/ui/badge";

import { format, type Locale, type Messages } from "@/lib/i18n";
import type { OwnerDocument } from "@/lib/owner-report";
import { ruleTitle } from "@/lib/rule-text";

/** One document of the owner's report (yomizaka#128): read by the public page, and drawn — inert, with demo data — on the home. */
export function OwnerReportDocument({ doc: d, n, words: w, lang }: Readonly<{ doc: OwnerDocument; n: number; words: Messages["ownerReport"]; lang: Locale }>) {
  const verdicts: Record<string, string> = w.verdict;
  return (
  <li className="flex flex-col gap-3 rounded-lg border border-border-default p-5">
    <h3 className="text-lg font-semibold">{format(w.document, { n: String(n) })}</h3>
    <dl className="grid gap-1 text-sm">
      <div><dt className="text-fg-secondary">{w.type}</dt><dd>{d.typeId ?? w.typeUnknown}</dd></div>
      <div><dt className="text-fg-secondary">{w.sha}</dt><dd className="break-all font-mono">{d.sha256}</dd></div>
      {d.pages ? <div><dt className="text-fg-secondary">{w.pages}</dt><dd>{d.pages}</dd></div> : null}
    </dl>
    <h4 className="font-medium">{w.signals}</h4>
    {d.signals.length === 0 ? <p className="text-sm text-fg-secondary">{w.noSignals}</p> : (
      <ul className="grid gap-1 text-sm">
        {d.signals.map((s) => <li key={`${s.id}-${s.observation}`}><Badge>{s.level}</Badge> {s.observation}</li>)}
      </ul>
    )}
    <h4 className="font-medium">{w.findings}</h4>
    {d.findings.length === 0 ? <p className="text-sm text-fg-secondary">{w.noFindings}</p> : (
      <ul className="grid gap-1 text-sm">
        {d.findings.map((f) => <li key={f.ruleId}><Badge>{verdicts[f.verdict] ?? f.verdict}</Badge> {ruleTitle(f.ruleId, lang, null)} ({f.ruleId}){f.citation ? `, ${f.citation}` : ""}</li>)}
      </ul>
    )}
    {d.notExamined.length > 0 ? <p className="text-sm"><b>{w.notExamined}</b> {d.notExamined.join(", ")}</p> : null}
    <h4 className="font-medium">{w.runs}</h4>
    <ul className="grid gap-1 font-mono text-xs">
      {d.runs.map((r) => <li key={r.runId}>{format(w.run, { studio: r.studio, runId: r.runId, version: r.studioVersion ?? w.versionNone })}</li>)}
    </ul>
  </li>
  );
}
