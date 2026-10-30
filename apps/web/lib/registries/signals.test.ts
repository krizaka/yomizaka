import { describe, expect, it } from "vitest";

import { VERDICT_WORDS } from "../signal-cards";
import { registries } from "./index";
import { closedRegistry } from "./model";
import { normaliseQstNumber } from "./qst-number";
import { checkIssuer, comparableName, registrantOfNeq, registrySignals } from "./signals";

const found = (over: Record<string, unknown> = {}) => ({
  kind: "found" as const,
  status: "registered" as const,
  statusDate: "2020-03-01",
  legalName: "9999-9999 Québec inc.",
  tradeName: "Atelier Exemple",
  ...over,
});
const issuer = {
  number: "0000000000TQ0001",
  name: "Atelier Exemple Inc.",
  registrant: "business" as const,
  documentDate: "2026-09-15",
};

describe("registry signals", () => {
  it("raises nothing for a registered number with the same name", () => {
    expect(registrySignals(found(), issuer, "Revenu Québec")).toEqual([]);
  });

  it("REG-001 for an unknown number, as a question", () => {
    const [s] = registrySignals({ kind: "unknown" }, issuer, "Revenu Québec");
    expect(s).toMatchObject({ signalId: "REG-001", level: "inhabituel", family: "figures" });
    expect(s.askFor).toBeTruthy();
  });

  it("REG-003 only when the status took effect on or before the document's date", () => {
    expect(
      registrySignals(found({ status: "struck", statusDate: "2026-01-01" }), issuer, "Revenu Québec").map(
        (s) => s.signalId,
      ),
    ).toEqual(["REG-003"]);
    expect(
      registrySignals(found({ status: "struck", statusDate: "2026-09-15" }), issuer, "Revenu Québec").map(
        (s) => s.signalId,
      ),
    ).toEqual(["REG-003"]);
    expect(registrySignals(found({ status: "struck", statusDate: "2027-01-01" }), issuer, "Revenu Québec")).toEqual([]);
  });

  it("REG-002 shows both names side by side when they differ", () => {
    const [s] = registrySignals(found({ legalName: "Autre Nom inc.", tradeName: null }), issuer, "Revenu Québec");
    expect(s.signalId).toBe("REG-002");
    expect(s.where).toContain("Atelier Exemple Inc.");
    expect(s.where).toContain("Autre Nom inc.");
  });

  it("never shows nor compares the registered name of a sole proprietor or an unknown registrant", () => {
    for (const registrant of ["individual", "unknown"] as const) {
      expect(
        registrySignals(
          found({ legalName: "Jean Exemple", tradeName: null }),
          { ...issuer, registrant },
          "Revenu Québec",
        ),
      ).toEqual([]);
    }
    const struck = registrySignals(
      found({ status: "struck", legalName: "Jean Exemple" }),
      { ...issuer, registrant: "individual" },
      "Revenu Québec",
    );
    expect(JSON.stringify(struck)).not.toContain("Jean Exemple");
  });

  it("raises nothing when the register did not answer", async () => {
    const r = await checkIssuer(closedRegistry("Revenu Québec", "unavailable"), issuer);
    expect(r).toEqual({ looked: false, reason: "unavailable", signals: [] });
  });

  it("never uses a verdict word", () => {
    const all = [
      ...registrySignals({ kind: "unknown" }, issuer, "Revenu Québec"),
      ...registrySignals(found({ status: "struck", legalName: "Autre" }), issuer, "Revenu Québec"),
    ];
    for (const s of all) {
      expect([s.observation, s.mayIndicate, s.askFor, s.where].join(" ")).not.toMatch(VERDICT_WORDS);
    }
  });
});

describe("helpers", () => {
  it("reads who registered from the NEQ prefix", () => {
    expect(registrantOfNeq("1100000000")).toBe("business");
    expect(registrantOfNeq("3300000000")).toBe("business");
    expect(registrantOfNeq("2200000000")).toBe("individual");
    expect(registrantOfNeq(null)).toBe("unknown");
  });
  it("normalises names and numbers", () => {
    expect(comparableName("Café Éxemple Ltée")).toBe("cafe exemple");
    expect(normaliseQstNumber("0000-000-000 TQ-0001")).toBe("0000000000TQ0001");
    expect(normaliseQstNumber("0000000000TX0001")).toBeNull();
  });
  it("covers the registers: CRA is never used, REQ is not authorised", async () => {
    const r = registries({ now: () => new Date("2026-10-30T10:00:00Z") });
    expect(await r.gstHst.lookupQst("0000000000TQ0001")).toEqual({ kind: "not-looked-up", reason: "not-covered" });
    expect(await r.req.lookupQst("0000000000TQ0001")).toEqual({ kind: "not-looked-up", reason: "not-authorised" });
  });
});
