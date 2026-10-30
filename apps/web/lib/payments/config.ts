import { dbDiscountStore, type PaymentsPort, type PlanConfig, stripeAdapter } from "@krizaka/payments";

import { systemClock } from "../../app/system-clock";
import { query } from "../db";
import { SOLD, SOLD_KINDS } from "../pricing";

/** The settings the payments vendor needs — read from the environment by the edge (a route), passed in. */
export interface PaymentsSettings {
  PAYMENTS_PROVIDER?: string;
  PAYMENTS_STRIPE_SECRET_KEY?: string;
  PAYMENTS_STRIPE_WEBHOOK_SECRET?: string;
}

/** What the processor sells, by checkout kind: the price catalogue's sold entries (`lib/pricing.ts` SOLD), each found by its lookup key. */
const PLANS: Record<string, PlanConfig> = Object.fromEntries(
  SOLD_KINDS.map((kind) => [kind, { lookupKey: SOLD[kind].lookupKey, mode: SOLD[kind].mode }]),
);

/** The only place a payments vendor is chosen. Null = payments are off. A promo code's discount is made once per terms version and remembered in `payments.discount` (never a Stripe promotion code). */
export function paymentsFrom(e: PaymentsSettings): PaymentsPort | null {
  if (e.PAYMENTS_PROVIDER !== "stripe" || !e.PAYMENTS_STRIPE_SECRET_KEY || !e.PAYMENTS_STRIPE_WEBHOOK_SECRET)
    return null;
  return stripeAdapter({
    secretKey: e.PAYMENTS_STRIPE_SECRET_KEY,
    webhookSecret: e.PAYMENTS_STRIPE_WEBHOOK_SECRET,
    plans: PLANS,
    clock: systemClock,
    discounts: dbDiscountStore(query),
  });
}
