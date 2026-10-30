import {
  type Actor,
  type CatalogObject,
  moveBatch,
  type ObjectCatalog,
  type ProviderService,
} from "@krizaka/storage/provider-admin";
import { addSeconds } from "@krizaka/time";
import type { QueryResultRow } from "pg";

import { refuse } from "../http";
import { DATA_KIND, ORG_SCOPE } from "./providers";

const PROVIDER_STATUS = { retiring: "retiring" } as const;

/**
 * The verified move of the documents from a retiring provider to the new default (ADR-005 §3). The objects are the catalog
 * (`documents.provider_id`), so a move resumes from the database and never repeats: each batch copies an object, reads it back,
 * compares its SHA-256, and only then flips the row's provider. Reads go new-then-old meanwhile (`dual-read.ts`).
 */
type Query = <T extends QueryResultRow>(text: string, values?: unknown[]) => Promise<T[]>;

export const MOVE_STATUS = { running: "running", paused: "paused", attention: "attention", done: "done" } as const;
type MoveStatus = (typeof MOVE_STATUS)[keyof typeof MOVE_STATUS];

/** How long a worker holds the move before another may take a step (a crashed worker never blocks it for longer). */
// @fixed: a batch of a few documents finishes well inside this; past it the worker is presumed dead
const LEASE_SECONDS = 120;
// @fixed: documents are at most 10 MB each; a batch this size stays inside one scheduler tick
export const MOVE_BATCH = 10;
// @fixed: the panel lists the first failures, the count stays exact
const FAILURES_KEPT = 50;

export interface MoveDeps {
  q: Query;
  service: Pick<ProviderService, "list" | "open">;
  defaults: () => Promise<Record<string, string>>;
  audit: (note: { action: string; actor: Actor; targetId: string; detail: Record<string, unknown> }) => Promise<void>;
  now: () => Date;
  batch?: number;
}

export interface MoveFailure {
  id: string;
  reason: string;
}

/** What the admin screen draws: counts only, never a key or a credential. */
export interface MoveView {
  id: string;
  fromId: string;
  toId: string;
  status: MoveStatus;
  total: number;
  moved: number;
  failed: MoveFailure[];
  /** Still to move (not counting the failed ones). */
  remaining: number;
  startedAt: string;
  finishedAt: string | null;
}

interface MoveRow extends QueryResultRow {
  id: string;
  from_id: string;
  to_id: string;
  status: MoveStatus;
  total: number;
  moved: number;
  failures: MoveFailure[];
  started_at: Date;
  finished_at: Date | null;
}

const COLUMNS = "id, from_id, to_id, status, total, moved, failures, started_at, finished_at";

const WHERE_HELD = "provider_id = $1 AND object_key IS NOT NULL AND storage_owner = 'krizaka'";

/** The documents of Krizaka's store as the move's catalog; the rows that already failed in this move are left out so one bad object never starves the others. */
export function documentCatalog(q: Query, skip: readonly string[]): ObjectCatalog {
  return {
    pending: (providerId, limit) =>
      q<CatalogObject & QueryResultRow>(
        `SELECT id, object_key AS key, mime_type AS "contentType", sha256 FROM documents WHERE ${WHERE_HELD} AND id <> ALL($2::uuid[]) ORDER BY id LIMIT $3`,
        [providerId, skip, limit],
      ),
    remaining: async (providerId) =>
      Number(
        (await q<{ n: string }>(`SELECT count(*)::text AS n FROM documents WHERE ${WHERE_HELD}`, [providerId]))[0]?.n ??
          0,
      ),
    switchProvider: async (objectId, from, to) =>
      (
        await q(
          "UPDATE documents SET provider_id = $3 WHERE id = $1 AND provider_id = $2 AND object_key IS NOT NULL RETURNING id",
          [objectId, from, to],
        )
      ).length > 0,
  };
}

const waitingOf = async (q: Query, row: MoveRow) =>
  Math.max(0, (await documentCatalog(q, []).remaining(row.from_id)) - row.failures.length);

async function viewOf(q: Query, row: MoveRow): Promise<MoveView> {
  return {
    id: row.id,
    fromId: row.from_id,
    toId: row.to_id,
    status: row.status,
    total: row.total,
    moved: row.moved,
    failed: row.failures,
    remaining: row.status === MOVE_STATUS.done ? 0 : await waitingOf(q, row),
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() ?? null,
  };
}

/** The latest move (the open one, else the last finished), or null when none ever ran. */
export async function currentMove(q: Query): Promise<MoveView | null> {
  const [row] = await q<MoveRow>(
    `SELECT ${COLUMNS} FROM storage_moves ORDER BY (status <> 'done') DESC, started_at DESC LIMIT 1`,
  );
  return row ? viewOf(q, row) : null;
}

const notAllowed = (message: string) => refuse(409, "STORAGE_MOVE_NOT_ALLOWED", message);

