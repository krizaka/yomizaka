import { Page, Section } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DISPLAY_TIME_ZONE, INTL } from "@/components/console/format";
import { OwnerReportDocument } from "@/components/OwnerReportDocument";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, format, getDictionary } from "@/lib/i18n";
import { limit } from "@/lib/limits";
import { openShare } from "@/lib/owner-report-shares";
import { pagePath } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

/** The building owner's page (yomizaka#128): a read-only report by link, public by token, never indexed, never cached; no account, no document. */
export default async function OwnerReportPage({ params }: Readonly<{ params: Promise<{ locale: string; token: string }> }>) {
  const { locale: raw, token } = await params;
  const locale = asLocale(raw);
  const t = getDictionary(locale);
  const w = t.ownerReport;
  const h = await headers();
  await limit("applicant", { headers: h }, null);
  const now = new Date();
  const report = await openShare(token, now, h);
  // One answer for an unknown, expired or revoked link: 404, nothing leaks (yomizaka#128).
  if (!report) notFound();
  const back = { href: pagePath(locale, "home"), label: t.meta.siteName };
  const date = new Date(report.issuedAt).toLocaleDateString(INTL[locale], { dateStyle: "long", timeZone: DISPLAY_TIME_ZONE });
    return (
    <>
      <SiteHeader locale={locale} current="home" />
      <main id="content">
        <PageHero back={back} linkAs={Link} title={w.title} backdrop="plain" lead={w.lead}>
          <p>{format(w.reference, { ref: report.reference })} · {format(w.issued, { date })}</p>
          <p>{w.notice}</p>
        </PageHero>
        <Page>
          <Section>
            <h2 className="text-xl font-semibold">{w.documents}</h2>
            <ol className="mt-4 grid gap-4">
              {report.documents.map((d, i) => (
                <OwnerReportDocument key={d.sha256} doc={d} n={i + 1} words={w} />
              ))}
            </ol>
            {report.rulesets.map((r) => (
              <p key={`${r.rulesetId}-${r.rulesetVersion}`} className="mt-4 text-sm">
                {format(w.ruleset, { id: r.rulesetId, version: r.rulesetVersion, jurisdiction: r.jurisdiction })}
                {r.reviewStatus ? ` ${format(w.reviewStatus, { status: r.reviewStatus })}` : ""}
              </p>
            ))}
            <p className="mt-6 text-sm text-fg-secondary">{w.limits}</p>
          </Section>
        </Page>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
