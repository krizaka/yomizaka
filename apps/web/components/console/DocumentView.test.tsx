import { KrizakaQueryProvider } from "@krizaka/query";
import { SEEDED_INPUTS } from "@yomizaka/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { DocumentView } from "./DocumentView";

const nav = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {}, replace() {} }), usePathname: () => "/fr/app/documents/d1/rapport", useSearchParams: () => new URLSearchParams(nav.search) }));

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const readable = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");

/** A finished compliance check, as Orazaka returns it — or as the demo seed wrote it (`inputs.seeded`). */
const check = (inputs: Record<string, string>, id = "a1") => ({
  id,
  studio: "compliance-check",
  status: "succeeded",
  runId: inputs.seeded ? "seeded-bail-rosemont-5-clause-illegale" : "run_8f3a2c",
  blueprintVersion: inputs.seeded ? null : "1.4.0",
  inputs,
  report: {
    rulesetId: "qc-residential-lease",
    rulesetVersion: "2026-06-20",
    jurisdiction: "QC",
    asOf: "2026-10-23",
    summary: { byVerdict: { FAIL: 1, PASS: 1 }, blockingFailures: 1, rulesEvaluated: 2 },
    findings: [
      { ruleId: "QC-LEASE-001", title: "Durée du bail", severity: "INFO", verdict: "PASS", explanation: "Douze mois.", method: "DETERMINISTIC" },
      { ruleId: "QC-LEASE-004", title: "Dépôt de garantie interdit", severity: "BLOCKING", verdict: "FAIL", explanation: "Le bail exige un dépôt.", evidenceSpan: { quote: "dépôt de sécurité de 1 450 $" }, method: "DETERMINISTIC", citation: "C.c.Q., art. 1904" },
    ],
  },
  error: null,
  createdAt: "2026-10-23T12:00:00.000Z",
  finishedAt: "2026-10-23T12:00:04.000Z",
});
const insight = { understanding: { nature: { id: "lease", label: { fr: "Bail de logement", en: "Residential lease" }, confidence: "high", score: 0.9 }, alternative: null, language: "fr", pages: 1, issuer: null, dates: [], parties: [{ role: "landlord", name: "Mathis Imaginaire-Roy" }, { role: "tenant", name: "Camille Fictif-Beaulieu" }], references: [], amounts: [{ kind: "rent", cents: 145000, text: "1 450,00 $" }, { kind: "rent", cents: 145000, text: "1 450,00 $" }], check: { studio: "compliance-check", documentType: "lease", ruleset: null }, authenticity: true, needsModel: false }, pii: { total: 0, counts: {} } };
const document = (analyses: unknown[], extra: Record<string, unknown> = {}) => ({
  id: "d1",
  title: "bail-rosemont-5",
  filename: "bail-rosemont-5.pdf",
  mimeType: "application/pdf",
  kind: "lease",
  sizeBytes: 3000,
  pages: 1,
  hasText: true,
  status: "attention",
  createdAt: "2026-10-23T11:59:00.000Z",
  sha256: "a".repeat(64),
  text: "BAIL DE LOGEMENT … dépôt de sécurité de 1 450 $ …",
  analyses,
  storage: { kind: "database", endpoint: null, region: "ca", residency: "canada", encrypted: true, owner: "krizaka", devOnly: false },
  retainUntil: null,
  purged: false,
  insight,
  ...extra,
});
const render = (doc: ReturnType<typeof document>, tab: "rapport" | "document" | "historique" = "rapport", locale: "en" | "fr" = "fr") =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
      <KrizakaQueryProvider>
        <DocumentView initial={doc as never} tab={tab} perspective="landlord" offer={{ studios: ["compliance-check", "document-authenticity"], jurisdictions: ["QC"], rulesets: [] }} />
      </KrizakaQueryProvider>
    </I18nProvider>,
  );