/** Starts the move: the target must be the documents default, the source a provider that is retiring (the admin switched the default first). One move at a time. */
export async function startMove(deps: MoveDeps, actor: Actor, input: { from: string; to: string }): Promise<MoveView> {
  if (input.from === input.to) throw notAllowed("The source and the target are the same provider");
  const listed = await deps.service.list(ORG_SCOPE);
  const from = listed.find((p) => p.id === input.from);
  const to = listed.find((p) => p.id === input.to);
  if (!from || !to) throw refuse(404, "STORAGE_PROVIDER_NOT_FOUND", "No such provider");
  if ((await deps.defaults())[DATA_KIND.documents] !== to.id)
    throw notAllowed("The target is not the default of the documents");
  if (from.status !== PROVIDER_STATUS.retiring) throw notAllowed("Only a retiring provider is moved from");
  const total = await documentCatalog(deps.q, []).remaining(from.id);
  const now = deps.now();
  let row: MoveRow | undefined;
  try {
    [row] = await deps.q<MoveRow>(
      `INSERT INTO storage_moves (from_id, to_id, status, total, started_by, started_at, updated_at, finished_at) VALUES ($1, $2, $3, $4, $5, $6, $6, $7) RETURNING ${COLUMNS}`,
      [
        from.id,
        to.id,
        total === 0 ? MOVE_STATUS.done : MOVE_STATUS.running,
        total,
        actor.id,
        now,
        total === 0 ? now : null,
      ],
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23505") throw refuse(409, "STORAGE_MOVE_OPEN", "A move is already open");
    throw error;
  }
  await deps.audit({
    action: "storage.move.started",
    actor,
    targetId: row!.id,
    detail: { from: from.id, to: to.id, total },
  });
  return viewOf(deps.q, row!);
}

/** Pauses the open move, or resumes it (a resume also lets the failed objects be tried again). */
export async function setMovePaused(deps: MoveDeps, actor: Actor, paused: boolean): Promise<MoveView> {
  const [row] = paused
    ? await deps.q<MoveRow>(
        `UPDATE storage_moves SET status = 'paused', updated_at = $1 WHERE status IN ('running', 'attention') RETURNING ${COLUMNS}`,
        [deps.now()],
      )
    : await deps.q<MoveRow>(
        `UPDATE storage_moves SET status = 'running', failures = '[]'::jsonb, leased_until = NULL, updated_at = $1 WHERE status IN ('paused', 'attention') RETURNING ${COLUMNS}`,
        [deps.now()],
      );
  if (!row) throw refuse(409, "STORAGE_MOVE_NONE", paused ? "No move is running" : "No move is waiting");
  await deps.audit({
    action: paused ? "storage.move.paused" : "storage.move.resumed",
    actor,
    targetId: row.id,
    detail: {},
  });
  return viewOf(deps.q, row);
}

const SYSTEM: Actor = { id: null, label: "storage-move" };

/**
 * One bounded batch of the open move, from the scheduler's tick. A lease keeps two instances from working on it at once; the batch itself
 * is safe to repeat (a flipped row is no longer pending). Returns the state after the batch, or null when there was nothing to do.
 */
export async function stepMove(deps: MoveDeps): Promise<MoveView | null> {
  const now = deps.now();
  const [row] = await deps.q<MoveRow>(
    `UPDATE storage_moves SET leased_until = $1 WHERE status = 'running' AND (leased_until IS NULL OR leased_until < $2) RETURNING ${COLUMNS}`,
    [addSeconds(now, LEASE_SECONDS), now],
  );
  if (!row) return null;
  try {
    const result = await moveBatch({
      catalog: documentCatalog(
        deps.q,
        row.failures.map((f) => f.id),
      ),
      from: { id: row.from_id, store: await deps.service.open(row.from_id) },
      to: { id: row.to_id, store: await deps.service.open(row.to_id) },
      limit: deps.batch ?? MOVE_BATCH,
    });
    return await settle(deps, row, result);
  } finally {
    await deps.q("UPDATE storage_moves SET leased_until = NULL WHERE id = $1", [row.id]);
  }
}

/** Where the move stands once a batch is settled: still going, stopped by failures that need an administrator, or done. */
function statusAfter(left: number, failed: number): MoveStatus {
  if (left > 0) return MOVE_STATUS.running;
  return failed > 0 ? MOVE_STATUS.attention : MOVE_STATUS.done;
}

async function settle(
  deps: MoveDeps,
  row: MoveRow,
  result: { switched: number; failed: MoveFailure[] },
): Promise<MoveView> {
  const failures = [...row.failures, ...result.failed].slice(0, FAILURES_KEPT);
  const failedCount = row.failures.length + result.failed.length;
  const left = Math.max(0, (await documentCatalog(deps.q, []).remaining(row.from_id)) - failedCount);
  const status = statusAfter(left, failedCount);
  const now = deps.now();
  const [saved] = await deps.q<MoveRow>(
    `UPDATE storage_moves SET moved = moved + $2, failures = $3::jsonb, status = CASE WHEN status = 'paused' AND $4 <> 'done' THEN 'paused' ELSE $4 END, updated_at = $5, finished_at = $6 WHERE id = $1 AND status IN ('running', 'paused') RETURNING ${COLUMNS}`,
    [row.id, result.switched, JSON.stringify(failures), status, now, status === MOVE_STATUS.done ? now : null],
  );
  const view = await viewOf(deps.q, saved ?? row);
  if (result.failed.length > 0)
    await deps.audit({
      action: "storage.move.failed",
      actor: SYSTEM,
      targetId: row.id,
      detail: { count: result.failed.length, reasons: [...new Set(result.failed.map((f) => f.reason))] },
    });
  if (status === MOVE_STATUS.done)
    await deps.audit({
      action: "storage.move.completed",
      actor: SYSTEM,
      targetId: row.id,
      detail: { moved: view.moved, from: row.from_id, to: row.to_id },
    });
  return view;
}
