"use client";

import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Card } from "@krizaka/ui/card";
import { DescriptionList } from "@krizaka/ui/description-list";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useState } from "react";
import { z } from "zod";

import type { Locale } from "@/lib/i18n";
import type { Verification } from "@/lib/report";

/** The words of the verify page, passed from the server (this page is public: no console slice, no provider). */
export interface VerifyLabels {
  reportFile: string;
  reportPaste: string;
  documentFile: string;
  documentHint: string;
  submit: string;
  empty: string;
  tooLarge: string;
  okTitle: string;
  failTitle: string;
  reasons: Record<string, string>;
  facts: Record<"fileSha" | "keyId" | "documentSha" | "runId" | "ruleset" | "checked" | "findings" | "jurisdiction", string>;
  documentMatch: Record<"yes" | "no" | "none", string>;
  drop: { reportTitle: string; documentTitle: string; browse: string; remove: string; hint: string };
}

const form = createKrizakaForm({
  schema: z.object({ reportFiles: z.array(z.instanceof(File)).max(1), reportText: z.string().max(2_000_000), documentFiles: z.array(z.instanceof(File)).max(1) }),
  defaultValues: { reportFiles: [] as File[], reportText: "", documentFiles: [] as File[] },
});

export function VerifyForm({ labels, locale }: { labels: VerifyLabels; locale: Locale }) {
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<Verification | null>(null);
  const f = form.useForm({
    i18n: { t: () => labels.empty, locale },
    onSubmit: async (values) => {
      setProblem(null);
      setResult(null);
      if (values.reportFiles.length === 0 && !values.reportText.trim()) return setProblem(labels.empty);
      const body = new FormData();
      if (values.reportFiles[0]) body.set("report", values.reportFiles[0]);
      else body.set("reportText", values.reportText);
      if (values.documentFiles[0]) body.set("document", values.documentFiles[0]);
      try {
        const res = await fetch("/api/verify", { method: "POST", body });
        if (!res.ok) return setProblem(res.status === 413 ? labels.tooLarge : labels.empty);
        setResult(((await res.json()) as { result: Verification }).result);
      } catch {
        setProblem(labels.empty);
      }
    },
  });
  return (
    <div className="flex flex-col gap-6">
      <f.Form aria-label={labels.submit} className="flex flex-col gap-4">
        <f.FileUpload name="reportFiles" label={labels.reportFile} title={labels.drop.reportTitle} browseLabel={labels.drop.browse} hint={labels.drop.hint} accept=".html,text/html" maxSize={2 * 1024 * 1024} removeLabel={(name) => labels.drop.remove.replace("{name}", name)} refusalLabel={() => labels.tooLarge} />
        <f.TextArea name="reportText" label={labels.reportPaste} rows={4} />
        <f.FileUpload name="documentFiles" label={labels.documentFile} title={labels.drop.documentTitle} browseLabel={labels.drop.browse} hint={labels.documentHint} maxSize={10 * 1024 * 1024} removeLabel={(name) => labels.drop.remove.replace("{name}", name)} refusalLabel={() => labels.tooLarge} />
        {problem ? <Alert tone="danger">{problem}</Alert> : null}
        <f.Submit shape="cut">
          {labels.submit}
        </f.Submit>
      </f.Form>
      {result ? <VerifyResult result={result} labels={labels} /> : null}
    </div>
  );
}

function VerifyResult({ result, labels }: { result: Verification; labels: VerifyLabels }) {
  if (!result.ok) {
    return (
      <Alert tone="danger" title={labels.failTitle} data-testid="verify-failed">
        <p>{labels.reasons[result.reason] ?? result.reason}</p>
        <p className="mt-2 text-xs">
          {labels.facts.fileSha}: <code className="break-all font-mono">{result.fileSha256}</code>
        </p>
      </Alert>
    );
  }
  const { payload } = result;
  return (
    <Card.Root className="flex flex-col gap-4 p-4" data-testid="verify-ok">
      <Alert tone="success" title={labels.okTitle}>
        {result.documentMatch === null ? labels.documentMatch.none : result.documentMatch ? labels.documentMatch.yes : labels.documentMatch.no}
      </Alert>
      {result.documentMatch === false ? <Alert tone="danger">{labels.documentMatch.no}</Alert> : null}
      <DescriptionList
        items={[
          { term: labels.facts.fileSha, details: <code className="break-all font-mono text-xs">{result.fileSha256}</code> },
          { term: labels.facts.keyId, details: <code className="font-mono text-xs">{result.keyId}</code> },
          { term: labels.facts.documentSha, details: <code className="break-all font-mono text-xs">{payload.document.sha256}</code> },
          { term: labels.facts.runId, details: <code className="break-all font-mono text-xs">{payload.check.runId}</code> },
          { term: labels.facts.jurisdiction, details: `${payload.check.jurisdiction} · ${payload.check.asOf}` },
          { term: labels.facts.ruleset, details: `${payload.check.rulesetId} · ${payload.check.rulesetVersion}` },
          { term: labels.facts.checked, details: payload.check.finishedAt },
          { term: labels.facts.findings, details: <Badge tone="neutral">{payload.findings.length}</Badge> },
        ]}
      />
    </Card.Root>
  );
}
