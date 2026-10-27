import { migrate as runMigrations } from "@krizaka/db";
import { describe, expect, it } from "vitest";

import { MIGRATION_LOCK_KEY } from "../db";
import { withScratchDatabase } from "../migration-testkit";
import { MIGRATIONS } from "../migrations";

/** Migration 0052 moves the applied notifications into the payments module's schema, every row kept (skipped without YOMIZAKA_DB_IT=1 and a database). */
const enabled = process.env["YOMIZAKA_DB_IT"] === "1" && !!process.env["DATABASE_URL"];

describe.runIf(enabled)("0052_coupons", () => {
  it("keeps every applied payment event, in payments.event, and a replay of the same id is still a duplicate", async () => {
    await withScratchDatabase("b53_coupons", async ({ connect, pool }) => {
      await runMigrations(connect, MIGRATIONS.filter((m) => m.version < "0052_coupons"), { lockKey: MIGRATION_LOCK_KEY });
      await pool.query("INSERT INTO payment_events (id, type) VALUES ('evt_old_1', 'payment_paid'), ('evt_old_2', 'payment_paid')");
      await runMigrations(connect, MIGRATIONS, { lockKey: MIGRATION_LOCK_KEY });
      const moved = await pool.query("SELECT id FROM payments.event ORDER BY id");
      expect(moved.rows.map((r) => r.id)).toEqual(["evt_old_1", "evt_old_2"]);
      expect((await pool.query("SELECT to_regclass('public.payment_events') AS t")).rows[0].t).toBeNull();
      expect((await pool.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'coupons'")).rows[0].n).toBe(3);
      await expect(pool.query("INSERT INTO payments.event (id, type) VALUES ('evt_old_1', 'x')")).rejects.toThrow();
    });
  });
});
