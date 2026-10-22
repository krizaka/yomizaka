"use client";

import { krizakaFetch, useQuery, useQueryClient } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { Dropzone, type FileRejection, UploadList, useUploadQueue } from "@krizaka/ui/file-upload";
import { Mascot } from "@krizaka/ui/mascots";
import { RadioGroup } from "@krizaka/ui/radio-group";
import { type Audience, DOCUMENT_KINDS, type DocumentKind, type DocumentSummary, documentSummary, MAX_FILE_BYTES, queryKeys } from "@yomizaka/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { z } from "zod";

import { useSay } from "@/lib/i18n-client";
import { libraryScreen } from "@/lib/library-screen";

import { formatBytes, formatDate } from "./format";

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
export type ExampleDocuments = Record<"tenant" | "landlord", { title: string; filename: string; text: string }>;

export function LibraryView({ initial, mode = "library", perspective = null, screening = false, examples }: { mode?: "library" | "check"; initial: DocumentSummary[]; perspective?: Audience | null; screening?: boolean; examples?: ExampleDocuments }) {
  const { say, locale } = useSay();
  const client = useQueryClient();
  const router = useRouter();
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
        // « Check a document »: the new document opens on what it is (its information tab).
        if (mode === "check") router.push(`/${locale}/app/documents/${result.document.id}/infos`);
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
  const screen = libraryScreen({ documents: rows.length, screening });
  const uploads = (
    <>
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
    </>
  );
  if (mode === "check") {
    return (
      <section className="flex max-w-3xl flex-col gap-3" aria-label={say("library.dropTitle")}>
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
        {uploads}
      </section>
    );
  }
  const order = (perspective === "landlord" ? ["landlord", "tenant"] : ["tenant", "landlord"]) as ("tenant" | "landlord")[];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-end gap-3" data-testid="library-actions">
        {screen.secondary ? (
          <Button asChild variant="secondary" size="md">
            <Link href={`/${locale}${screen.secondary}`}>{say("library.screeningCta")}</Link>
          </Button>
        ) : null}
        <Button asChild variant="primary" size="md">
          <Link href={`/${locale}${screen.primary}`}>{say("library.checkCta")}</Link>
        </Button>
      </div>
      {screen.table ? (
        <DataTable
          caption={say("library.caption")}
          rows={rows}
          columns={columns}
          getRowId={(d) => d.id}
          rowLabel={(d) => d.title}
          defaultSort={{ column: "added", direction: "descending" }}
          loading={documents.isLoading}
        />
      ) : (
        <section className="mx-auto flex w-full max-w-3xl flex-col gap-4" aria-label={say("library.emptyTitle")} data-testid="library-empty">
          <div className="flex flex-col items-center gap-2 text-center">
            <Mascot bird="owl" mood="empty" size={176} />
            <h2 className="m-0 font-display text-xl font-bold text-fg">{say("library.emptyTitle")}</h2>
            <p className="m-0 max-w-xl text-sm text-fg-secondary">{say("library.emptyText")}</p>
          </div>
          {uploads}
          {examples ? (
            <div className="flex flex-col gap-3 pt-2" data-testid="library-examples">
              <h3 className="m-0 text-sm font-semibold text-fg">{say("library.examplesTitle")}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {order.map((role) => (
                  <Card.Root key={role} className="flex flex-col gap-2 p-4">
                    <span className="font-semibold text-fg">{say(role === "tenant" ? "library.exampleTenant" : "library.exampleLandlord")}</span>
                    <span className="text-sm text-fg-secondary">{say(role === "tenant" ? "library.exampleTenantHint" : "library.exampleLandlordHint")}</span>
                    <div>
                      <Button variant="secondary" size="sm" onClick={() => queue.add([new File([examples[role].text], examples[role].filename, { type: "text/plain" })])}>
                        {say("library.tryExample")}
                      </Button>
                    </div>
                  </Card.Root>
                ))}
              </div>
              <p className="m-0 text-xs text-fg-muted">{say("library.examplesNote")}</p>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
