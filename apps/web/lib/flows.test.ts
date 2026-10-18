import { AUDIENCES, flowDefinition } from "@yomizaka/core";
import { describe, expect, it } from "vitest";

import { definitionFromForm, emptyForm, formFromDefinition } from "./flow-form";
import { audiencesOf, type AvailableFlow, decideStart, flowsFor, offerFor, seedFlows } from "./flows";
import { SEED_FLOWS } from "./flows-seed";

/** ADR-0003: flows are data. These are the pure rules; the SQL is in flows.integration.test.ts. */
const flow = (key: string, patch: Partial<AvailableFlow["definition"]> = {}): AvailableFlow => ({ key, versionId: `${key}-v1`, version: 1, definition: { ...SEED_FLOWS[0]!.definition, ...patch } });

describe("the seeded flows", () => {
  it("are valid definitions, one per audience of the vocabulary", () => {
    for (const s of SEED_FLOWS) expect(flowDefinition.safeParse(s.definition).success, s.key).toBe(true);
    expect(new Set(SEED_FLOWS.flatMap((s) => s.definition.audiences))).toEqual(new Set(AUDIENCES));
  });
  it("point the compliance Studio at the rulesets of the pack by jurisdiction (data, not code)", () => {
    const compliance = SEED_FLOWS[0]!.definition.steps.find((s) => s.studio === "compliance-check")!;
    expect(compliance.jurisdictions.map((j) => [j.code, j.ruleset])).toEqual([["QC", "qc-residential-lease"], ["FR", "fr-residential-lease"], ["BE-WAL", "be-residential-lease"]]);
  });
  it("keep the freelancer and business flows « soon » and dev only", () => {
    expect(SEED_FLOWS.filter((s) => s.definition.status === "soon").map((s) => s.key).sort()).toEqual(["file-check-business", "file-check-freelancer", "tenant-screening"]);
    expect(seedFlows("prod").map((f) => f.key)).toEqual(["lease-check-tenant", "lease-check-landlord"]);
  });
});

describe("what the app derives from the flows — nothing hard-coded", () => {
  it("offers an audience only when an enabled flow offers it, available when one of its flows runs today", () => {
    const flows = [flow("a", { audiences: ["tenant"] }), flow("b", { audiences: ["freelancer"], status: "soon" })];
    expect(audiencesOf(flows)).toEqual([{ audience: "tenant", status: "available" }, { audience: "freelancer", status: "soon" }]);
    expect(audiencesOf([])).toEqual([]);
  });

  it("a disabled flow is hidden: take it out of the available list and its audience, studios and jurisdictions go with it", () => {
    const tenant = flow("tenant", { audiences: ["tenant"] });
    const both = [tenant, flow("landlord", { audiences: ["landlord"] })];
    expect(audiencesOf(both).map((a) => a.audience)).toEqual(["tenant", "landlord"]);
    expect(audiencesOf([tenant]).map((a) => a.audience)).toEqual(["tenant"]);
    expect(offerFor([], "tenant")).toEqual({ studios: [], jurisdictions: [] });
  });

  it("offers on a document the Studios and jurisdictions of the person's flows (all flows until they chose a side)", () => {
    const flows = seedFlows("dev");
    expect(offerFor(flows, "tenant")).toEqual({ studios: ["compliance-check", "document-authenticity"], jurisdictions: ["QC", "FR", "BE-WAL"] });
    expect(offerFor(flows, "freelancer")).toEqual({ studios: ["document-authenticity"], jurisdictions: [] });
    expect(flowsFor(flows, null)).toHaveLength(flows.length);
  });
});

describe("a required consent is enforced, not only hidden", () => {
  const screening = flow("tenant-screening", { audiences: ["landlord"], consents: ["tenant-screening"] });
  it("refuses to start a flow whose consent has not been given (CONSENT_REQUIRED, naming it)", () => {
    expect(decideStart([screening], "landlord", "compliance-check", [])).toEqual({ ok: false, code: "CONSENT_REQUIRED", missing: ["tenant-screening"] });
  });
  it("starts it once every consent is granted, under that flow's version", () => {
    const decision = decideStart([screening], "landlord", "compliance-check", ["tenant-screening"]);
    expect(decision).toMatchObject({ ok: true, flow: { key: "tenant-screening", versionId: "tenant-screening-v1" } });
  });
  it("refuses a Studio no enabled flow offers to this person (FLOW_NOT_OFFERED)", () => {
    expect(decideStart([screening], "tenant", "compliance-check", ["tenant-screening"])).toMatchObject({ ok: false, code: "FLOW_NOT_OFFERED" });
    expect(decideStart([], null, "document-authenticity", [])).toMatchObject({ ok: false, code: "FLOW_NOT_OFFERED" });
  });
  it("runs under another flow of the audience when that one needs no consent", () => {
    const free = flow("lease-check-landlord", { audiences: ["landlord"] });
    expect(decideStart([screening, free], "landlord", "compliance-check", [])).toMatchObject({ ok: true, flow: { key: "lease-check-landlord" } });
  });
});

describe("the administration form and the definition, both ways", () => {
  it("round-trips every seeded flow", () => {
    for (const s of SEED_FLOWS) expect(definitionFromForm(formFromDefinition(s.definition))).toEqual(flowDefinition.parse(s.definition));
  });
  it("refuses an incomplete form (no audience, no title) — the definition's schema is the validator", () => {
    expect(() => definitionFromForm(emptyForm())).toThrow();
  });
  it("turns the price in dollars into cents", () => {
    const f = formFromDefinition(SEED_FLOWS[0]!.definition);
    expect(definitionFromForm({ ...f, pricingModel: "per-run", amount: "4.5" }).pricing).toEqual({ model: "per-run", amountCents: 450 });
  });
});
