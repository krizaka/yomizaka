"use client";

import { MoreIcon } from "@krizaka/icons";
import { localDay } from "@krizaka/intl";
import { krizakaFetch, useMutation, useQuery, useQueryClient } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { DescriptionList } from "@krizaka/ui/description-list";
import { DetailLayout } from "@krizaka/ui/detail-layout";
import { DocumentViewer, type Located } from "@krizaka/ui/document-viewer";
import { DropdownMenu } from "@krizaka/ui/dropdown-menu";
import { createKrizakaForm } from "@krizaka/ui/form";
import { Tabs } from "@krizaka/ui/tabs";
import { type Analysis, analysis as analysisSchema, ANALYSIS_STATUS, type Audience, AUTHENTICITY_MAX_BYTES, type AuthenticityReport, checkSteps, type ComplianceReport, DOCUMENT_TABS, type DocumentView as DocumentViewData, documentView, DOCX_MIME, isSeededCheck, type Jurisdiction, JURISDICTIONS, ODT_MIME, passages, queryKeys, type Studio, type TextSource } from "@yomizaka/core";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ComponentProps, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { ClosingNoteView } from "@/components/ClosingNoteView";
import { CheckSteps } from "@/components/console/CheckSteps";
import { DocumentInsight } from "@/components/console/DocumentInsight";
import { Paywall } from "@/components/console/Paywall";
import { planCheck, rulesFor } from "@/lib/check-flow";
import { errorKey } from "@/lib/client";
import { buildNote, noteInputOf, noteSourceOf } from "@/lib/closing-note/build";
import { type DocumentTab } from "@/lib/console-nav";
import { displayTitle } from "@/lib/document-face";
import { useSay } from "@/lib/i18n-client";
import { firstCheck, wordingOf } from "@/lib/perspective-defaults";
import { photoOriginSignals } from "@/lib/photo-origin";
import { CHECK_KINDS, type CheckKind, isCheckKind, LAW_TIME_ZONE } from "@/lib/rulesets";

import { STATUS_TONE } from "./DocumentTable";
import { formatBytes, formatDate } from "./format";
import { FindingList, type FindingSelection, TechnicalDetails, VerdictBand } from "./ReportFace";
import { ReportShare } from "./ReportShare";
import { StorageNotice } from "./StorageNotice";

const LEVEL_TONE: Record<string, "neutral" | "warning" | "danger"> = { observé: "neutral", inhabituel: "warning", incohérent: "danger" };
const RUN_TONE = { running: "accent", succeeded: "success", failed: "danger", cancelled: "neutral" } as const;

