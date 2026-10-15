import { audit } from "./audit";
import { query } from "./db";
import { isUuid } from "./documents";
import { refuse } from "./http";

/** What the administration console reads: counts, accounts, the audit trail, documents (metadata only), Orazaka runs. */

export interface Overview {
  accounts: number;
  admins: number;
  suspended: number;
  documents: number;
  bytes: number;
  runs: Record<string, number>;
  lastRunAt: string | null;
}

export async function overview(): Promise<Overview> {
  const [a] = await query<{ accounts: string; admins: string; suspended: string }>(
    "SELECT count(*) AS accounts, count(*) FILTER (WHERE role = 'ADMIN') AS admins, count(*) FILTER (WHERE status = 'SUSPENDED') AS suspended FROM accounts",
  );
  const [d] = await query<{ documents: string; bytes: string | null }>("SELECT count(*) AS documents, sum(size_bytes) AS bytes FROM documents");
  const runs = await query<{ status: string; n: string }>("SELECT status, count(*) AS n FROM analyses GROUP BY status");
  const [last] = await query<{ at: Date | null }>("SELECT max(created_at) AS at FROM analyses");
  return {
    accounts: Number(a?.accounts ?? 0),
    admins: Number(a?.admins ?? 0),
    suspended: Number(a?.suspended ?? 0),
    documents: Number(d?.documents ?? 0),
    bytes: Number(d?.bytes ?? 0),
    runs: Object.fromEntries(runs.map((r) => [r.status, Number(r.n)])),
    lastRunAt: last?.at?.toISOString() ?? null,
  };
}

export interface AdminDocument {
  id: string;
  title: string;
  owner: string;
  kind: string;
  mimeType: string;
  sizeBytes: number;
  analyses: number;
  createdAt: string;
}

export async function allDocuments(): Promise<AdminDocument[]> {
  const rows = await query<{ id: string; title: string; owner: string; kind: string; mime_type: string; size_bytes: number; analyses: string; created_at: Date }>(
    `SELECT d.id, d.title, a.email AS owner, d.kind, d.mime_type, d.size_bytes, d.created_at,
            (SELECT count(*) FROM analyses x WHERE x.document_id = d.id) AS analyses
       FROM documents d JOIN accounts a ON a.id = d.owner_id ORDER BY d.created_at DESC LIMIT 500`,
  );
  return rows.map((r) => ({ id: r.id, title: r.title, owner: r.owner, kind: r.kind, mimeType: r.mime_type, sizeBytes: r.size_bytes, analyses: Number(r.analyses), createdAt: r.created_at.toISOString() }));
}

export interface AdminRun {
  id: string;
  studio: string;
  status: string;
  runId: string | null;
  document: string;
  owner: string;
  durationSeconds: number | null;
  error: string | null;
  createdAt: string;
}

/** Duration of a run from its row: finished − created, null while it runs. */
export const durationSeconds = (created: Date, finished: Date | null) => (finished ? Math.max(0, Math.round((finished.getTime() - created.getTime()) / 1000)) : null);

export async function allRuns(): Promise<AdminRun[]> {
  const rows = await query<{ id: string; studio: string; status: string; run_id: string | null; title: string; email: string; error: string | null; created_at: Date; finished_at: Date | null }>(
    `SELECT x.id, x.studio, x.status, x.run_id, d.title, a.email, x.error, x.created_at, x.finished_at
       FROM analyses x JOIN documents d ON d.id = x.document_id JOIN accounts a ON a.id = d.owner_id
      ORDER BY x.created_at DESC LIMIT 500`,
  );
  return rows.map((r) => ({ id: r.id, studio: r.studio, status: r.status, runId: r.run_id, document: r.title, owner: r.email, durationSeconds: durationSeconds(r.created_at, r.finished_at), error: r.error, createdAt: r.created_at.toISOString() }));
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string | null;
  ip: string | null;
}

export async function auditLog(limit = 300, targetId?: string): Promise<AuditEntry[]> {
  const rows = await query<{ id: string; at: Date; actor_label: string; action: string; target_id: string | null; ip: string | null }>(
    `SELECT id, at, actor_label, action, target_id, ip FROM audit_log ${targetId ? "WHERE target_id = $2 OR actor_id::text = $2" : ""} ORDER BY at DESC LIMIT $1`,
    targetId ? [limit, targetId] : [limit],
  );
  return rows.map((r) => ({ id: String(r.id), at: r.at.toISOString(), actor: r.actor_label, action: r.action, target: r.target_id, ip: r.ip }));
}

export interface UserDetail {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  lastSeenAt: string | null;
  documents: number;
  sessions: number;
}

export async function userDetail(id: string): Promise<UserDetail> {
  if (!isUuid(id)) throw refuse(404, "NOT_FOUND", "No such account");
  const [r] = await query<{ id: string; email: string; role: "USER" | "ADMIN"; status: "ACTIVE" | "SUSPENDED"; created_at: Date; last_seen_at: Date | null; documents: string; sessions: string }>(
    `SELECT a.id, a.email, a.role, a.status, a.created_at, a.last_seen_at,
            (SELECT count(*) FROM documents d WHERE d.owner_id = a.id) AS documents,
            (SELECT count(*) FROM sessions s WHERE s.account_id = a.id AND s.expires_at > now()) AS sessions
       FROM accounts a WHERE a.id = $1`,
    [id],
  );
  if (!r) throw refuse(404, "NOT_FOUND", "No such account");
  return { id: r.id, email: r.email, role: r.role, status: r.status, createdAt: r.created_at.toISOString(), lastSeenAt: r.last_seen_at?.toISOString() ?? null, documents: Number(r.documents), sessions: Number(r.sessions) };
}

/** Suspends (every session ends at once) or restores an account. An administrator never suspends their own account. */
export async function setUserStatus(actor: { id: string; email: string }, id: string, status: "ACTIVE" | "SUSPENDED", headers?: Headers): Promise<UserDetail> {
  if (!isUuid(id)) throw refuse(404, "NOT_FOUND", "No such account");
  if (status === "SUSPENDED" && id === actor.id) throw refuse(409, "SELF_SUSPEND", "You cannot suspend your own account");
  const rows = await query("UPDATE accounts SET status = $2 WHERE id = $1 RETURNING id", [id, status]);
  if (rows.length === 0) throw refuse(404, "NOT_FOUND", "No such account");
  if (status === "SUSPENDED") await query("DELETE FROM sessions WHERE account_id = $1", [id]);
  await audit({ action: status === "SUSPENDED" ? "admin.user_suspended" : "admin.user_restored", actorId: actor.id, actorLabel: actor.email, targetId: id, headers });
  return userDetail(id);
}
