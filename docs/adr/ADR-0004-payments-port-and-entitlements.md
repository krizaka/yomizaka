# ADR-0004 — Payments behind a port, entitlements as data

Status: accepted (2026-10-22). Issue: krizaka/yomizaka#138.

## Context
Yomizaka sells one free audit per account, then 9,99 $ CAD per audit or 29 $ CAD/month Pro. The org rules: the domain has no
infrastructure and no vendor SDK, a vendor is chosen in configuration, prices and rules are data.

## Decision
- **A payments port** (the shared `@krizaka/payments` port): `createCustomer`, `checkout`, `portal`, `parseWebhook`. It speaks plans and
  **vendor-free events** (`payment_paid {kind}`, `subscription_started`, `subscription_changed`). The domain (`lib/billing.ts`) imports
  nothing from a vendor.
- **The adapter is configuration**: `@krizaka/payments` (krizaka-ui ADR-005; a small client over `fetch`, no SDK) is chosen by
  `PAYMENTS_PROVIDER` in `lib/payments/config.ts`, the only file that reads the environment for payments. Another processor
  is another adapter.
- **Prices are data at the processor**, found by lookup key (`PAYMENTS_PRICE_KEY_*`); `pnpm payments:setup` (`deploy/payments-catalogue.json`) creates them.
  The fair-use cap is configuration (`APP_FAIR_USE_AUDITS_PER_MONTH`). No amount is typed in the code.
- **Taxes**: the processor's automatic tax (GST 5 % + QST 9.975 % for Québec) and its invoices carry Krizaka's registration numbers.
- **Entitlements** (migration `0009_billing`): `accounts.free_audit_used_at`, `audit_credits`, `plan`, `subscription_status`,
  `current_period_end`, `payment_customer_id`; `payment_events(id)` makes each notification apply once. The free audit and
  a credit are taken with a single conditional `UPDATE` (no double spend) and given back if the run cannot start.
- **Exempt**: accounts an operator created (QA, personas) have no `terms_accepted_at` and are never charged.

## Consequences
The webhook is the only writer of paid state. Live mode is a change of keys and of the processor account, not of code.
