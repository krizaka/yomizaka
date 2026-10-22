/**
 * The payments PORT. The domain (lib/billing.ts) knows plans, customers and these events — never a vendor. The adapter
 * (lib/payments/stripe-adapter.ts today) is chosen in configuration (lib/payments/config.ts); another processor is another
 * adapter. Prices are the vendor's data, found by the adapter: no amount appears in the code.
 */
export type PlanKind = "audit" | "pro";

/** What the domain learns from a processor, vendor-free. `id` is unique per event: the domain applies each once. */
export type PaymentEvent =
  | { id: string; type: "audit_paid"; accountId: string; customerId: string | null }
  | { id: string; type: "subscription_started"; accountId: string; customerId: string | null; subscriptionId: string | null }
  | { id: string; type: "subscription_changed"; accountId: string | null; customerId: string | null; subscriptionId: string; status: string; active: boolean; periodEnd: number | null }
  | { id: string; type: "ignored" };

export interface CheckoutRequest {
  kind: PlanKind;
  customerId: string;
  accountId: string;
  successUrl: string;
  cancelUrl: string;
  locale: "en" | "fr";
}

export interface PaymentsPort {
  /** Creates the processor's customer for an account (idempotent per account). */
  createCustomer(email: string, accountId: string): Promise<{ id: string }>;
  /** A hosted payment page for a plan; the amount, the taxes and the invoice are the processor's. */
  checkout(request: CheckoutRequest): Promise<{ url: string }>;
  /** The hosted page where the customer manages the subscription and the invoices. */
  portal(customerId: string, returnUrl: string, locale: "en" | "fr"): Promise<{ url: string }>;
  /** Verifies the notification's proof of origin (read from its headers) over the raw body and translates it; throws on a bad signature. */
  parseWebhook(rawBody: string, headers: Headers, nowSeconds: number): PaymentEvent;
}

export class PaymentsError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "PaymentsError";
  }
}
