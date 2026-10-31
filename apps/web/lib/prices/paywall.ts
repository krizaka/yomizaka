import { LIMIT, PRICE } from "../pricing";
import { money } from "./format";

/** A price on sale as the BFF sends it (`/api/billing`, from `publicCatalogue`). */
export interface SoldPrice {
  key: string;
  amountCents: number | null;
  limits: Record<string, number>;
}

/** The paywall's figures, from the catalogue: the price of one dossier, the Agencies subscription and what it includes. Null while one is missing (nothing is guessed). */
export function paywallFigures(
  prices: readonly SoldPrice[],
  locale: "en" | "fr",
): { document: string; agency: string; included: number } | null {
  const document = prices.find((p) => p.key === PRICE.document)?.amountCents;
  const agency = prices.find((p) => p.key === PRICE.agency);
  if (document == null || agency?.amountCents == null) return null;
  return {
    document: money(document, locale),
    agency: money(agency.amountCents, locale),
    included: agency.limits[LIMIT.included] ?? 0,
  };
}
