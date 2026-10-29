import { isSoldKind, type SoldKind } from "./pricing";

/** The query parameter the checkout's return URLs carry (`/api/billing/checkout`): the kind bought, or `cancelled`. */
export const PAID_KEY = "paid";

export type PaymentReturn = { state: "paid"; kind: SoldKind } | { state: "cancelled" };

/** What the return from the processor's checkout says; anything else (absent, repeated, unknown) is no return at all, never a guess. */
export function paymentReturnOf(raw: string | string[] | undefined): PaymentReturn | null {
  if (raw === "cancelled") return { state: "cancelled" };
  if (typeof raw === "string" && isSoldKind(raw)) return { state: "paid", kind: raw };
  return null;
}
