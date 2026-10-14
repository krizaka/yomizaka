"use client";

import { YomizakaLogo } from "@krizaka/ui";
import { Button } from "@krizaka/ui/button";
import { NavBar } from "@krizaka/ui/nav-bar";
import { ThemeToggle } from "@krizaka/ui/theme";
import Link from "next/link";

import { type Locale, otherLocale, translator } from "@/lib/i18n";
import { APP_VERSION, contactHref, type PageId, pagePath, REPO_URL } from "@/lib/site";

/**
 * The bar of a Krizaka product (NAV-SYS, products independent): the animated mark and the DEV badge · this site's
 * sections · the repository, the theme, the language and the one action. No family switcher, no link to another product.
 */
export function SiteHeader({ locale, current }: { locale: Locale; current: PageId }) {
  const t = translator(locale);
  const other = otherLocale(locale);
  const home = pagePath(locale, "home");
  const sections = [
    { href: `${home}#how`, label: t("chrome.nav.how") },
    { href: `${home}#demo`, label: t("chrome.nav.demo") },
  ];
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 px-3">
      <NavBar.Root label={t("chrome.navLabel")} className="pointer-events-auto mx-auto max-w-(--kz-page-max,72rem)">
        <NavBar.Brand asChild>
          <Link href={home} aria-label={t("chrome.brandHome")}>
            <YomizakaLogo size={26} />
            Yomizaka
          </Link>
        </NavBar.Brand>
        <NavBar.Badge env="dev" version={APP_VERSION} />

        <NavBar.Items>
          {sections.map((s) => (
            <NavBar.Link key={s.href} asChild>
              <Link href={s.href}>{s.label}</Link>
            </NavBar.Link>
          ))}
        </NavBar.Items>

        <NavBar.Actions className="gap-1">
          <NavBar.Repo href={REPO_URL} label={t("chrome.sourceCode")} className="hidden lg:inline-flex" />
          <span className="hidden md:inline-flex">
            <ThemeToggle label={t("chrome.themeToggle")} variant="ghost" />
          </span>
          <Button asChild variant="outline" size="sm" className="hidden h-7 w-auto px-2 font-mono text-[11px] font-semibold tracking-wide md:inline-flex">
            <Link href={pagePath(other, current)} hrefLang={other} lang={other}>
              <span className="sr-only">{t("chrome.languageLabel")} · </span>
              {t("chrome.otherLanguage")}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <Link href={`/${locale}/sign-in`}>{t("chrome.signIn")}</Link>
          </Button>
          <Button asChild variant="primary" size="sm" shape="cut" className="ml-1 hidden font-bold md:inline-flex">
            <a href={contactHref("dev-yomizaka-bar")}>{t("chrome.talk")}</a>
          </Button>

          <NavBar.Mobile openLabel={t("chrome.navLabel")} closeLabel={t("chrome.navLabel")} className="max-h-[calc(100dvh-6rem)] gap-1 overflow-y-auto overscroll-contain p-3">
            {sections.map((s) => (
              <NavBar.MobileLink key={s.href} asChild>
                <Link href={s.href}>{s.label}</Link>
              </NavBar.MobileLink>
            ))}
            <NavBar.MobileLink asChild>
              <Link href={`/${locale}/sign-in`}>{t("chrome.signIn")}</Link>
            </NavBar.MobileLink>
            <NavBar.MobileLink asChild>
              <Link href={pagePath(other, current)} hrefLang={other} lang={other}>
                {t("chrome.otherLanguage")}
              </Link>
            </NavBar.MobileLink>
            <div className="flex items-center gap-2 px-3 py-1">
              <ThemeToggle label={t("chrome.themeToggle")} variant="ghost" />
            </div>
            <Button asChild variant="primary" size="md" shape="cut" className="mt-2 font-bold">
              <a href={contactHref("dev-yomizaka-bar")}>{t("chrome.talk")}</a>
            </Button>
          </NavBar.Mobile>
        </NavBar.Actions>
      </NavBar.Root>
    </div>
  );
}
