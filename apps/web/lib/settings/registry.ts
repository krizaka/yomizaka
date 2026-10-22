import { z } from "zod";

/**
 * Every setting of the app: its key, its type, its default and the scopes it can be overridden at. Settings are DATA in the
 * database (ADR-0009), changed by an administrator without a redeploy; the registry is the one place that says what exists,
 * so the admin forms, the validation and the checks at the server boundary all read the same list.
 */
export const SCOPE = { global: "global", workspace: "workspace", user: "user" } as const;
export type Scope = (typeof SCOPE)[keyof typeof SCOPE];
/** The order a value is looked up in: the most specific wins (user, then workspace, then global). */
export const SCOPES_BY_SPECIFICITY = [SCOPE.user, SCOPE.workspace, SCOPE.global] as const;

export const GROUP = { general: "general", features: "features", limits: "limits", plans: "plans" } as const;
export type Group = (typeof GROUP)[keyof typeof GROUP];
export const GROUPS = Object.values(GROUP);

export const KIND = { flag: "flag", integer: "integer", choice: "choice", bilingual: "bilingual", subset: "subset" } as const;
export type Kind = (typeof KIND)[keyof typeof KIND];

export interface Def<T = unknown> {
  group: Group;
  kind: Kind;
  schema: z.ZodType<T>;
  default: T;
  scopes: readonly Scope[];
  /** For a number: its bounds and unit; for a choice or a subset: the values. */
  min?: number;
  max?: number;
  unit?: string;
  choices?: readonly string[];
}

const ALL: readonly Scope[] = [SCOPE.global, SCOPE.workspace, SCOPE.user];
const WORKSPACE: readonly Scope[] = [SCOPE.global, SCOPE.workspace];
const GLOBAL: readonly Scope[] = [SCOPE.global];

const flag = (group: Group, value: boolean, scopes: readonly Scope[] = GLOBAL): Def<boolean> => ({ group, kind: KIND.flag, schema: z.boolean(), default: value, scopes });
const integer = (group: Group, value: number, bounds: { min: number; max: number; unit?: string }, scopes: readonly Scope[] = GLOBAL): Def<number> => ({ group, kind: KIND.integer, schema: z.number().int().min(bounds.min).max(bounds.max), default: value, scopes, ...bounds });
const choice = <const C extends readonly [string, ...string[]]>(group: Group, choices: C, value: C[number], scopes: readonly Scope[] = GLOBAL): Def<C[number]> => ({ group, kind: KIND.choice, schema: z.enum(choices), default: value, scopes, choices });
const subset = <const C extends readonly [string, ...string[]]>(group: Group, choices: C, value: C[number][], scopes: readonly Scope[] = GLOBAL): Def<C[number][]> => ({ group, kind: KIND.subset, schema: z.array(z.enum(choices)).min(1), default: value, scopes, choices });
const bilingual = (group: Group, value: { fr: string; en: string }, scopes: readonly Scope[] = GLOBAL): Def<{ fr: string; en: string }> => ({ group, kind: KIND.bilingual, schema: z.object({ fr: z.string().trim().min(1).max(500), en: z.string().trim().min(1).max(500) }), default: value, scopes });

export const PAYMENT_DISPLAY = { test: "test", live: "live" } as const;
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
  // Limits: what one document and one account may do.
  "limits.maxFileMb": integer(GROUP.limits, PLATFORM_MAX_FILE_MB, { min: 1, max: PLATFORM_MAX_FILE_MB, unit: "MB" }, WORKSPACE),
  "limits.maxPages": integer(GROUP.limits, 200, { min: 1, max: 500, unit: "pages" }, WORKSPACE),
  "limits.allowedTypes": subset(GROUP.limits, FILE_TYPES, [...FILE_TYPES], WORKSPACE),
  "limits.reuseDays": integer(GROUP.limits, 365, { min: 0, max: 3650, unit: "days" }),
  "limits.purgeAfterHours": integer(GROUP.limits, 24, { min: 1, max: 720, unit: "hours" }),
  "limits.bonusAuditsPerMonth": integer(GROUP.limits, 0, { min: 0, max: 10000, unit: "audits" }, [SCOPE.user]),
  // Plans: what each plan includes (prices stay in Stripe).
  "plans.free.auditsPerDay": integer(GROUP.plans, 0, { min: 0, max: 1000, unit: "audits" }, WORKSPACE),
  "plans.pro.auditsPerMonth": integer(GROUP.plans, 100, { min: 1, max: 100000, unit: "audits" }, WORKSPACE),
  "plans.pro.auditsPerDay": integer(GROUP.plans, 0, { min: 0, max: 5000, unit: "audits" }, WORKSPACE),
} as const satisfies Record<string, Def<never> | Def<boolean> | Def<number> | Def<string> | Def<string[]> | Def<{ fr: string; en: string }>>;

export type SettingKey = keyof typeof SETTINGS;
export type ValueOf<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]["schema"]>;
export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];
export const isSettingKey = (key: string): key is SettingKey => key in SETTINGS;
export const defOf = (key: SettingKey): Def => SETTINGS[key] as unknown as Def;
export const keysOfGroup = (group: Group): SettingKey[] => SETTING_KEYS.filter((k) => defOf(k).group === group);
