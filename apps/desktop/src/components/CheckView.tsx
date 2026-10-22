import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Progress } from "@krizaka/ui/progress";
import { useMutation, useQuery } from "@krizaka/query";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { STAGE, stageOf, stepOf, STAGES_IN_ORDER } from "@yomizaka/client";

import { useI18n } from "../i18n";
import { queries, yomizaka } from "../lib/config";
import { localDocuments } from "../lib/local-documents";
import { base64Of, native } from "../lib/native";
import { type Route } from "../lib/route";
import { ClosingNote } from "./ClosingNote";

/** A check being followed: its stages, then the plain-language note, and the signed report saved next to the document. */
export function CheckView({ documentId, analysisId, go }: { documentId: string; analysisId: string; go: (route: Route) => void }) {
  const { t, locale } = useI18n();
  const run = useQuery(queries.analysis(documentId, analysisId, locale));
  const found = run.data?.analysis ?? null;
  const stage = stageOf({ uploading: false, analysis: found });
  const save = useMutation({
    mutationFn: async () => {
      const { url, headers } = await yomizaka.reportRequest(documentId, analysisId, locale);
      const res = await tauriFetch(url, { headers });
      if (!res.ok) throw new Error(String(res.status));
      const path = localDocuments.pathOf(documentId);
      if (!path) throw new Error("the document's file is not known on this Mac");
      return native.saveReport(path, `yomizaka-audit-${analysisId.slice(0, 8)}.pdf`, base64Of(new Uint8Array(await res.arrayBuffer())));
    },
  });
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <Button variant="ghost" size="sm" className="self-start" onClick={() => go({ screen: "library", folder: null })}>
        {t("check.back")}
      </Button>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-fg-muted">{t("stage.step", { step: stepOf(stage), total: STAGES_IN_ORDER.length })}</p>
        <h1 className="text-xl font-semibold">{t(`stage.${stage}`)}</h1>
        {stage === STAGE.checking || stage === STAGE.sending ? <Progress value={null} label={t(`stage.${stage}`)} /> : null}
        {stage === STAGE.checking ? <p className="text-fg-secondary">{t("result.runningHint")}</p> : null}
        {found?.runId ? <p className="font-mono text-xs text-fg-muted">{t("check.run", { runId: found.runId })}</p> : null}
      </div>
      {stage === STAGE.failed ? <Alert tone="danger">{found?.error ?? t("result.failedHint")}</Alert> : null}
      {run.data?.closingNote ? (
        <>
          <ClosingNote note={run.data.closingNote} />
          {found?.studio === "compliance-check" ? (
            <div className="flex flex-col gap-2">
              <Button variant="primary" onClick={() => save.mutate()} loading={save.isPending}>
                {save.isPending ? t("report.saving") : t("report.save")}
              </Button>
              {save.isSuccess ? <Alert tone="success">{t("report.saved", { name: save.data.split("/").pop() ?? "" })}</Alert> : null}
              {save.isError ? <Alert tone="danger">{t("report.failed")}</Alert> : null}
              <p className="text-xs text-fg-muted">{t("result.signed")}</p>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
