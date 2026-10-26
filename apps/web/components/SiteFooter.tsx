import { SiteFooter as FamilyFooter, SiteFooterColumn, SiteFooterLink } from "@krizaka/ui/site-footer";
import { familyLabels } from "@krizaka/ui/sites";
import Link from "next/link";

import { format, getDictionary, type Locale, translator } from "@/lib/i18n";
import { indexable } from "@/lib/indexing";
import { isListed } from "@/lib/listed";
import { uiVersion } from "@/lib/platform";
import { APP_VERSION, contactHref, pagePath, REPO_URL } from "@/lib/site";

/**
 * The footer is @krizaka/ui's SiteFooter in product mode (`family={false}`): the product's pages, its source and contact,
 * the publisher line « A Krizaka product » (→ www.krizaka.com), DEV · the version, Montréal. On a deployment kept out of
 * search engines the invitation line ends the signature row — one footer, no strip under it.
 */
export function SiteFooter({ locale }: Readonly<{ locale: Locale }>) {
  const t = translator(locale);
  return (
    <FamilyFooter
      current="yomizaka"
      family={false}
      labels={familyLabels[locale]}
      aria-label={t("chrome.footerLabel")}
      env={indexable() ? undefined : "DEV"}
      data-testid="app-version"
      legal={
        <>
          <span>
            {format(getDictionary(locale).chrome.version, { version: APP_VERSION })}
            {uiVersion() ? ` · Krizaka UI ${uiVersion()}` : ""}
          </span>
          {indexable() ? null : <span data-testid="dev-environment-notice">{t("chrome.devNotice")}</span>}
        </>
      }
    >
      <SiteFooterColumn title="Yomizaka">
        {isListed("download") ? (
          <SiteFooterLink asChild>
            <Link href={pagePath(locale, "download")}>{t("chrome.download")}</Link>
          </SiteFooterLink>
        ) : null}
        <SiteFooterLink asChild>
          <Link href={pagePath(locale, "docs")}>{t("chrome.docs")}</Link>
        </SiteFooterLink>
        {isListed("pricing") ? (
          <SiteFooterLink asChild>
            <Link href={pagePath(locale, "pricing")}>{t("chrome.nav.pricing")}</Link>
          </SiteFooterLink>
        ) : null}
        <SiteFooterLink asChild>
          <Link href={pagePath(locale, "privacy")}>{t("chrome.legal")}</Link>
        </SiteFooterLink>
        <SiteFooterLink asChild>
          <Link href={pagePath(locale, "terms")}>{t("chrome.terms")}</Link>
        </SiteFooterLink>
        <SiteFooterLink href={REPO_URL}>{t("chrome.sourceCode")}</SiteFooterLink>
        <SiteFooterLink href={contactHref("dev-yomizaka-footer")}>{t("chrome.contact")}</SiteFooterLink>
      </SiteFooterColumn>
    </FamilyFooter>
  );
}
