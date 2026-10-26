import { AVAILABILITY, type PublicPrice } from "@krizaka/settings";

import { LIMIT } from "../pricing";
import { money } from "./format";

/** One line of the Tarifs page: its entry (the words are `pricing.rows.<plan>`), and its figures — none for an entry in preparation. */
export type PricingLine =
  | { plan: string; kind: "sold"; price: string; included: number | null; overage: string | null }
  | { plan: "first"; kind: "free" }
  | { plan: string; kind: "preparing" };

/**
 * The Tarifs page from the public catalogue (`publicCatalogue`: never an internal entry): what is on sale with its figure — one
 * document, then the first verification offered when `audit.freeFirst` is on, then the subscriptions with what they include and
 * the price beyond — and what is in preparation, without a figure. Nothing here is typed: every amount is the catalogue's.
 */
export function pricingLines(prices: readonly PublicPrice[], freeFirst: boolean, locale: "en" | "fr"): { sold: PricingLine[]; preparing: PricingLine[] } {
  const onSale = prices.filter((p) => p.amountCents !== null && (p.availability === AVAILABILITY.public || p.availability === AVAILABILITY.founderLimited));
  const line = (p: PublicPrice): PricingLine => {
    const overage = p.limits[LIMIT.overageCents];
    return { plan: p.plan, kind: "sold", price: money(p.amountCents!, locale), included: p.limits[LIMIT.included] ?? null, overage: overage === undefined ? null : money(overage, locale) };
  };
  const perUnit = onSale.filter((p) => p.unit !== "month" && p.unit !== "year").map(line);
  const subscriptions = onSale.filter((p) => p.unit === "month" || p.unit === "year").map(line);
  return {
    sold: [...perUnit, ...(freeFirst ? [{ plan: "first", kind: "free" } as const] : []), ...subscriptions],
    preparing: prices.filter((p) => p.availability === AVAILABILITY.preparing).map((p) => ({ plan: p.plan, kind: "preparing" })),
  };
}
