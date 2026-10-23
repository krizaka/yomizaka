import { beforeAll, describe, expect, it } from "vitest";

import { PERSONA_ERIC } from "../../../scripts/demo-documents/index.mjs";
import { seedPersona } from "../../../scripts/demo-seed/seed.mjs";
import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { migrate, query } from "./db";
import * as org from "./organisation/store";

/** The persona's seed against a real PostgreSQL: idempotent, resettable, and the library shows the three collections with their counts. */
const enabled = process.env.YOMIZAKA_DB_IT === "1" && !!process.env.DATABASE_URL;
const messagesByLocale = { fr, en };
const run = (email: string, options: { reset?: boolean; locale?: string } = {}) => seedPersona((sql: string, values?: unknown[]) => query(sql, values), { persona: "eric", email, messagesByLocale, ...options });
const expected = { "Immeuble Rosemont": 6, "Candidats — 4½ Villeray": 6, "Factures 2026": 4 };

describe.runIf(enabled)("the demo seed (Éric)", () => {
  beforeAll(async () => {
    await migrate();
  });
  const fresh = () => `eric-${Math.random().toString(36).slice(2)}@demo.yomizaka.test`;
  const snapshot = async (owner: string) => ({
    documents: (await query<{ n: number }>("SELECT count(*)::int AS n FROM documents WHERE owner_id = $1", [owner]))[0]!.n,
    analyses: (await query<{ n: number }>("SELECT count(*)::int AS n FROM analyses a JOIN documents d ON d.id = a.document_id WHERE d.owner_id = $1", [owner]))[0]!.n,
    collections: (await query<{ n: number }>("SELECT count(*)::int AS n FROM collections WHERE owner_id = $1", [owner]))[0]!.n,
  });

  it("shows the three collections with their counts in the persona's library", async () => {
    const email = fresh();
    const { owner } = await run(email);
    const overview = await org.overview(query, owner);
    const counts = Object.fromEntries(overview.flatMap((l) => l.collections.map((c) => [c.name, c.files])));
    for (const [name, n] of Object.entries(expected)) expect(counts[name], name).toBe(n);
    expect(PERSONA_ERIC.collections).toHaveLength(3);
    const checks = await query<{ run_id: string; inputs: Record<string, string> }>("SELECT a.run_id, a.inputs FROM analyses a JOIN documents d ON d.id = a.document_id WHERE d.owner_id = $1", [owner]);
    expect(checks).toHaveLength(PERSONA_ERIC.checked.length);
    for (const c of checks) {
      expect(c.run_id).toMatch(/^seeded-/);
      expect(c.inputs.seeded).toBe("true");
    }
  });

  it("changes nothing on a re-run, and starts over with reset", async () => {
    const email = fresh();
    const first = await run(email);
    const before = await snapshot(first.owner);
    const again = await run(email);
    expect(again.owner).toBe(first.owner);
    expect(again.collections).toEqual(expected);
    expect(await snapshot(first.owner)).toEqual(before);
    const reset = await run(email, { reset: true });
    expect(reset.collections).toEqual(expected);
    expect(await snapshot(first.owner)).toEqual(before);
  });

  it("takes the account's language for the collections' names", async () => {
    const { collections } = await run(fresh(), { locale: "en" });
    expect(Object.keys(collections).sort()).toEqual(["Candidates — 4½ Villeray", "Invoices 2026", "Rosemont building"]);
  });
});
