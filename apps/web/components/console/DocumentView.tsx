"use client";

import { krizakaFetch, useMutation, useQuery, useQueryClient } from "@krizaka/query";
import { Badge } from "@krizaka/ui/badge";
import { DetailLayout } from "@krizaka/ui/detail-layout";
import type { Located } from "@krizaka/ui/document-viewer";
import { Tabs } from "@krizaka/ui/tabs";
import { ANALYSIS_STATUS, type Audience, type DocumentView as DocumentViewData, documentView, type Jurisdiction, queryKeys, type Studio } from "@yomizaka/core";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { z } from "zod";

import { type DocumentTab } from "@/lib/console-nav";
import { displayTitle } from "@/lib/document-face";
import { useSay } from "@/lib/i18n-client";

import { documentFacts, highlightsOf } from "./document-view-model";
import { DocumentActions } from "./DocumentActions";
import { DocumentFileTab } from "./DocumentFileTab";
import { DocumentHistoryTab } from "./DocumentHistoryTab";
import { DocumentReportTab } from "./DocumentReportTab";
import { STATUS_TONE } from "./DocumentTable";
import { formatBytes, formatDate } from "./format";
import { LiveAnalysis } from "./LiveAnalysis";
import type { FindingSelection } from "./ReportFace";
import { ReportShare } from "./ReportShare";
import { StartCards } from "./StartChecks";

/**
 * The document on `DetailLayout` (the UX review's Y5): the title the insight knows, the status, the one primary action by state,
 * the rest in a menu; three tabs as routes — the report first (the verdict, the findings with what failed first, the engine's
 * facts folded), the document (the file or its text, what Yomizaka read in it, where it lives), the history of its runs —; the
 * sharing in the side panel. Every analysis is an Orazaka run, shown as it came back. This component holds what the tabs share
 * (the document, the lit finding, the deletion); each tab and the actions are their own component (yomizaka#320, #110).
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
  const path = `/${locale}/app/documents/${initial.id}`;
  // The tab is the route (/documents/[id]/rapport|document|historique): back, forward, refresh and sharing all work.
  const go = (next: DocumentTab, query = "") => router.push(`${path}/${next}${query}`, { scroll: false });
  // The lit finding is in the address (`?finding=`): « Voir dans le fichier » opens the document tab on it; back returns to the report.
  const [activeId, setActiveId] = useState<string | null>(params.get("finding"));
  const [found, setFound] = useState<Record<string, Located | null>>({});
  const viewerRef = useRef<HTMLElement>(null);
  const fileUrl = `/api/documents/${doc.id}/file`;
  // The history can open an earlier run's report (`?run=`): its findings, its download and its sharing follow it.
  const facts = documentFacts(doc, { run: params.get("run"), locale });
  const { latestCompliance, latestReport, certifiable, reportHref, isPdf } = facts;
  const lang = locale === "fr" ? "fr" : "en";
  const title = displayTitle(doc, lang);
  const highlights = highlightsOf(latestReport);
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
  const startCards = <StartCards doc={doc} perspective={perspective} offer={offer} examinable={facts.examinable} running={facts.running} />;

  return (
    <DetailLayout
      back={<Link href={`/${locale}/app`}>{say("document.back")}</Link>}
      eyebrow={`${say(`kinds.${doc.kind}`)} · ${doc.filename}`}
      title={title}
      status={<Badge tone={STATUS_TONE[doc.status]}>{say(`statuses.${doc.status}`)}</Badge>}
      meta={[doc.pages ? say("library.pages", { count: doc.pages }) : null, formatBytes(doc.sizeBytes, locale), doc.retainUntil ? say("document.where.retentionUntil", { date: formatDate(doc.retainUntil, locale) }) : null].filter(Boolean).join(" · ")}
      actions={<DocumentActions fileUrl={fileUrl} reportHref={certifiable ? reportHref : null} onDelete={() => remove.mutate()} deleting={remove.isPending} />}
      tabs={
        <Tabs.Nav label={say("document.viewer")} current={`${path}/${tab}`}>
          {facts.tabs.map((t) => (
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
      {tab === "rapport" ? (
        <DocumentReportTab doc={doc} facts={facts} selection={selection} perspective={perspective} startCards={startCards} />
      ) : tab === "document" ? (
        <DocumentFileTab doc={doc} path={path} isPdf={isPdf} report={latestReport} viewer={{ fileUrl, highlights, activeId, onActiveChange: setActiveId, onLocate: setFound }} viewerRef={viewerRef} found={found} onDelete={() => remove.mutate()} deleting={remove.isPending} />
      ) : (
        <DocumentHistoryTab doc={doc} path={path} latestCompliance={latestCompliance} />
      )}
    </DetailLayout>
  );
}
