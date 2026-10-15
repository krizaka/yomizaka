"use client";

import { krizakaFetch, useMutation, useQuery, useQueryClient } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { DescriptionList } from "@krizaka/ui/description-list";
import { createKrizakaForm } from "@krizaka/ui/form";
import { Spinner } from "@krizaka/ui/spinner";
import { Tabs } from "@krizaka/ui/tabs";
import { type Analysis, analysis as analysisSchema, AUTHENTICITY_MAX_BYTES, type AuthenticityReport, type ComplianceReport, type DocumentDetail, documentDetail, JURISDICTIONS, passages, queryKeys } from "@yomizaka/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";

import { formatBytes, formatDate } from "./format";
import { STATUS_TONE } from "./LibraryView";

const VERDICT_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = { PASS: "success", FAIL: "danger", INSUFFICIENT_EVIDENCE: "warning" };
const LEVEL_TONE: Record<string, "neutral" | "warning" | "danger"> = { observé: "neutral", inhabituel: "warning", incohérent: "danger" };
const RUN_TONE = { running: "accent", succeeded: "success", failed: "danger", cancelled: "neutral" } as const;

const compliance = createKrizakaForm({
  schema: z.object({ jurisdiction: z.enum(JURISDICTIONS), asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  defaultValues: { jurisdiction: "QC" as (typeof JURISDICTIONS)[number], asOf: new Date().toISOString().slice(0, 10) },
});
const authenticity = createKrizakaForm({
  schema: z.object({ expectedIssuer: z.string().trim().max(120) }),
  defaultValues: { expectedIssuer: "" },
});

/** The document's text, the passages a compliance report quotes marked where they sit. */
function DocumentText({ text, report }: { text: string; report: ComplianceReport | null }) {
  const { say } = useSay();
  const parts = useMemo(
    () => passages(text, (report?.findings ?? []).filter((f) => f.evidenceSpan?.quote).map((f) => ({ id: f.ruleId, quote: f.evidenceSpan!.quote, start: f.evidenceSpan!.start }))),
    [text, report],
  );
  return (
    <div className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border-default bg-surface-1 p-4 font-mono text-xs leading-relaxed text-fg-secondary">
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

function ComplianceFindings({ report }: { report: ComplianceReport }) {
  const { say } = useSay();
  const failures = report.summary?.blockingFailures ?? report.findings.filter((f) => f.verdict === "FAIL" && f.severity === "BLOCKING").length;
  return (
    <div className="flex flex-col gap-3">
      {report.reviewStatus ? <Alert tone="warning">{say("analysis.toReview")}</Alert> : null}
      <p className="text-sm text-fg-secondary">{say("analysis.summary", { failures, rules: report.summary?.rulesEvaluated ?? report.findings.length })}</p>
      <ul className="flex flex-col gap-2">
        {report.findings.map((f) => (
          <li key={f.ruleId} className="rounded-lg border border-border-default bg-surface-1 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-fg">{f.title ?? f.ruleId}</span>
              <Badge tone={VERDICT_TONE[f.verdict] ?? "neutral"}>{say(`analysis.verdicts.${f.verdict}`)}</Badge>
            </div>
            <p className="mt-1 text-fg-secondary">{f.explanation}</p>
            <dl className="mt-2 grid gap-1 text-xs text-fg-muted sm:grid-cols-[auto_1fr] sm:gap-x-3">
              <dt>{say("analysis.severity")}</dt>
              <dd className="font-mono">
                {f.ruleId} · {f.severity}
                {f.method ? ` · ${f.method}` : ""}
              </dd>
              {f.citation ? (
                <>
                  <dt>{say("analysis.citation")}</dt>
                  <dd>{f.citation}</dd>
                </>
              ) : null}
              <dt>{say("analysis.passage")}</dt>
              <dd>
                {f.evidenceSpan?.quote ? (
                  <a href={`#passage-${f.ruleId}`} className="italic text-fg-accent hover:underline">
                    « {f.evidenceSpan.quote} »
                  </a>
                ) : (
                  say("analysis.noPassage")
                )}
              </dd>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AuthenticitySignals({ report }: { report: AuthenticityReport }) {
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

/** One analysis: its Orazaka run (id, version, status), polled while it runs, then its report. */
function AnalysisCard({ documentId, initial }: { documentId: string; initial: Analysis }) {
  const { say, locale } = useSay();
  const client = useQueryClient();
  const live = useQuery({
    queryKey: [...queryKeys.document(documentId), "analysis", initial.id],
    queryFn: () => krizakaFetch(`/api/documents/${documentId}/analyses/${initial.id}`, { schema: z.object({ analysis: analysisSchema }) }).then((r) => r.analysis),
    initialData: initial,
    enabled: initial.status === "running",
    refetchInterval: (q) => (q.state.data?.status === "running" ? 3000 : false),
  });
  const a = live.data ?? initial;
  useEffect(() => {
    if (initial.status === "running" && a.status !== "running") void client.invalidateQueries({ queryKey: queryKeys.documents() });
  }, [a.status, initial.status, client]);
  const ruleset = a.report && "rulesetId" in a.report ? `${a.report.rulesetId} · ${a.report.rulesetVersion}` : null;
  return (
    <Card.Root className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-bold text-fg">{say(a.studio === "compliance-check" ? "analysis.complianceTitle" : "analysis.authenticityTitle")}</h3>
        <Badge tone={RUN_TONE[a.status]}>{a.status === "running" ? <Spinner size="sm" label={say("analysis.running")} /> : null} {say(`analysis.statuses.${a.status}`)}</Badge>
      </div>
      <DescriptionList
        items={[
          { term: say("analysis.runId"), details: <code className="break-all font-mono text-xs" data-testid="orazaka-run-id">{a.runId ?? "—"}</code> },
          ...(a.blueprintVersion ? [{ term: say("analysis.blueprint"), details: `${a.studio} · ${a.blueprintVersion}` }] : []),
          ...(ruleset ? [{ term: say("analysis.ruleset"), details: ruleset }] : []),
          ...(a.inputs.jurisdiction ? [{ term: say("analysis.jurisdiction"), details: `${a.inputs.jurisdiction} · ${a.inputs.asOf ?? ""}` }] : []),
          ...(a.inputs.expectedIssuer ? [{ term: say("analysis.expectedIssuer"), details: a.inputs.expectedIssuer }] : []),
          { term: say("analysis.started"), details: formatDate(a.createdAt, locale, true) },
          ...(a.finishedAt ? [{ term: say("analysis.finished"), details: formatDate(a.finishedAt, locale, true) }] : []),
        ]}
      />
      {a.status === "running" ? <p className="text-sm text-fg-secondary">{say("analysis.running")}</p> : null}
      {a.error ? <Alert tone="danger">{a.error}</Alert> : null}
      {a.report && "findings" in a.report ? <ComplianceFindings report={a.report} /> : null}
      {a.report && "signals" in a.report ? <AuthenticitySignals report={a.report} /> : null}
      {a.report ? <p className="text-xs text-fg-muted">{say("analysis.language")}</p> : null}
    </Card.Root>
  );
}

function StartCompliance({ documentId, disabled }: { documentId: string; disabled: boolean }) {
  const { say, locale } = useSay();
  const client = useQueryClient();
  const [problem, setProblem] = useState<string | null>(null);
  const start = useMutation({
    mutationFn: (body: { jurisdiction: string; asOf: string }) => krizakaFetch(`/api/documents/${documentId}`, { method: "POST", json: { studio: "compliance-check", ...body } }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.document(documentId) }),
  });
  const form = compliance.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (values) => {
      setProblem(null);
      try {
        await start.mutateAsync(values);
      } catch (error) {
        setProblem(say(`errors.${errorKey(error)}`));
      }
    },
  });
  return (
    <form.Form aria-label={say("analysis.complianceTitle")} className="flex flex-col gap-3">
      <p className="text-sm text-fg-secondary">{say("analysis.complianceText")}</p>
      <form.Select name="jurisdiction" label={say("analysis.jurisdiction")} options={JURISDICTIONS.map((j) => ({ value: j, label: say(`analysis.jurisdictions.${j}`) }))} />
      <form.DateField name="asOf" label={say("analysis.asOf")} />
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      <form.Submit shape="cut" disabled={disabled}>
        {say("analysis.run")}
      </form.Submit>
    </form.Form>
  );
}

function StartAuthenticity({ documentId, disabled }: { documentId: string; disabled: boolean }) {
  const { say, locale } = useSay();
  const client = useQueryClient();
  const [problem, setProblem] = useState<string | null>(null);
  const start = useMutation({
    mutationFn: (body: { expectedIssuer: string }) =>
      krizakaFetch(`/api/documents/${documentId}`, { method: "POST", json: { studio: "document-authenticity", ...(body.expectedIssuer ? { expectedIssuer: body.expectedIssuer } : {}) } }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.document(documentId) }),
  });
  const form = authenticity.useForm({
    i18n: { t: (key, vars) => say(key, vars as Record<string, string | number> | undefined), locale },
    onSubmit: async (values) => {
      setProblem(null);
      try {
        await start.mutateAsync(values);
      } catch (error) {
        setProblem(say(`errors.${errorKey(error)}`));
      }
    },
  });
  return (
    <form.Form aria-label={say("analysis.authenticityTitle")} className="flex flex-col gap-3">
      <p className="text-sm text-fg-secondary">{say("analysis.authenticityText")}</p>
      <form.TextField name="expectedIssuer" label={say("analysis.expectedIssuer")} hint={say("analysis.expectedIssuerHint")} />
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      <form.Submit shape="cut" variant="secondary" disabled={disabled}>
        {say("analysis.run")}
      </form.Submit>
    </form.Form>
  );
}

/** The document page: the file and its text on one side, Orazaka's checks on the other — each a traced run. */
export function DocumentView({ initial }: { initial: DocumentDetail }) {
  const { say, locale } = useSay();
  const router = useRouter();
  const client = useQueryClient();
  const doc = useQuery({
    queryKey: queryKeys.document(initial.id),
    queryFn: () => krizakaFetch(`/api/documents/${initial.id}`, { schema: z.object({ document: documentDetail }) }).then((r) => r.document),
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
  const fileUrl = `/api/documents/${doc.id}/file`;
  const latestCompliance = doc.analyses.find((a) => a.studio === "compliance-check" && a.report && "findings" in a.report);
  const running = (studio: Analysis["studio"]) => doc.analyses.some((a) => a.studio === studio && a.status === "running");
  const isPdf = doc.mimeType === "application/pdf";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/${locale}/app`} className="text-sm text-fg-muted hover:text-fg">
            ← {say("document.back")}
          </Link>
          <h2 className="mt-1 break-words font-display text-2xl font-extrabold tracking-tight text-fg">{doc.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[doc.status]}>{say(`statuses.${doc.status}`)}</Badge>
            <Badge tone="neutral">{say(`kinds.${doc.kind}`)}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm" shape="cut">
            <a href={fileUrl} target="_blank" rel="noreferrer">
              {say("document.openFile")}
            </a>
          </Button>
          {confirming ? (
            <Button variant="danger" size="sm" loading={remove.isPending} onClick={() => remove.mutate()}>
              {say("document.deleteConfirm")}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
              {say("document.delete")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section aria-label={say("document.viewer")} className="flex min-w-0 flex-col gap-3">
          <Tabs.Root defaultValue={isPdf ? "file" : "text"}>
            <Tabs.List aria-label={say("document.viewer")}>
              {isPdf ? <Tabs.Trigger value="file">{say("document.file")}</Tabs.Trigger> : null}
              <Tabs.Trigger value="text">{say("document.text")}</Tabs.Trigger>
            </Tabs.List>
            {isPdf ? (
              <Tabs.Content value="file">
                <iframe src={fileUrl} title={say("document.viewerFrame", { name: doc.filename })} className="h-[70vh] w-full rounded-lg border border-border-default bg-surface-1" />
              </Tabs.Content>
            ) : null}
            <Tabs.Content value="text">{doc.hasText ? <DocumentText text={doc.text} report={latestCompliance?.report && "findings" in latestCompliance.report ? latestCompliance.report : null} /> : <Alert tone="info">{say("document.noText")}</Alert>}</Tabs.Content>
          </Tabs.Root>
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

        <section aria-labelledby="checks" className="flex min-w-0 flex-col gap-4">
          <div>
            <h2 id="checks" className="font-display text-lg font-bold text-fg">
              {say("document.checks")}
            </h2>
            <p className="text-sm text-fg-secondary">{say("document.checksLead")}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <Card.Root className="p-4">
              <h3 className="mb-2 font-display text-base font-bold text-fg">{say("analysis.complianceTitle")}</h3>
              {doc.hasText ? <StartCompliance documentId={doc.id} disabled={running("compliance-check")} /> : <Alert tone="info">{say("document.noText")}</Alert>}
            </Card.Root>
            <Card.Root className="p-4">
              <h3 className="mb-2 font-display text-base font-bold text-fg">{say("analysis.authenticityTitle")}</h3>
              {!isPdf ? <Alert tone="info">{say("analysis.noPdf")}</Alert> : doc.sizeBytes > AUTHENTICITY_MAX_BYTES ? <Alert tone="info">{say("analysis.tooLarge")}</Alert> : <StartAuthenticity documentId={doc.id} disabled={running("document-authenticity")} />}
            </Card.Root>
          </div>
          {doc.analyses.map((a) => (
            <AnalysisCard key={a.id} documentId={doc.id} initial={a} />
          ))}
        </section>
      </div>
    </div>
  );
}
