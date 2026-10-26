import type { CapsOf } from "../billing";
import { auditCapsOf, type Snapshot } from "../settings/boundary";
import { appPrices } from "./catalogue";
import { includedFor } from "./plan";

/** The caps of an account's plan at a date: the settings' (daily cap, bonus, first audit free) and its subscription's catalogue entry (included volume). */
export const capsFor =
  (settings: Snapshot, at: Date): CapsOf =>
  async (plan, entitlement) =>
    auditCapsOf(settings, plan, plan === "pro" ? await includedFor(appPrices(), entitlement, at) : 0);
