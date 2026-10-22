import type { QueryResultRow } from "pg";

import { refuse } from "./http";
import type { PaymentEvent } from "./payments/port";

/**
 * Entitlements — the domain, vendor-free (it speaks the payments port's events, never a processor's). A self-serve account
 * (one that accepted the terms at sign-up) gets ONE free audit, then pays per audit (a credit) or subscribes to Pro,
 * unlimited under a fair-use cap that is configuration (`APP_FAIR_USE_AUDITS_PER_MONTH`, passed in). Accounts created by an
 * operator (QA, demo personas) are exempt. The stored state mirrors the processor's notifications, each applied once.
 */
type Query = <T extends QueryResultRow>(text: string, values?: unknown[]) => Promise<T[]>;
export type AuditVia = "exempt" | "free" | "credit" | "pro";

export interface Entitlement {
  selfServe: boolean;
  freeAuditUsed: boolean;
  credits: number;
  pro: boolean;
  proUntil: string | null;
  subscriptionStatus: string | null;
  hasCustomer: boolean;
}

const ROW = `SELECT (terms_accepted_at IS NOT NULL) AS self_serve, (free_audit_used_at IS NOT NULL) AS free_used, audit_credits, plan,
  subscription_status, current_period_end, (payment_customer_id IS NOT NULL) AS has_customer FROM accounts WHERE id = $1`;

export async function entitlementOf(query: Query, accountId: string, now: Date): Promise<Entitlement> {
  const [r] = await query<{ self_serve: boolean; free_used: boolean; audit_credits: number; plan: string; subscription_status: string | null; current_period_end: Date | null; has_customer: boolean }>(ROW, [accountId]);
  if (!r) throw refuse(404, "NOT_FOUND", "No such account");
  const live = r.subscription_status === "active" || r.subscription_status === "trialing";
  const pro = r.plan === "PRO" && live && (!r.current_period_end || r.current_period_end > now);
  return { selfServe: r.self_serve, freeAuditUsed: r.free_used, credits: r.audit_credits, pro, proUntil: r.current_period_end?.toISOString() ?? null, subscriptionStatus: r.subscription_status, hasCustomer: r.has_customer };
}

/**
 * Takes the right to one audit, atomically (two requests cannot spend the same free audit or credit). Throws 402 PAYWALL when
 * there is none, 429 FAIR_USE past the Pro cap. The caller gives it back with `releaseAudit` if the run could not start.
 */
export async function reserveAudit(query: Query, accountId: string, now: Date, fairUsePerMonth: number): Promise<AuditVia> {
  const e = await entitlementOf(query, accountId, now);
  if (!e.selfServe) return "exempt";
  if (e.pro) {
    const [row] = await query<{ n: string }>("SELECT count(*) AS n FROM analyses a JOIN documents d ON d.id = a.document_id WHERE d.owner_id = $1 AND a.created_at >= date_trunc('month', $2::timestamptz)", [accountId, now]);
    if (Number(row?.n ?? 0) >= fairUsePerMonth) throw refuse(429, "FAIR_USE", "Monthly fair-use limit reached", { limit: fairUsePerMonth });
    return "pro";
  }
  if ((await query("UPDATE accounts SET free_audit_used_at = $2 WHERE id = $1 AND free_audit_used_at IS NULL RETURNING id", [accountId, now])).length) return "free";
  if ((await query("UPDATE accounts SET audit_credits = audit_credits - 1 WHERE id = $1 AND audit_credits > 0 RETURNING id", [accountId])).length) return "credit";
  throw refuse(402, "PAYWALL", "Payment required");
}

export async function releaseAudit(query: Query, accountId: string, via: AuditVia): Promise<void> {
  if (via === "free") await query("UPDATE accounts SET free_audit_used_at = NULL WHERE id = $1", [accountId]);
  if (via === "credit") await query("UPDATE accounts SET audit_credits = audit_credits + 1 WHERE id = $1", [accountId]);
}

/** A run that failed gives its audit back, once: the free audit or the credit it spent (Pro and exempt accounts spent nothing). */
export async function refundFailedAudit(query: Query, analysisId: string): Promise<boolean> {
  const [done] = await query<{ billed_via: string; document_id: string }>("UPDATE analyses SET billed_via = billed_via || '-refunded' WHERE id = $1 AND billed_via IN ('free', 'credit') RETURNING billed_via, document_id", [analysisId]);
  if (!done) return false;
  const [owner] = await query<{ owner_id: string }>("SELECT owner_id FROM documents WHERE id = $1", [done.document_id]);
  if (!owner) return false;
  await releaseAudit(query, owner.owner_id, done.billed_via.startsWith("free") ? "free" : "credit");
  return true;
}

/** Applies a verified payment event once: its id is recorded first (`ON CONFLICT DO NOTHING`), a replay changes nothing. */
export async function applyPaymentEvent(query: Query, event: PaymentEvent): Promise<"applied" | "duplicate" | "ignored"> {
  if (event.type === "ignored") return "ignored";
  const fresh = await query("INSERT INTO payment_events (id, type) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id", [event.id, event.type]);
  if (!fresh.length) return "duplicate";
  switch (event.type) {
    case "audit_paid":
      if (event.customerId) await query("UPDATE accounts SET payment_customer_id = COALESCE(payment_customer_id, $2) WHERE id = $1", [event.accountId, event.customerId]);
      await query("UPDATE accounts SET audit_credits = audit_credits + 1 WHERE id = $1", [event.accountId]);
      return "applied";
    case "subscription_started":
      if (event.customerId) await query("UPDATE accounts SET payment_customer_id = COALESCE(payment_customer_id, $2) WHERE id = $1", [event.accountId, event.customerId]);
      await query("UPDATE accounts SET plan = 'PRO', payment_subscription_id = $2, subscription_status = COALESCE(subscription_status, 'active') WHERE id = $1", [event.accountId, event.subscriptionId]);
      return "applied";
    case "subscription_changed": {
      const rows = await query(
        `UPDATE accounts SET plan = $3, subscription_status = $4, payment_subscription_id = $5, current_period_end = to_timestamp($6)
           WHERE payment_customer_id = $1 OR id::text = $2 RETURNING id`,
        [event.customerId, event.accountId, event.active ? "PRO" : "FREE", event.status, event.subscriptionId, event.periodEnd],
      );
      return rows.length ? "applied" : "ignored";
    }
  }
}
