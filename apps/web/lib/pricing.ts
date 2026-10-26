import { AVAILABILITY, definePrices, UNIT } from "@krizaka/settings";

/**
 * Yomizaka's price catalogue — its SEED (ADR-009, krizaka/.github#253, yomizaka#367). Prices are data: the administrator
 * schedules a change from a date on admin.yomizaka.com (`/config/prices`), every change is audited, a subscription keeps the
 * version it was sold at. These are only the defaults of the pricing audit (CAD, plus taxes — the processor adds GST and QST).
 * Nothing but the catalogue (`lib/prices/catalogue.ts`) reads this module; pages, the paywall and the checkout read the catalogue.
 */
export const PRICE = {
  /** One document verified, paid per document. */
  document: "yomizaka.document",
  /** Small business (PME), agencies and property managers: a month, with verifications included and a price for each one beyond. */
  agency: "yomizaka.agency",
  /** Firms (études) and corporate: a month, with more verifications included and a lower price beyond. */
  firm: "yomizaka.firm",
  /** A dedicated API over 5 000 verifications a month: on quote; its internal target per document, never on a public page. */
  api: "yomizaka.api",
  /** In preparation (no figure): the full applicant file, background checks, screening alone. */
  fullFile: "yomizaka.fullFile",
  backgroundCheck: "yomizaka.backgroundCheck",
  screening: "yomizaka.screening",
} as const;
export type PriceKey = (typeof PRICE)[keyof typeof PRICE];

/** The named limits an entry holds: the verifications a month includes, the price of each one beyond (cents). */
export const LIMIT = { included: "included", overageCents: "overageCents" } as const;

export const PRICES = definePrices([
  { product: "yomizaka", plan: "document", unit: UNIT.document, amountCents: 65, availability: AVAILABILITY.public },
  { product: "yomizaka", plan: "agency", unit: UNIT.month, amountCents: 5900, availability: AVAILABILITY.public, limits: { [LIMIT.included]: 100, [LIMIT.overageCents]: 45 } },
  { product: "yomizaka", plan: "firm", unit: UNIT.month, amountCents: 27900, availability: AVAILABILITY.public, limits: { [LIMIT.included]: 750, [LIMIT.overageCents]: 32 } },
  { product: "yomizaka", plan: "api", unit: UNIT.document, amountCents: 22, availability: AVAILABILITY.internal },
  { product: "yomizaka", plan: "fullFile", unit: UNIT.document, amountCents: null, availability: AVAILABILITY.preparing },
  { product: "yomizaka", plan: "backgroundCheck", unit: UNIT.document, amountCents: null, availability: AVAILABILITY.preparing },
  { product: "yomizaka", plan: "screening", unit: UNIT.document, amountCents: null, availability: AVAILABILITY.preparing },
]);

/**
 * What the processor sells, by checkout kind: the catalogue entry it charges and the processor's price (its lookup key, the
 * same as `deploy/payments-catalogue.json`; `lib/pricing.test.ts` keeps the amounts equal to the seed). A changed amount in the
 * catalogue needs a new processor price under a new key — the checkout refuses while the two differ.
 */
export const SOLD = {
  document: { key: PRICE.document, lookupKey: "yomizaka_document_cad", mode: "payment" },
  agency: { key: PRICE.agency, lookupKey: "yomizaka_agency_monthly_cad", mode: "subscription" },
  firm: { key: PRICE.firm, lookupKey: "yomizaka_firm_monthly_cad", mode: "subscription" },
} as const;
export type SoldKind = keyof typeof SOLD;
export const SOLD_KINDS = Object.keys(SOLD) as SoldKind[];
export const isSoldKind = (v: string): v is SoldKind => (SOLD_KINDS as string[]).includes(v);
/** The subscription a subscribed account is on when it recorded none (one sold before the catalogue): the first plan. */
export const DEFAULT_SUBSCRIPTION: SoldKind = "agency";
