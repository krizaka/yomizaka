import { KrizakaQueryProvider } from "@krizaka/query";
import { ThemeProvider } from "@krizaka/ui/theme";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {}, replace() {}, refresh() {} }), usePathname: () => "/fr/app/verifications", useSearchParams: () => new URLSearchParams() }));

process.env.NEXT_PUBLIC_APP_VERSION = "0.1.0+abc1234";
const { ConsoleShell } = await import("./ConsoleShell");

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const EMAIL = "eric.persona@example.test";
const render = (props: { name?: string; role?: "USER" | "ADMIN" } = {}, locale: "en" | "fr" = "fr") =>
  renderToStaticMarkup(
    <ThemeProvider>
      <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
        <KrizakaQueryProvider>
          <ConsoleShell locale={locale} email={EMAIL} role={props.role ?? "USER"} name={props.name}>
            <p>content</p>
          </ConsoleShell>
        </KrizakaQueryProvider>
      </I18nProvider>
    </ThemeProvider>,
  );
const railLinks = (html: string) => [...html.matchAll(/<a [^>]*data-rail-item[^>]*>/g)].map((m) => m[0]);
const headerOf = (html: string) => html.slice(html.indexOf("<header"), html.indexOf("</header>"));

describe("the signed-in shell (Orazaka's pattern, the UX review's Y1)", () => {
  it("the rail holds Bibliothèque · Vérifications · Recherche and nothing else, the active one from the route, the collapse control alone at its foot", () => {
    const html = render();
    const links = railLinks(html);
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.match(/href="([^"]+)"/)![1])).toEqual(["/fr/app", "/fr/app/verifications", "/fr/app/recherche"]);
    expect(links[1]).toContain('aria-current="page"');
    expect(links[0]).not.toContain("aria-current");
    expect(html).not.toMatch(/<a [^>]*data-rail-item[^>]*href="\/fr\/app\/(settings|verifier)"/);
    const toggles = html.match(/<button [^>]*data-rail-item[^>]*>/g) ?? [];
    expect(toggles).toHaveLength(1);
    expect(html).toContain(fr.console.shell.expand);
  });

  it("the header names the product, carries the DEV chip and the one action, « Vérifier un document », to the task page", () => {
    const header = headerOf(render());
    expect(header).toContain(">Yomizaka<");
    expect(header).toMatch(/data-testid="app-version"[^>]*>DEV · v0\.1\.0\+abc1234</);
    expect(header).toMatch(/<a [^>]*href="\/fr\/app\/verifier"[^>]*>/);
    const action = header.match(/<a [^>]*data-testid="header-check"[^>]*>/)![0];
    expect(action).toContain('aria-label="Vérifier un document"');
    expect(action).toContain('href="/fr/app/verifier"');
    expect(headerOf(render({}, "en"))).toContain('aria-label="Check a document"');
  });

  it("shows the person's name beside the avatar when there is one, and never the raw e-mail address", () => {
    const named = render({ name: "Éric Tremblay" });
    expect(named).toContain('data-name="Éric Tremblay"');
    expect(named).not.toContain(EMAIL);
    const anonymous = render();
    expect(anonymous).not.toContain("data-name=");
    expect(anonymous).not.toContain(EMAIL);
  });

  it("keeps the skip link and the content landmark", () => {
    const html = render();
    expect(html).toContain('href="#content"');
    expect(html).toMatch(/<main [^>]*id="content"/);
  });
});
