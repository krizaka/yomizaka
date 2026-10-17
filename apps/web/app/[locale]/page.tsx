import { CheckIcon, EyeIcon, GlobeIcon, KeepIcon, LockIcon, SearchIcon, ShieldIcon } from "@krizaka/icons";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { CardGrid } from "@krizaka/ui/card-grid";
import { CtaPanel } from "@krizaka/ui/cta-panel";
import { LinkCard } from "@krizaka/ui/link-card";
import { MascotQuote } from "@krizaka/ui/mascot-quote";
import { MetaRow } from "@krizaka/ui/meta-row";
import { Section } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import Link from "next/link";
import { preconnect } from "react-dom";

import { JourneyTour } from "@/components/JourneyTour";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, format, getDictionary } from "@/lib/i18n";
import { HOW_STEPS, OUTCOMES, productStatus, TRUST } from "@/lib/landing";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { contactHref, pagePath, REPO_URL } from "@/lib/site";
import { MEDIA_CDN, TOUR_RUNS, TOUR_STEPS, tourClip, type TourDevice } from "@/lib/tour";

import preview from "../../../../dev-preview.json";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "home");
}

const OUTCOME_ICONS = { clauses: <ShieldIcon />, edits: <EyeIcon />, proof: <CheckIcon /> } as const;
const HOW_ICONS = { keep: <KeepIcon />, read: <SearchIcon />, prove: <LockIcon /> } as const;
const TRUST_ICONS = { canada: <GlobeIcon />, traced: <SearchIcon />, open: <KeepIcon /> } as const;

/**
 * dev.yomizaka.com — one story in five sections (lib/landing.ts): the promise and the real journey recorded on the app,
 * what you can do, how it works, why you can trust it, the closing call. Every block is @krizaka/ui's, in ink indigo.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const d = getDictionary(locale).landing;
  const status = productStatus(preview);
  const signIn = `/${locale}/sign-in`;
  const destination = { run: pagePath(locale, "run"), verify: pagePath(locale, "verify"), "sign-in": signIn } as const;
  const trustHref = { canada: pagePath(locale, "privacy"), traced: pagePath(locale, "run"), open: REPO_URL } as const;
  const steps = (device: TourDevice) =>
    TOUR_STEPS.map((id) => {
      const clip = tourClip(device, id);
      const w = d.tour.steps[id];
      return { id, title: w.title, description: w.text, alt: w.alt, poster: clip.poster, video: { webm: clip.webm, mp4: clip.mp4 } };
    });
  // The first poster is the page's LCP: open the CDN's connection now and fetch the poster of the frame shown (phone below
  // md, browser from md) at once — React hoists these links into <head>.
  preconnect(MEDIA_CDN);
  return (
    <>
      <link rel="preload" as="image" href={tourClip("phone", "keep").poster} media="(max-width: 767px)" fetchPriority="high" />
      <link rel="preload" as="image" href={tourClip("desktop", "keep").poster} media="(min-width: 768px)" fetchPriority="high" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="home" />
      <main id="content">
        {/* 1 · The promise, and the real journey as its proof — painted at once (LCP), never revealed. */}
        <PageHero id="hero" eyebrow={d.eyebrow} title={d.title} lead={d.lead}>
          <Button asChild variant="primary" size="lg" shape="cut" shimmer magnetic>
            <a href={contactHref("dev-yomizaka-hero")}>{d.talk}</a>
          </Button>
          <Button asChild variant="secondary" size="lg" shape="cut">
            <Link href={pagePath(locale, "run")}>{d.seeRun}</Link>
          </Button>
          <figure className="m-0 mt-8 flex basis-full flex-col gap-3">
            <JourneyTour
              label={d.tour.label}
              phone={steps("phone")}
              desktop={steps("desktop")}
              address={d.tour.address}
              words={{ play: d.tour.play, pause: d.tour.pause, step: d.tour.step }}
            />
            <figcaption className="text-center font-mono text-xs text-fg-muted md:text-start">{format(d.tour.recorded, { run: TOUR_RUNS.desktop.slice(0, 8) })}</figcaption>
          </figure>
        </PageHero>

        {/* 2 · What you can do — outcomes, each card a way in. */}
        <Section id="outcomes" eyebrow={d.outcomes.eyebrow} title={d.outcomes.title} reveal divider>
          <CardGrid min={300}>
            {OUTCOMES.map((o) => (
              <LinkCard
                key={o.id}
                layout="stack"
                href={destination[o.to]}
                icon={OUTCOME_ICONS[o.id]}
                title={d.outcomes[o.id].title}
                description={d.outcomes[o.id].text}
                cta={d.outcomes[o.id].cta}
                linkAs={Link}
              />
            ))}
          </CardGrid>
        </Section>

        {/* 3 · How it works — who does what, in three steps; the owl keeps its promise. */}
        <Section id="how" eyebrow={d.how.eyebrow} title={d.how.title} lead={d.how.lead} reveal divider>
          <ol className="grid gap-4 md:grid-cols-3">
            {HOW_STEPS.map((id, i) => (
              <li key={id} className="flex flex-col gap-2 rounded-xl border border-border-default bg-surface-1 p-5" data-reveal="">
                <span className="flex items-center gap-3 text-fg-accent">
                  <span className="font-mono text-xs">{String(i + 1).padStart(2, "0")}</span>
                  <span aria-hidden className="[&_svg]:h-5 [&_svg]:w-5">
                    {HOW_ICONS[id]}
                  </span>
                </span>
                <h3 className="text-base font-semibold text-fg">{d.how.steps[id].title}</h3>
                <p className="text-sm leading-relaxed text-fg-secondary">{d.how.steps[id].text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <MascotQuote bird="owl" label={d.how.owlLabel} variant="callout">
              {d.how.owl}
            </MascotQuote>
          </div>
        </Section>

        {/* 4 · Trust — where the documents live, what is traced, the code; the engine named once; the honest status. */}
        <Section id="trust" eyebrow={d.trust.eyebrow} title={d.trust.title} lead={d.trust.lead} reveal divider>
          <CardGrid min={300}>
            {TRUST.map((id) => (
              <LinkCard key={id} layout="stack" href={trustHref[id]} icon={TRUST_ICONS[id]} title={d.trust[id].title} description={d.trust[id].text} cta={d.trust[id].cta} linkAs={Link} />
            ))}
          </CardGrid>
          <MetaRow
            className="mt-6"
            size="md"
            items={[d.trust.powered, "Apache-2.0"]}
            chips={[
              <Badge key="status" tone={status === "preview" ? "accent" : "warning"} title={d.status[status]}>
                {d.statusChip[status]}
              </Badge>,
            ]}
          />
          <p className="mt-2 max-w-2xl text-sm text-fg-secondary">{d.status[status]}</p>
        </Section>

        {/* 5 · The closing call — the one action while sign-up is closed. */}
        <Section id="closing" spacing="sm">
          <CtaPanel title={d.closing.title} body={d.closing.body} reveal>
            <Button asChild variant="primary" size="lg" shape="cut">
              <a href={contactHref("dev-yomizaka-closing")}>{d.talk}</a>
            </Button>
          </CtaPanel>
        </Section>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
