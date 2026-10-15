import { clientIp } from "./client-ip";
import { query } from "./db";

/** The append-only trail of what matters: sign-ins (and refusals), uploads, analyses, deletions, administration. */
export async function audit(entry: { action: string; actorId: string | null; actorLabel: string; targetId?: string | null; detail?: Record<string, unknown>; headers?: Headers }) {
  try {
    await query("INSERT INTO audit_log (actor_id, actor_label, action, target_id, detail, ip) VALUES ($1, $2, $3, $4, $5, $6)", [
      entry.actorId,
      entry.actorLabel,
      entry.action,
      entry.targetId ?? null,
      JSON.stringify(entry.detail ?? {}),
      entry.headers ? clientIp(entry.headers) : null,
    ]);
  } catch (error) {
    console.error(`audit: ${entry.action} not recorded`, error);
  }
}
