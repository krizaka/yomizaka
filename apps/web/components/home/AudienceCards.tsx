import { CheckIcon } from "@krizaka/icons";
import { Badge } from "@krizaka/ui/badge";
import { Section } from "@krizaka/ui/page";
import { type Audience } from "@yomizaka/core";
import Link from "next/link";

import { getDictionary, type Locale } from "@/lib/i18n";
import { sidePath } from "@/lib/sides";

/**
 * « Pour qui ? », in depth: one card per audience with its three checks. On a phone the cards are a swipeable row (each
 * 84 % wide, snapping, the next one peeking); from `md` a grid. « Bientôt » is a badge, and the checks that do not run yet
 * say so in their own line — a card never claims a check that does not run.
 */
export function AudienceCards({ locale, audiences }: { locale: Locale; audiences: readonly { audience: Audience; status: "available" | "soon" }[] }) {
  const d = getDictionary(locale);
  const t = d.landing.audiences;
  return (
    <Section id="audiences" eyebrow={t.eyebrow} title={t.title} lead={t.lead} reveal divider>
      <ul className="-mx-(--kz-page-gutter,1rem) m-0 flex list-none snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden px-(--kz-page-gutter,1rem) pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4" data-testid="audience-cards">
        {audiences.map(({ audience: a, status }) => {
          const soon = status === "soon";
          const checks = t.items[a].checks;
          return (
            <li key={a} className="flex w-[84%] shrink-0 snap-start md:w-auto" data-reveal="">
              <Link href={sidePath(locale, a)} className="group flex w-full flex-col gap-4 rounded-2xl border border-border-default bg-surface-1 p-5 transition-colors hover:border-border-strong hover:bg-surface-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring" data-testid={`audience-card-${a}`}>
                <span className="flex items-start justify-between gap-2">
                  <span className="text-lg font-semibold text-fg">{d.sides[a].switch}</span>
                  {soon ? <Badge tone="warning">{d.sides.soon}</Badge> : null}
                </span>
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {(["a", "b", "c"] as const).map((id) => (
                    <li key={id} className="flex items-start gap-2.5 text-sm leading-snug text-fg-secondary">
                      <span aria-hidden className="mt-0.5 shrink-0 text-fg-accent [&_svg]:size-4">
                        <CheckIcon />
                      </span>
                      {checks[id]}
                    </li>
                  ))}
                </ul>
                <span className="mt-auto text-sm font-semibold text-fg-accent group-hover:underline">{t.open} →</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
