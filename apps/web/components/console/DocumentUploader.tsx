"use client";

import { krizakaFetch, useQuery } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Checkbox } from "@krizaka/ui/checkbox";
import { Dropzone, type FileRejection, UploadList, useUploadQueue } from "@krizaka/ui/file-upload";
import { type DocumentKind, type DocumentSummary, MAX_FILE_BYTES, STORAGE_MODE, STORAGE_MODES } from "@yomizaka/core";
import { useRouter } from "next/navigation";
import { type MutableRefObject, type ReactNode, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { useSay } from "@/lib/i18n-client";

export interface Placement {
  collectionId: string | null;
  folderId: string | null;
}

/** Sends one file to the BFF with its progress (XMLHttpRequest: fetch reports no upload progress), aborted on pause. */
function send(file: File, kind: DocumentKind | "auto", placement: Placement | undefined, keep: boolean, signal: AbortSignal, onProgress: (sent: number) => void): Promise<{ document: DocumentSummary; duplicate: boolean }> {
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
    body.append("keep", String(keep));
    if (placement?.collectionId) body.append("collectionId", placement.collectionId);
    if (placement?.folderId) body.append("folderId", placement.folderId);
    xhr.send(body);
  });
}

/**
 * The drop zone and its queue (pause, resume, retry), shared by the library, a collection and « Check a document ». A file
 * dropped in a collection or a folder lands there (`placement`); `extra` draws what sits beside the zone (examples).
 */
export function DocumentUploader({ kindRef, placement, onUploaded, extra }: { kindRef?: MutableRefObject<DocumentKind | "auto">; placement?: Placement; onUploaded?: (document: DocumentSummary) => void; extra?: (add: (files: File[]) => void) => ReactNode }) {
  const { say, locale } = useSay();
  const router = useRouter();
  const [notices, setNotices] = useState<string[]>([]);
  // Not kept by default (the document is purged after its check, only the report stays): « conserver » is the person's choice.
  const [chosen, setChosen] = useState<boolean | null>(null);
  // The owner's setting (ADR-0007): keeping may be switched off, or ticked by default; the person's own tick wins.
  const prefs = useQuery({ queryKey: ["storage-prefs"], queryFn: () => krizakaFetch("/api/me/storage", { schema: z.object({ settings: z.object({ mode: z.enum(STORAGE_MODES), keepDefault: z.boolean() }) }) }) });
  const keepOff = prefs.data?.settings.mode === STORAGE_MODE.none;
  const keep = !keepOff && (chosen ?? prefs.data?.settings.keepDefault ?? false);
  const keepRef = useRef(keep);
  useEffect(() => {
    keepRef.current = keep;
  }, [keep]);
  const queue = useUploadQueue({
    previews: false,
    retries: 1,
    shouldRetry: (error) => (error as { body?: { code?: string } }).body?.code === "NETWORK",
    upload: async (file, { signal, onProgress }) => {
      try {
        const result = await send(file, kindRef?.current ?? "auto", placement, keepRef.current, signal, onProgress);
        setNotices((n) => [say(result.duplicate ? "library.duplicate" : "library.uploaded", { name: file.name }), ...n].slice(0, 3));
        if (onUploaded) onUploaded(result.document);
        else router.refresh();
      } catch (error) {
        const code = (error as { body?: { code?: string } }).body?.code ?? "UNKNOWN";
        throw new Error(say(`errors.${code}`));
      }
    },
  });
  const refusal = (r: FileRejection) => say(r.reason === "size" ? "library.refusedSize" : r.reason === "type" ? "library.refusedType" : "library.refusedCount", { name: r.file.name });
  return (
    <>
      {keepOff ? (
        <p className="m-0 text-sm text-fg-secondary" data-testid="keep-disabled">{say("library.keepDisabled")}</p>
      ) : (
      <div className="flex items-start gap-3" data-testid="keep-choice">
        <Checkbox
          id="keep-documents"
          checked={keep}
          onCheckedChange={(v) => setChosen(v === true)}
        />
        <label htmlFor="keep-documents" className="flex cursor-pointer flex-col text-sm">
          <span className="font-semibold text-fg">{say("library.keep")}</span>
          <span className="text-fg-secondary">{say(keep ? "library.keepOn" : "library.keepOff")}</span>
        </label>
      </div>
      )}
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
            status: (st) => say(`upload.${st}`),
          }}
        />
      ) : null}
      {notices.map((n) => (
        <Alert key={n} tone="success">
          {n}
        </Alert>
      ))}
      {extra?.(queue.add)}
    </>
  );
}
