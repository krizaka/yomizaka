import { adoptMigration } from "@krizaka/db";
import { describe, expect, it } from "vitest";

import { MIGRATIONS } from "./migrations";
import { MODULES } from "./modules";

describe("the adopted Krizaka modules", () => {
  const adoption = MIGRATIONS.find((m) => m.version === "0036_adopt_krizaka_modules");

  it("are adopted by migration 0036 with the text `adoptMigration` prints today (markers only, no DDL)", () => {
    expect(adoption).toBeDefined();
    for (const { schema, context } of MODULES) {
      expect(adoption!.sql, schema.module).toContain(adoptMigration(schema, 1, context).trim());
    }
    expect(adoption!.sql).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS public\.krizaka_module_versions)|ALTER TABLE|DROP /);
  });

  it("list a module after the modules it requires", () => {
    const seen = new Set<string>();
    for (const { schema } of MODULES) {
      for (const required of schema.requires) expect(seen.has(required), `${schema.module} requires ${required}`).toBe(true);
      seen.add(schema.module);
    }
  });
});
