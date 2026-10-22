"use client";

import { Badge } from "@krizaka/ui/badge";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { type DocumentSummary } from "@yomizaka/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { useSay } from "@/lib/i18n-client";

import { formatBytes, formatDate } from "./format";
import { ItemMenu, type Option, type TagOption } from "./OrganisationActions";
import { TagChips } from "./TagChips";

/** What the row menu needs to move and tag a document: the destinations, the owner's tags and each document's own. */
export interface Organise {
  collections: Option[];
  folders: Option[];
  collectionId: string | null;
  tags: TagOption[];
  tagsByDocument: Record<string, TagOption[]>;
}

export const STATUS_TONE = { stored: "neutral", analysing: "accent", checked: "success", attention: "warning", failed: "danger" } as const;

/** The documents of a view (rows come from the server; a run in progress refreshes them every 4 s). */
export function DocumentTable({ rows, caption, organise }: { rows: DocumentSummary[]; caption?: string; organise?: Organise }) {
  const { say, locale } = useSay();
  const router = useRouter();
  const running = rows.some((d) => d.status === "analysing");
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [running, router]);
  const columns = useMemo<DataTableColumn<DocumentSummary>[]>(
    () => [
      {
        id: "title",
        header: say("library.columns.title"),
        sortable: true,
        card: "title",
        value: (d) => d.title,
        cell: (d) => (
          <span className="flex flex-col">
            <Link href={`/${locale}/app/documents/${d.id}`} className="font-semibold text-fg hover:text-fg-accent hover:underline" aria-label={say("library.open", { title: d.title })}>
              {d.title}
            </Link>
            <span className="text-xs text-fg-muted">
              {d.filename}
              {d.pages ? ` · ${say("library.pages", { count: d.pages })}` : ""}
              {!d.hasText ? ` · ${say("library.noText")}` : ""}
            </span>
          </span>
        ),
      },
      { id: "kind", header: say("library.columns.kind"), sortable: true, value: (d) => d.kind, cell: (d) => say(`kinds.${d.kind}`) },
      { id: "status", header: say("library.columns.status"), value: (d) => d.status, cell: (d) => <Badge tone={STATUS_TONE[d.status]}>{say(`statuses.${d.status}`)}</Badge> },
      { id: "size", header: say("library.columns.size"), sortable: true, align: "end", value: (d) => d.sizeBytes, cell: (d) => formatBytes(d.sizeBytes, locale) },
      { id: "added", header: say("library.columns.added"), sortable: true, align: "end", value: (d) => d.createdAt, cell: (d) => formatDate(d.createdAt, locale) },
      ...(organise
        ? [
            {
              id: "organise",
              header: say("organisation.title"),
              align: "end" as const,
              value: (d: DocumentSummary) => d.id,
              cell: (d: DocumentSummary) => (
                <span className="flex items-center justify-end gap-2">
                  <TagChips tags={organise.tagsByDocument[d.id] ?? []} />
                  <ItemMenu kind="document" id={d.id} name={d.title} collections={organise.collections} folders={organise.folders} collectionId={organise.collectionId} tags={organise.tags} current={(organise.tagsByDocument[d.id] ?? []).map((t) => t.id)} />
                </span>
              ),
            },
          ]
        : []),
    ],
    [say, locale, organise],
  );
  return <DataTable caption={caption ?? say("library.caption")} rows={rows} columns={columns} getRowId={(d) => d.id} rowLabel={(d) => d.title} defaultSort={{ column: "added", direction: "descending" }} />;
}
