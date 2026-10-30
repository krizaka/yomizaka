import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { SearchResults } from "./SearchView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {} }),
  usePathname: () => "/fr/app/search",
}));

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const readable = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ");
const hit = (n: number, source: "text" | "finding" | "title" = "text") => ({
  documentId: `d${n}`,
  title: `Bail ${n}`,
  kind: "lease" as const,
  source,
  passage: `… un <b>dépôt</b> de garantie ${n} …`,
  rank: n,
});
const render = (hits: ReturnType<typeof hit>[], q = "dépôt", locale: "en" | "fr" = "fr") =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
      <SearchResults hits={hits} q={q} />
    </I18nProvider>,
  );

describe("the search's results (the UX review's Y7, H1)", () => {
  it("counts with proper plurals — « 1 résultat », « 3 résultats », « 1 result »", () => {
    expect(readable(render([hit(1)]))).toMatch(/\b1 résultat\b/);
    expect(readable(render([hit(1), hit(2), hit(3)]))).toContain("3 résultats");
    expect(readable(render([hit(1)], "deposit", "en"))).toMatch(/\b1 result\b/);
    expect(readable(render([hit(1), hit(2)], "deposit", "en"))).toContain("2 results");
  });

  it("keeps the highlight of the words found and says where each hit comes from; each hit opens its document", () => {
    const html = render([hit(1, "finding")]);
    expect(html).toContain("<b>dépôt</b>");
    expect(readable(html)).toContain(fr.console.search.sources.finding);
    expect(html).toContain('href="/fr/app/documents/d1"');
  });

  it("with nothing found: the owl and « Rien ne correspond à « … » »", () => {
    const html = render([], "introuvable");
    expect(html).toContain('data-testid="search-none"');
    expect(readable(html)).toContain(fr.console.search.none.replace("{q}", "introuvable"));
    expect(html).not.toContain('data-testid="search-count"');
  });
});
