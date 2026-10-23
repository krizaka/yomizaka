import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { queueItemsOf, UploadTray } from "./LibraryDrop";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {}, replace() {} }) }));

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const readable = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");
const say = (key: string, vars?: Record<string, string | number>) => {
  const words = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], fr.console) as string;
  return Object.entries(vars ?? {}).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), words ?? key);
};
const item = (id: string, status: "queued" | "uploading" | "paused" | "done" | "error", patch: Record<string, unknown> = {}) => ({ id, name: `${id}.pdf`, size: 10, progress: 0.5, status, ...patch });

describe("drop anywhere on the library (the review's B4): the tray follows the queue", () => {
  it("maps each file to a row: the state in words, the progress while it sends, a retry once it failed", () => {
    const retry = vi.fn();
    const rows = queueItemsOf([item("a", "queued"), item("b", "uploading"), item("c", "paused"), item("d", "done"), item("e", "error", { error: "Trop lourd" })], say, retry);
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
    expect(readable(render(queueItemsOf([item("a", "error", { error: "x" })], say), "en"))).toContain("0 in progress · 0 done · 1 failed");
    expect(render([])).toBe("");
  });
});
