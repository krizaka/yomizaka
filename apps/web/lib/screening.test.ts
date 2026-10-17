import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { decideFlow, seedFlows } from "./flows";
import { demoProvider, effectiveState, landlordView, RETENTION_DAYS, SCREENING_SCOPES, SCREENING_STATUS, screeningResult, tenantView } from "./screening";

const NOW = new Date("2026-10-17T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const row = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  landlord_id: "l1",
  tenant_name: "Camille Fictif",
  tenant_email: "camille@exemple.test",
  scope: ["payment-history"],
  provider: "demo",
  status: SCREENING_STATUS.requested,
  created_at: NOW,
  expires_at: day(14),
  consented_at: null,
  shared_at: null,
  contested_at: null,
  contest_comment: null,
  landlord_email: "proprio@exemple.test",
  result: null,
  result_expires_at: null,
  purged_at: null,
  ...over,
});
const result = { band: "no-concern", items: [{ key: "payment-history", outcome: "clear" }], provider: "demo", generatedAt: NOW.toISOString() };

describe("tenant screening — what the law lets a landlord ask (docs/product/tenant-screening-research.md)", () => {
  it("offers no criminal-record scope: the only lawful scope today is payment history", () => {
    expect([...SCREENING_SCOPES]).toEqual(["payment-history"]);
    expect(JSON.stringify([en.screening, fr.screening])).not.toMatch(/casier judiciaire\s*:?\s*(oui|vérif)/i);
    const code = readFileSync(join(__dirname, "screening.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    // The code asks for, stores and returns no criminal-record or SIN data: those words do not appear outside comments.
    expect(code).not.toMatch(/criminal|judiciaire|casier|\bsin\b|assurance sociale/i);
  });

  it("states the lawful list and what is never asked, in both languages", () => {
    for (const d of [en, fr]) {
      expect(d.screening.tenant.notAsked.length).toBeGreaterThan(20);
      expect(d.screening.landlord.lawful.length).toBeGreaterThan(20);
    }
    expect(fr.screening.tenant.notAsked).toMatch(/assurance sociale.*casier judiciaire/i);
    expect(en.screening.tenant.notAsked).toMatch(/social insurance number.*criminal record/i);
  });
});

describe("the consent flow: the tenant decides, sees first, can contest", () => {
  it("shows the landlord NO result until the tenant has passed it on", () => {
    expect(landlordView(row({ status: SCREENING_STATUS.consented, result, result_expires_at: day(30) }) as never, NOW).result).toBeNull();
    expect(landlordView(row({ status: SCREENING_STATUS.shared, result, result_expires_at: day(30) }) as never, NOW).result).toMatchObject({ band: "no-concern" });
  });
  it("never shows a contested result to the landlord, who sees only « contested »", () => {
    const view = landlordView(row({ status: SCREENING_STATUS.contested, result, result_expires_at: day(30), contest_comment: "faux" }) as never, NOW);
    expect(view.result).toBeNull();
    expect(view.status).toBe("contested");
    expect(JSON.stringify(view)).not.toContain("faux");
  });
  it("shows the tenant their own result as soon as they consented, with who asked and how long it is kept", () => {
    const view = tenantView(row({ status: SCREENING_STATUS.consented, result, result_expires_at: day(30) }) as never, NOW);
    expect(view).toMatchObject({ landlord: "proprio@exemple.test", retentionDays: RETENTION_DAYS, demo: true, result: { band: "no-concern" } });
  });
  it("expires a request nobody answered, and stops showing a result past its retention", () => {
    expect(effectiveState(row({ expires_at: day(-1) }) as never, NOW).status).toBe("expired");
    expect(effectiveState(row({ status: SCREENING_STATUS.shared, result, result_expires_at: day(-1) }) as never, NOW).resultAlive).toBe(false);
    expect(landlordView(row({ status: SCREENING_STATUS.shared, result, result_expires_at: day(-1) }) as never, NOW).result).toBeNull();
    expect(tenantView(row({ status: SCREENING_STATUS.shared, result, result_expires_at: day(-1) }) as never, NOW).result).toBeNull();
  });
});

describe("minimal data", () => {
  it("keeps a band and a few items — nothing else: the stored result schema has no score, account, address or raw report", () => {
    expect(Object.keys(screeningResult.shape).sort()).toEqual(["band", "generatedAt", "items", "provider"]);
    expect(screeningResult.safeParse({ ...result, score: 712, account: "x" }).success).toBe(true); // extra keys are dropped by parse
    expect(Object.keys(screeningResult.parse({ ...result, score: 712, account: "x" }))).not.toContain("score");
  });
  it("the demo provider is fictitious, deterministic, and says so", async () => {
    expect(demoProvider.demo).toBe(true);
    const clear = await demoProvider.check({ name: "A", email: "a@x.test" }, ["payment-history"], NOW);
    const flagged = await demoProvider.check({ name: "A", email: "flag@x.test" }, ["payment-history"], NOW);
    expect(clear.band).toBe("no-concern");
    expect(flagged.band).toBe("review");
    expect(Object.keys(clear).sort()).toEqual(["band", "generatedAt", "items", "provider"]);
  });
});

describe("the flow gate: the landlord's undertaking is a consent the flow requires", () => {
  const flows = seedFlows("dev");
  it("refuses until the undertaking is granted, then lets the landlord ask; a tenant is never offered it", () => {
    expect(decideFlow(flows, "landlord", "tenant-screening", [])).toEqual({ ok: false, code: "CONSENT_REQUIRED", missing: ["screening-landlord-undertaking"] });
    expect(decideFlow(flows, "landlord", "tenant-screening", ["screening-landlord-undertaking"])).toMatchObject({ ok: true });
    expect(decideFlow(flows, "tenant", "tenant-screening", ["screening-landlord-undertaking"])).toMatchObject({ ok: false, code: "FLOW_NOT_OFFERED" });
  });
  it("is dev only (the real providers need contracts): not offered in prod", () => {
    expect(decideFlow(seedFlows("prod"), "landlord", "tenant-screening", ["screening-landlord-undertaking"])).toMatchObject({ ok: false, code: "FLOW_NOT_OFFERED" });
  });
});
