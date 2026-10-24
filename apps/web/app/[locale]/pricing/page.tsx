import { Page, Section } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, format, getDictionary } from "@/lib/i18n";
import { money, PRICING } from "@/lib/pricing";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { pagePath } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "pricing");
}

interface Row {
  title: string;
  text: string;
  value?: string;
  status?: string;
}

/**
 * The prices, read from `lib/pricing.ts` (the processor's catalogue). What is sold today comes first; what is not yet built
 * (a lot, the filter alone, the full Québec file, the income check) is listed under « In preparation », with no figure.
 */
export default async function Pricing({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale);
  const p = t.pricing;
  const line = (r: Row) => (
    <li key={r.title} className="grid gap-2 py-5 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-6">
      <div>
        <h3 className="text-base font-medium text-fg-primary">{r.title}</h3>
        <p className="mt-1 max-w-[62ch] text-sm text-fg-secondary">{r.text}</p>
      </div>
      {r.value ? <p className="font-mono text-sm text-fg-primary sm:text-right">{r.value}</p> : <p className="text-sm text-fg-muted sm:text-right">{r.status}</p>}
    </li>
  );
  const offered: Row[] = [
    { ...p.rows.check, value: format(p.rows.check.value, { price: money(PRICING.check.cents, locale) }) },
    ...(PRICING.firstCheckFree ? [p.rows.first] : []),
    { ...p.rows.pro, text: format(p.rows.pro.text, { limit: PRICING.pro.auditsPerMonth }), value: format(p.rows.pro.value, { price: money(PRICING.pro.cents, locale) }) },
  ];
  const preparing: Row[] = [p.rows.lot, p.rows.filter, p.rows.full, p.rows.income];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="pricing" />
      <main id="content">
        <PageHero back={{ href: pagePath(locale, "home"), label: t.meta.siteName }} linkAs={Link} title={p.title} backdrop="plain" lead={p.lead} />
        <Page>
          <Section title={p.offer.title} lead={p.offer.lead} headingSize="sm" spacing="sm">
            <ul className="divide-y divide-border-default">{offered.map(line)}</ul>
          </Section>
          <Section title={p.preparing.title} lead={p.preparing.lead} headingSize="sm" spacing="sm" divider>
            <ul className="divide-y divide-border-default">{preparing.map(line)}</ul>
          </Section>
        </Page>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
