"use client";

import { Badge } from "@krizaka/ui/badge";
import { DataTable, type DataTableColumn, DataTableFilters, type DataTableFilterState, type DataTableSort } from "@krizaka/ui/data-table";
import { useRouteState as useUrlState } from "@krizaka/ui/router";
import { DOCUMENT_KINDS, DOCUMENT_STATUSES, type DocumentSummary } from "@yomizaka/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { useSay } from "@/lib/i18n-client";
import { PAGE_SIZES, pageOf, pageSizeOf, parseList, sortOf, sortParam, TABLE_DEFAULTS } from "@/lib/table-state";

import { formatBytes, formatDate } from "./format";
import { ItemMenu, type Option, type TagOption } from "./OrganisationActions";
import { tableLabels } from "./table-labels";
import { TagChips } from "./TagChips";

/** What the row menu needs to move and tag a document: the destinations, the owner's tags and each document's own. */
export interface Organise {
  collections: Option[];
  folders: Option[];
  collectionId: string | null;
  tags: TagOption[];
  tagsByDocument: Record<string, TagOption[]>;
}

/** The columns the table sorts by (and the address may name). */
const SORTABLE = ["title", "kind", "size", "added"] as const;

export const STATUS_TONE = { stored: "neutral", analysing: "accent", checked: "success", attention: "warning", failed: "danger" } as const;

/** Which columns stay in a narrow row: 1 always; 3 leaves a phone's card (title and result only, the review's B5) for the row's detail. */
export const DOCUMENT_COLUMN_PRIORITY = { title: 1, kind: 3, status: 1, size: 3, added: 3 } as const;

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
        filter: "text",
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
      { id: "kind", header: say("library.columns.kind"), priority: DOCUMENT_COLUMN_PRIORITY.kind, sortable: true, filter: "facet", options: DOCUMENT_KINDS.map((k) => ({ value: k, label: say(`kinds.${k}`) })), value: (d) => d.kind, cell: (d) => say(`kinds.${d.kind}`) },
      { id: "status", header: say("library.columns.status"), type: "status", filter: "facet", options: DOCUMENT_STATUSES.map((k) => ({ value: k, label: say(`statuses.${k}`) })), value: (d) => d.status, cell: (d) => <Badge tone={STATUS_TONE[d.status]}>{say(`statuses.${d.status}`)}</Badge> },
      { id: "size", header: say("library.columns.size"), priority: DOCUMENT_COLUMN_PRIORITY.size, sortable: true, align: "end", value: (d) => d.sizeBytes, cell: (d) => formatBytes(d.sizeBytes, locale) },
      { id: "added", header: say("library.columns.added"), priority: DOCUMENT_COLUMN_PRIORITY.added, sortable: true, align: "end", value: (d) => d.createdAt, cell: (d) => formatDate(d.createdAt, locale) },
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
  // The state is the address: ?q= (search in the title) &kind= &status= (filters) &page= &size= &sort= — a refresh, a shared link and the back button restore it.
  const [q, setQ] = useUrlState<string>("q", { default: TABLE_DEFAULTS.q, history: "replace" });
  const [kind, setKind] = useUrlState<string>("kind", { default: "" });
  const [status, setStatus] = useUrlState<string>("status", { default: "" });
  const [page, setPage] = useUrlState<string>("page", { default: TABLE_DEFAULTS.page });
  const [size, setSize] = useUrlState<string>("size", { values: PAGE_SIZES.map(String), default: TABLE_DEFAULTS.size });
  const [sortRaw, setSort] = useUrlState<string>("sort", { default: TABLE_DEFAULTS.sort });
  const filters: DataTableFilterState = Object.fromEntries([q ? (['title', q] as const) : null, kind ? (['kind', parseList(kind, DOCUMENT_KINDS)] as const) : null, status ? (['status', parseList(status, DOCUMENT_STATUSES)] as const) : null].filter((e) => e !== null));
  const onFiltersChange = (next: DataTableFilterState) => {
    setQ(typeof next.title === "string" ? next.title : "");
    setKind(Array.isArray(next.kind) ? next.kind.join(",") : "");
    setStatus(Array.isArray(next.status) ? next.status.join(",") : "");
    setPage(TABLE_DEFAULTS.page);
  };
  const labels = useMemo(() => tableLabels(say), [say]);
  const sort = sortOf(sortRaw, SORTABLE);
  return (
    <DataTable
      caption={caption ?? say("library.caption")}
      rows={rows}
      columns={columns}
      getRowId={(d) => d.id}
      rowLabel={(d) => d.title}
      sort={sort}
      onSortChange={(next: DataTableSort) => setSort(sortParam(next))}
      filters={filters}
      onFiltersChange={onFiltersChange}
      page={pageOf(page)}
      onPageChange={(n) => setPage(String(n))}
      pageSize={pageSizeOf(size)}
      pageSizeOptions={PAGE_SIZES}
      onPageSizeChange={(n) => {
        setSize(String(n));
        setPage(TABLE_DEFAULTS.page);
      }}
      toolbar={<DataTableFilters />}
      labels={labels}
    />
  );
}
