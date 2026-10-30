import { randomUUID } from "node:crypto";

import type { Applied, ApplyInput } from "@krizaka/coupons";
import type { Query } from "@krizaka/db";
import { PaymentsError } from "@krizaka/payments";
import { subMinutes } from "@krizaka/time";

import { query, transaction } from "../db";
import { refuse } from "../http";
import { logError } from "../log";
import { coupons, guarded } from "./instance";

// @fixed: how long before its reservation ends the unpaid session expires, so the use is never held past the session's own end (ADR-002 §4.1, the deadline protocol)
const SESSION_MARGIN_MINUTES = 5;

/** Whether the account has paid before: a subscription it ever had, or a credit it bought. « New customers only » reads this, never the processor. */
export async function hasPaidBefore(query: Query, accountId: string): Promise<boolean> {
  const [row] = await query<{ paid: boolean }>(
    `SELECT (a.subscription_status IS NOT NULL OR EXISTS (SELECT 1 FROM credits."grant" g WHERE g.account_id = a.id AND g.bucket = 'purchased')) AS paid FROM accounts a WHERE a.id = $1`,
    [accountId],
  );
  return row?.paid ?? false;
}

export interface Reservation {
  applied: Applied;
  /** When the unpaid session expires: before the reservation ends. */
  expiresAt: Date;
}

/** Step 1 of « Pay » (ADR-002 §4.1): reserves a use of the code in a short transaction, with no network call inside it. One key per attempt. */
export async function reserve(
  input: Omit<ApplyInput, "idempotencyKey" | "hasPaidBefore"> & { code: string },
): Promise<Reservation> {
  const paid = await hasPaidBefore(query, input.accountId);
  const applied = await guarded(() =>
    transaction((tx) =>
      coupons.apply(tx, { ...input, hasPaidBefore: paid, idempotencyKey: `checkout-${randomUUID()}` }),
    ),
  );
  return { applied, expiresAt: subMinutes(applied.reservedUntil, SESSION_MARGIN_MINUTES) };
}

/** Step 3: stores the processor's session on the reservation (it then outlives the session). A failure here loses nothing: the webhook finds the use by its id. */
export async function attach(
  reservation: Reservation,
  session: { checkoutRef: string; expiresAt: Date | null },
): Promise<void> {
  try {
    await transaction((tx) =>
      coupons.attachCheckout(tx, reservation.applied.redemptionId, session.checkoutRef, session.expiresAt),
    );
  } catch (error) {
    logError("coupons: the session could not be attached to its reservation (the webhook still finds it)", error);
  }
}

/** The session could not be made: the use is given back at once (the sweeper would, later). */
export async function giveBack(reservation: Reservation): Promise<void> {
  try {
    await transaction((tx) => coupons.release(tx, { redemptionId: reservation.applied.redemptionId }));
  } catch (error) {
    logError("coupons: a reservation could not be released (the sweeper will)", error);
  }
}

/** The processor refused the discount's terms (a repeating discount on a one-off payment): the code does not fit this purchase. */
export function badTerms(error: unknown): unknown {
  return error instanceof PaymentsError && error.code === "PAYMENTS_BAD_DISCOUNT"
    ? refuse(422, "COUPON_NOT_FOR_PLAN", "This code does not apply to this purchase")
    : error;
}
