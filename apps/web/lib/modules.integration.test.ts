import { assertModules, migrate as runMigrations } from "@krizaka/db";
import pg from "pg";
import { describe, expect, it } from "vitest";

import { MIGRATION_LOCK_KEY } from "./db";
import { MIGRATIONS } from "./migrations";
import { MODULES } from "./modules";

/** A database migrated by `main` (before 0036) takes markers only (skipped without YOMIZAKA_DB_IT=1 and DATABASE_URL). */
const enabled = process.env.YOMIZAKA_DB_IT === "1" && !!process.env.DATABASE_URL;

describe.runIf(enabled)("adopted Krizaka modules", () => {
  it("adds markers only to a database that ran the product's own SQL", async () => {
    const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    const name = `b52_${Date.now()}`;
    await admin.query(`CREATE DATABASE ${name}`);
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${name}`;
    const pool = new pg.Pool({ connectionString: url.toString(), max: 2 });
    const connect = async () => {
      const client = await pool.connect();
      return { query: (text: string, values?: unknown[]) => client.query(text, values), release: () => client.release() };
    };
    const columns = async () =>
      (await pool.query("SELECT table_schema || '.' || table_name || '.' || column_name AS c FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY 1")).rows.map(
        (r: { c: string }) => r.c,
      );
    try {
      await runMigrations(connect, MIGRATIONS.filter((m) => m.version < "0036"), { lockKey: MIGRATION_LOCK_KEY });
      const before = await columns();
      const applied = await runMigrations(connect, MIGRATIONS, { lockKey: MIGRATION_LOCK_KEY });
      expect(applied.filter((v) => v < "0036")).toEqual([]);
      expect(applied).toContain("0036_adopt_krizaka_modules");
      expect((await columns()).filter((c) => !before.includes(c) && !c.startsWith("public.krizaka_module_versions."))).toEqual([]);
      expect(before.some((c) => c.startsWith("public.krizaka_module_versions."))).toBe(false);
      await assertModules(async (text, params) => (await pool.query(text, params)).rows as never, MODULES);
    } finally {
      await pool.end();
      await admin.query(`DROP DATABASE ${name}`);
      await admin.end();
    }
  });
});
