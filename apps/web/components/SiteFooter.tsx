import { SiteFooter as FamilyFooter, SiteFooterColumn, SiteFooterLink } from "@krizaka/ui/site-footer";
import { familyLabels } from "@krizaka/ui/sites";
import Link from "next/link";

import { format, getDictionary, type Locale, translator } from "@/lib/i18n";
import { indexable } from "@/lib/indexing";
import { uiVersion } from "@/lib/platform";
import { APP_VERSION, contactHref, pagePath, REPO_URL } from "@/lib/site";

/**
 * The footer is @krizaka/ui's SiteFooter in product mode (`family={false}`): the product's pages, its source and contact,
 * the publisher line « A Krizaka product » (→ www.krizaka.com), DEV · the version, Montréal. On a deployment kept out of
 * search engines the invitation line ends the signature row — one footer, no strip under it.
 */
export function SiteFooter({ locale }: { locale: Locale }) {
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
          <SiteFooterLink asChild>
            <Link href={`${pagePath(locale, "changelog")}#${APP_VERSION}`}>
              {format(getDictionary(locale).changelog.footerVersion, { version: APP_VERSION })}
              {uiVersion() ? ` · Krizaka UI ${uiVersion()}` : ""}
            </Link>
          </SiteFooterLink>
          {indexable() ? null : <span data-testid="dev-environment-notice">{t("chrome.devNotice")}</span>}
        </>
      }
    >
      <SiteFooterColumn title="Yomizaka">
        <SiteFooterLink asChild>
          <Link href={pagePath(locale, "run")}>{t("chrome.nav.run")}</Link>
        </SiteFooterLink>
        <SiteFooterLink asChild>
          <Link href={pagePath(locale, "verify")}>{t("chrome.nav.verify")}</Link>
        </SiteFooterLink>
        <SiteFooterLink asChild>
          <Link href={pagePath(locale, "privacy")}>{t("chrome.legal")}</Link>
        </SiteFooterLink>
        <SiteFooterLink href={REPO_URL}>{t("chrome.sourceCode")}</SiteFooterLink>
        <SiteFooterLink href={contactHref("dev-yomizaka-footer")}>{t("chrome.contact")}</SiteFooterLink>
      </SiteFooterColumn>
    </FamilyFooter>
  );
}
