import { KrizakaQueryProvider } from "@krizaka/query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CheckSummary } from "@/lib/checks";
import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { LibraryView } from "./LibraryView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {}, replace() {} }), usePathname: () => "/fr/app", useSearchParams: () => new URLSearchParams() }));

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
/** The text of some markup, scanned (no regular expression strips tags): each tag becomes `gap`, a `<style>` element is dropped whole. */
function flatten(html: string, gap: string): string {
  let out = "";
  let i = 0;
  while (i < html.length) {
    if (html[i] !== "<") {
      out += html[i++];
      continue;
    }
    const end = html.indexOf(">", i);
    if (end < 0) break;
    const name = html.slice(i + 1, end).split(/[\s/>]/)[0]?.toLowerCase();
    i = name === "style" ? html.indexOf("</style>", end) + "</style>".length : end + 1;
    out += gap;
  }
  return out;
}
const readable = (html: string) => flatten(html, " ").replace(/&#x27;|&#39;/g, "'").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");
const collection = (patch: Record<string, unknown> = {}) => ({ id: "c1", name: "My documents", files: 2, folders: 0, tags: [], isDefault: true, avatar: null, description: null, lastCheck: { at: "2026-10-20T15:00:00.000Z", status: "attention" }, ...patch });
const check = (n: number, result: CheckSummary["result"]): CheckSummary => ({ id: `a${n}`, documentId: `d${n}`, title: `Bail ${n}`, kind: "lease", studio: "compliance-check", result, runId: `run_${n}`, at: `2026-10-2${n}T12:00:00.000Z` });
const EXAMPLES = { tenant: { title: "Bail locataire", filename: "bail-locataire.txt", text: "…" }, landlord: { title: "Bail propriétaire", filename: "bail-proprietaire.txt", text: "…" } };
const render = (props: Record<string, unknown>, locale: "en" | "fr" = "fr") =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
      <KrizakaQueryProvider>
        <LibraryView libraries={[{ id: "l1", name: "Ma bibliothèque", collections: [collection()] }] as never} documents={1} tags={[]} examples={EXAMPLES} {...(props as object)} />
      </KrizakaQueryProvider>
    </I18nProvider>,
  );
/** The markup of the first collection card's link, from its `<a` to its `</a>`. */
const cardLink = (html: string) => {
  const from = html.indexOf('href="/fr/app/library/l1/c1"');
  const open = html.lastIndexOf("<a ", from);
  return html.slice(open, html.indexOf("</a>", from));
};

