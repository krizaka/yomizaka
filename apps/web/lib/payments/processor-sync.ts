import { stripeCall } from "@krizaka/payments";

import { type PaymentsSettings } from "./config";
import { type PriceSync, type SyncEntry, syncProcessorPrices } from "./price-sync";

/** The sync from the deployment's settings: « off » when no processor key is configured, « live » (nothing done) for a live key, else the result in test mode. */
export async function processorSync(
  e: PaymentsSettings,
  entries: readonly SyncEntry[],
): Promise<PriceSync | "off" | "live"> {
  if (e.PAYMENTS_PROVIDER !== "stripe" || !e.PAYMENTS_STRIPE_SECRET_KEY) return "off";
  const stripe = stripeCall({ secretKey: e.PAYMENTS_STRIPE_SECRET_KEY });
  return stripe.mode === "live" ? "live" : syncProcessorPrices(stripe, entries);
}
