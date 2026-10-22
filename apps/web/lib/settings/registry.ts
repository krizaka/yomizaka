import { ALL_SCOPES, bilingual, choice, type Def, defineSettings, flag, integer, KIND, type Kind, type Registry, SCOPE, type Scope, SCOPES_BY_SPECIFICITY, subset, WORKSPACE_SCOPES } from "@krizaka/settings";
import type { z } from "zod";

/**
 * Every setting of the app: its key, its type, its default and the scopes it can be overridden at. Settings are DATA in the
 * database (ADR-0009), changed by an administrator without a redeploy; the registry is the one place that says what exists,
 * so the admin forms, the validation and the checks at the server boundary all read the same list.
 */
export { SCOPE, type Scope, SCOPES_BY_SPECIFICITY };

export const GROUP = { general: "general", features: "features", limits: "limits", plans: "plans" } as const;
export type Group = (typeof GROUP)[keyof typeof GROUP];
export const GROUPS = Object.values(GROUP);

export { type Def,KIND, type Kind };

const ALL = ALL_SCOPES;
const WORKSPACE = WORKSPACE_SCOPES;

export const PAYMENT_DISPLAY = { test: "test", live: "live" } as const;
export const AVATAR_SEED_CHOICES = ["v1", "v2", "v3", "v4", "v5", "v6"] as const;
export const FILE_TYPES = ["pdf", "text", "image"] as const;

/** The platform's cap on a file: a limit here can only go down from it. */
// @fixed: what the pre-flight and the uploads can carry
export const PLATFORM_MAX_FILE_MB = 10;

export const SETTINGS = {
  // General: the switches that open and close the app for consumers.
  "app.maintenance": flag(GROUP.general, false),
  "app.maintenanceMessage": bilingual(GROUP.general, { fr: "Yomizaka est en maintenance. Revenez dans quelques minutes.", en: "Yomizaka is down for maintenance. Please come back in a few minutes." }),
  "signup.open": flag(GROUP.general, false),
  "payments.enabled": flag(GROUP.general, true, WORKSPACE),
  "payments.display": choice(GROUP.general, [PAYMENT_DISPLAY.test, PAYMENT_DISPLAY.live], PAYMENT_DISPLAY.test),
  "audit.freeFirst": flag(GROUP.general, true, WORKSPACE),
  // Features: each can be switched off for everyone, a workspace or one person (a beta).
  "features.documentInsight": flag(GROUP.features, true, ALL),
  "features.personalInfo": flag(GROUP.features, true, WORKSPACE),
  "features.keepDocuments": flag(GROUP.features, true, ALL),
  "features.ownStorage": flag(GROUP.features, true, WORKSPACE),
  "features.assistant": flag(GROUP.features, false, ALL),
  // API keys (ADR-0011): the global switch; what a plan holds is below.
  "features.apiKeys": flag(GROUP.features, true, WORKSPACE),
  // Collection avatars (krizaka/yomizaka#206): on or off, which of the set are offered, how heavy an uploaded image may be.
  "features.collectionAvatars": flag(GROUP.features, true, WORKSPACE),
  "features.avatarSet": subset(GROUP.features, AVATAR_SEED_CHOICES, [...AVATAR_SEED_CHOICES]),
  // Limits: what one document and one account may do.
  "limits.maxFileMb": integer(GROUP.limits, PLATFORM_MAX_FILE_MB, { min: 1, max: PLATFORM_MAX_FILE_MB, unit: "MB" }, WORKSPACE),
  "limits.maxPages": integer(GROUP.limits, 200, { min: 1, max: 500, unit: "pages" }, WORKSPACE),
  "limits.allowedTypes": subset(GROUP.limits, FILE_TYPES, [...FILE_TYPES], WORKSPACE),
  "limits.reuseDays": integer(GROUP.limits, 365, { min: 0, max: 3650, unit: "days" }),
  "limits.purgeAfterHours": integer(GROUP.limits, 24, { min: 1, max: 720, unit: "hours" }),
  "limits.apiRequestsPerMinute": integer(GROUP.limits, 60, { min: 1, max: 6000, unit: "requests" }, WORKSPACE),
  "limits.avatarMaxKb": integer(GROUP.limits, 512, { min: 16, max: 2048, unit: "KB" }),
  "limits.bonusAuditsPerMonth": integer(GROUP.limits, 0, { min: 0, max: 10000, unit: "audits" }, [SCOPE.user]),
  // Plans: what each plan includes (prices stay in Stripe).
  "plans.free.auditsPerDay": integer(GROUP.plans, 0, { min: 0, max: 1000, unit: "audits" }, WORKSPACE),
  "plans.pro.auditsPerMonth": integer(GROUP.plans, 100, { min: 1, max: 100000, unit: "audits" }, WORKSPACE),
  "plans.free.apiKeys": integer(GROUP.plans, 0, { min: 0, max: 100, unit: "keys" }, WORKSPACE),
  "plans.pro.apiKeys": integer(GROUP.plans, 10, { min: 0, max: 100, unit: "keys" }, WORKSPACE),
  "plans.pro.auditsPerDay": integer(GROUP.plans, 0, { min: 0, max: 5000, unit: "audits" }, WORKSPACE),
} as const satisfies Registry;

const settings = defineSettings(SETTINGS);
/** The registry's tools (the shared package's), over this product's own list. */
export { settings };
export type SettingKey = keyof typeof SETTINGS;
export type ValueOf<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]["schema"]>;
export const SETTING_KEYS = settings.keys;
export const isSettingKey = settings.isKey;
export const defOf = settings.defOf;
export const keysOfGroup = settings.keysOfGroup;
