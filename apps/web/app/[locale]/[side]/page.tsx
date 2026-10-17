import { CheckIcon, EyeIcon, KeepIcon, LockIcon, SearchIcon, ShieldIcon } from "@krizaka/icons";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { CardGrid } from "@krizaka/ui/card-grid";
import { CtaPanel } from "@krizaka/ui/cta-panel";
import { LinkCard } from "@krizaka/ui/link-card";
import { MascotQuote } from "@krizaka/ui/mascot-quote";
import { Section } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import { type Audience, AUDIENCE_STATUS } from "@yomizaka/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { AudiencePicker } from "@/components/AudiencePicker";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, getDictionary, LOCALES } from "@/lib/i18n";
import { OG_IMAGE, siteJsonLd } from "@/lib/seo";
import { SIDE_LANDINGS, sideOfSlug, sidePath, sideUrl } from "@/lib/sides";
import { contactHref, pagePath } from "@/lib/site";

export const dynamicParams = false;
export function generateStaticParams() {
  // Both languages' words for each side, so the other language's word redirects instead of answering 404.
  return LOCALES.flatMap((locale) => SIDE_LANDINGS.map(({ locale: slugLocale, side }) => ({ locale, side: sidePath(slugLocale, side).split("/")[2]! })));
}

const OUTCOME_ICONS = { a: <ShieldIcon />, b: <EyeIcon />, c: <CheckIcon /> } as const;
const HOW_ICONS = { keep: <KeepIcon />, read: <SearchIcon />, prove: <LockIcon /> } as const;

const resolve = async (params: Promise<{ locale: string; side: string }>) => {
  const { locale: raw, side: slug } = await params;
  const locale = asLocale(raw);
  const found = sideOfSlug(slug);
  return { locale, found };
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string; side: string }> }): Promise<Metadata> {
  const { locale, found } = await resolve(params);
  if (!found) return {};
  const t = getDictionary(locale);
  const w = t.sides[found.side];
  const languages = Object.fromEntries(LOCALES.map((l) => [l, sideUrl(l, found.side)]));
  return {
    title: { absolute: w.seoTitle },
    description: w.seoDescription,
    alternates: { canonical: sideUrl(locale, found.side), languages: { ...languages, "x-default": sideUrl("en", found.side) } },
    openGraph: { type: "website", siteName: t.meta.siteName, title: w.seoTitle, description: w.seoDescription, url: sideUrl(locale, found.side), locale: locale === "en" ? "en_CA" : "fr_CA", images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: t.meta.siteName }] },
    twitter: { card: "summary_large_image", title: w.seoTitle, description: w.seoDescription, images: [OG_IMAGE] },
  };
}

/** The landing for one side of the lease: the hero, the steps and the examples speak to a tenant or to a landlord. */
export default async function SideLanding({ params }: { params: Promise<{ locale: string; side: string }> }) {
  const { locale, found } = await resolve(params);
  if (!found) notFound();
  const t0 = getDictionary(locale);
  const side: Audience = found.side;
  const soon = AUDIENCE_STATUS[side] === "soon";
  const info = side === "freelancer" || side === "business" ? t0.sides.soonInfo[side] : null;
  // The other language's word for the side goes to this language's address.
  if (found.slugLocale !== locale) permanentRedirect(sidePath(locale, side));
  const t = t0;
  const w = t.sides[side];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="home" />
      <main id="content">
        <AudiencePicker locale={locale} current={side} label={t.sides.switchLabel} hint={t.landing.switchHint} words={{ tenant: t.sides.tenant.switch, landlord: t.sides.landlord.switch, freelancer: t.sides.freelancer.switch, business: t.sides.business.switch }} soon={t.sides.soon} other={t.sides.other} />
        <PageHero id="hero" eyebrow={w.eyebrow} title={w.title} lead={w.lead}>
          {soon ? (
            <Badge tone="warning" data-testid="soon-badge">
              {t.sides.soon}
            </Badge>
          ) : null}
          <Button asChild variant="primary" size="lg" shape="cut" shimmer magnetic>
            <a href={contactHref(`dev-yomizaka-${side}`)}>{t.landing.talk}</a>
          </Button>
          <Button asChild variant="secondary" size="lg" shape="cut">
            <Link href={pagePath(locale, "run")}>{t.landing.seeRun}</Link>
          </Button>
        </PageHero>

        {info ? (
          <Section id="soon" spacing="sm" title={info.title} divider>
            <ul className="grid max-w-3xl gap-2 text-sm text-fg-secondary">
              <li>{info.today}</li>
              <li>{info.next}</li>
            </ul>
          </Section>
        ) : null}

        <Section id="outcomes" eyebrow={t.landing.outcomes.eyebrow} title={w.outcomesTitle} reveal divider>
          <CardGrid min={300}>
            {(["a", "b", "c"] as const).map((id) => (
              <LinkCard key={id} layout="stack" href={id === "c" ? pagePath(locale, "verify") : id === "b" ? `/${locale}/sign-in` : pagePath(locale, "run")} icon={OUTCOME_ICONS[id]} title={w.outcomes[id].title} description={w.outcomes[id].text} cta={w.outcomes[id].cta} linkAs={Link} />
            ))}
          </CardGrid>
        </Section>

        <Section id="how" eyebrow={t.landing.how.eyebrow} title={t.landing.how.title} lead={t.landing.how.lead} reveal divider>
          <ol className="grid gap-4 md:grid-cols-3">
            {(["keep", "read", "prove"] as const).map((id, i) => (
              <li key={id} className="flex flex-col gap-2 rounded-xl border border-border-default bg-surface-1 p-5" data-reveal="">
                <span className="flex items-center gap-3 text-fg-accent">
                  <span className="font-mono text-xs">{String(i + 1).padStart(2, "0")}</span>
                  <span aria-hidden className="[&_svg]:h-5 [&_svg]:w-5">
                    {HOW_ICONS[id]}
                  </span>
                </span>
                <h3 className="text-base font-semibold text-fg">{w.how[id].title}</h3>
                <p className="text-sm leading-relaxed text-fg-secondary">{w.how[id].text}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="examples" eyebrow={w.examples.eyebrow} title={w.examples.title} lead={w.examples.lead} reveal divider>
          <ul className="grid gap-3 md:grid-cols-2">
            {(["a", "b", "c", "d"] as const).map((id) => (
              <li key={id} className="rounded-xl border border-border-default bg-surface-1 p-4 text-sm leading-relaxed text-fg-secondary" data-reveal="">
                {w.examples.items[id]}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <MascotQuote bird="owl" label={t.landing.how.owlLabel} variant="callout">
              {w.owl}
            </MascotQuote>
          </div>
        </Section>

        <Section id="closing" spacing="sm">
          <CtaPanel title={t.landing.closing.title} body={t.landing.closing.body} reveal>
            <Button asChild variant="primary" size="lg" shape="cut">
              <a href={contactHref(`dev-yomizaka-${side}-closing`)}>{t.landing.talk}</a>
            </Button>
          </CtaPanel>
        </Section>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
