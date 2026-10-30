import { randomUUID } from "node:crypto";

import { z } from "zod";

import { requireSession } from "@/lib/access";
import { audit } from "@/lib/audit";
import { clientAddress } from "@/lib/client-address";
import { hasPaidBefore } from "@/lib/coupons/checkout";
import { coupons, guarded } from "@/lib/coupons/instance";
import { query, transaction } from "@/lib/db";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const body = z.object({ code: z.string().trim().min(1).max(80) });

/**
 * Redeems a credit code: the same rules as a discount, then a capped, expiring grant on the credits ledger, in one transaction. One key per try, so a double click
 * is one grant (and a second code for the same account is refused by the code's own per-account limit).
 */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    const { code } = await readJson(req, body);
    const redeemed = await guarded(async () =>
      transaction(async (tx) =>
        coupons.redeemCredit(tx, {
          code,
          accountId: session.account.id,
          idempotencyKey: `redeem-${randomUUID()}`,
          ip: clientAddress(req.headers),
          hasPaidBefore: await hasPaidBefore(query, session.account.id),
        }),
      ),
    );
    await audit({
      action: "billing.credit_code_redeemed",
      actorId: session.account.id,
      actorLabel: session.account.email,
      detail: { redemptionId: redeemed.redemptionId, credits: redeemed.credits },
      headers: req.headers,
    });
    return Response.json({
      credits: redeemed.credits,
      expiresAt: redeemed.expiresAt.toISOString(),
      replayed: redeemed.replayed,
    });
  });
}
