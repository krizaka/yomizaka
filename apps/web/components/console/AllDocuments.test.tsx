import { KrizakaQueryProvider } from "@krizaka/query";
import type { DocumentSummary } from "@yomizaka/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { AllDocuments } from "./AllDocuments";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {}, replace() {}, refresh() {} }), usePathname: () => "/fr/app/documents", useSearchParams: () => new URLSearchParams("") }));

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const wrap = (node: React.ReactNode, locale: "en" | "fr" = "fr") => renderToStaticMarkup(<I18nProvider locale={locale} messages={MESSAGES[locale] as never}><KrizakaQueryProvider>{node}</KrizakaQueryProvider></I18nProvider>);
const doc = (n: number): DocumentSummary => ({ id: `d${n}`, title: `Bail ${n}`, filename: `bail-${n}.pdf`, mimeType: "application/pdf", kind: "lease", sizeBytes: 1000, pages: 1, hasText: true, status: "checked", createdAt: "2026-10-20T12:00:00.000Z" });

describe("« Documents » (B2, P14)", () => {
  it("lists every document with a link to its page, under one h1", () => {
    const html = wrap(<AllDocuments documents={[doc(1), doc(2)]} />);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain(fr.console.documentsPage.title);
    expect(html).toContain('href="/fr/app/documents/d1"');
    expect(html).toContain('href="/fr/app/documents/d2"');
  });
  it("says so with the owl and one action when there is none yet", () => {
    const html = wrap(<AllDocuments documents={[]} />, "en");
    expect(html).toContain('data-testid="documents-empty"');
    expect(html).toContain(en.console.documentsPage.empty);
    expect(html).toContain('href="/en/app/check"');
  });
});
