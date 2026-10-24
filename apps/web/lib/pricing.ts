/**
 * Yomizaka's prices, as data. The payment processor charges what `deploy/payments-catalogue.json` declares (its lookup keys
 * are the ones of `lib/env.ts`); the pricing page reads this module, and `lib/pricing.test.ts` keeps the two equal. A price
 * changes in both places, in the same pull request, or in neither. Only what is sold today is here: a lot price or a full
 * Québec file is not, so the page says « In preparation » for them and promises no figure.
 */
export const CURRENCY = "CAD";

export const PRICING = {
  /** One document check, paid per check (`yomizaka_audit_cad`). */
  check: { cents: 999, lookupKey: "yomizaka_audit_cad" },
  /** Pro, billed monthly (`yomizaka_pro_monthly_cad`), with the monthly fair-use cap of its plan (`plans.pro.auditsPerMonth`). */
  pro: { cents: 2900, lookupKey: "yomizaka_pro_monthly_cad", auditsPerMonth: 100 },
  /** The first check is offered: the setting `audit.freeFirst`, on by default. */
  firstCheckFree: true,
} as const;

const LOCALE_TAG = { en: "en-CA", fr: "fr-CA" } as const;

/** A price for display, in the page's language (`9,99 $` in French, `$9.99` in English): from cents, never a float typed by hand. */
export function money(cents: number, locale: keyof typeof LOCALE_TAG): string {
  return new Intl.NumberFormat(LOCALE_TAG[locale], { style: "currency", currency: CURRENCY }).format(cents / 100);
}
