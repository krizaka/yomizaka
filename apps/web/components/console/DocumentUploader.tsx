"use client";

import { krizakaFetch, useQuery } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Checkbox } from "@krizaka/ui/checkbox";
import { Dropzone, type FileRejection, UploadList, useUploadQueue } from "@krizaka/ui/file-upload";
import { type DocumentKind, type DocumentSummary, MAX_FILE_BYTES, STORAGE_MODE, STORAGE_MODES } from "@yomizaka/core";
import { useRouter } from "next/navigation";
import { type MutableRefObject, type ReactNode, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { useAppConfig } from "@/lib/app-config-client";
import { useSay } from "@/lib/i18n-client";
import { ROUTE_STATES } from "@/lib/route-state";
import { useRouteState } from "@/lib/use-route-state";

/** What the drop zone offers: PDF, text and photos. A HEIC is named by extension too (a browser often gives it no type). */
const ACCEPT = "application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/heic,image/heif,.pdf,.txt,.docx,.png,.jpg,.jpeg,.heic,.heif";
const isPhotoFile = (file: File) => /^image\/(png|jpeg|heic|heif)$/.test(file.type) || /\.(png|jpe?g|heic|heif)$/i.test(file.name);

export interface Placement {
  collectionId: string | null;
  folderId: string | null;
}

/** Sends one file to the BFF with its progress (XMLHttpRequest: fetch reports no upload progress), aborted on pause. */
function send(files: File[], kind: DocumentKind | "auto", placement: Placement | undefined, keep: boolean, signal: AbortSignal, onProgress: (sent: number) => void): Promise<{ document: DocumentSummary; duplicate: boolean }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status < 300 ? resolve(xhr.response) : reject(Object.assign(new Error(xhr.response?.code ?? "UNKNOWN"), { body: xhr.response })));
    xhr.onerror = () => reject(Object.assign(new Error("NETWORK"), { body: { code: "NETWORK" } }));
    signal.addEventListener("abort", () => xhr.abort());
    const body = new FormData();
    for (const file of files) body.append("file", file);
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
  // The owner's setting (ADR-0007): keeping may be switched off, or ticked by default; the person's own tick wins.
  const prefs = useQuery({ queryKey: ["storage-prefs"], queryFn: () => krizakaFetch("/api/me/storage", { schema: z.object({ settings: z.object({ mode: z.enum(STORAGE_MODES), keepDefault: z.boolean() }) }) }), throwOnError: false, retry: false });
  const app = useAppConfig();
  const keepOff = prefs.data?.settings.mode === STORAGE_MODE.none || app?.features.keepDocuments === false;
  // Not kept unless the owner's setting says so (the document is purged after its check, only the report stays); the choice is `?conserver=`.
  const [choice, setChoice] = useRouteState({ ...ROUTE_STATES.keepDocuments.state, fallback: prefs.data?.settings.keepDefault ? "1" : "0" });
  const keep = !keepOff && choice === "1";
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
        const result = await send([file], kindRef?.current ?? "auto", placement, keepRef.current, signal, onProgress);
        setNotices((n) => [say(result.duplicate ? "library.duplicate" : "library.uploaded", { name: file.name }), ...n].slice(0, 3));
        if (onUploaded) onUploaded(result.document);
        else router.refresh();
      } catch (error) {
        const code = (error as { body?: { code?: string } }).body?.code ?? "UNKNOWN";
        throw new Error(say(`errors.${code}`));
      }
    },
  });
  // Several photos dropped together are the pages of ONE document (the default; `?pages=0` keeps them apart).
  const [grouping, setGrouping] = useRouteState({ ...ROUTE_STATES.groupPhotos.state });
  const [groupNotice, setGroupNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [grouped, setGrouped] = useState(false);
  const onFiles = (files: File[]) => {
    const photos = files.filter(isPhotoFile);
    if (grouping !== "1" || photos.length < 2) return queue.add(files);
    queue.add(files.filter((f) => !isPhotoFile(f)));
    setGrouped(true);
    setGroupNotice(null);
    send(photos, kindRef?.current ?? "auto", placement, keepRef.current, new AbortController().signal, () => undefined)
      .then((result) => {
        setGroupNotice({ tone: "success", text: say("library.groupedUploaded", { count: photos.length }) });
        if (onUploaded) onUploaded(result.document);
        else router.refresh();
      })
      .catch((error: { body?: { code?: string } }) => setGroupNotice({ tone: "danger", text: say(`errors.${error.body?.code ?? "UNKNOWN"}`) }))
      .finally(() => setGrouped(false));
  };
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
          onCheckedChange={(v) => setChoice(v === true ? "1" : "0")}
        />
        <label htmlFor="keep-documents" className="flex cursor-pointer flex-col text-sm">
          <span className="font-semibold text-fg">{say("library.keep")}</span>
          <span className="text-fg-secondary">{say(keep ? "library.keepOn" : "library.keepOff")}</span>
        </label>
      </div>
      )}
      <div className="flex items-start gap-3" data-testid="group-photos">
        <Checkbox id="group-photos" checked={grouping === "1"} onCheckedChange={(v) => setGrouping(v === true ? "1" : "0")} />
        <label htmlFor="group-photos" className="flex cursor-pointer flex-col text-sm">
          <span className="font-semibold text-fg">{say("library.groupPhotos")}</span>
          <span className="text-fg-secondary">{say(grouping === "1" ? "library.groupPhotosOn" : "library.groupPhotosOff")}</span>
        </label>
      </div>
      <Dropzone title={say("library.dropTitle")} browseLabel={say("library.browse")} hint={say("library.hint")} accept={ACCEPT} maxSize={app?.maxFileBytes ?? MAX_FILE_BYTES} maxFiles={20} multiple onFiles={onFiles} refusalLabel={refusal} disabled={grouped} />
      <p className="m-0 text-xs text-fg-secondary">{say("library.photoNotice")}</p>
      {groupNotice ? <Alert tone={groupNotice.tone}>{groupNotice.text}</Alert> : null}
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
