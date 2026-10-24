import crypto from "node:crypto";

import { z } from "zod";

import { CONSENT_MEANS, grantConsent, NOTICE_VERSION, purposesOfScope, requireConsent } from "./applicant-consent";
import { audit } from "./audit";
import { query } from "./db";
import { refuse } from "./http";

/*
 * Checking a tenant's application (« dossier ») — provider-agnostic, with explicit tenant consent
 * (docs/product/tenant-screening-research.md). The landlord asks; the TENANT consents or declines, sees the result FIRST and
 * shares it or contests it. Minimal data: a short summary, never a provider's raw report, deleted after the retention window.
 * There is no criminal-record scope, and none can be added without a new flow version and a lawyer's opinion.
 */
export const SCREENING_STATUS = { requested: "requested", consented: "consented", shared: "shared", declined: "declined", contested: "contested", expired: "expired", erased: "erased" } as const;
export type ScreeningStatus = (typeof SCREENING_STATUS)[keyof typeof SCREENING_STATUS];

/** What a request may ask. Payment history only today; the list is the law's limit, not a roadmap. */
export const SCREENING_SCOPES = ["payment-history"] as const;

// @fixed: the days a request can be answered — a tenant needs time to read it; two weeks, then it expires unanswered.
export const REQUEST_VALID_DAYS = 14;
// @fixed: how long the result is kept after the tenant's consent (Law 25: only as long as necessary); the landlord decides within a month.
export const RETENTION_DAYS = 30;

export const screeningItem = z.object({ key: z.enum(["payment-history", "identity-match"]), outcome: z.enum(["clear", "review"]) });
/** What is kept of a provider's answer: a band and a few items — nothing else. No score, no account, no address. */
export const screeningResult = z.object({ band: z.enum(["no-concern", "review"]), items: z.array(screeningItem).max(4), provider: z.string(), generatedAt: z.string() });
export type ScreeningResult = z.infer<typeof screeningResult>;

export interface ScreeningSubject {
  name: string;
  email: string;
}
/** A provider turns the consenting tenant's identity into a minimal result. The real ones need contracts; the demo is fictitious. */
export interface ScreeningProvider {
  id: string;
  /** True for the providers whose data is fictitious: the pages say so. */
  demo: boolean;
  check(subject: ScreeningSubject, scope: readonly string[], now: Date): Promise<ScreeningResult>;
}

/** The demo provider: fictitious, deterministic — an address starting with « flag » returns a « review » band, any other is clear. */
export const demoProvider: ScreeningProvider = {
  id: "demo",
  demo: true,
  async check(subject, scope, now) {
    const flagged = subject.email.startsWith("flag");
    const items = scope.map((key) => ({ key: key as "payment-history", outcome: (flagged ? "review" : "clear") as "clear" | "review" }));
    return { band: flagged ? "review" : "no-concern", items, provider: "demo", generatedAt: now.toISOString() };
  },
};
const PROVIDERS: Record<string, ScreeningProvider> = { [demoProvider.id]: demoProvider };
export const providerById = (id: string): ScreeningProvider => {
  const p = PROVIDERS[id];
  if (!p) throw refuse(503, "PROVIDER_UNAVAILABLE", "No such screening provider");
  return p;
};

/** The token is 256 random bits: a plain SHA-256 is enough to keep only its hash (nothing to guess, nothing to key). */
const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/** `n` days after `from`, in UTC (calendar days, no millisecond arithmetic). */
const addDays = (from: Date, n: number): Date => {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};
export const newToken = () => `sc1.${crypto.randomBytes(32).toString("base64url")}`;

interface Row {
  id: string;
  landlord_id: string;
  tenant_name: string;
  tenant_email: string;
  scope: string[];
  provider: string;
  status: ScreeningStatus;
  created_at: Date;
  expires_at: Date;
  consented_at: Date | null;
  shared_at: Date | null;
  contested_at: Date | null;
  contest_comment: string | null;
  landlord_email?: string;
  result: unknown;
  result_expires_at: Date | null;
  purged_at: Date | null;
}

