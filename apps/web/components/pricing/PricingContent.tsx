import { PricingPage } from "@krizaka/ui/pricing-page";

import { ButtonLink } from "@/components/ButtonLink";
import { format, getDictionary, type Locale } from "@/lib/i18n";
import { signInPath } from "@/lib/nav";
import type { PricingPlan, PricingSoon } from "@/lib/prices/page";
import { contactHref } from "@/lib/site";

/**
 * The pricing page on the pricing template of @krizaka/ui (yomizaka#388). Prices and included volumes come from the catalogue
 * (props); every word is a message. What is not built is « soon » and carries no figure. Sign-up is closed while the product is in
 * development, so the call to action is sign-in and the status line says the same as the home. Above the largest included volume
 * there is no figure (the code bills no usage, #373): a quiet line leads to the contact form (#360).
 */
export function PricingContent({
  locale,
  sold,
  soon,
  freeFirst,
  launch,
  status,
}: Readonly<{
  locale: Locale;
  sold: PricingPlan[];
  soon: PricingSoon[];
  freeFirst: boolean;
  launch?: { headline: string; ends: string; lines: { plan: string; text: string }[] };
  status: string;
}>) {
  const p = getDictionary(locale).pricing;
  const words = (plan: string) => p.plans[plan as keyof typeof p.plans];
  const soonWords = (plan: string) => p.soon.items[plan as keyof typeof p.soon.items];
  const largest = Math.max(0, ...sold.map((s) => s.included ?? 0));
  return (
    <PricingPage
      title={p.title}
      lead={p.lead}
      toolbar={
        <>
          <p>{status}</p>
          {largest > 0 ? (
            <p data-volume>
              <a href={contactHref("dev-yomizaka-pricing-volume", locale)}>{format(p.volume, { included: largest })}</a>
            </p>
          ) : null}
          {launch ? (
            <p data-launch-offer>
              <strong>{launch.headline}</strong> {launch.ends}
            </p>
          ) : null}
        </>
      }
      plansLabel={p.plansLabel}
      plans={sold
        .filter((s) => words(s.plan))
        .map((s) => ({
          id: s.plan,
          name: words(s.plan).name,
          price: s.price,
          unit: s.per === "month" ? p.perMonth : p.perDossier,
          features: [
            ...words(s.plan).features,
            ...(s.included === null ? [] : [format(p.included, { included: s.included })]),
            ...(s.included !== null ? [s.overage === null ? p.paused : format(p.beyond, { rate: s.overage })] : []),
            ...(launch?.lines.filter((l) => l.plan === s.plan).map((l) => l.text) ?? []),
            ...(s.plan === "document" && freeFirst ? [p.freeFirst] : []),
            s.per === "month" ? p.cancel : p.noSubscription,
          ],
          action: (
            <ButtonLink href={signInPath(locale)} variant="secondary" size="md">
              {getDictionary(locale).chrome.signIn}
            </ButtonLink>
          ),
        }))}
      credits={
        soon.length
          ? {
              title: p.soon.title,
              children: (
                <>
                  <p>{p.soon.lead}</p>
                  <ul>
                    {soon
                      .filter((s) => soonWords(s.plan))
                      .map((s) => (
                        <li key={s.plan} data-soon={s.plan}>
                          <strong>{soonWords(s.plan).name}</strong> — {soonWords(s.plan).text} <em>{p.soon.badge}</em>
                        </li>
                      ))}
                  </ul>
                </>
              ),
            }
          : undefined
      }
    />
  );
}
