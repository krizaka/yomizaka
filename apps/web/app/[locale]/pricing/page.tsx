import { publicCatalogue } from "@krizaka/settings";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PricingContent } from "@/components/pricing/PricingContent";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, getDictionary } from "@/lib/i18n";
import { productStatus } from "@/lib/landing";
import { appPrices } from "@/lib/prices/catalogue";
import { pricingLines } from "@/lib/prices/page";
import { PRICING_PUBLISHED } from "@/lib/prices/publication";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { appSettings } from "@/lib/settings/instance";

import preview from "../../../../../dev-preview.json";

/** The prices are data an administrator schedules (ADR-009): the page is read at each request, never frozen at build. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "pricing");
}

/**
 * The prices, read from the catalogue in force (`publicCatalogue`: never an internal entry, an entry in preparation without its
 * figure — ADR-009). HELD behind `PRICING_PUBLISHED` until Oussama approves the grid (yomizaka#300): a 404 until then.
 */
export default async function Pricing({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  if (!PRICING_PUBLISHED) notFound();
  const locale = asLocale((await params).locale);
  const [prices, freeFirst] = await Promise.all([appPrices().catalogue(new Date()), appSettings().get("audit.freeFirst")]);
  const { sold, soon } = pricingLines(publicCatalogue(prices), locale);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="pricing" />
      <main id="content">
        <PricingContent locale={locale} sold={sold} soon={soon} freeFirst={freeFirst === true} status={getDictionary(locale).landing.status[productStatus(preview)]} />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
