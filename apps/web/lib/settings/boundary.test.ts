import { describe, expect, it } from "vitest";

import { YOMIZAKA_RULES } from "../preflight/rules";
import { auditCapsOf, clientConfigOf, maintenanceOf, preflightRulesFrom, type Snapshot } from "./boundary";
import { defOf, SETTING_KEYS, type SettingKey } from "./registry";

/** A snapshot of the defaults, with some values changed. */
const snapshot = (changes: Partial<Record<SettingKey, unknown>> = {}): Snapshot =>
  Object.fromEntries(SETTING_KEYS.map((k) => [k, k in changes ? { value: changes[k], source: "global" } : { value: defOf(k).default, source: "default" }])) as Snapshot;

describe("the pre-flight rules follow the configuration", () => {
  it("keeps the product's rules and applies the limits an administrator set", () => {
    const rules = preflightRulesFrom(YOMIZAKA_RULES, snapshot({ "limits.maxFileMb": 2, "limits.maxPages": 30, "limits.allowedTypes": ["pdf"] }));
    expect(rules).toMatchObject({ maxBytes: 2 * 1024 * 1024, maxPages: 30, allowedKinds: ["pdf"] });
    expect(rules.pdfActiveNames).toEqual(YOMIZAKA_RULES.pdfActiveNames);
  });
  it("the defaults are the product's own rules", () => {
    expect(preflightRulesFrom(YOMIZAKA_RULES, snapshot())).toEqual(YOMIZAKA_RULES);
  });
});

describe("maintenance", () => {
  it.each([
    [false, false],
    [true, true],
  ])("on=%s", (set, on) => expect(maintenanceOf(snapshot({ "app.maintenance": set })).on).toBe(on));
  it("carries its message in both languages", () => {
    const m = maintenanceOf(snapshot({ "app.maintenanceMessage": { fr: "Retour à 14 h.", en: "Back at 2 pm." } }));
    expect(m.message).toEqual({ fr: "Retour à 14 h.", en: "Back at 2 pm." });
  });
});

describe("the audit caps of a plan", () => {
  it.each([
    ["pro", {}, { perMonth: 100, perDay: 0, freeFirst: true }],
    ["pro", { "plans.pro.auditsPerMonth": 50, "limits.bonusAuditsPerMonth": 20, "plans.pro.auditsPerDay": 10 }, { perMonth: 70, perDay: 10, freeFirst: true }],
    ["free", { "plans.free.auditsPerDay": 3, "audit.freeFirst": false }, { perMonth: Number.POSITIVE_INFINITY, perDay: 3, freeFirst: false }],
  ] as const)("%s with %j", (plan, changes, caps) => expect(auditCapsOf(snapshot(changes), plan)).toEqual(caps));
});

describe("what the browser may know", () => {
  it("is the limits, the features it shows and the payment display — nothing else", () => {
    const c = clientConfigOf(snapshot({ "features.keepDocuments": false, "payments.display": "live" }));
    expect(c).toEqual({ maxFileBytes: 10 * 1024 * 1024, allowedTypes: ["pdf", "text", "image"], features: { keepDocuments: false, ownStorage: true, documentInsight: true, assistant: false }, payments: { enabled: true, display: "live" } });
  });
});
