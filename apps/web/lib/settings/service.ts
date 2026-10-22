import { type Actor, type AuditEntry, type Context, GLOBAL, postgresSettings as postgres, type PostgresSettingsDeps, type ScopeRef, SettingsError, type SettingsService as Service } from "@krizaka/settings";
import type { QueryResultRow } from "pg";

import { SCOPES_BY_SPECIFICITY, SETTINGS, settings } from "./registry";

/** The SettingsService (ADR-0009) is `@krizaka/settings`; this binds it to Yomizaka's own registry. */
export type SettingsService = Service<typeof SETTINGS>;
export type { Actor, AuditEntry, Context, ScopeRef };
export { GLOBAL, SCOPES_BY_SPECIFICITY, SettingsError };

type AppQuery = <T extends QueryResultRow>(text: string, values?: unknown[]) => Promise<T[]>;

export const postgresSettings = (deps: Omit<PostgresSettingsDeps<typeof SETTINGS>, "query"> & { query: AppQuery }): SettingsService => postgres(settings, { ...deps, query: (sql, params) => deps.query(sql, params) as never });