const compliance = createKrizakaForm({
  schema: z.object({ documentType: z.enum(CHECK_KINDS), jurisdiction: z.enum(JURISDICTIONS), asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  defaultValues: { documentType: "lease" as CheckKind, jurisdiction: "QC" as (typeof JURISDICTIONS)[number], asOf: localDay(new Date(), LAW_TIME_ZONE) },
});
const authenticity = createKrizakaForm({
  schema: z.object({ expectedIssuer: z.string().trim().max(120) }),
  defaultValues: { expectedIssuer: "" },
});

/** pdf.js is loaded on this page only, and its worker is served from this origin (CSP: 'self'). */
const loadPdfjs = () => import("pdfjs-dist") as unknown as ReturnType<ComponentProps<typeof DocumentViewer>["loadPdfjs"]>;
const WORKER_SRC = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

/** Where Orazaka's finding sits in the file, in words — never a place the PDF's text layer did not confirm. */
function placeOf(found: Located | null | undefined, say: (key: string, vars?: Record<string, string | number>) => string): string | null {
  if (found === undefined) return null;
  if (found === null) return say("analysis.findingNotFound");
  return found.match === "page" ? say("analysis.findingPageOnly", { page: found.page }) : say("analysis.findingPage", { page: found.page });
}

/** The document's text, the passages a compliance report quotes marked where they sit. */
function DocumentText({ text, report }: { text: string; report: ComplianceReport | null }) {
  const { say } = useSay();
  const parts = useMemo(
    () => passages(text, (report?.findings ?? []).filter((f) => f.evidenceSpan?.quote).map((f) => ({ id: f.ruleId, quote: f.evidenceSpan!.quote, start: f.evidenceSpan!.start ?? undefined }))),
    [text, report],
  );
  return (
    <div className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border-default bg-surface-1 p-4 font-mono text-xs leading-relaxed text-fg-secondary" data-testid="document-text">
      {parts.map((p, i) =>
        p.mark ? (
          <mark key={i} id={`passage-${p.mark}`} className="ym-passage text-fg" title={say("document.passageOf", { rule: p.mark })}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </div>
  );
}

function AuthenticitySignals({ report }: { report: Pick<AuthenticityReport, "header" | "signals"> }) {
  const { say } = useSay();
  return (
    <div className="flex flex-col gap-3">
      {report.header ? <Alert tone="info">{report.header}</Alert> : null}
      <ul className="flex flex-col gap-2">
        {report.signals.map((s) => (
          <li key={s.signalId} className="rounded-lg border border-border-default bg-surface-1 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs text-fg-muted">{s.signalId}</span>
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
function PhotoOriginSignals({ source }: { source: TextSource }) {
  const { say, locale } = useSay();
  const signals = photoOriginSignals(source.origin).map((s) => {
    const facts = { ...s.facts, ...(s.facts.taken ? { taken: formatDate(s.facts.taken, locale, true), modified: formatDate(s.facts.modified, locale, true) } : {}) };
    return { signalId: s.signalId, level: s.level, observation: say(`analysis.photoOrigin.${s.case}.observation`, facts), mayIndicate: say(`analysis.photoOrigin.${s.case}.mayIndicate`), where: say("analysis.photoOrigin.where") };
  });
  return <AuthenticitySignals report={{ header: say("analysis.photoOrigin.header"), signals }} />;
}

/** The compliance form: the kinds offered (a lease always), the one preselected, and the request built by the kind's ruleset in force (`rulesFor`). */
function StartCompliance({ documentId, disabled, jurisdictions, options, initialType }: { documentId: string; disabled: boolean; initialType: CheckKind; jurisdictions: readonly (typeof JURISDICTIONS)[number][]; options: readonly CheckKind[] }) {
  const { say, locale } = useSay();
  const client = useQueryClient();
  const [reused, setReused] = useState(false);
  // A check the task page tried to start on the drop and the engine refused arrives as `?refused=<code>`: said here, above the form.
  const refused = useSearchParams()?.get("refused") ?? null;
  const [problem, setProblem] = useState<string | null>(refused && refused !== "PAYWALL" && refused !== "FAIR_USE" ? say(`errors.${refused}`) : null);
  const [paywall, setPaywall] = useState<"PAYWALL" | "FAIR_USE" | null>(refused === "PAYWALL" || refused === "FAIR_USE" ? refused : null);
  const start = useMutation({
    // The request is the kind's ruleset in force on the check's date (lib/check-flow `rulesFor`): never a lease's rules for another kind.
    mutationFn: (body: { documentType: CheckKind; jurisdiction: string; asOf: string }) => {
      const request = rulesFor(body.documentType, body.jurisdiction as (typeof JURISDICTIONS)[number], body.asOf);
      if (!request) throw new Error("KIND_NOT_VERIFIED");
      return krizakaFetch(`/api/documents/${documentId}`, { method: "POST", json: request });
    },
    onSuccess: (data) => {
      setReused(Boolean((data as { reused?: boolean } | null)?.reused));
      return client.invalidateQueries({ queryKey: queryKeys.document(documentId) });
    },
  });
  const form = compliance.useForm({
    defaultValues: { documentType: initialType, jurisdiction: "QC", asOf: localDay(new Date(), LAW_TIME_ZONE) },
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (values) => {
      setProblem(null);
      if (!rulesFor(values.documentType, values.jurisdiction, values.asOf)) return setProblem(say("analysis.notVerified"));
      try {
        await start.mutateAsync(values);
      } catch (error) {
        const code = errorKey(error);
        if (code === "PAYWALL" || code === "FAIR_USE") setPaywall(code);
        else setProblem(say(`errors.${code}`));
      }
    },
  });
  return (
    <form.Form aria-label={say("analysis.complianceTitle")} className="flex flex-col gap-3">
      <p className="text-sm text-fg-secondary">{say("analysis.complianceText")}</p>
      {options.length > 1 ? (
        <form.Select name="documentType" label={say("analysis.documentType")} options={options.map((k) => ({ value: k, label: say(`analysis.documentTypes.${k}`) }))} />
      ) : null}
      {/* The rules derive from the kind chosen now (the review's C5): Québec's named rulesets for an invoice or a contract, said in one line; a lease keeps its jurisdiction menu. */}
      <form.Field name="documentType">
        {(field) =>
          field.value !== "lease" ? (
            <p className="m-0 text-sm text-fg-secondary" data-testid="rules-line">
              {say("analysis.rulesLine", { kind: say(`analysis.kindWords.${String(field.value)}`) })}
            </p>
          ) : (
            <form.Select name="jurisdiction" label={say("analysis.jurisdiction")} options={jurisdictions.map((j) => ({ value: j, label: say(`analysis.jurisdictions.${j}`) }))} />
          )
        }
      </form.Field>
      <form.DateField name="asOf" label={say("analysis.asOf")} />
      {paywall ? <Paywall reason={paywall} /> : null}
      {reused ? <Alert tone="info">{say("analysis.reused")}</Alert> : null}
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      <form.Submit disabled={disabled}>
        {say("analysis.run")}
      </form.Submit>
    </form.Form>
  );
}

function StartAuthenticity({ documentId, disabled }: { documentId: string; disabled: boolean }) {
  const { say, locale } = useSay();
  const client = useQueryClient();
  const [reused, setReused] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<"PAYWALL" | "FAIR_USE" | null>(null);
  const start = useMutation({
    mutationFn: (body: { expectedIssuer: string }) =>
      krizakaFetch(`/api/documents/${documentId}`, { method: "POST", json: { studio: "document-authenticity", ...(body.expectedIssuer ? { expectedIssuer: body.expectedIssuer } : {}) } }),
    onSuccess: (data) => {
      setReused(Boolean((data as { reused?: boolean } | null)?.reused));
      return client.invalidateQueries({ queryKey: queryKeys.document(documentId) });
    },
  });
  const form = authenticity.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (values) => {
      setProblem(null);
      try {
        await start.mutateAsync(values);
      } catch (error) {
        const code = errorKey(error);
        if (code === "PAYWALL" || code === "FAIR_USE") setPaywall(code);
        else setProblem(say(`errors.${code}`));
      }
    },
  });
  return (
    <form.Form aria-label={say("analysis.authenticityTitle")} className="flex flex-col gap-3">
      <p className="text-sm text-fg-secondary">{say("analysis.authenticityText")}</p>
      <form.TextField name="expectedIssuer" label={say("analysis.expectedIssuer")} hint={say("analysis.expectedIssuerHint")} />
      {paywall ? <Paywall reason={paywall} /> : null}
      {reused ? <Alert tone="info">{say("analysis.reused")}</Alert> : null}
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      <form.Submit variant="secondary" disabled={disabled}>
        {say("analysis.run")}
      </form.Submit>
    </form.Form>
  );
}

/** A running analysis, asked again every 3 s (the BFF fetches and keeps Orazaka's result); once it ends, the document and the lists are read again. */
function LiveAnalysis({ documentId, analysis: initial }: { documentId: string; analysis: Analysis }) {
  const client = useQueryClient();
  const live = useQuery({
    queryKey: [...queryKeys.document(documentId), "analysis", initial.id],
    queryFn: () => krizakaFetch(`/api/documents/${documentId}/analyses/${initial.id}`, { schema: z.object({ analysis: analysisSchema }) }).then((r) => r.analysis),
    initialData: initial,
    refetchInterval: (q) => (q.state.data?.status === ANALYSIS_STATUS.running ? 3000 : false),
  });
  const status = live.data?.status ?? initial.status;
  useEffect(() => {
    if (status !== ANALYSIS_STATUS.running) void Promise.all([client.invalidateQueries({ queryKey: queryKeys.document(documentId) }), client.invalidateQueries({ queryKey: queryKeys.documents() })]);
  }, [status, client, documentId]);
  return null;
}

/**
 * The document on `DetailLayout` (the UX review's Y5): the title the insight knows, the status, the one primary action by state,
 * the rest in a menu; three tabs as routes — the report first (the verdict, the findings with what failed first, the engine's
 * facts folded), the document (the file or its text, what Yomizaka read in it, where it lives), the history of its runs —; the
 * sharing in the side panel. Every analysis is an Orazaka run, shown as it came back.
 */
export function DocumentView({ initial, tab, perspective = null, offer }: { initial: DocumentViewData; tab: DocumentTab; perspective?: Audience | null; offer: { studios: readonly Studio[]; jurisdictions: readonly Jurisdiction[]; rulesets: readonly string[] } }) {
  const { say, locale } = useSay();
  const router = useRouter();
  const client = useQueryClient();
  const params = useSearchParams();
  const doc = useQuery({
    queryKey: queryKeys.document(initial.id),
    queryFn: () => krizakaFetch(`/api/documents/${initial.id}`, { schema: z.object({ document: documentView }) }).then((r) => r.document),
    initialData: initial,
  }).data;
  const remove = useMutation({
    mutationFn: () => krizakaFetch(`/api/documents/${initial.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.documents() });
      router.replace(`/${locale}/app`);
    },
  });
  const [confirming, setConfirming] = useState(false);
  const path = `/${locale}/app/documents/${initial.id}`;
  // The tab is the route (/documents/[id]/rapport|document|historique): back, forward, refresh and sharing all work.
  const go = (next: DocumentTab, query = "") => router.push(`${path}/${next}${query}`, { scroll: false });
  // The lit finding is in the address (`?finding=`): « Voir dans le fichier » opens the document tab on it; back returns to the report.
  const [activeId, setActiveId] = useState<string | null>(params.get("finding"));
  const [found, setFound] = useState<Record<string, Located | null>>({});
  const viewerRef = useRef<HTMLElement>(null);
  const fileUrl = `/api/documents/${doc.id}/file`;
  const isComplianceReport = (a: Analysis) => a.studio === "compliance-check" && !!a.report && "findings" in a.report;
  // The history can open an earlier run's report (`?run=`): its findings, its download and its sharing follow it.
  const runParam = params.get("run");
  const latestCompliance = (runParam ? doc.analyses.find((a) => a.id === runParam && isComplianceReport(a)) : undefined) ?? doc.analyses.find(isComplianceReport);
  const latestAuthenticity = doc.analyses.find((a) => a.studio === "document-authenticity" && a.report && "signals" in a.report);
  const running = (studio: Analysis["studio"]) => doc.analyses.some((a) => a.studio === studio && a.status === ANALYSIS_STATUS.running);
  const failures = doc.analyses.filter((a) => a.error);
  const isPdf = doc.mimeType === "application/pdf";
  const examinable = isPdf || doc.mimeType === DOCX_MIME || doc.mimeType === ODT_MIME;
  const certifiable = !!latestCompliance && !isSeededCheck(latestCompliance);
  const reportHref = latestCompliance ? `/api/documents/${doc.id}/analyses/${latestCompliance.id}/report?lang=${locale}` : null;
  const lang = locale === "fr" ? "fr" : "en";
  const title = displayTitle(doc, lang);
  const tabs = DOCUMENT_TABS.filter((t) => t !== "historique" || doc.analyses.length > 1);
  const latestReport = latestCompliance?.report && "findings" in latestCompliance.report ? latestCompliance.report : null;
  const highlights = useMemo(
    () => (latestReport?.findings ?? []).filter((f) => f.evidenceSpan?.quote).map((f) => ({ id: f.ruleId, quote: f.evidenceSpan!.quote, label: f.title ?? f.ruleId })),
    [latestReport],
  );
  // While a check runs, where it stands (Lecture › Contrôle › Règles › Rapport) at the top of the report: Krizaka UI's Stepper fed by the core's steps (#208).
  const runningStudio = (["compliance-check", "document-authenticity"] as const).find((s) => running(s)) ?? null;
  const selection: FindingSelection = {
    activeId,
    onSelect: (id) => {
      setActiveId(id);
      if (id) {
        go("document", `?finding=${encodeURIComponent(id)}`);
        // On a narrow screen the file sits above the findings: bring it into view; the viewer scrolls to the passage itself.
        if (window.matchMedia?.("(max-width: 1279px)").matches) viewerRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        if (!isPdf || doc.textSource) document.getElementById(`passage-${id}`)?.scrollIntoView({ block: "center" });
      }
    },
  };
  // The kind the person declared (« Quel document ? ») and the one Yomizaka read select the ruleset (ADR-089): a mismatch is shown and confirmed in the form.
  const detectedKind = doc.insight?.understanding.check?.documentType ?? null;
  const compliancePlan = planCheck({ declared: doc.kind, detected: detectedKind, asOf: localDay(new Date(), LAW_TIME_ZONE) });
  const offeredKinds: readonly CheckKind[] = ["lease", ...(offer.rulesets.includes("qc-invoice") ? (["invoice"] as const) : []), ...(offer.rulesets.includes("qc-service-contract") ? (["contract"] as const) : []), ...(offer.rulesets.includes("qc-visit-notice") ? (["visit-notice"] as const) : []), ...(offer.rulesets.includes("qc-premises-condition") ? (["premises-condition"] as const) : [])];
  const complianceOptions: readonly CheckKind[] = compliancePlan.mismatch ? [...new Set<CheckKind>([...offeredKinds, compliancePlan.mismatch.detected, ...(isCheckKind(doc.kind) ? [doc.kind] : [])])] : offeredKinds;
  const complianceCard = (
    <Card.Root key="compliance-check" className="p-4">
      <h3 className="mb-2 font-display text-base font-bold text-fg">{say("analysis.complianceTitle")}</h3>
      {doc.insight && doc.insight.understanding.nature && !doc.insight.understanding.check ? <Alert tone="info">{say("insight.noCheck")}</Alert> : !doc.hasText ? <Alert tone="info">{say("document.noText")}</Alert> : compliancePlan.unsupported ? <Alert tone="info">{say("analysis.notVerified")}</Alert> : (
        <>
          {compliancePlan.mismatch ? <Alert tone="warning">{say("analysis.mismatch", { declared: say(`kinds.${compliancePlan.mismatch.declared}`), detected: say(`analysis.kindWords.${compliancePlan.mismatch.detected}`) })}</Alert> : null}
          <StartCompliance documentId={doc.id} initialType={isCheckKind(doc.kind) ? doc.kind : (detectedKind ?? "lease")} disabled={running("compliance-check")} jurisdictions={offer.jurisdictions} options={complianceOptions} />
        </>
      )}
    </Card.Root>
  );
  const authenticityCard = (
    <Card.Root key="document-authenticity" className="p-4">
      <h3 className="mb-2 font-display text-base font-bold text-fg">{say("analysis.authenticityTitle")}</h3>
      {doc.textSource ? <PhotoOriginSignals source={doc.textSource} /> : !examinable ? <Alert tone="info">{say("analysis.noPdf")}</Alert> : doc.sizeBytes > AUTHENTICITY_MAX_BYTES ? <Alert tone="info">{say("analysis.tooLarge")}</Alert> : <StartAuthenticity documentId={doc.id} disabled={running("document-authenticity")} />}
    </Card.Root>
  );
  const startCards = (firstCheck(perspective, doc.kind) === "compliance-check" ? [complianceCard, authenticityCard] : [authenticityCard, complianceCard]).filter((c) => offer.studios.includes(c.key as Studio));

  const activeFinding = activeId ? (latestReport?.findings.find((f) => f.ruleId === activeId) ?? null) : null;
  const place = activeId ? placeOf(found[activeId], say) : null;

  const report = (
    <section aria-label={say("document.tabs.rapport")} className="flex min-w-0 flex-col gap-4" data-testid="tab-rapport">
      {runningStudio ? <CheckSteps steps={checkSteps({ hasText: doc.hasText, analysis: { studio: runningStudio, status: "running" } })} /> : null}
      {failures.map((a) => (
        <Alert key={a.id} tone="danger">
          {a.error}
        </Alert>
      ))}
      {latestCompliance && latestReport ? (
        <>
          <VerdictBand report={latestReport} />
          <FindingList report={latestReport} selection={selection} />
          {latestAuthenticity?.report && "signals" in latestAuthenticity.report ? <AuthenticitySignals report={latestAuthenticity.report} /> : null}
          <TechnicalDetails documentId={doc.id} analysis={latestCompliance} />
          <details className="rounded-lg border border-border-default p-3">
            <summary className="cursor-pointer text-sm font-semibold text-fg">{say("document.details")}</summary>
            <div className="mt-3">
              <ClosingNoteView note={buildNote(noteInputOf(latestReport, noteSourceOf(doc.textSource)), locale)} />
            </div>
          </details>
          <details className="rounded-lg border border-border-default p-3" data-testid="more-checks">
            <summary className="cursor-pointer text-sm font-semibold text-fg">{say("reportFace.otherChecks")}</summary>
            <div className="mt-3 grid gap-4 md:grid-cols-2">{startCards}</div>
          </details>
        </>
      ) : latestAuthenticity?.report && "signals" in latestAuthenticity.report ? (
        <>
          <AuthenticitySignals report={latestAuthenticity.report} />
          <TechnicalDetails documentId={doc.id} analysis={latestAuthenticity} />
          <div className="grid gap-4 md:grid-cols-2">{startCards}</div>
        </>
      ) : (
        <>
          <div>
            <h2 className="font-display text-lg font-bold text-fg">{say("reportFace.notChecked")}</h2>
            <p className="text-sm text-fg-secondary">{say(`document.checksLeadBy.${wordingOf(perspective)}`)}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">{startCards}</div>
        </>
      )}
      <p className="m-0 text-xs text-fg-muted">{say("library.informative")}</p>
    </section>
  );

  const document_ = (
    <section aria-label={say("document.tabs.document")} className="flex min-w-0 flex-col gap-6" data-testid="tab-document">
      {activeFinding ? (
        <Alert tone="info" data-testid="finding-place">
          <span className="font-semibold">{activeFinding.title ?? activeFinding.ruleId}</span>
          {place ? ` — ${place}` : null}
          {" · "}
          <Link href={`${path}/rapport`} scroll={false} className="underline">
            {say("reportFace.backToReport")}
          </Link>
        </Alert>
      ) : null}
      {isPdf && !doc.purged ? (
        <section ref={viewerRef} aria-label={say("document.viewer")} className="min-w-0">
          <DocumentViewer
            src={fileUrl}
            loadPdfjs={loadPdfjs}
            workerSrc={WORKER_SRC}
            highlights={highlights}
            activeId={activeId}
            onActiveChange={setActiveId}
            onLocate={setFound}
            className="[--kz-document-viewer-height:72vh]"
            labels={{ region: say("document.viewerRegion"), loading: say("document.loadingPdf"), failed: say("document.pdfFailed"), page: say("document.pageLabel"), onPage: say("document.onPage"), notFound: say("document.notFound") }}
          />
        </section>
      ) : doc.purged ? (
        <Alert tone="info">{say("document.where.notKeptText")}</Alert>
      ) : doc.hasText ? (
        <DocumentText text={doc.text} report={latestReport} />
      ) : (
        <Alert tone="info">{say("document.noText")}</Alert>
      )}
      {/* A photo becomes an image-only PDF: its text (OCR or vision) is shown under the viewer, where a finding can be found. */}
      {isPdf && !doc.purged && doc.textSource && doc.hasText ? <DocumentText text={doc.text} report={latestReport} /> : null}
      {doc.insight ? <DocumentInsight insight={doc.insight} documentId={doc.id} source={doc.textSource} /> : null}
      <StorageNotice storage={doc.storage} retainUntil={doc.retainUntil} purged={doc.purged} onDelete={() => remove.mutate()} deleting={remove.isPending} />
      <DescriptionList
        items={[
          { term: say("document.file"), details: doc.filename },
          ...(doc.pages ? [{ term: say("document.pages"), details: String(doc.pages) }] : []),
          { term: say("document.size"), details: formatBytes(doc.sizeBytes, locale) },
          { term: say("document.added"), details: formatDate(doc.createdAt, locale, true) },
          { term: say("document.fingerprint"), details: <code className="break-all font-mono text-xs">{doc.sha256}</code> },
        ]}
      />
    </section>
  );

  const history = (
    <section aria-label={say("document.tabs.historique")} className="flex min-w-0 flex-col gap-3" data-testid="tab-historique">
      <p className="m-0 text-sm text-fg-secondary">{doc.analyses.length > 1 ? say("reportFace.history") : say("reportFace.oneRun")}</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {doc.analyses.map((a) => (
          <li key={a.id} className="flex flex-col gap-2 rounded-lg border border-border-default bg-surface-1 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-fg">{say(a.studio === "compliance-check" ? "analysis.complianceTitle" : "analysis.authenticityTitle")}</span>
              <Badge tone={RUN_TONE[a.status]}>{say(`analysis.statuses.${a.status}`)}</Badge>
            </div>
            <span className="text-xs text-fg-muted">{formatDate(a.createdAt, locale, true)}</span>
            {isComplianceReport(a) ? (
              <Link href={`${path}/rapport?run=${a.id}`} scroll={false} aria-current={latestCompliance?.id === a.id ? "true" : undefined} className="text-sm font-semibold text-fg-accent hover:underline" data-testid="open-run">
                {say("reportFace.openRun")}
              </Link>
            ) : null}
            <TechnicalDetails documentId={doc.id} analysis={a} />
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <DetailLayout
      back={<Link href={`/${locale}/app`}>{say("document.back")}</Link>}
      eyebrow={`${say(`kinds.${doc.kind}`)} · ${doc.filename}`}
      title={title}
      status={<Badge tone={STATUS_TONE[doc.status]}>{say(`statuses.${doc.status}`)}</Badge>}
      meta={[doc.pages ? say("library.pages", { count: doc.pages }) : null, formatBytes(doc.sizeBytes, locale), doc.retainUntil ? say("document.where.retentionUntil", { date: formatDate(doc.retainUntil, locale) }) : null].filter(Boolean).join(" · ")}
      actions={
        <>
          {certifiable && reportHref ? (
            <Button asChild variant="primary" size="sm" shape="cut">
              <a href={reportHref} download data-testid="report-download">
                {say("reportFace.downloadReport")}
              </a>
            </Button>
          ) : null}
          {confirming ? (
            <Button variant="danger" size="sm" loading={remove.isPending} onClick={() => remove.mutate()}>
              {say("document.deleteConfirm")}
            </Button>
          ) : null}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" size="sm" aria-label={say("document.details")} data-testid="document-menu">
                <MoreIcon size={16} aria-hidden />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item asChild>
                <a href={fileUrl} target="_blank" rel="noreferrer">
                  {say("document.openFile")}
                </a>
              </DropdownMenu.Item>
              {certifiable && reportHref ? (
                <DropdownMenu.Item asChild>
                  <a href={`${reportHref}&format=pdf`} download>
                    {say("analysis.exportPdf")}
                  </a>
                </DropdownMenu.Item>
              ) : null}
              <DropdownMenu.Item tone="danger" onSelect={() => setConfirming(true)}>
                {say("document.delete")}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </>
      }
      tabs={
        <Tabs.Nav label={say("document.viewer")} current={`${path}/${tab}`}>
          {tabs.map((t) => (
            <Tabs.NavLink key={t} href={`${path}/${t}`} exact asChild>
              <Link href={`${path}/${t}`} scroll={false}>
                {say(`document.tabs.${t}`)}
              </Link>
            </Tabs.NavLink>
          ))}
        </Tabs.Nav>
      }
      aside={
        certifiable && latestCompliance ? (
          <section aria-label={say("reportFace.whoSees")} className="flex flex-col gap-2" data-testid="report-aside">
            <h2 className="m-0 font-display text-base font-bold text-fg">{say("reportFace.whoSees")}</h2>
            <p className="m-0 text-sm text-fg-secondary">{say("reportFace.onlyYou")}</p>
            <ReportShare documentId={doc.id} analysisId={latestCompliance.id} />
            <p className="m-0 text-xs text-fg-muted">{say("analysis.language")}</p>
          </section>
        ) : undefined
      }
    >
      {doc.analyses.filter((a) => a.status === ANALYSIS_STATUS.running).map((a) => (
        <LiveAnalysis key={a.id} documentId={doc.id} analysis={a} />
      ))}
      {tab === "rapport" ? report : tab === "document" ? document_ : history}
    </DetailLayout>
  );
}
