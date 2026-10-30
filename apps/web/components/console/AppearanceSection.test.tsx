import { KrizakaQueryProvider } from "@krizaka/query";
import { ThemeProvider } from "@krizaka/ui/theme";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { AppearanceSection } from "./AppearanceSection";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {} }),
  usePathname: () => "/fr/app/settings/apparence",
  useSearchParams: () => new URLSearchParams(),
}));

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const readable = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ");
const render = (locale: "en" | "fr") =>
  readable(
    renderToStaticMarkup(
      <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
        <KrizakaQueryProvider>
          <ThemeProvider defaultMode="dark">
            <AppearanceSection />
          </ThemeProvider>
        </KrizakaQueryProvider>
      </I18nProvider>,
    ),
  );

describe("the appearance of the app (ADR-006 § 4)", () => {
  it("offers System, Light and Dark and the density, in French", () => {
    const text = render("fr");
    for (const word of [
      fr.console.settings.appearance.themes.system,
      fr.console.settings.appearance.themes.light,
      fr.console.settings.appearance.themes.dark,
      fr.console.settings.appearance.densities.compact,
    ])
      expect(text).toContain(word);
  });

  it("speaks English too, and offers no sound and no surface set", () => {
    const text = render("en");
    expect(text).toContain(en.console.settings.appearance.themes.system);
    expect(text).not.toMatch(/blueprint|carbone|sound/i);
  });
});