describe("the document on DetailLayout (the UX review's Y5)", () => {
  it("names the document by what the insight knows — never the filename as the title — with one h1, its status, and the filename as the eyebrow", () => {
    nav.search = "";
    const html = render(document([check({ jurisdiction: "QC" })]));
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    const text = readable(html);
    expect(text).toContain("Bail de logement — Camille Fictif-Beaulieu");
    expect(html).not.toMatch(/<h1[^>]*>[^<]*bail-rosemont-5/);
    expect(text).toContain("bail-rosemont-5.pdf");
    expect(text).toContain("À regarder");
  });

  it("the report tab says the verdict first, the findings with what failed first, the engine's facts folded — the run id once on the face", () => {
    const html = render(document([check({ jurisdiction: "QC" })]));
    const band = html.indexOf('data-testid="verdict-band"');
    const findings = html.indexOf('data-testid="finding-list"');
    const technical = html.indexOf('data-testid="technical-details"');
    expect(band).toBeGreaterThan(0);
    expect(findings).toBeGreaterThan(band);
    expect(technical).toBeGreaterThan(findings);
    const text = readable(html);
    expect(text).toContain("1 point à regarder");
    expect(text.indexOf("Dépôt de garantie interdit")).toBeLessThan(text.indexOf("Durée du bail"));
    expect(html.match(/run_8f3a2c/g)).toHaveLength(1);
    expect(text).not.toContain("BLOCKING");
  });

  it("offers the signed report as the one primary action and the sharing in the side panel for a real check; neither for a seeded one, which says so", () => {
    const real = render(document([check({ jurisdiction: "QC" })]));
    expect(real).toContain('data-testid="report-download"');
    expect(real).toContain('data-testid="report-aside"');
    const seeded = render(document([check({ ...SEEDED_INPUTS })]));
    expect(seeded).not.toContain('data-testid="report-download"');
    expect(seeded).not.toContain('data-testid="report-aside"');
    expect(readable(seeded)).toContain(fr.console.analysis.seededNote);
  });

  it("the tabs are routes — Rapport · Document, and Historique only once a second run exists", () => {
    const one = render(document([check({ jurisdiction: "QC" })]));
    expect(one).toContain('href="/fr/app/documents/d1/rapport"');
    expect(one).toContain('href="/fr/app/documents/d1/document"');
    expect(one).not.toContain('href="/fr/app/documents/d1/historique"');
    const two = render(document([check({ jurisdiction: "QC" }), check({ jurisdiction: "QC" }, "a0")]), "historique");
    expect(two).toContain('href="/fr/app/documents/d1/historique"');
    expect(two).toContain('data-testid="tab-historique"');
    expect(readable(two)).toContain(fr.console.reportFace.history);
  });

  it("the document tab holds the file's text, what Yomizaka read — each kind of amount once —, where it lives, and the file facts", () => {
    const html = render(document([check({ jurisdiction: "QC" })]), "document");
    expect(html).toContain('data-testid="tab-document"');
    expect(html).toContain('data-testid="document-insight"');
    expect(html).toContain('data-testid="document-storage"');
    expect((readable(html).match(/Loyer/g) ?? []).length).toBe(1);
    expect(readable(html)).toContain("bail-rosemont-5.pdf");
  });

  it("« Voir dans le fichier » carries the finding in the address: the document tab names it, and leads back to the report", () => {
    nav.search = "finding=QC-LEASE-004";
    const html = render(document([check({ jurisdiction: "QC" })]), "document");
    expect(html).toContain('data-testid="finding-place"');
    expect(readable(html)).toContain("Dépôt de garantie interdit");
    expect(html).toContain('href="/fr/app/documents/d1/rapport"');
    expect(readable(html)).toContain(fr.console.reportFace.backToReport);
    nav.search = "";
    expect(render(document([check({ jurisdiction: "QC" })]), "document")).not.toContain('data-testid="finding-place"');
  });

  it("with no check yet: the report tab says so and offers the checks; a refusal carried in the address is said above the form", () => {
    nav.search = "";
    const none = render(document([]));
    expect(readable(none)).toContain(fr.console.reportFace.notChecked);
    expect(none).not.toContain('data-testid="verdict-band"');
    expect(readable(none)).toContain(fr.console.analysis.complianceTitle);
    nav.search = "refused=RATE_LIMITED";
    expect(readable(render(document([])))).toContain(fr.console.errors.RATE_LIMITED ?? fr.console.errors.UNKNOWN);
    nav.search = "";
    expect(readable(render(document([]), "rapport", "en"))).toContain(en.console.reportFace.notChecked);
  });
});
