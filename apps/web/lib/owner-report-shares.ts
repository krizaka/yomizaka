import { applicantFileOf } from "./applicant-file";
import { audit } from "./audit";
import { clientAddress } from "./client-address";
import { query } from "./db";
import { isUuid } from "./documents";
import { refuse } from "./http";
import { type OwnerReport, ownerReportOf, shareDays, type ShareState, shareState } from "./owner-report";
import { addDays, hash, newToken } from "./screening";

/** The owner link of an applicant file's verification report (yomizaka#128): create, list, revoke by the file's manager; open by token. */

interface ShareRow {
  id: string;
  recipient: string;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  views: string;
}
export interface ShareView {
  id: string;
  recipient: string;
  state: ShareState;
  createdAt: string;
  expiresAt: string;
  views: number;
}

/** The manager's file, or 404 (another manager's file does not exist for you). */
async function ownFile(landlordId: string, fileId: string): Promise<void> {
  if (!isUuid(fileId)) throw refuse(404, "NOT_FOUND", "No such applicant file");
  const rows = await query("SELECT 1 FROM screenings WHERE id = $1 AND landlord_id = $2 AND flow = 'file'", [fileId, landlordId]);
  if (rows.length === 0) throw refuse(404, "NOT_FOUND", "No such applicant file");
}

export async function createShare(owner: { id: string; email: string }, fileId: string, input: { recipient?: string; days?: number }, now: Date, headers?: Headers): Promise<{ id: string; token: string; expiresAt: string }> {
  await ownFile(owner.id, fileId);
  const token = newToken();
  const expiresAt = addDays(now, shareDays(input.days));
  const [row] = await query<{ id: string }>(
    "INSERT INTO file_report_shares (screening_id, landlord_id, recipient, token_hash, created_at, expires_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    [fileId, owner.id, (input.recipient ?? "").trim().slice(0, 120), hash(token), now, expiresAt],
  );
  await audit({ action: "report.shared", actorId: owner.id, actorLabel: owner.email, targetId: fileId, detail: { shareId: row!.id, expiresAt: expiresAt.toISOString() }, headers });
  return { id: row!.id, token, expiresAt: expiresAt.toISOString() };
}

export async function listShares(landlordId: string, fileId: string, now: Date): Promise<ShareView[]> {
  await ownFile(landlordId, fileId);
  const rows = await query<ShareRow>(
    `SELECT s.id, s.recipient, s.created_at, s.expires_at, s.revoked_at, (SELECT count(*) FROM file_report_views v WHERE v.share_id = s.id) AS views
       FROM file_report_shares s WHERE s.screening_id = $1 AND s.landlord_id = $2 ORDER BY s.created_at DESC`,
    [fileId, landlordId],
  );
  return rows.map((r) => ({ id: r.id, recipient: r.recipient, state: shareState({ expiresAt: r.expires_at, revokedAt: r.revoked_at }, now), createdAt: r.created_at.toISOString(), expiresAt: r.expires_at.toISOString(), views: Number(r.views) }));
}

export async function revokeShare(owner: { id: string; email: string }, fileId: string, shareId: string, headers?: Headers): Promise<void> {
  await ownFile(owner.id, fileId);
  if (!isUuid(shareId)) throw refuse(404, "NOT_FOUND", "No such link");
  const rows = await query("UPDATE file_report_shares SET revoked_at = now() WHERE id = $1 AND screening_id = $2 AND landlord_id = $3 AND revoked_at IS NULL RETURNING id", [shareId, fileId, owner.id]);
  if (rows.length === 0) throw refuse(404, "NOT_FOUND", "No such link");
  await audit({ action: "report.share_revoked", actorId: owner.id, actorLabel: owner.email, targetId: fileId, detail: { shareId }, headers });
}

/** An owner report with the expiry of the link that opened it. */
export type SharedOwnerReport = OwnerReport & { expiresAt: string };

/** What the owner link opens: the redacted report, or null when the link is unknown, expired or revoked (one answer, nothing leaks). Each opening is recorded. */
export async function openShare(token: string, now: Date, headers?: Headers): Promise<SharedOwnerReport | null> {
  const [row] = await query<{ id: string; screening_id: string; landlord_id: string; expires_at: Date; revoked_at: Date | null }>(
    "SELECT id, screening_id, landlord_id, expires_at, revoked_at FROM file_report_shares WHERE token_hash = $1",
    [hash(token)],
  );
  if (!row || shareState({ expiresAt: row.expires_at, revokedAt: row.revoked_at }, now) !== "live") return null;
  const file = await applicantFileOf(row.landlord_id, row.screening_id, now);
  const hashes = new Map((await query<{ id: string; sha256: string }>("SELECT id, sha256 FROM documents WHERE owner_id = $1 AND screening_id = $2", [row.landlord_id, row.screening_id])).map((d) => [d.id, d.sha256]));
  await query("INSERT INTO file_report_views (share_id, viewed_at, ip) VALUES ($1, $2, $3)", [row.id, now, headers ? clientAddress(headers) : null]);
  await audit({ action: "report.viewed", actorId: null, actorLabel: "owner-link", targetId: row.screening_id, detail: { shareId: row.id }, headers });
  return { ...ownerReportOf(file, hashes, now), expiresAt: row.expires_at.toISOString() };
}