/** What the landlord sees: the result only once the tenant has shared it. A contested result is never shown. */
export interface LandlordView {
  id: string;
  tenantName: string;
  tenantEmail: string;
  status: ScreeningStatus;
  createdAt: string;
  expiresAt: string;
  result: ScreeningResult | null;
  provider: string;
  demo: boolean;
}
/** What the tenant sees: the request, and their result as soon as they consented. */
export interface TenantView {
  status: ScreeningStatus;
  /** Who asks — the tenant must know to consent. */
  landlord: string;
  tenantName: string;
  scope: string[];
  provider: string;
  demo: boolean;
  expiresAt: string;
  retentionDays: number;
  result: ScreeningResult | null;
  resultExpiresAt: string | null;
  contestComment: string | null;
}

const parseResult = (r: unknown): ScreeningResult | null => {
  const p = screeningResult.safeParse(r);
  return p.success ? p.data : null;
};

/** The state of a request as of now: a pending one past its date is expired; a result past its retention is deleted. Pure. */
export function effectiveState(row: Pick<Row, "status" | "expires_at" | "result_expires_at">, now: Date): { status: ScreeningStatus; resultAlive: boolean } {
  const resultAlive = row.result_expires_at === null || row.result_expires_at.getTime() > now.getTime();
  const pending = row.status === SCREENING_STATUS.requested;
  return { status: pending && row.expires_at.getTime() <= now.getTime() ? SCREENING_STATUS.expired : row.status, resultAlive };
}

export const landlordView = (row: Row, now: Date): LandlordView => {
  const state = effectiveState(row, now);
  const visible = state.status === SCREENING_STATUS.shared && state.resultAlive;
  return { id: row.id, tenantName: row.tenant_name, tenantEmail: row.tenant_email, status: state.status, createdAt: row.created_at.toISOString(), expiresAt: row.expires_at.toISOString(), result: visible ? parseResult(row.result) : null, provider: row.provider, demo: providerById(row.provider).demo };
};
export const tenantView = (row: Row, now: Date): TenantView => {
  const state = effectiveState(row, now);
  return { status: state.status, landlord: row.landlord_email ?? "", tenantName: row.tenant_name, scope: row.scope, provider: row.provider, demo: providerById(row.provider).demo, expiresAt: row.expires_at.toISOString(), retentionDays: RETENTION_DAYS, result: state.resultAlive ? parseResult(row.result) : null, resultExpiresAt: row.result_expires_at?.toISOString() ?? null, contestComment: row.contest_comment };
};

type Landlord = { id: string; email: string };

/** The landlord asks. Returns the token ONCE (only its hash is kept): the landlord hands the link to the applicant. */
export async function requestScreening(landlord: Landlord, input: { tenantName: string; tenantEmail: string; scope: readonly string[]; provider?: string }, now: Date, headers?: Headers): Promise<{ id: string; token: string }> {
  const scope = [...new Set(input.scope)].filter((s) => (SCREENING_SCOPES as readonly string[]).includes(s));
  if (scope.length === 0) throw refuse(400, "BAD_REQUEST", "Nothing lawful to check");
  const provider = providerById(input.provider ?? demoProvider.id);
  const token = newToken();
  const [row] = await query<{ id: string }>(
    "INSERT INTO screenings (landlord_id, tenant_name, tenant_email, scope, provider, token_hash, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
    [landlord.id, input.tenantName.trim(), input.tenantEmail.trim().toLowerCase(), scope, provider.id, hash(token), addDays(now, REQUEST_VALID_DAYS)],
  );
  await audit({ action: "screening.requested", actorId: landlord.id, actorLabel: landlord.email, targetId: row!.id, detail: { scope, provider: provider.id }, headers });
  return { id: row!.id, token };
}

export async function listForLandlord(landlordId: string, now: Date): Promise<LandlordView[]> {
  await purgeExpired(now);
  const rows = await query<Row>("SELECT * FROM screenings WHERE landlord_id = $1 ORDER BY created_at DESC LIMIT 100", [landlordId]);
  return rows.map((r) => landlordView(r, now));
}

export async function byToken(token: string): Promise<Row> {
  const [row] = await query<Row>("SELECT s.*, a.email AS landlord_email FROM screenings s JOIN accounts a ON a.id = s.landlord_id WHERE s.token_hash = $1", [hash(token)]);
  if (!row) throw refuse(404, "NOT_FOUND", "No such request");
  return row;
}

export async function viewForTenant(token: string, now: Date): Promise<TenantView> {
  await purgeExpired(now);
  return tenantView(await byToken(token), now);
}

const actor = (row: Row) => ({ actorId: null, actorLabel: `tenant:${row.tenant_email}` });

