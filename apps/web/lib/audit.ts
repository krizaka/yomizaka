import { type AuditEntryInput, createAudit } from "@krizaka/audit";
import type { Query } from "@krizaka/db";

import { systemClock } from "../app/system-clock";
import { clientIp } from "./client-ip";
import { query } from "./db";
import { logError } from "./log";

type Entry = { action: string; actorId: string | null; actorLabel: string; targetId?: string | null; detail?: Record<string, unknown>; headers?: Headers };

/** The trail of what matters (`@krizaka/audit`, table `audit.entry`): who did what, when, from which address. Append-only. */
export const trail = createAudit({
  clock: systemClock,
  onError: (error, entry) => logError(`audit: ${entry.action} not recorded`, error),
});

// @fixed: the length `audit.entry.actor_label` accepts (CHECK 1..120)
const LABEL_MAX = 120;

/** The kind of what an entry is about: the domain of its action (`document.deleted` is about a `document`). */
const targetType = (action: string) => action.split(".")[0]!;

function inputOf(entry: Entry): AuditEntryInput {
  return {
    actorId: entry.actorId,
    actorLabel: entry.actorLabel.trim().slice(0, LABEL_MAX) || "unknown",
    action: entry.action,
    target: entry.targetId ? { type: targetType(entry.action), id: entry.targetId } : null,
    detail: entry.detail ?? {},
    ip: entry.headers ? clientIp(entry.headers) : null,
  };
}

/** One line of the trail, written with the caller's own runner: inside a transaction it commits (or not) with the change it records, and its failure is the caller's. */
export async function auditIn(run: Query, entry: Entry): Promise<void> {
  await trail.record(run, inputOf(entry));
}

/** The same, beside the work: a failure is logged, never thrown (a trail that cannot be written must not break the request). */
export async function audit(entry: Entry) {
  await trail.recordQuietly(query, inputOf(entry));
}
