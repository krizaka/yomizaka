import { clientIp } from "./client-ip";
import { query } from "./db";
import { logError } from "./log";

type Entry = { action: string; actorId: string | null; actorLabel: string; targetId?: string | null; detail?: Record<string, unknown>; headers?: Headers };
type Run = (text: string, values?: unknown[]) => Promise<unknown>;

/** One line of the trail, written with the caller's own runner: inside a transaction it commits (or not) with the change it records, and its failure is the caller's. */
export async function auditIn(run: Run, entry: Entry): Promise<void> {
  await run("INSERT INTO audit_log (actor_id, actor_label, action, target_id, detail, ip) VALUES ($1, $2, $3, $4, $5, $6)", [
    entry.actorId,
    entry.actorLabel,
    entry.action,
    entry.targetId ?? null,
    JSON.stringify(entry.detail ?? {}),
    entry.headers ? clientIp(entry.headers) : null,
  ]);
}

/** The append-only trail of what matters: sign-ins (and refusals), uploads, analyses, deletions, administration. */
export async function audit(entry: Entry) {
  try {
    await auditIn(query, entry);
  } catch (error) {
    logError(`audit: ${entry.action} not recorded`, error);
  }
}
