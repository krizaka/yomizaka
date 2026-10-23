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