/** The tenant consents: the provider is called, a minimal result is kept for the retention window, and the tenant sees it first. */
export async function consent(token: string, now: Date, headers?: Headers): Promise<TenantView> {
  const row = await byToken(token);
  const state = effectiveState(row, now);
  if (state.status !== SCREENING_STATUS.requested) throw refuse(409, "NOT_PENDING", "This request is no longer waiting for an answer");
  // The consent per purpose is recorded first (notice version, date, means); the check then runs only while each stands (yomizaka#131).
  for (const purpose of purposesOfScope(row.scope)) await grantConsent(row.id, purpose, { noticeVersion: NOTICE_VERSION, means: CONSENT_MEANS.WEB_FORM }, now, headers);
  for (const purpose of purposesOfScope(row.scope)) await requireConsent(row.id, purpose);
  const result = await providerById(row.provider).check({ name: row.tenant_name, email: row.tenant_email }, row.scope, now);
  const [updated] = await query<Row>(
    "UPDATE screenings SET status = 'consented', consented_at = $2, result = $3, result_expires_at = $4 WHERE id = $1 AND status = 'requested' RETURNING *",
    [row.id, now, JSON.stringify(result), addDays(now, RETENTION_DAYS)],
  );
  if (!updated) throw refuse(409, "NOT_PENDING", "This request is no longer waiting for an answer");
  await audit({ ...actor(row), action: "screening.consented", targetId: row.id, detail: { scope: row.scope, provider: row.provider }, headers });
  return tenantView({ ...updated, landlord_email: row.landlord_email }, now);
}

export async function decline(token: string, now: Date, headers?: Headers): Promise<TenantView> {
  const row = await byToken(token);
  if (effectiveState(row, now).status !== SCREENING_STATUS.requested) throw refuse(409, "NOT_PENDING", "This request is no longer waiting for an answer");
  const [updated] = await query<Row>("UPDATE screenings SET status = 'declined' WHERE id = $1 AND status = 'requested' RETURNING *", [row.id]);
  await audit({ ...actor(row), action: "screening.declined", targetId: row.id, headers });
  return tenantView({ ...updated!, landlord_email: row.landlord_email }, now);
}

/** The tenant releases their result to the landlord. */
export async function share(token: string, now: Date, headers?: Headers): Promise<TenantView> {
  const row = await byToken(token);
  const state = effectiveState(row, now);
  if (state.status !== SCREENING_STATUS.consented || !state.resultAlive) throw refuse(409, "NOT_SHAREABLE", "There is no result to share");
  const [updated] = await query<Row>("UPDATE screenings SET status = 'shared', shared_at = $2 WHERE id = $1 AND status = 'consented' RETURNING *", [row.id, now]);
  await audit({ ...actor(row), action: "screening.shared", targetId: row.id, headers });
  return tenantView({ ...updated!, landlord_email: row.landlord_email }, now);
}

/** The tenant contests the result: the landlord never sees it, only « contested ». */
export async function contest(token: string, comment: string, now: Date, headers?: Headers): Promise<TenantView> {
  const row = await byToken(token);
  const state = effectiveState(row, now);
  if ((state.status !== SCREENING_STATUS.consented && state.status !== SCREENING_STATUS.shared) || !state.resultAlive) throw refuse(409, "NOT_CONTESTABLE", "There is no result to contest");
  const [updated] = await query<Row>("UPDATE screenings SET status = 'contested', contested_at = $2, contest_comment = $3 WHERE id = $1 AND status IN ('consented', 'shared') RETURNING *", [row.id, now, comment.trim().slice(0, 500)]);
  await audit({ ...actor(row), action: "screening.contested", targetId: row.id, headers });
  return tenantView({ ...updated!, landlord_email: row.landlord_email }, now);
}

/** Retention: results past their window are deleted (the summary goes, the fact of the request stays), and unanswered requests expire. */
export async function purgeExpired(now: Date): Promise<number> {
  const purged = await query<{ id: string }>("UPDATE screenings SET result = NULL, purged_at = $1, contest_comment = NULL WHERE result IS NOT NULL AND result_expires_at <= $1 RETURNING id", [now]);
  await query("UPDATE screenings SET status = 'expired' WHERE status = 'requested' AND expires_at <= $1", [now]);
  for (const p of purged) await audit({ action: "screening.purged", actorId: null, actorLabel: "retention", targetId: p.id });
  return purged.length;
}
