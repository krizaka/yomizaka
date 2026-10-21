import { Badge } from "@krizaka/ui/badge";

import { getDictionary, type Locale } from "@/lib/i18n";
import type { Showcase } from "@/lib/showcase";

const ORDER: Record<string, number> = { FAIL: 0, INSUFFICIENT_EVIDENCE: 1, PASS: 2 };
const TONE = { PASS: "success", FAIL: "danger", INSUFFICIENT_EVIDENCE: "warning" } as const;

/**
 * An unsigned, visual specimen of the audit report of a fictitious lease (ADR-0002). A large watermark crosses it; it has no
 * signature block, no fingerprint, no key: it is a picture of what a report looks like, never a file anyone can pass off as
 * an attestation. A downloadable sample, if ever wanted, needs a separate demo key and `"specimen": true` in its payload.
 */
export function Specimen({ run, locale }: { run: Showcase; locale: Locale }) {
  const t = getDictionary(locale).run;
  return (
    <figure id="specimen" data-testid="specimen" className="relative m-0 flex flex-col gap-3 overflow-hidden rounded-xl border border-border-default bg-surface-1 p-4" aria-label={t.specimen.title}>
      <figcaption className="text-xs font-semibold text-fg-muted">{t.specimen.title}</figcaption>
      <p className="text-sm font-semibold text-fg">{run.document.title}</p>
      <ul className="flex flex-col gap-1 text-xs text-fg-secondary">
        {[...run.report.findings].sort((a, b) => (ORDER[a.verdict] ?? 1) - (ORDER[b.verdict] ?? 1)).map((f) => (
          <li key={f.ruleId} className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="font-mono">{f.ruleId}</span> · {f.title ?? f.ruleId}
            </span>
            <Badge tone={TONE[f.verdict as keyof typeof TONE] ?? "neutral"}>{t.verdicts[f.verdict as keyof typeof t.verdicts] ?? f.verdict}</Badge>
          </li>
        ))}
      </ul>
      <p className="text-xs text-fg-muted">{t.specimen.note}</p>
      <span aria-hidden className="pointer-events-none absolute inset-0 flex select-none items-center justify-center text-center text-2xl font-black leading-tight text-danger/35 [transform:rotate(-24deg)] sm:text-3xl">
        {t.specimen.mark}
      </span>
      <span className="sr-only">{t.specimen.mark}</span>
    </figure>
  );
}
