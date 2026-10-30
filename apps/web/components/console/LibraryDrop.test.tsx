import { readFileSync } from "node:fs";

import { KrizakaQueryProvider } from "@krizaka/query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { AddFilesButton, bundlePhotos, DropZone, LibraryDrop, queueItemsOf, UploadTray } from "./LibraryDrop";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {}, replace() {} }) }));

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const readable = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ");
const say = (key: string, vars?: Record<string, string | number>) => {
  const words = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], fr.console) as string;
  return Object.entries(vars ?? {}).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), words ?? key);
};
const item = (
  id: string,
  status: "queued" | "uploading" | "paused" | "done" | "error",
  patch: Record<string, unknown> = {},
) => ({ id, name: `${id}.pdf`, size: 10, progress: 0.5, status, ...patch });

describe("drop anywhere on the library (the review's B4): the tray follows the queue", () => {
  it("maps each file to a row: the state in words, the progress while it sends, a retry once it failed", () => {
    const retry = vi.fn();
    const rows = queueItemsOf(
      [
        item("a", "queued"),
        item("b", "uploading"),
        item("c", "paused"),
        item("d", "done"),
        item("e", "error", { error: "Trop lourd" }),
      ],
      say,
      retry,
    );
    expect(rows.map((r) => r.status)).toEqual(["queued", "reading", "queued", "done", "failed"]);
    expect(rows.map((r) => r.progress)).toEqual([undefined, 0.5, undefined, undefined, undefined]);
    expect(rows[1]!.statusText).toBe(fr.console.upload.uploading);
    expect(rows[4]!.statusText).toBe("Trop lourd");
    expect(rows.filter((r) => r.trailing)).toHaveLength(1);
    const retryButton = renderToStaticMarkup(<>{rows[4]!.trailing}</>);
    expect(readable(retryButton)).toContain(fr.console.upload.retry);
  });

  it("the tray says how many are in progress and done, lists the files, and is absent while the queue is empty", () => {
    const render = (rows: ReturnType<typeof queueItemsOf>, locale: "en" | "fr" = "fr") =>
      renderToStaticMarkup(
        <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
          <UploadTray items={rows} />
        </I18nProvider>,
      );
    const html = render(queueItemsOf([item("a", "uploading"), item("b", "done"), item("c", "done")], say));
    expect(html).toContain('data-testid="upload-tray"');
    const text = readable(html);
    expect(text).toContain("Vérifications en cours");
    expect(text).toContain("1 en cours · 2 terminées");
    expect(text).toContain("a.pdf");
    expect(text).not.toContain("en échec");
    expect(readable(render(queueItemsOf([item("a", "error", { error: "x" })], say), "en"))).toContain(
      "0 in progress · 0 done · 1 failed",
    );
    expect(render([])).toBe("");
  });

  it("several photos dropped together are the pages of one document: the first carries the group, the other files go one by one, the tray says so", () => {
    const f = (name: string, type: string) => new File(["x"], name, { type });
    const one = bundlePhotos([f("a.pdf", "application/pdf"), f("p1.jpg", "image/jpeg")]);
    expect(one.queued.map((x) => x.name)).toEqual(["a.pdf", "p1.jpg"]);
    expect(one.groups.size).toBe(0);
    const many = bundlePhotos([
      f("p1.jpg", "image/jpeg"),
      f("a.pdf", "application/pdf"),
      f("p2.heic", "image/heic"),
      f("p3.png", "image/png"),
    ]);
    expect(many.queued.map((x) => x.name)).toEqual(["a.pdf", "p1.jpg"]);
    expect([...many.groups.keys()].map((x) => x.name)).toEqual(["p1.jpg"]);
    expect([...many.groups.values()][0]!.map((x) => x.name)).toEqual(["p1.jpg", "p2.heic", "p3.png"]);
    const rows = queueItemsOf([item("p1", "uploading"), item("a", "queued")], say, undefined, new Map([["p1.pdf", 3]]));
    expect(rows[0]!.name).toBe("p1.pdf et 2 autres photos, un seul document");
    expect(rows[1]!.name).toBe("a.pdf");
    expect(readFileSync(new URL("./LibraryDrop.tsx", import.meta.url), "utf8")).toContain(
      "send(GROUPS.get(file) ?? [file]",
    );
  });

  it("a place wraps its page in the island: the header's picker button and the zone where the page wants it — nothing outside one (the review's Y7)", () => {
    const wrap = (node: React.ReactNode) =>
      renderToStaticMarkup(
        <I18nProvider locale="fr" messages={MESSAGES.fr as never}>
          <KrizakaQueryProvider>{node}</KrizakaQueryProvider>
        </I18nProvider>,
      );
    expect(wrap(<AddFilesButton>Ajouter</AddFilesButton>)).toBe("");
    expect(wrap(<DropZone />)).toBe("");
    const html = wrap(
      <LibraryDrop placement={{ collectionId: "c1", folderId: null }}>
        <AddFilesButton>Ajouter des documents</AddFilesButton>
        <DropZone />
      </LibraryDrop>,
    );
    expect(html).toContain('data-testid="add-files"');
    expect(html).toContain('type="file"');
    expect(html).toContain('data-testid="library-dropzone"');
    expect(html.match(/data-testid="library-dropzone"/g)).toHaveLength(1);
    // The dropped files go to the place: the placement reaches `send`.
    expect(readFileSync(new URL("./LibraryDrop.tsx", import.meta.url), "utf8")).toContain(
      'send(GROUPS.get(file) ?? [file], "auto", placement, keep, signal, onProgress)',
    );
  });
});
