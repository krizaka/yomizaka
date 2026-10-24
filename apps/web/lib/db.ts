import pg from "pg";

import { readEnv } from "./env";
import { MIGRATIONS } from "./migrations";

/**
 * One pool per process. TLS to the cluster is verified against its CA (DATABASE_CA_CERT) — never
 * `rejectUnauthorized: false`; the URL's `sslmode` is read here, not by the driver, so the rule is one place.
 */
export function poolConfig(source: Record<string, string | undefined> = process.env): pg.PoolConfig {
  const env = readEnv(source);
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const url = new URL(env.DATABASE_URL);
  const mode = url.searchParams.get("sslmode");
  url.searchParams.delete("sslmode");
  const tls = mode === "require" || mode === "verify-ca" || mode === "verify-full";
  return {
    connectionString: url.toString(),
    max: 5,
    idleTimeoutMillis: 30_000,
    ...(tls ? { ssl: { ca: env.DATABASE_CA_CERT?.replace(/\\n/g, "\n"), rejectUnauthorized: true } } : {}),
  };
}

const holder = globalThis as unknown as { __yomizakaPool?: pg.Pool };

export function pool(): pg.Pool {
  holder.__yomizakaPool ??= new pg.Pool(poolConfig());
  return holder.__yomizakaPool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  const result = await pool().query<T>(text, values);
  return result.rows;
}

/** Runs `work` on one connection between BEGIN and COMMIT. A failure rolls back and is rethrown: the rollback never masks it. */
export async function transaction<T>(work: (run: <R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]) => Promise<R[]>) => Promise<T>): Promise<T> {
  const conn = await pool().connect();
  try {
    await conn.query("BEGIN");
    const value = await work(async (text, values = []) => (await conn.query(text, values)).rows as never);
    await conn.query("COMMIT");
    return value;
  } catch (error) {
    await conn.query("ROLLBACK").catch((rollback: unknown) => {
      throw new AggregateError([error, rollback], "transaction failed and its rollback failed");
    });
    throw error;
  } finally {
    conn.release();
  }
}

/** Applies the migrations not applied yet, one transaction each, under an advisory lock (two instances never race). */
export async function migrate(client?: pg.Pool): Promise<string[]> {
  const db = client ?? pool();
  const conn = await db.connect();
  const applied: string[] = [];
  try {
    await conn.query("SELECT pg_advisory_lock(73191)");
    await conn.query("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const done = new Set((await conn.query<{ version: string }>("SELECT version FROM schema_migrations")).rows.map((r) => r.version));
    for (const m of MIGRATIONS) {
      if (done.has(m.version)) continue;
      await conn.query("BEGIN");
      try {
        await conn.query(m.sql);
        await conn.query("INSERT INTO schema_migrations (version) VALUES ($1)", [m.version]);
        await conn.query("COMMIT");
        applied.push(m.version);
      } catch (error) {
        await conn.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await conn.query("SELECT pg_advisory_unlock(73191)").catch(() => undefined);
    conn.release();
  }
  return applied;
}

/**
 * Runs `work` only if no other instance holds this advisory lock (session level, one connection): the job of a tick that two
 * instances must never do at once. `null` when the lock is held elsewhere.
 */
export async function withAdvisoryLock<T>(key: number, work: () => Promise<T>): Promise<T | null> {
  return withLock("SELECT pg_try_advisory_lock($1) AS ok", "SELECT pg_advisory_unlock($1)", key, work);
}

/** The same for a lock named by a string (one batch, one document…): two callers of the same name never work at once. */
export async function withNamedLock<T>(name: string, work: () => Promise<T>): Promise<T | null> {
  return withLock("SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS ok", "SELECT pg_advisory_unlock(hashtextextended($1, 0))", name, work);
}

/**
 * Locks live on their own small pool: a holder keeps its connection for the whole of its work, and that work runs its queries on the
 * main pool — if both came from one pool, as many concurrent holders as it has connections would wait forever for a connection to
 * read with (yomizaka#266, review). Holders beyond the pool simply wait their turn for a lock connection.
 */
const lockHolder = globalThis as unknown as { __yomizakaLockPool?: pg.Pool };
// @fixed: connections kept for locks — a technical bound; the main pool is never touched by it
const LOCK_CONNECTIONS = 4;
const lockPool = (): pg.Pool => (lockHolder.__yomizakaLockPool ??= new pg.Pool({ ...poolConfig(), max: LOCK_CONNECTIONS, allowExitOnIdle: true }));

async function withLock<T>(lock: string, unlock: string, key: number | string, work: () => Promise<T>): Promise<T | null> {
  const conn = await lockPool().connect();
  try {
    const [row] = (await conn.query<{ ok: boolean }>(lock, [key])).rows;
    if (!row?.ok) return null;
    try {
      return await work();
    } finally {
      await conn.query(unlock, [key]).catch(() => undefined);
    }
  } finally {
    conn.release();
  }
}

/** The same lock, but waits its turn instead of giving up: for work that must happen once and that every caller needs done (seeding). */
export async function withBlockingLock<T>(name: string, work: () => Promise<T>): Promise<T> {
  const conn = await lockPool().connect();
  try {
    await conn.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [name]);
    try {
      return await work();
    } finally {
      await conn.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [name]).catch(() => undefined);
    }
  } finally {
    conn.release();
  }
}
