import { publicCatalogue } from "@krizaka/settings";
import { Page, Section } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, format, getDictionary } from "@/lib/i18n";
import { appPrices } from "@/lib/prices/catalogue";
import { type PricingLine, pricingLines } from "@/lib/prices/page";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { appSettings } from "@/lib/settings/instance";
import { pagePath } from "@/lib/site";

/** The prices are data an administrator schedules (ADR-009): the page is read at each request, never frozen at build. */
export const dynamic = "force-dynamic";

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
 * The prices, read from the catalogue in force (`publicCatalogue`: never an internal entry, an entry in preparation without its
 * figure — ADR-009, #367). What is sold today comes first; what is not built yet is listed under « In preparation », with no figure.
 */
export default async function Pricing({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale);
  const p = t.pricing;
  const now = new Date();
  const [prices, freeFirst] = await Promise.all([appPrices().catalogue(now), appSettings().get("audit.freeFirst")]);
  const lines = pricingLines(publicCatalogue(prices), freeFirst === true, locale);
  const words = (plan: string) => p.rows[plan as keyof typeof p.rows];
  const row = (l: PricingLine): Row => {
    const w = words(l.plan);
    if (l.kind === "free") return { title: w.title, text: w.text, value: w.value };
    if (l.kind === "preparing") return { title: w.title, text: w.text, status: w.status };
    return { title: w.title, text: format(w.text, { included: l.included ?? 0, overage: l.overage ?? "" }), value: format(w.value, { price: l.price }) };
  };
  const line = (r: Row) => (
    <li key={r.title} className="grid gap-2 py-5 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-6">
      <div>
        <h3 className="text-base font-medium text-fg-primary">{r.title}</h3>
        <p className="mt-1 max-w-[62ch] text-sm text-fg-secondary">{r.text}</p>
      </div>
      {r.value ? <p className="font-mono text-sm text-fg-primary sm:text-right">{r.value}</p> : <p className="text-sm text-fg-muted sm:text-right">{r.status}</p>}
    </li>
  );
  const offered = lines.sold.filter((l) => words(l.plan)).map(row);
  const preparing = lines.preparing.filter((l) => words(l.plan)).map(row);
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
          {preparing.length ? (
            <Section title={p.preparing.title} lead={p.preparing.lead} headingSize="sm" spacing="sm" divider>
              <ul className="divide-y divide-border-default">{preparing.map(line)}</ul>
            </Section>
          ) : null}
        </Page>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