describe("the library home (yomizaka#275, the UX review's Y3)", () => {
  it("has one h1 with its secondary actions, and leaves the primary (« Vérifier un document ») to the header", () => {
    const html = render({});
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(readable(html)).toContain("Bibliothèque");
    expect(readable(html)).toContain("Nouvelle collection");
    expect(readable(html)).not.toContain("Vérifier un document");
  });

  it("names the default collection in the language being read, with its last check", () => {
    const text = readable(render({}));
    expect(text).toContain("Mes documents");
    expect(text).not.toContain("My documents");
    expect(text).toContain("À regarder");
    expect(readable(render({}, "en"))).toContain("My documents");
  });

  it("lists the latest checks first — each a link to the report — with « Tout voir » to Vérifications; says so when there is none", () => {
    const html = render({ latest: [check(1, "attention"), check(2, "checked")] });
    const section = html.slice(html.indexOf('data-testid="latest-checks"'), html.indexOf("</section>", html.indexOf('data-testid="latest-checks"')));
    expect(section.match(/<li\b/g)).toHaveLength(2);
    expect(section).toContain('href="/fr/app/documents/d1/rapport"');
    expect(section).toContain('href="/fr/app/verifications"');
    expect(readable(section)).toContain("Dernières vérifications");
    expect(readable(section)).toContain("Tout voir");
    expect(readable(render({ latest: [] }))).toContain(fr.console.organisation.noChecks);
    const none = render({ latest: [] });
    expect(none.slice(none.indexOf('data-testid="latest-checks"'), none.indexOf("</section>", none.indexOf('data-testid="latest-checks"')))).not.toContain('href="/fr/app/verifications"');
  });

  it("draws each collection as one link card with a place mark, its count and its last check; the menu sits beside the link, never inside it", () => {
    const html = render({});
    const link = cardLink(html);
    expect(readable(link)).toContain("Mes documents");
    expect(readable(link)).toContain("2 fichiers");
    expect(readable(link)).toContain("Par défaut");
    expect(link).toContain('data-testid="place-mark"');
    expect(link).not.toContain("<button");
    expect(html).toContain('data-testid="collection-last-check"');
    const chosen = cardLink(render({ libraries: [{ id: "l1", name: "L", collections: [collection({ avatar: { kind: "set", seed: "plain-2" } })] }] }));
    expect(chosen).not.toContain('data-testid="place-mark"');
    expect(readable(chosen)).toContain("Mes documents");
  });

  it("with nothing yet: the owl, one sentence, the only drop zone and the two examples — no table, no checks list", () => {
    const html = render({ documents: 0, latest: [], libraries: [{ id: "l1", name: "L", collections: [collection({ files: 0, lastCheck: null })] }] });
    expect(html).toContain('data-testid="library-empty"');
    expect(readable(html)).toContain(fr.console.library.emptyPitch);
    expect(html.match(/data-testid="library-dropzone"/g)).toHaveLength(1);
    expect(html).toContain('data-testid="library-examples"');
    expect(readable(html)).toContain(fr.console.library.exampleTenant);
    expect(html).not.toContain('data-testid="latest-checks"');
    expect(html).not.toContain("<table");
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  it("keeps a collection the person made reachable even with no document yet (no empty state over it)", () => {
    const html = render({ documents: 0, latest: [], libraries: [{ id: "l1", name: "L", collections: [collection({ files: 0, lastCheck: null }), collection({ id: "c2", name: "Immeuble Rosemont", isDefault: false, files: 0, lastCheck: null })] }] });
    expect(html).not.toContain('data-testid="library-empty"');
    expect(html).toContain('href="/fr/app?period=30d&amp;collection=c2"');
    expect(readable(html)).toContain("Immeuble Rosemont");
  });

  it("no longer carries « Récents » (yomizaka#325): all documents are in their collections and in Recherche", () => {
    const html = render({ documents: 2 });
    expect(html).not.toContain("<table");
    expect(readable(html)).not.toContain(fr.console.organisation.recents);
    expect(html).not.toContain('data-testid="library-dropzone"');
  });

  it("the sentence under the heading: three figures, each a link to its view with the view's filter (yomizaka#325, #332)", () => {
    const html = render({ todo: { toReview: 6, toDecide: 2, openLinks: 1, nextExpiry: "2026-11-07T12:00:00.000Z" } });
    const lead = html.slice(html.indexOf("Vous avez"), html.indexOf("</p>", html.indexOf("Vous avez")));
    expect(html.indexOf("Vous avez")).toBeLessThan(html.indexOf('data-testid="binder"'));
    expect(lead).toContain('href="/fr/app/verifications?result=attention%2Cfailed"');
    expect(lead).toContain('href="/fr/app/dossiers?state=used"');
    expect(lead).toContain('href="/fr/app/dossiers?state=open"');
    expect(flatten(lead, "")).toBe("Vous avez 6 vérifications à regarder, 2 dossiers à décider et 1 lien de dépôt ouvert.");
  });

  it("without the applicant-file flow the sentence counts the checks only", () => {
    const html = render({ todo: { toReview: 3, toDecide: null, openLinks: null } });
    expect(html).toContain('href="/fr/app/verifications?result=attention%2Cfailed"');
    expect(html).not.toContain("/fr/app/dossiers?state=");
    expect(flatten(html, "")).toContain("Vous avez 3 vérifications à regarder.");
  });

  it("the sentence is « Rien à traiter » when everything is at zero — no figure link", () => {
    const html = render({ todo: { toReview: 0, toDecide: 0, openLinks: 0 } });
    expect(readable(html)).toContain(fr.console.home.todo.nothing);
    expect(html).not.toContain('data-testid="lead-figure"');
  });

  it("today's date is on the right of the heading, as a time element", () => {
    const html = render({ now: "2026-10-25T16:00:00.000Z" });
    expect(html).toMatch(/<time[^>]*datetime="2026-10-25"|<time[^>]*dateTime="2026-10-25"/i);
    expect(readable(html)).toContain("dimanche 25 octobre 2026");
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  it("« Le classeur » comes first on the page — before the latest checks, and (one column on a phone) before the side column", () => {
    const html = render({ latest: [check(1, "attention")], strip: [{ id: "checks", total: 1, values: [1] }], activity: [{ day: "2026-10-25", checks: 1 }], credits: { kind: "included" } });
    const at = (id: string) => html.indexOf(`data-testid="${id}"`);
    expect(at("binder")).toBeGreaterThan(-1);
    expect(at("binder")).toBeLessThan(at("latest-checks"));
    expect(at("latest-checks")).toBeLessThan(at("quick-access"));
    expect(at("quick-access")).toBeLessThan(at("activity"));
    expect(at("activity")).toBeLessThan(at("week"));
    expect(at("week")).toBeLessThan(at("credits"));
  });

  it("the binder: a tab per collection with its count, the address choosing the open one", () => {
    const libraries = [{ id: "l1", name: "L", collections: [collection(), collection({ id: "c2", name: "Rosemont", isDefault: false, files: 4, lastCheck: null })] }];
    const html = render({ libraries, chosen: "c2" });
    const binder = html.slice(html.indexOf('data-testid="binder"'), html.indexOf('data-testid="latest-checks"'));
    expect(binder.match(/data-testid="binder-count"/g)).toHaveLength(2);
    expect(binder).toContain('href="/fr/app?period=30d&amp;collection=c1"');
    expect(binder).toContain('href="/fr/app?period=30d&amp;collection=c2"');
    expect(readable(binder)).toMatch(/Rosemont\s+4/);
    expect(binder).toMatch(/aria-current="page"[^>]*href="\/fr\/app\?period=30d&amp;collection=c2"|href="\/fr\/app\?period=30d&amp;collection=c2"[^>]*aria-current="page"/);
    // the open tab's panel is that collection
    expect(cardLink(binder.replace("/fr/app/library/l1/c1", "x")).length).toBeGreaterThanOrEqual(0);
    expect(binder).toContain('href="/fr/app/library/l1/c2"');
    expect(binder).not.toContain('href="/fr/app/library/l1/c1"');
  });

  it("the side column: quick access (the request only with the applicant-file flow), the strip, the week and the credits", () => {
    const strip = [
      { id: "checks", total: 5, values: [1, 4] },
      { id: "toReview", total: 2, values: [0, 2] },
      { id: "documents", total: 3, values: [1, 2] },
    ];
    const activity = [{ day: "2026-10-24", checks: 1 }, { day: "2026-10-25", checks: 4 }];
    const html = render({ strip, activity, credits: { kind: "credits", left: 3 }, screening: false });
    const quick = html.slice(html.indexOf('data-testid="quick-access"'), html.indexOf('data-testid="activity"'));
    expect(quick).toContain('href="/fr/app/documents"');
    expect(quick).not.toContain('href="/fr/app/dossiers"');
    expect(readable(quick)).not.toContain("Vérifier un document");
    expect(render({ screening: true })).toMatch(/data-testid="quick-access"[\s\S]*href="\/fr\/app\/dossiers"/);
    for (const id of ["checks", "toReview", "documents"]) expect(html).toContain(`data-testid="strip-${id}"`);
    expect(html).not.toContain('data-testid="strip-files"');
    expect(readable(html.slice(html.indexOf('data-testid="credits"')))).toContain("3 vérifications restantes");
  });

  it("the week chart has its table alternative in the page, in French", () => {
    const html = render({ activity: [{ day: "2026-10-24", checks: 1 }, { day: "2026-10-25", checks: 4 }] });
    const week = html.slice(html.indexOf('data-testid="week"'), html.indexOf('data-testid="credits"') > 0 ? html.indexOf('data-testid="credits"') : undefined);
    expect(week).toContain("<table");
    expect(readable(week)).toContain("Vérifications");
    expect(readable(week)).not.toMatch(/View as table|Show data/);
  });

  it("the activity of the period: its total from the days, and the 7 · 30 · 90 d switch in the address", () => {
    const activity = [{ day: "2026-10-23", checks: 2 }, { day: "2026-10-24", checks: 3 }];
    const strip = [{ id: "checks", total: 5, values: [2, 3] }];
    const html2 = render({ activity, strip, period: "7d" });
    const section = html2.slice(html2.indexOf('data-testid="activity"'));
    expect(readable(section)).toMatch(/\b5\b/);
    for (const p of ["7d", "30d", "90d"]) expect(section).toContain(`href="/fr/app?period=${p}&amp;collection=c1"`);
    expect(section).toMatch(/aria-current="page"[^>]*href="\/fr\/app\?period=7d&amp;collection=c1"|href="\/fr\/app\?period=7d&amp;collection=c1"[^>]*aria-current="page"/);
  });
});
