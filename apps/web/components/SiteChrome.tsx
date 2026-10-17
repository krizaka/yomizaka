"use client";

import { CheckIcon, HomeIcon, InfoIcon, PlayIcon } from "@krizaka/icons";
import { YomizakaLogo } from "@krizaka/ui";
import { Button } from "@krizaka/ui/button";
import { NavBar } from "@krizaka/ui/nav-bar";
import { ThemeToggle } from "@krizaka/ui/theme";
import Link from "next/link";

import { type Locale, otherLocale, translator } from "@/lib/i18n";
import { contactHref, type PageId, pagePath, REPO_URL } from "@/lib/site";

/** The product's pages, in the one « Product » menu (the products' bar standard): no Platforms (web only), no Docs yet. */
const MENU = [
  { id: "home", icon: <HomeIcon />, page: "home" },
  { id: "how", icon: <InfoIcon />, page: "home", hash: "#how" },
  { id: "run", icon: <PlayIcon />, page: "run" },
  { id: "verify", icon: <CheckIcon />, page: "verify" },
] as const;

/**
 * The bar of a Krizaka product (products independent): the animated mark · the Product menu · the repository, the theme,
 * the language, sign-in and the one action. No version chip (the version is in the footer), no family switcher, no link
 * to another product.
 */
export function SiteHeader({ locale, current }: { locale: Locale; current: PageId }) {
  const t = translator(locale);
  const other = otherLocale(locale);
  const home = pagePath(locale, "home");
  const items = MENU.map((m) => ({ ...m, href: `${pagePath(locale, m.page)}${"hash" in m ? m.hash : ""}`, active: m.page === current && !("hash" in m) }));
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 px-3">
      <NavBar.Root label={t("chrome.navLabel")} className="pointer-events-auto mx-auto max-w-(--kz-page-max,72rem)">
        <NavBar.Brand asChild>
          <Link href={home} aria-label={t("chrome.brandHome")}>
            <YomizakaLogo size={26} />
            Yomizaka
          </Link>
        </NavBar.Brand>
        <NavBar.Items>
          <NavBar.Menu value="product" label={t("chrome.nav.product")} active={items.some((i) => i.active)} columns={1}>
            {items.map((i) => (
              <NavBar.MenuLink key={i.id} asChild icon={i.icon} title={t(`chrome.menu.${i.id}.title`)} description={t(`chrome.menu.${i.id}.text`)} active={i.active}>
                <Link href={i.href} />
              </NavBar.MenuLink>
            ))}
          </NavBar.Menu>
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

          <NavBar.Mobile openLabel={t("chrome.menu.label")} closeLabel={t("chrome.menu.label")} className="max-h-[calc(100dvh-6rem)] gap-1 overflow-y-auto overscroll-contain p-3">
            <div role="group" aria-label={t("chrome.nav.product")} className="flex flex-col gap-1">
              <p className="px-3 pt-1 text-xs font-semibold uppercase tracking-wider text-fg-muted">{t("chrome.nav.product")}</p>
              {items.map((i) => (
                <NavBar.MobileLink key={i.id} asChild active={i.active}>
                  <Link href={i.href}>{t(`chrome.menu.${i.id}.title`)}</Link>
                </NavBar.MobileLink>
              ))}
            </div>
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
