import type { QueryResultRow } from "pg";

import { refuse } from "./http";

/**
 * Overage — the dossiers a subscription runs beyond the volume it includes (ADR-0015, krizaka-internal#45 slice D). The rate is the
 * administrator's (`overageCents` on the subscription's catalogue entry, the version it was sold at) and it is CHARGED here, once per
 * dossier and month, before the check runs: an invoice with one line, taxed by the processor, paid with the card on file. A retry
 * charges nothing more (the idempotency key is the dossier and the month); a check that could not run is refunded, once.
 * Vendor-free: the processor is the `OverageBiller` the edge gives (`lib/payments/overage-biller.ts`).
 */
type Query = <T extends QueryResultRow>(text: string, values?: unknown[]) => Promise<T[]>;

/** What the product asks of a payment processor for an overage: charge a dossier, give it back. */
export interface OverageBiller {
  /** Charges `amountMinor` (before taxes) once for `key`; resolves the invoice reference. Rejects with `declined` true when the card refuses. */
  charge(request: {
    key: string;
    customerId: string;
    amountMinor: number;
    description: string;
  }): Promise<{ ref: string }>;
  refund(ref: string, key: string): Promise<void>;
  /** True for the rejection of a card that refused (the account is asked to pay, nothing runs). */
  isDeclined(error: unknown): boolean;
}

export type OverageCharge = { dossierId: string; period: string };

const periodOf = (now: Date) => now.toISOString().slice(0, 7);
const keyOf = (c: OverageCharge) => `overage-${c.dossierId}-${c.period}`;

/** The dossier a document belongs to: its application file, or itself when it stands alone. */
export async function dossierOf(query: Query, documentId: string): Promise<string> {
  const [row] = await query<{ dossier: string }>(
    "SELECT COALESCE(screening_id, id) AS dossier FROM documents WHERE id = $1",
    [documentId],
  );
  if (!row) throw refuse(404, "NOT_FOUND", "No such document");
  return row.dossier;
}

/**
 * Bills the dossier once and records it. A card that refuses is a 402 `PAYWALL` (the account is asked to pay; nothing ran). The
 * charge is recorded after it went through; a crash between the two leaves a charge the next try finds by its key (the processor
 * answers the same invoice), so the record is written then and the dossier is never billed twice.
 */
export async function chargeOverage(
  query: Query,
  biller: OverageBiller,
  sale: { accountId: string; customerId: string; documentId: string; cents: number; now: Date; description: string },
): Promise<void> {
  const charge = { dossierId: await dossierOf(query, sale.documentId), period: periodOf(sale.now) };
  const [kept] = await query<{ refunded_at: Date | null }>(
    "SELECT refunded_at FROM overage_charges WHERE dossier_id = $1 AND period = $2",
    [charge.dossierId, charge.period],
  );
  if (kept && !kept.refunded_at) return;
  let ref: string;
  try {
    ({ ref } = await biller.charge({
      key: kept ? `${keyOf(charge)}-again` : keyOf(charge),
      customerId: sale.customerId,
      amountMinor: sale.cents,
      description: sale.description,
    }));
  } catch (error) {
    if (biller.isDeclined(error))
      throw refuse(402, "PAYWALL", "The card was declined for the dossier beyond the included volume");
    throw error;
  }
  await query(
    `INSERT INTO overage_charges (dossier_id, period, account_id, charge_ref, amount_cents, charged_at)
       VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (dossier_id, period) DO UPDATE SET charge_ref = EXCLUDED.charge_ref, charged_at = EXCLUDED.charged_at, refunded_at = NULL`,
    [charge.dossierId, charge.period, sale.accountId, ref, sale.cents, sale.now],
  );
}

/** Gives the dossier's overage back, once (a check that could not start or failed): nothing to give when none was charged or it was already. */
export async function refundOverage(
  query: Query,
  biller: OverageBiller,
  documentId: string,
  now: Date,
): Promise<boolean> {
  const charge = { dossierId: await dossierOf(query, documentId), period: periodOf(now) };
  const [row] = await query<{ charge_ref: string }>(
    "SELECT charge_ref FROM overage_charges WHERE dossier_id = $1 AND period = $2 AND refunded_at IS NULL",
    [charge.dossierId, charge.period],
  );
  if (!row) return false;
  // The processor first (its key makes a retry harmless), then the record: a refund that failed stays to give back.
  await biller.refund(row.charge_ref, `${keyOf(charge)}-refund`);
  await query("UPDATE overage_charges SET refunded_at = $3 WHERE dossier_id = $1 AND period = $2", [
    charge.dossierId,
    charge.period,
    now,
  ]);
  return true;
}
