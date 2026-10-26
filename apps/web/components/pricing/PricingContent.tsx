import { PricingPage } from "@krizaka/ui/pricing-page";

import { ButtonLink } from "@/components/ButtonLink";
import { format, getDictionary, type Locale } from "@/lib/i18n";
import { signInPath } from "@/lib/nav";
import type { PricingPlan, PricingSoon } from "@/lib/prices/page";

/**
 * The pricing page on the pricing template of @krizaka/ui (yomizaka#388). Prices and included volumes come from the catalogue
 * (props); every word is a message. What is not built is « soon » and carries no figure. Sign-up is closed while the product is in
 * development, so the call to action is sign-in and the status line says the same as the home.
 */
export function PricingContent({ locale, sold, soon, freeFirst, status }: Readonly<{ locale: Locale; sold: PricingPlan[]; soon: PricingSoon[]; freeFirst: boolean; status: string }>) {
  const p = getDictionary(locale).pricing;
  const words = (plan: string) => p.plans[plan as keyof typeof p.plans];
  const soonWords = (plan: string) => p.soon.items[plan as keyof typeof p.soon.items];
  return (
    <PricingPage
      title={p.title}
      lead={p.lead}
      toolbar={<p>{status}</p>}
      plansLabel={p.plansLabel}
      plans={sold
        .filter((s) => words(s.plan))
        .map((s) => ({
          id: s.plan,
          name: words(s.plan).name,
          price: s.price,
          unit: s.per === "month" ? p.perMonth : p.perDocument,
          features: [
            ...words(s.plan).features,
            ...(s.included === null ? [] : [format(p.included, { included: s.included })]),
            ...(s.included !== null ? [p.paused] : []),
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
