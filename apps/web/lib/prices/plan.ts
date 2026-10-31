import { AVAILABILITY, type PriceCatalogue, type PriceEntry } from "@krizaka/settings";

import { refuse } from "../http";
import { DEFAULT_SUBSCRIPTION, LIMIT, SOLD, type SoldKind } from "../pricing";

/** What a subscription recorded when it was sold: the catalogue entry and the version (null for one sold before the catalogue). */
export interface SoldSubscription {
  planKey: string | null;
  priceVersionId: string | null;
}

/** The entry a checkout of this kind sells now: its version is what the account records. */
export const soldEntry = (catalogue: PriceCatalogue, kind: SoldKind, at: Date): Promise<PriceEntry> =>
  catalogue.entry(SOLD[kind].key, at);

const keyOf = (planKey: string | null) =>
  Object.values(SOLD).find((s) => s.key === planKey && s.mode === "subscription")?.key ??
  SOLD[DEFAULT_SUBSCRIPTION].key;

/** The price a subscription is held to: the version it was sold at, forever; without one, its plan (or the default plan) in force. */
export async function subscriptionEntry(
  catalogue: PriceCatalogue,
  sub: SoldSubscription,
  at: Date,
): Promise<PriceEntry> {
  const kept = sub.priceVersionId ? await catalogue.version(sub.priceVersionId) : null;
  return kept ?? catalogue.entry(keyOf(sub.planKey), at);
}

/** The verifications a month a subscription includes: the `included` limit of its catalogue entry. */
export const includedFor = async (catalogue: PriceCatalogue, sub: SoldSubscription, at: Date): Promise<number> =>
  (await subscriptionEntry(catalogue, sub, at)).limits[LIMIT.included] ?? 0;

/**
 * The price a checkout may charge: the catalogue entry, on sale with a figure, and the processor's price equal to it (amount and
 * currency). A change scheduled in the catalogue without its new processor price stops the sale (503 PRICE_MISMATCH) rather than
 * charge another amount than the one shown.
 */
export function onSale(
  entry: PriceEntry,
  processor: { amount: number; currency: string },
): PriceEntry & { amountCents: number } {
  if (
    entry.amountCents === null ||
    (entry.availability !== AVAILABILITY.public && entry.availability !== AVAILABILITY.founderLimited)
  ) {
    throw refuse(409, "NOT_ON_SALE", "This price is not on sale");
  }
  if (processor.amount !== entry.amountCents || processor.currency.toLowerCase() !== entry.currency.toLowerCase()) {
    throw refuse(503, "PRICE_MISMATCH", "The processor's price differs from the catalogue's");
  }
  return { ...entry, amountCents: entry.amountCents };
}

/** What one dossier beyond the included volume costs, in cents before taxes, at the rate the subscription was sold at (0: none, the account waits). */
export const overageFor = async (catalogue: PriceCatalogue, sub: SoldSubscription, at: Date): Promise<number> =>
  (await subscriptionEntry(catalogue, sub, at)).limits[LIMIT.overage] ?? 0;
