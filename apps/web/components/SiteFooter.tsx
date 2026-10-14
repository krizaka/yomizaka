import { YomizakaLogo } from "@krizaka/ui";
import { Page } from "@krizaka/ui/page";
import Link from "next/link";

import { type Locale, translator } from "@/lib/i18n";
import { APP_VERSION, contactHref, KRIZAKA_URL, pagePath, REPO_URL } from "@/lib/site";

import { Rich } from "./Rich";

/** The footer: the product, its source, the contact, the privacy notice — and the publisher, Krizaka, here only. */
export function SiteFooter({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const link = "underline-offset-4 hover:text-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm";
  return (
    <footer className="mt-16 border-t border-border-default">
      <Page className="flex flex-col gap-4 py-8 text-sm text-fg-muted md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <YomizakaLogo size={22} animated={false} />
          <p>
            <Rich text={t("chrome.footer")} />{" "}
            <a href={KRIZAKA_URL} className={link}>
              krizaka.com
            </a>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link href={pagePath(locale, "privacy")} className={link}>
            {t("chrome.legal")}
          </Link>
          <a href={REPO_URL} className={link}>
            {t("chrome.sourceCode")}
          </a>
          <a href={contactHref("dev-yomizaka-footer")} className={link}>
            {t("chrome.contact")}
          </a>
          <span className="font-mono text-xs" data-testid="app-version">
            {t("chrome.dev", { version: APP_VERSION })}
          </span>
        </div>
      </Page>
    </footer>
  );
}
