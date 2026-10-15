import { Button } from "@krizaka/ui/button";
import { Page, Section, SectionHeading } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { VerifyForm, type VerifyLabels } from "@/components/VerifyForm";
import { pageSession } from "@/lib/access";
import { readEnv } from "@/lib/env";
import { asLocale, getDictionary } from "@/lib/i18n";
import { publicKeyBase64 } from "@/lib/report-key";
import { signingKey } from "@/lib/report-signer";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { pagePath } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "verify");
}

/** Public: anyone checks an audit report — what a green result guarantees, what it does not, and the public key. */
export default async function Verify({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale);
  const v = t.verify;
  const key = signingKey();
  const signedIn = (await pageSession()) !== null;
  // A development deployment (APP_PUBLIC_ACTIONS=off): a signed-out visitor runs nothing; the page is read-only.
  const locked = !signedIn && readEnv().APP_PUBLIC_ACTIONS !== "on";
  const labels: VerifyLabels = {
    reportFile: v.reportFile,
    reportPaste: v.reportPaste,
    documentFile: v.documentFile,
    documentHint: v.documentHint,
    submit: v.submit,
    empty: v.empty,
    tooLarge: v.tooLarge,
    okTitle: v.okTitle,
    failTitle: v.failTitle,
    reasons: v.reasons,
    facts: v.facts,
    documentMatch: v.documentMatch,
    drop: v.drop,
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="verify" />
      <main id="content" className="pt-20">
        <PageHero back={{ href: pagePath(locale, "home"), label: t.meta.siteName }} linkAs={Link} title={v.title} lead={v.lead} />
        <Page>
          <Section>
            <div className="max-w-3xl">
              {locked ? (
                <div className="flex flex-col items-start gap-4 rounded-xl border border-border-default bg-surface-1 p-5">
                  <p className="text-sm text-fg-secondary">{v.devLocked}</p>
                  <Button asChild variant="primary" size="md" shape="cut">
                    <Link href={`/${locale}/sign-in`}>{v.devSignIn}</Link>
                  </Button>
                </div>
              ) : (
                <VerifyForm labels={labels} locale={locale} canAttachDocument={signedIn} />
              )}
            </div>
          </Section>
          <Section divider>
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <SectionHeading title={v.guaranteesTitle} />
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-fg-secondary">
                  {Object.values(v.guarantees).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              <div>
                <SectionHeading title={v.limitsTitle} />
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-fg-secondary">
                  {Object.values(v.limits).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>
          <Section divider>
            <SectionHeading title={v.keyTitle} lead={v.keyLead} />
            <p className="mt-3 font-mono text-xs text-fg-secondary" data-testid="key-id">
              {key.keyId}
            </p>
            <pre className="mt-2 max-w-3xl overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-border-default bg-surface-1 p-3 font-mono text-xs text-fg-secondary" data-testid="public-key">
              {publicKeyBase64(key)}
            </pre>
            {key.keyId.startsWith("dev:") ? <p className="mt-2 text-sm text-fg-secondary">{v.devKey}</p> : null}
          </Section>
        </Page>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
