"use client";

import { formatDate } from "@krizaka/intl";
import { Button } from "@krizaka/ui/button";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { EmptyState } from "@krizaka/ui/empty-state";
import { Mascot } from "@krizaka/ui/mascots";
import { PageHeader } from "@krizaka/ui/page-header";
import Link from "next/link";
import { useMemo } from "react";

import type { FileSummary } from "@/lib/applicant-file";
import { documentsFact, linkFact } from "@/lib/applicant-file-face";
import { CONSOLE_ROUTES } from "@/lib/console-nav";
import { useSay } from "@/lib/i18n-client";

import { DISPLAY_TIME_ZONE, INTL } from "./format";
import { type AskableType, RequestDocuments } from "./RequestDocuments";
import { tableLabels } from "./table-labels";

/** The words of a file's link and documents, shared by the list and the detail. */
export function useFileFacts() {
  const { say, locale } = useSay();
  const date = (iso: string) => formatDate(iso, { locale: INTL[locale], timeZone: DISPLAY_TIME_ZONE });
  return {
    link: (f: Parameters<typeof linkFact>[0]) => {
      const fact = linkFact(f);
      return say(fact.key, fact.date ? { date: date(fact.date) } : undefined);
    },
    documents: (count: number, asked: number) => {
      const fact = documentsFact(count, asked);
      return say(fact.key, { count: fact.count, asked: fact.asked });
    },
    date,
  };
}

/**
 * « Dossiers » (design § 4, § 5.2, yomizaka#323): the applicant files, newest first, as `listApplicantFiles` returns them —
 * the applicant, the link's state as a line of facts, the documents in against those asked, the day it was asked — and
 * « Demander des documents ». No decision yet (P7): no status chip, no sort by a check's result.
 */
export function FilesView({ files, types, origin }: { files: readonly FileSummary[]; types: readonly AskableType[]; origin: string }) {
  const { say, locale } = useSay();
  const facts = useFileFacts();
  const base = `/${locale}${CONSOLE_ROUTES.files}`;
  const columns = useMemo<DataTableColumn<FileSummary>[]>(
    () => [
      {
        id: "candidate",
        header: say("dossiers.columns.candidate"),
        card: "title",
        value: (f) => f.candidateName,
        cell: (f) => (
          <Link href={`${base}/${f.id}`} className="font-semibold text-fg hover:text-fg-accent hover:underline" aria-label={say("dossiers.open", { name: f.candidateName })}>
            {f.candidateName}
          </Link>
        ),
      },
      { id: "link", header: say("dossiers.columns.link"), value: (f) => f.status, cell: (f) => <span data-testid="file-link">{facts.link(f)}</span> },
      { id: "documents", header: say("dossiers.columns.documents"), priority: 2, value: (f) => f.documents, cell: (f) => <span className="tabular-nums">{facts.documents(f.documents, f.requested)}</span> },
      { id: "asked", header: say("dossiers.columns.asked"), priority: 3, align: "end", value: (f) => f.createdAt, cell: (f) => <span className="tabular-nums">{facts.date(f.createdAt)}</span> },
    ],
    [say, base, facts],
  );
  const labels = useMemo(() => tableLabels(say), [say]);
  const ask = (variant: "primary" | "secondary") => (
    <RequestDocuments
      types={types}
      origin={origin}
      trigger={
        <Button variant={variant} size="md">
          {say("dossiers.request")}
        </Button>
      }
    />
  );
  return (
    <div className="flex flex-col gap-6" data-testid="files-view">
      <PageHeader title={say("dossiers.title")} description={say("dossiers.lead")} actions={files.length ? ask("secondary") : null} />
      {files.length ? (
        <DataTable caption={say("dossiers.caption")} rows={[...files]} columns={columns} getRowId={(f) => f.id} rowLabel={(f) => f.candidateName} pageSize={12} labels={labels} />
      ) : (
        <EmptyState icon={<Mascot bird="owl" mood="empty" size={120} />} title={say("dossiers.empty.title")} description={say("dossiers.empty.text")} action={ask("primary")} data-testid="files-empty" />
      )}
    </div>
  );
}
