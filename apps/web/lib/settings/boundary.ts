import { type DocumentInsight, MAX_FILE_BYTES } from "@yomizaka/core";

import type { FileKind, PreflightRules } from "../preflight/port";
import type { SettingKey } from "./registry";
import type { Resolved } from "./resolve";

/** The settings a check at the server boundary reads: a resolved snapshot (see SettingsService.snapshot). */
export type Snapshot = Record<SettingKey, Resolved>;
const value = <T>(s: Snapshot, key: SettingKey) => s[key].value as T;

const MB = 1024 * 1024;
/** The file kinds the pre-flight knows by the names the settings use. */
const KIND_OF: Record<string, FileKind> = { pdf: "pdf", text: "text" };

/** The pre-flight rules as set in the configuration: the product's rules with the limits an administrator changed. */
export function preflightRulesFrom(base: PreflightRules, s: Snapshot): PreflightRules {
  return {
    ...base,
    maxBytes: Math.min(MAX_FILE_BYTES, value<number>(s, "limits.maxFileMb") * MB),
    maxPages: value<number>(s, "limits.maxPages"),
    allowedKinds: value<string[]>(s, "limits.allowedTypes").map((t) => KIND_OF[t]!).filter(Boolean),
  };
}

/** The « Ce document » panel and the personal-information counts follow their switches: what is off is not sent to the browser at all. */
export function withFeatures<T extends { insight?: DocumentInsight }>(doc: T, features: { documentInsight: boolean; personalInfo: boolean }): T {
  if (!features.documentInsight) return { ...doc, insight: undefined };
  if (!features.personalInfo && doc.insight) return { ...doc, insight: { ...doc.insight, pii: { total: 0, counts: {} } } };
  return doc;
}

export interface Maintenance {
  on: boolean;
  message: { fr: string; en: string };
}
export const maintenanceOf = (s: Snapshot): Maintenance => ({ on: value<boolean>(s, "app.maintenance"), message: value<{ fr: string; en: string }>(s, "app.maintenanceMessage") });

/** What the browser may know of the configuration (never a secret, never a switch it does not need). */
export interface ClientConfig {
  maxFileBytes: number;
  allowedTypes: string[];
  features: { keepDocuments: boolean; ownStorage: boolean; documentInsight: boolean; assistant: boolean };
  payments: { enabled: boolean; display: string };
}
export const clientConfigOf = (s: Snapshot): ClientConfig => ({
  maxFileBytes: Math.min(MAX_FILE_BYTES, value<number>(s, "limits.maxFileMb") * MB),
  allowedTypes: value<string[]>(s, "limits.allowedTypes"),
  features: { keepDocuments: value(s, "features.keepDocuments"), ownStorage: value(s, "features.ownStorage"), documentInsight: value(s, "features.documentInsight"), assistant: value(s, "features.assistant") },
  payments: { enabled: value(s, "payments.enabled"), display: value(s, "payments.display") },
});

/** The caps an audit is held to: monthly (a person's bonus added) and daily (0 = no cap), for the plan the account is on. */
export interface AuditCaps {
  perMonth: number;
  perDay: number;
  freeFirst: boolean;
}
export const auditCapsOf = (s: Snapshot, plan: "free" | "pro"): AuditCaps => ({
  perMonth: plan === "pro" ? value<number>(s, "plans.pro.auditsPerMonth") + value<number>(s, "limits.bonusAuditsPerMonth") : Number.POSITIVE_INFINITY,
  perDay: value<number>(s, plan === "pro" ? "plans.pro.auditsPerDay" : "plans.free.auditsPerDay"),
  freeFirst: value<boolean>(s, "audit.freeFirst"),
});
