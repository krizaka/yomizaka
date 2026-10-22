import { defOf, SCOPE, type SettingKey } from "./registry";
import { GLOBAL, type SettingsService } from "./service";

/**
 * A deployment that was configured by environment before settings existed keeps behaving the same: at server start, each
 * legacy value that differs from the registry's default is written ONCE as a global setting — and only when nobody has set it
 * since. From then on the administration owns it; the environment is never read again.
 */
export interface LegacyValues {
  signupOpen: boolean;
  purgeAfterHours: number;
  proAuditsPerMonth: number;
}

const LEGACY_KEYS = { signupOpen: "signup.open", purgeAfterHours: "limits.purgeAfterHours", proAuditsPerMonth: "plans.pro.auditsPerMonth" } as const satisfies Record<keyof LegacyValues, SettingKey>;

export async function seedLegacySettings(service: SettingsService, legacy: LegacyValues, now: Date): Promise<SettingKey[]> {
  const seeded: SettingKey[] = [];
  const existing = await service.overrides(GLOBAL);
  for (const [field, key] of Object.entries(LEGACY_KEYS) as [keyof LegacyValues, SettingKey][]) {
    if (existing[key] !== undefined || legacy[field] === defOf(key).default) continue;
    await service.set({ id: null, label: "server start (legacy environment)" }, { scope: SCOPE.global, id: "" }, key, legacy[field], now);
    seeded.push(key);
  }
  return seeded;
}
