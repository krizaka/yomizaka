# ADR-0015: Overage — a dossier beyond the included volume is charged at the plan's rate

- Status: accepted (2026-10-30, the CTO, within the founder's validated grid: Agency 49 $ with 15 dossiers then 3 $ each, Manager 149 $ with 60 then 2 $)
- Issues: krizaka-internal#45 (slice D), #44 (the seed of the grid)
- Supersedes in part: ADR-0013 (« no overage »; its tests are rewritten, not removed)
- Note: the number 0014 was already taken (document tampering); this is the overage decision the handoff called ADR-0014.

## Context

ADR-0013 held an account at its included volume until next month (429 `FAIR_USE`) because the code billed no usage. The validated
grid sells the dossier and says what a dossier beyond the volume costs. A rate on a page that nothing charges is a false claim, so
the rate and the billing ship together, and the seed of the grid (#44) comes after this decision.

## Decision

- **The rate is data**: `overageCents` is a limit of the subscription's catalogue entry, in cents before taxes, edited in
  `/config/prices` like any limit (scheduled, audited, versioned). A subscription keeps the rate of the version it was sold at.
  No rate (or 0) means no overage: the account waits (`FAIR_USE`), as before.
- **How it is billed**: when a subscribed account starts a dossier beyond its included volume (and its daily cap), the product
  charges that dossier **at once, one dossier = one invoice line**, with the facade's `charge` (`@krizaka/payments`: an invoice with
  one line, taxed by the processor, paid with the card on file). No metered usage and no month-end batch: the customer sees each
  dossier on their invoices, and a month that stays within the volume costs nothing more.
- **Once per dossier and month**: the idempotency key is the dossier and the month (`overage_charges`, primary key
  `(dossier_id, period)`); the second check of the same dossier is on the house, as in ADR-0013's dossier rule, and a retry never charges twice.
- **A card that refuses** answers 402 `PAYWALL` (the account is asked to pay; nothing runs). **A check that cannot start or fails**
  refunds its overage once (`releaseAudit`, `refundFailedAudit`), like the free audit and the credit.
- **Payments off** (no processor configured): no overage is charged and the account waits. Nothing is billed that cannot be.
- **The pages** show the rate only from the seed of #44, which also adds the processor's price keys for the new amounts and turns
  « per document » into « per dossier ». `lib/prices/billed-charges.test.ts` is rewritten: an `overageCents` limit may exist only on
  a subscription, only `billing.ts` (through `lib/overage.ts`) reads it, and the code must charge it.

## Consequences

- Open: a monthly summary line instead of one invoice per dossier, if customers with many overage dossiers ask for it (a decision for
  after the first paying accounts); a dunning flow for a refused card (today the account sees the paywall).
- Guards: `lib/overage.test.ts` (once per dossier and month, a refusal, a refund once), `lib/billing.integration.test.ts` (the whole
  path on a real database), `lib/prices/billed-charges.test.ts`.
