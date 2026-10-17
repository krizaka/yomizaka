import { ForwardIcon, KeepIcon, LockIcon, SearchIcon, ShieldIcon } from "@krizaka/icons";
import { Button } from "@krizaka/ui/button";
import { LandingPage } from "@krizaka/ui/landing-page";
import { MascotQuote } from "@krizaka/ui/mascot-quote";
import { NumberTicker } from "@krizaka/ui/number-ticker";
import { Section } from "@krizaka/ui/page";
import type { Metadata } from "next";
import Link from "next/link";

import { AppTake } from "@/components/home/AppTake";
import { AudienceCards } from "@/components/home/AudienceCards";
import { AudiencePicker } from "@/components/home/AudiencePicker";
import { ComparisonSection } from "@/components/home/ComparisonSection";
import { FaqSection } from "@/components/home/FaqSection";
import { HeroFlow } from "@/components/home/HeroFlow";
import { ProofSection } from "@/components/home/ProofSection";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, format, getDictionary } from "@/lib/i18n";
import { HERO_FIGURES, productStatus } from "@/lib/landing";
import { recordedRun } from "@/lib/recorded-runs";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { contactHref, pagePath } from "@/lib/site";
import { TAKE_CHAPTERS, takeFor } from "@/lib/tour";

import preview from "../../../../dev-preview.json";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "home");
}

const FEATURE_ICONS = { line: <ShieldIcon />, file: <SearchIcon />, find: <KeepIcon />, proof: <LockIcon /> } as const;

/**
 * dev.yomizaka.com — the product landing template of @krizaka/ui (`LandingPage`: split hero with the product in its window,
 * a band of figures, a bento of what it does, then our own sections, the closing call). The hero's visual is the real
 * recorded check, before/after; the figures are counted from it (`NumberTicker`), never typed. Orazaka, the engine, is named
 * only in the proof and in one FAQ answer.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const dict = getDictionary(locale);
  const d = dict.landing;
  const status = productStatus(preview);
  const run = recordedRun("tenant");
  const figures = HERO_FIGURES(run.report);
  const take = takeFor(locale);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="home" />
      <main id="content">
        <LandingPage
          eyebrow={d.eyebrow}
          title={d.title}
          lead={d.lead}
          visualLabel={d.hero.visualLabel}
          visual={<HeroFlow locale={locale} />}
          actions={
            <>
              <Button asChild variant="primary" size="lg" shape="cut" shimmer magnetic className="w-full sm:w-auto">
                <a href={contactHref("dev-yomizaka-hero")}>
                  {d.talk} <ForwardIcon size={16} strokeWidth={2.25} />
                </a>
              </Button>
              <Button asChild variant="secondary" size="lg" shape="cut" className="w-full sm:w-auto">
                <Link href={pagePath(locale, "run")}>{d.seeRun}</Link>
              </Button>
              <AudiencePicker
                locale={locale}
                label={dict.sides.switchLabel}
                hint={d.switchHint}
                words={{ tenant: dict.sides.tenant.switch, landlord: dict.sides.landlord.switch, freelancer: dict.sides.freelancer.switch, business: dict.sides.business.switch }}
                soon={dict.sides.soon}
                other={dict.sides.other}
              />
            </>
          }
          proofs={[
            { value: <NumberTicker value={figures.rules} locale={locale} />, label: d.figures.rules },
            { value: <NumberTicker value={figures.articles} locale={locale} />, label: d.figures.articles },
            { value: <NumberTicker value={figures.found} locale={locale} />, label: d.figures.found },
          ]}
          featuresHeading={{ eyebrow: d.features.eyebrow, title: d.features.title, lead: d.features.lead }}
          features={[
            { id: "line", size: "lg", icon: FEATURE_ICONS.line, title: d.features.items.line.title, text: d.features.items.line.text },
            { id: "file", size: "md", icon: FEATURE_ICONS.file, title: d.features.items.file.title, text: d.features.items.file.text },
            { id: "find", size: "sm", icon: FEATURE_ICONS.find, title: d.features.items.find.title, text: d.features.items.find.text },
            { id: "proof", size: "sm", icon: FEATURE_ICONS.proof, title: d.features.items.proof.title, text: d.features.items.proof.text },
          ]}
          closing={{
            title: d.closing.title,
            body: d.closing.body,
            actions: (
              <Button asChild variant="primary" size="lg" shape="cut">
                <a href={contactHref("dev-yomizaka-closing")}>{d.talk}</a>
              </Button>
            ),
          }}
        >
          <AudienceCards locale={locale} />
          <ProofSection locale={locale} />

          {/* The app, recorded as one take on a phone — below the fold, so the hero stays light. */}
          <Section id="app" eyebrow={d.app.eyebrow} title={d.app.title} lead={d.app.lead} reveal divider>
            <figure className="m-0 flex flex-col gap-3">
              <AppTake
                label={d.tour.label}
                address={d.tour.address}
                poster={take.poster}
                webm={take.webm}
                mp4={take.mp4}
                chapters={TAKE_CHAPTERS.map((id) => ({ id, title: d.app.chapters[id].title, text: d.app.chapters[id].text, at: take.chapters[id] }))}
                playLabel={d.tour.play}
                pauseLabel={d.tour.pause}
              />
              <figcaption className="text-center font-mono text-xs text-fg-muted md:text-start">{format(d.tour.recorded, { run: take.runId.slice(0, 8) })}</figcaption>
            </figure>
          </Section>

          <ComparisonSection locale={locale} />

          <Section id="promise" spacing="sm" reveal>
            <MascotQuote bird="owl" mood="success" label={d.how.owlLabel} variant="callout">
              {d.how.owl}
            </MascotQuote>
            <p className="mt-4 max-w-[70ch] text-sm text-fg-secondary">{d.status[status]}</p>
          </Section>

          <FaqSection locale={locale} />
        </LandingPage>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
