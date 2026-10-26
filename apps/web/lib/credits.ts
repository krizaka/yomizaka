import { auditsUsedThisMonth, entitlementOf } from "./billing";
import { query } from "./db";
import { type CreditsFigure,creditsFigure } from "./home-b2";
import { auditCapsOf } from "./settings/boundary";
import { settingsFor } from "./settings/guards";

/** What an account has, read from its billing state (the entitlement, this month's audits, the fair-use cap): the home's credits and the check page's plan strip say the same numbers. */
export async function creditsOf(owner: string, now: Date): Promise<CreditsFigure> {
  const [entitlement, used, settings] = await Promise.all([entitlementOf(query, owner, now), auditsUsedThisMonth(query, owner, now), settingsFor(owner)]);
  return creditsFigure(entitlement, used, auditCapsOf(settings, "pro").perMonth);
}
