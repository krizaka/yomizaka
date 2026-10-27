import { readFileSync } from "node:fs";

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
const NOW = "2026-10-30T12:00:00.000Z";
const render = (props: { checks: CheckSummary[]; batches: boolean; now?: string }, locale: "en" | "fr" = "fr") =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
      <KrizakaQueryProvider>
        <ChecksView now={NOW} {...props} />
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
    expect(html).toContain('href="/fr/app/documents/d1/rapport"');
    expect(text).toContain("Bail — Rosemont, logement 1");
    expect(text).toContain("À regarder");
    expect(text).toContain("Vérifié");
    // The run id is cut to one mono line; the whole id is its title and what « copy » takes.
    expect(text).toContain("seeded-b…");
    expect(html).toContain('title="seeded-bail-2"');
    expect(readable(render({ checks: [check(1, "attention")], batches: false }, "en"))).toContain("To look at");
  });

  it("with nothing checked yet: the owl, the words, and the one action to the task page", () => {
    nav.search = "";
    const html = render({ checks: [], batches: false });
    expect(html).toContain('data-testid="checks-empty"');
    expect(readable(html)).toContain(fr.console.checks.empty.title);
    expect(html).toContain('href="/fr/app/check"');
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

describe("a running check keeps the list live", () => {
  it("marks the view live while a row is analysing, so it asks again until the run ends", () => {
    nav.search = "";
    expect(render({ checks: [check(1, "analysing")], batches: false })).toContain('data-live="true"');
    expect(render({ checks: [check(1, "checked")], batches: false })).not.toContain("data-live");
  });
});

describe("the filters of the list live in the address (the UX review's Y6)", () => {
  const rows = [check(1, "checked"), check(2, "attention"), check(3, "attention", { title: "Facture Plomberie Roy", kind: "invoice" }), check(4, "failed", { title: "Contrat d'entretien", kind: "contract" })];
  it("draws the bar above the list — the search, the result, the kind, the period — and the count of checks; never with nothing checked", () => {
    nav.search = "";
    const html = render({ checks: rows, batches: false });
    expect(html).toContain('data-testid="checks-filters"');
    const text = readable(html);
    expect(text).toContain(fr.console.checks.filters.result);
    expect(text).toContain(fr.console.checks.filters.kind);
    expect(text).toContain(fr.console.checks.filters.period);
    expect(text).toContain("4 vérifications");
    expect(html).not.toContain('data-testid="checks-no-match"');
    expect(render({ checks: [], batches: false })).not.toContain('data-testid="checks-filters"');
  });
  it("reads them from the address: the rows kept, the filters in force as chips, the count", () => {
    nav.search = "result=attention&kind=lease";
    const text = readable(render({ checks: rows, batches: false }));
    expect(text).toContain("Bail — Rosemont, logement 2");
    expect(text).not.toContain("Bail — Rosemont, logement 1");
    expect(text).not.toContain("Facture Plomberie Roy");
    expect(text).toMatch(/\b1 vérification\b/);
    expect(text).toContain(`${fr.console.checks.filters.result} : ${fr.console.statuses.attention}`);
    expect(text).toContain(`${fr.console.checks.filters.kind} : ${fr.console.kinds.lease}`);
    expect(text).toContain(fr.console.checks.filters.clear);
    nav.search = "";
  });
  it("the period reads the server's now: the last 7 days keep the recent rows only", () => {
    nav.search = "period=7d";
    const text = readable(render({ checks: rows, batches: false, now: "2026-10-30T12:00:00.000Z" }));
    expect(text).toContain("Facture Plomberie Roy");
    expect(text).toContain("Contrat d'entretien");
    expect(text).not.toContain("logement 1");
    expect(text).not.toContain("logement 2");
    expect(text).toContain(`${fr.console.checks.filters.period} : ${fr.console.checks.filters.periods["7d"]}`);
    nav.search = "";
  });
  it("a choice is a history step Back undoes, typing is replaced as it goes; the field's draft is reconciled with the address", () => {
    const view = readFileSync(new URL("./ChecksView.tsx", import.meta.url), "utf8");
    expect(view).toContain("router[history](hrefWith(next)");
    expect(view).toContain("onSearch={(v) => commit(v, FILTER_HISTORY.typed)}");
    expect(view).toContain("onSubmit={(v) => commit(v, FILTER_HISTORY.chosen)}");
    expect(view).toContain("reconcileDraft(state, filters.q)");
  });
  it("with filters that keep nothing: says so and offers to clear them — back to the plain address; the owl stays for « no check yet »", () => {
    nav.search = "q=introuvable&tab=checks";
    const html = render({ checks: rows, batches: false });
    expect(html).toContain('data-testid="checks-no-match"');
    expect(html).not.toContain('data-testid="checks-empty"');
    expect(html).toContain('href="/fr/app/verifications?tab=checks"');
    expect(readable(html)).toContain(fr.console.checks.noMatch.title);
    nav.search = "";
  });
});
