"use client";

import { krizakaFetch, useQuery, useQueryClient } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { EmptyState } from "@krizaka/ui/empty-state";
import { Dropzone, type FileRejection, UploadList, useUploadQueue } from "@krizaka/ui/file-upload";
import { Mascot } from "@krizaka/ui/mascots";
import { RadioGroup } from "@krizaka/ui/radio-group";
import { type Audience, DOCUMENT_KINDS, type DocumentKind, type DocumentSummary, documentSummary, MAX_FILE_BYTES, queryKeys } from "@yomizaka/core";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { z } from "zod";

import { useSay } from "@/lib/i18n-client";

import { formatBytes, formatDate } from "./format";
import { PerspectiveChooser } from "./PerspectiveChooser";

export const STATUS_TONE = { stored: "neutral", analysing: "accent", checked: "success", attention: "warning", failed: "danger" } as const;

/** Sends one file to the BFF with its progress (XMLHttpRequest: fetch reports no upload progress), aborted on pause. */
function send(file: File, kind: DocumentKind | "auto", signal: AbortSignal, onProgress: (sent: number) => void): Promise<{ document: DocumentSummary; duplicate: boolean }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status < 300 ? resolve(xhr.response) : reject(Object.assign(new Error(xhr.response?.code ?? "UNKNOWN"), { body: xhr.response })));
    xhr.onerror = () => reject(Object.assign(new Error("NETWORK"), { body: { code: "NETWORK" } }));
    signal.addEventListener("abort", () => xhr.abort());
    const body = new FormData();
    body.append("file", file);
    body.append("kind", kind);
    xhr.send(body);
  });
}

/** The library: drop files (a queue that pauses, resumes and retries), then every document with its state. */
export function LibraryView({ initial, perspective = null, audiences, screening = false }: { initial: DocumentSummary[]; perspective?: Audience | null; audiences: readonly { audience: Audience; status: "available" | "soon" }[]; screening?: boolean }) {
  const { say, locale } = useSay();
  const client = useQueryClient();
  const [kind, setKind] = useState<DocumentKind | "auto">("auto");
  const kindRef = useRef(kind);
  const [notices, setNotices] = useState<string[]>([]);
  const documents = useQuery({
    queryKey: queryKeys.documents(),
    queryFn: () => krizakaFetch("/api/documents", { schema: z.object({ documents: z.array(documentSummary) }) }).then((r) => r.documents),
    initialData: initial,
    refetchInterval: (q) => (q.state.data?.some((d) => d.status === "analysing") ? 4000 : false),
  });
  const queue = useUploadQueue({
    previews: false,
    retries: 1,
    shouldRetry: (error) => (error as { body?: { code?: string } }).body?.code === "NETWORK",
    upload: async (file, { signal, onProgress }) => {
      try {
        const result = await send(file, kindRef.current, signal, onProgress);
        setNotices((n) => [say(result.duplicate ? "library.duplicate" : "library.uploaded", { name: file.name }), ...n].slice(0, 3));
        await client.invalidateQueries({ queryKey: queryKeys.documents() });
      } catch (error) {
        const code = (error as { body?: { code?: string } }).body?.code ?? "UNKNOWN";
        throw new Error(say(`errors.${code}`));
      }
    },
  });
  const refusal = (r: FileRejection) => say(r.reason === "size" ? "library.refusedSize" : r.reason === "type" ? "library.refusedType" : "library.refusedCount", { name: r.file.name });
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
    ],
    [say, locale],
  );
  const rows = documents.data ?? [];
  return (
    <div className="flex flex-col gap-6">
      {perspective === null ? <PerspectiveChooser current={null} audiences={audiences} onboarding /> : (
        <p className="text-right text-xs text-fg-muted">
          <Link className="underline" href={`/${locale}/app/settings`}>{say("profile.open")}</Link>
        </p>
      )}
      {screening ? (
        <p className="m-0 text-sm">
          <Link className="font-semibold text-fg-accent underline" href={`/${locale}/app/screening`}>
            {say("library.screening")}
          </Link>
        </p>
      ) : null}
      <section className="flex flex-col gap-3" aria-label={say("library.dropTitle")}>
        <RadioGroup.Root variant="segmented" label={say("library.kindLabel")} value={kind} onValueChange={(v: string) => {
            kindRef.current = v as DocumentKind | "auto";
            setKind(v as DocumentKind | "auto");
          }}>
          {(["auto", ...DOCUMENT_KINDS] as const).map((k) => (
            <RadioGroup.Segment key={k} value={k}>
              {say(`kinds.${k}`)}
            </RadioGroup.Segment>
          ))}
        </RadioGroup.Root>
        <Dropzone title={say("library.dropTitle")} browseLabel={say("library.browse")} hint={say("library.hint")} accept="application/pdf,text/plain,.pdf,.txt" maxSize={MAX_FILE_BYTES} maxFiles={20} multiple onFiles={queue.add} refusalLabel={refusal} />
        {queue.items.length > 0 ? (
          <UploadList
            items={queue.items}
            locale={locale}
            onPause={queue.pause}
            onResume={queue.resume}
            onCancel={queue.cancel}
            onRemove={queue.remove}
            onRetry={queue.retry}
            labels={{
              list: say("library.dropTitle"),
              pause: (n) => `${say("upload.pause")} ${n}`,
              resume: (n) => `${say("upload.resume")} ${n}`,
              retry: (n) => `${say("upload.retry")} ${n}`,
              cancel: (n) => `${say("upload.cancel")} ${n}`,
              remove: (n) => `${say("upload.remove")} ${n}`,
              status: (s) => say(`upload.${s}`),
            }}
          />
        ) : null}
        {notices.map((n) => (
          <Alert key={n} tone="success">
            {n}
          </Alert>
        ))}
      </section>
      <DataTable
        caption={say("library.caption")}
        rows={rows}
        columns={columns}
        getRowId={(d) => d.id}
        rowLabel={(d) => d.title}
        defaultSort={{ column: "added", direction: "descending" }}
        loading={documents.isLoading}
        empty={
          <EmptyState icon={<Mascot bird="owl" mood="empty" size={88} />} title={say("library.emptyTitle")} description={say("library.emptyText")} />
        }
      />
    </div>
  );
}
