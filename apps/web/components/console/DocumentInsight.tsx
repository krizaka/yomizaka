"use client";

import { Alert } from "@krizaka/ui/alert";
import type { DocumentInsight as Insight } from "@yomizaka/core";

import { useSay } from "@/lib/i18n-client";

const date = (iso: string, locale: string) => new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const money = (cents: number, locale: string) => new Intl.NumberFormat(locale, { style: "currency", currency: "CAD" }).format(cents / 100);

/**
 * « Ce document »: what it is and what it holds, read in-process from its text (no model, nothing sent). The nature carries its
 * confidence; when no legal check fits it says so plainly. Personal information is counted, never listed.
 */
export function DocumentInsight({ insight, documentId }: { insight: Insight; documentId: string }) {
  const { say, locale } = useSay();
  const u = insight.understanding;
  const lang = locale === "fr" ? "fr" : "en";
  const rows: [string, React.ReactNode][] = [];
  if (u.issuer) rows.push([say("insight.issuer"), u.issuer]);
  for (const d of u.dates.filter((x) => x.kind !== "other").concat(u.dates.filter((x) => x.kind === "other").slice(0, 3))) rows.push([say(`insight.dateKinds.${d.kind}`), date(d.value, locale)]);
  for (const p of u.parties) rows.push([say(`insight.roles.${p.role}`), p.name]);
  for (const r of u.references) rows.push([say(`insight.refKinds.${r.kind}`), <span key={r.kind} className="font-mono">{r.value}</span>]);
  for (const a of u.amounts.slice(0, 8)) rows.push([say(`insight.amountKinds.${a.kind}`), money(a.cents, locale)]);
  if (u.language !== "unknown") rows.push([say("insight.language"), say(`insight.languages.${u.language}`)]);
  if (u.pages) rows.push([say("insight.pages"), String(u.pages)]);
  const pii = Object.entries(insight.pii.counts);
  return (
    <section aria-labelledby="insight-title" className="flex flex-col gap-3" data-testid="document-insight">
      <h2 id="insight-title" className="text-lg font-semibold">
        {say("insight.title")}
      </h2>
      {u.nature ? (
        <p>
          <strong>{u.nature.label[lang]}</strong> <span className="text-fg-secondary">({say(`insight.confidence.${u.nature.confidence}`)})</span>
          {u.alternative ? <span className="block text-sm text-fg-secondary">{say("insight.alternative", { nature: u.alternative.label[lang] })}</span> : null}
        </p>
      ) : (
        <p className="text-fg-secondary">{say("insight.unknown")}</p>
      )}
      {!u.check ? <Alert tone="info">{say("insight.noCheck")}</Alert> : null}
      {rows.length ? (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          {rows.map(([k, v], i) => (
            <div key={i} className="contents">
              <dt className="text-fg-secondary">{k}</dt>
              <dd className="break-words">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {insight.pii.total > 0 ? (
        <Alert tone="warning" title={say("insight.piiTitle")}>
          <p data-testid="pii-notice">
            {pii.map(([kind, n]) => `${say(`insight.piiKinds.${kind}`)} : ${n}`).join(" · ")}
          </p>
          <p className="mt-2 text-sm">{say("insight.piiRetention")}</p>
          <p className="mt-2">
            <a className="font-semibold underline" href={`/api/documents/${documentId}/redacted?lang=${locale}`} download data-testid="redacted-download">
              {say("insight.piiRedacted")}
            </a>
          </p>
        </Alert>
      ) : null}
      <p className="text-xs text-fg-secondary">{say("insight.informative")}</p>
    </section>
  );
}
