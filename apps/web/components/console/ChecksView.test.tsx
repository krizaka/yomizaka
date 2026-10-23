import { KrizakaQueryProvider } from "@krizaka/query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CheckSummary } from "@/lib/checks";
import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { ChecksView } from "./ChecksView";

const nav = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {}, replace() {}, refresh() {} }), usePathname: () => "/fr/app/verifications", useSearchParams: () => new URLSearchParams(nav.search) }));

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const readable = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");
const check = (n: number, result: CheckSummary["result"], patch: Partial<CheckSummary> = {}): CheckSummary => ({ id: `a${n}`, documentId: `d${n}`, title: `Bail — Rosemont, logement ${n}`, kind: "lease", studio: "compliance-check", result, runId: `run_${n}`, at: `2026-10-2${n}T12:00:00.000Z`, ...patch });
const render = (props: { checks: CheckSummary[]; batches: boolean }, locale: "en" | "fr" = "fr") =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
      <KrizakaQueryProvider>
        <ChecksView {...props} />
      </KrizakaQueryProvider>
    </I18nProvider>,
  );

describe("the Vérifications destination (the UX review's § 4.1)", () => {
  it("has one h1, and lists every check with its document (a link to its report), its result and its run", () => {
    nav.search = "";
    const html = render({ checks: [check(1, "attention"), check(2, "checked", { runId: "seeded-bail-2" })], batches: false });
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    const text = readable(html);
    expect(text).toContain("Vérifications");
    expect(html).toContain('href="/fr/app/documents/d1/verifications"');
    expect(text).toContain("Bail — Rosemont, logement 1");
    expect(text).toContain("À regarder");
    expect(text).toContain("Vérifié");
    expect(text).toContain("seeded-bail-2");
    expect(readable(render({ checks: [check(1, "attention")], batches: false }, "en"))).toContain("To look at");
  });

  it("with nothing checked yet: the owl, the words, and the one action to the task page", () => {
    nav.search = "";
    const html = render({ checks: [], batches: false });
    expect(html).toContain('data-testid="checks-empty"');
    expect(readable(html)).toContain(fr.console.checks.empty.title);
    expect(html).toContain('href="/fr/app/verifier"');
    expect(html).not.toContain(fr.console.checks.tabs.lots);
  });

  it("with batches on: two tabs as routes, « Lots » read from the address, and the import action on the list", () => {
    nav.search = "";
    const list = render({ checks: [check(1, "checked")], batches: true });
    expect(list).toMatch(/<a (?=[^>]*href="\/fr\/app\/verifications")(?=[^>]*aria-current="page")[^>]*>/);
    expect(list).toMatch(/<a (?=[^>]*href="\/fr\/app\/verifications\?tab=lots")(?![^>]*aria-current)[^>]*>/);
    expect(list).toContain('href="/fr/app/verifications?tab=lots"');
    expect(readable(list)).toContain(fr.console.checks.import);
    nav.search = "tab=lots";
    const lots = render({ checks: [check(1, "checked")], batches: true });
    expect(lots).toMatch(/<a (?=[^>]*href="\/fr\/app\/verifications\?tab=lots")(?=[^>]*aria-current="page")[^>]*>/);
    expect(lots).toMatch(/<a (?=[^>]*href="\/fr\/app\/verifications")(?![^>]*aria-current)[^>]*>/);
    expect(readable(lots)).toContain(fr.console.batch.title);
    expect(readable(lots)).not.toContain("Bail — Rosemont, logement 1");
    expect(lots.match(/<h1\b/g)).toHaveLength(1);
  });
});

describe("the list's filters, in the address (the UX review's § 4.4, Y6)", () => {
  it("shows a FilterBar with the result and kind menus and the count of results, not on the batches tab", () => {
    nav.search = "";
    const html = render({ checks: [check(1, "attention"), check(2, "checked")], batches: true });
    expect(html).toContain('aria-label="Filtrer les vérifications"');
    expect(readable(html)).toContain("2 résultats");
    expect(readable(html)).toContain("Résultat");
    nav.search = "tab=lots";
    expect(render({ checks: [check(1, "attention")], batches: true })).not.toContain("Filtrer les vérifications");
  });

  it("filters the rows from the address: the result, the kind and the words", () => {
    nav.search = "result=attention";
    const byResult = readable(render({ checks: [check(1, "attention"), check(2, "checked")], batches: false }));
    expect(byResult).toContain("Bail — Rosemont, logement 1");
    expect(byResult).not.toContain("Bail — Rosemont, logement 2");
    expect(byResult).toContain("1 résultat");

    nav.search = "kind=invoice";
    const byKind = readable(render({ checks: [check(1, "attention"), check(2, "checked", { kind: "invoice", title: "Facture Plomberie Roy" })], batches: false }));
    expect(byKind).toContain("Facture Plomberie Roy");
    expect(byKind).not.toContain("Bail — Rosemont, logement 1");

    nav.search = "q=logement%202";
    const byWords = readable(render({ checks: [check(1, "attention"), check(2, "checked")], batches: false }));
    expect(byWords).toContain("logement 2");
    expect(byWords).not.toContain("logement 1");
    expect(byWords).toContain("Chercher un document: logement 2");
  });

  it("with filters that match nothing: the owl says so, and offers to clear them", () => {
    nav.search = "result=failed";
    const html = render({ checks: [check(1, "attention")], batches: false });
    expect(html).toContain('data-testid="checks-nomatch"');
    expect(html).not.toContain('data-testid="checks-empty"');
    expect(readable(html)).toContain(fr.console.checks.noMatch.title);
    expect(readable(html)).toContain("Effacer les filtres");
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    nav.search = "";
  });

  it("with no check at all, the first-run empty state stays, with or without filters in the address", () => {
    nav.search = "result=failed";
    const html = render({ checks: [], batches: false });
    expect(html).toContain('data-testid="checks-empty"');
    expect(html).not.toContain('data-testid="checks-nomatch"');
    nav.search = "";
  });
});

describe("a running check keeps the list live", () => {
  it("marks the view live while a row is analysing, so it asks again until the run ends", () => {
    nav.search = "";
    expect(render({ checks: [check(1, "analysing")], batches: false })).toContain('data-live="true"');
    expect(render({ checks: [check(1, "checked")], batches: false })).not.toContain("data-live");
  });
});
