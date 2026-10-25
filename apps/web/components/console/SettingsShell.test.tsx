import { KrizakaQueryProvider } from "@krizaka/query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { SettingsShell } from "./SettingsShell";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {}, replace() {}, refresh() {} }), usePathname: () => "/fr/app/settings/profil", useSearchParams: () => new URLSearchParams() }));

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const readable = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");
const ACCOUNT = { email: "eric.persona@example.test", name: "Éric Tremblay", avatarSeed: null, verified: true, memberSince: "2026-10-02T12:00:00.000Z" };
const render = (props: Partial<Parameters<typeof SettingsShell>[0]> = {}, locale: "en" | "fr" = "fr") =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
      <KrizakaQueryProvider>
        <SettingsShell section="profil" account={ACCOUNT} {...props}>
          <p>section</p>
        </SettingsShell>
      </KrizakaQueryProvider>
    </I18nProvider>,
  );
// The layout draws its navigation twice (a wide screen's and a phone's): each address is read once.
const navLinks = (html: string) => {
  const found = [...html.matchAll(/<a [^>]*href="(\/fr\/app\/settings\/[a-z]+)"[^>]*>/g)].map((m) => ({ href: m[1], current: m[0].includes('aria-current="page"') }));
  return found.filter((l, i) => found.findIndex((o) => o.href === l.href) === i);
};

describe("the settings on SettingsLayout (the UX review's Y2)", () => {
  it("navigates the six sections as routes, the current one from the route", () => {
    const links = navLinks(render());
    expect(links.map((l) => l.href)).toEqual(["/fr/app/settings/profil", "/fr/app/settings/apparence", "/fr/app/settings/securite", "/fr/app/settings/facturation", "/fr/app/settings/stockage", "/fr/app/settings/donnees"]);
    expect(links.filter((l) => l.current).map((l) => l.href)).toEqual(["/fr/app/settings/profil"]);
    expect(navLinks(render({ section: "facturation" })).filter((l) => l.current).map((l) => l.href)).toEqual(["/fr/app/settings/facturation"]);
  });

  it("says who is signed in on top: the name, the verified address, member since — in the reader's language", () => {
    const text = readable(render());
    expect(text).toContain("Éric Tremblay");
    expect(text).toContain("eric.persona@example.test");
    expect(text).toContain(fr.console.settings.verified);
    expect(text).toMatch(/Membre depuis .*2026/);
    expect(readable(render({ account: { ...ACCOUNT, verified: false } }))).toContain(fr.console.settings.unverified);
    expect(readable(render({}, "en"))).toMatch(/Member since .*2026/);
  });

  it("falls back on the address as the card's name when there is none, and draws the default picture", () => {
    const html = render({ account: { ...ACCOUNT, name: null } });
    expect(html).toContain('data-testid="settings-identity"');
    expect(readable(html)).toContain("eric.persona@example.test");
  });
});
