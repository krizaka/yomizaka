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
