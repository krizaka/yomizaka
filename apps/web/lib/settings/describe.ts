import { defOf, type Group, type Kind, type Scope, SETTING_KEYS, type SettingKey } from "./registry";

/** A setting as the administration shows it: JSON-safe (no schema), so it can cross to the browser. */
export interface SettingDescription {
  key: SettingKey;
  group: Group;
  kind: Kind;
  default: unknown;
  scopes: readonly Scope[];
  min?: number;
  max?: number;
  unit?: string;
  choices?: readonly string[];
}

export const describeSettings = (): SettingDescription[] =>
  SETTING_KEYS.map((key) => {
    const { group, kind, default: dflt, scopes, min, max, unit, choices } = defOf(key);
    return { key, group, kind, default: dflt, scopes, min, max, unit, choices };
  });
