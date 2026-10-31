import { dossiersUsedThisMonth, entitlementOf } from "./billing";
import { query } from "./db";
import { type CreditsFigure, creditsFigure } from "./home-b2";
import { capsFor } from "./prices/caps";
import { settingsFor } from "./settings/guards";

/** What an account has, read from its billing state (the entitlement, this month's audits, the volume its subscription includes): the home's credits and the check page's plan strip say the same numbers. */
export async function creditsOf(owner: string, now: Date): Promise<CreditsFigure> {
  const [entitlement, used, settings] = await Promise.all([
    entitlementOf(query, owner, now),
    dossiersUsedThisMonth(query, owner, now),
    settingsFor(owner),
  ]);
  return creditsFigure(entitlement, used, (await capsFor(settings, now)("pro", entitlement)).perMonth);
}
