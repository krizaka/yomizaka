/** The subscription states in which the processor could not collect a payment: the plan lapses until the card is updated. */
const COLLECTION_FAILED = new Set(["past_due", "unpaid"]);

/**
 * Whether the account should be told its last subscription payment did not go through. Only with a customer at the processor,
 * because the way out is its secure portal (`/api/billing/portal`); `incomplete` is a checkout still completing, never a failure.
 */
export function paymentProblemOf({ subscriptionStatus, hasCustomer }: Readonly<{ subscriptionStatus: string | null; hasCustomer: boolean }>): boolean {
  return hasCustomer && subscriptionStatus !== null && COLLECTION_FAILED.has(subscriptionStatus);
}
