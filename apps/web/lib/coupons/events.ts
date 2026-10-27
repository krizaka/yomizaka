import type { Query } from "@krizaka/db";
import type { PaymentEvent } from "@krizaka/payments";

import { coupons } from "./instance";

type Paid = Extract<PaymentEvent, { type: "payment_paid" | "subscription_started" }>;

/**
 * A payment that used a promo code confirms its use, in the event's own transaction (ADR-002 §4.1 step 4): found by the `redemption_id` the checkout
 * was created with, or by the session when the attach never ran. A payment without a code finds nothing and changes nothing; a replay is « already ».
 */
export async function confirmCoupon(tx: Query, e: Paid): Promise<void> {
  const redemptionId = e.metadata.redemption_id ?? null;
  if (!redemptionId && !e.checkoutRef) return;
  await coupons.redeem(tx, {
    redemptionId,
    checkoutRef: e.checkoutRef,
    paymentRef: e.paymentRef ?? e.invoiceRef,
    amountPaidMinor: e.amountTotal,
    amountDiscountMinor: e.amountDiscount,
    currency: e.currency,
  });
}

/** An unpaid session expired: its reserved use is free again. */
export async function releaseCoupon(tx: Query, e: Extract<PaymentEvent, { type: "checkout_expired" }>): Promise<void> {
  await coupons.release(tx, { ...(e.metadata.redemption_id ? { redemptionId: e.metadata.redemption_id } : {}), checkoutRef: e.checkoutRef });
}

/** A refund adds up on the use (the amount is the payment's cumulative refunds); a full refund gives the use back only when the admin allowed it. */
export async function refundCoupon(tx: Query, e: Extract<PaymentEvent, { type: "payment_refunded" }>): Promise<void> {
  await coupons.refund(tx, { paymentRef: e.paymentRef, invoiceRef: e.invoiceRef, amountRefunded: e.amountRefunded });
}
