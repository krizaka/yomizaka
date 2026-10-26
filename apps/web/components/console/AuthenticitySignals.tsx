"use client";

import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import type { AuthenticityReport, TextSource } from "@yomizaka/core";

import { useSay } from "@/lib/i18n-client";
import { photoOriginSignals } from "@/lib/photo-origin";

import { formatDate } from "./format";

const LEVEL_TONE: Record<string, "neutral" | "warning" | "danger"> = { observé: "neutral", inhabituel: "warning", incohérent: "danger" };

/** The authenticity Studio's signals, each with its plain level, as Orazaka returned them. */
export function AuthenticitySignals({ report }: Readonly<{ report: Pick<AuthenticityReport, "header" | "signals"> }>) {
  const { say } = useSay();
  return (
    <div className="flex flex-col gap-3">
      {report.header ? <Alert tone="info">{report.header}</Alert> : null}
      <ul className="flex flex-col gap-2">
        {report.signals.map((s) => (
          <li key={s.signalId} className="rounded-lg border border-border-default bg-surface-1 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-fg-muted">{s.signalId}</span>
              <Badge tone={LEVEL_TONE[s.level] ?? "neutral"}>{say(`analysis.levels.${s.level}`)}</Badge>
            </div>
            <p className="mt-1 text-fg">{s.observation}</p>
            {s.mayIndicate ? (
              <p className="mt-1 text-fg-secondary">
                <strong className="font-semibold">{say("analysis.mayIndicate")} · </strong>
                {s.mayIndicate}
              </p>
            ) : null}
            {s.where ? <p className="mt-1 text-xs text-fg-muted">{s.where}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A photo document's origin, read at upload (its metadata never leaves the intake, ADR-0010), as the report's signals. */
export function PhotoOriginSignals({ source }: Readonly<{ source: TextSource }>) {
  const { say, locale } = useSay();
  const signals = photoOriginSignals(source.origin).map((s) => {
    const facts = { ...s.facts, ...(s.facts.taken ? { taken: formatDate(s.facts.taken, locale, true), modified: formatDate(s.facts.modified, locale, true) } : {}) };
    return { signalId: s.signalId, level: s.level, observation: say(`analysis.photoOrigin.${s.case}.observation`, facts), mayIndicate: say(`analysis.photoOrigin.${s.case}.mayIndicate`), where: say("analysis.photoOrigin.where") };
  });
  return <AuthenticitySignals report={{ header: say("analysis.photoOrigin.header"), signals }} />;
}
