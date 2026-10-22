import type { QueryResultRow } from "pg";

import { defOf, isSettingKey, SCOPE, type Scope, SCOPES_BY_SPECIFICITY, SETTING_KEYS, type SettingKey, type ValueOf } from "./registry";
import { type Layers, type Resolved, resolveValue } from "./resolve";

/**
 * The SettingsService PORT (ADR-0009). The app asks it for a setting — resolved user, then workspace, then global, then the
 * default — and an administrator changes it through it, every change leaving an audit line (who, what, when, before, after).
 * Written without any Yomizaka code so it can be shared by the other Krizaka products with their own stores.
 */
export interface ScopeRef {
  scope: Scope;
  /** The workspace or user the override belongs to; empty for the global scope. */
  id: string;
}
export const GLOBAL: ScopeRef = { scope: SCOPE.global, id: "" };

export interface Actor {
  id: string | null;
  label: string;
}
export interface Context {
  userId?: string | null;
  /** A workspace named directly (an admin previewing it); else it is looked up from the user. */
  workspaceId?: string | null;
}
export interface AuditEntry {
  id: number;
  at: string;
  actorLabel: string;
  scope: Scope;
  scopeId: string;
  key: string;
  before: unknown;
  after: unknown;
}

export class SettingsError extends Error {
  constructor(
    readonly status: number,
    readonly code: "UNKNOWN_SETTING" | "BAD_VALUE" | "BAD_SCOPE",
    message: string,
  ) {
    super(message);
    this.name = "SettingsError";
  }
}

export interface SettingsService {
  get<K extends SettingKey>(key: K, context?: Context): Promise<ValueOf<K>>;
  /** Every setting, resolved for a context, with where each value comes from. */
  snapshot(context?: Context): Promise<Record<SettingKey, Resolved>>;
  /** What is overridden at one scope (the rest follows the scope above). */
  overrides(scope: ScopeRef): Promise<Partial<Record<SettingKey, unknown>>>;
  set(actor: Actor, scope: ScopeRef, key: string, value: unknown, now: Date): Promise<void>;
  /** Back to the default: removes the override at that scope. */
  reset(actor: Actor, scope: ScopeRef, key: string, now: Date): Promise<void>;
  history(options?: { key?: string; limit?: number }): Promise<AuditEntry[]>;
}

type Query = <T extends QueryResultRow>(text: string, values?: unknown[]) => Promise<T[]>;

export interface PostgresSettingsDeps {
  query: Query;
  /** The workspace a user belongs to (null while workspaces do not exist, #126). */
  workspaceOf?: (userId: string) => Promise<string | null>;
  /** Defaults that depend on the deployment (a legacy environment switch): they replace the registry's default, never an override. */
  defaults?: Partial<Record<SettingKey, unknown>>;
  /** How long a read is served from memory (other instances see a change within it; this one at once). */
  cacheMs?: number;
  clock?: () => number;
}

const cacheKey = (s: ScopeRef) => `${s.scope}:${s.id}`;

export function postgresSettings(deps: PostgresSettingsDeps): SettingsService {
  const { query } = deps;
  const cacheMs = deps.cacheMs ?? 5000;
  const clock = deps.clock ?? (() => 0);
  const cache = new Map<string, { at: number; values: Partial<Record<SettingKey, unknown>> }>();

  async function load(scope: ScopeRef): Promise<Partial<Record<SettingKey, unknown>>> {
    const hit = cache.get(cacheKey(scope));
    if (hit && clock() - hit.at < cacheMs) return hit.values;
    const rows = await query<{ key: string; value: unknown }>("SELECT key, value FROM app_settings WHERE scope = $1 AND scope_id = $2", [scope.scope, scope.id]);
    const values: Partial<Record<SettingKey, unknown>> = {};
    for (const r of rows) if (isSettingKey(r.key)) values[r.key] = r.value;
    cache.set(cacheKey(scope), { at: clock(), values });
    return values;
  }

  async function layersFor(context: Context): Promise<Record<Scope, Partial<Record<SettingKey, unknown>>>> {
    const workspaceId = context.workspaceId ?? (context.userId && deps.workspaceOf ? await deps.workspaceOf(context.userId) : null);
    const [user, workspace, global] = await Promise.all([context.userId ? load({ scope: SCOPE.user, id: context.userId }) : {}, workspaceId ? load({ scope: SCOPE.workspace, id: workspaceId }) : {}, load(GLOBAL)]);
    return { user, workspace, global };
  }

  function validate(scope: ScopeRef, key: string, value?: unknown): SettingKey {
    if (!isSettingKey(key)) throw new SettingsError(404, "UNKNOWN_SETTING", `No such setting: ${key}`);
    const def = defOf(key);
    if (!def.scopes.includes(scope.scope)) throw new SettingsError(400, "BAD_SCOPE", `${key} cannot be set at the ${scope.scope} level`);
    if (scope.scope !== SCOPE.global && !scope.id) throw new SettingsError(400, "BAD_SCOPE", "A workspace or a user is required");
    if (value !== undefined && !def.schema.safeParse(value).success) throw new SettingsError(400, "BAD_VALUE", `Not a valid value for ${key}`);
    return key;
  }

  const record = (actor: Actor, scope: ScopeRef, key: string, before: unknown, after: unknown, now: Date) =>
    query("INSERT INTO settings_audit (at, actor_id, actor_label, scope, scope_id, key, before, after) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [now, actor.id, actor.label, scope.scope, scope.id, key, JSON.stringify(before ?? null), JSON.stringify(after ?? null)]);

  return {
    async get(key, context = {}) {
      const layers = await layersFor(context);
      return resolveValue(key, { user: layers.user[key], workspace: layers.workspace[key], global: layers.global[key] }, deps.defaults?.[key]).value as never;
    },

    async snapshot(context = {}) {
      const layers = await layersFor(context);
      return Object.fromEntries(SETTING_KEYS.map((k) => [k, resolveValue(k, { user: layers.user[k], workspace: layers.workspace[k], global: layers.global[k] } satisfies Layers, deps.defaults?.[k])])) as Record<SettingKey, Resolved>;
    },

    overrides: (scope) => load(scope),

    async set(actor, scope, key, value, now) {
      const k = validate(scope, key, value ?? null);
      const parsed = defOf(k).schema.parse(value);
      const before = (await query<{ value: unknown }>("SELECT value FROM app_settings WHERE scope = $1 AND scope_id = $2 AND key = $3", [scope.scope, scope.id, k]))[0]?.value;
      await query(
        `INSERT INTO app_settings (scope, scope_id, key, value, updated_at, updated_by) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (scope, scope_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
        [scope.scope, scope.id, k, JSON.stringify(parsed), now, actor.id],
      );
      await record(actor, scope, k, before, parsed, now);
      cache.clear();
    },

    async reset(actor, scope, key, now) {
      const k = validate(scope, key);
      const rows = await query<{ value: unknown }>("DELETE FROM app_settings WHERE scope = $1 AND scope_id = $2 AND key = $3 RETURNING value", [scope.scope, scope.id, k]);
      if (rows.length) await record(actor, scope, k, rows[0]!.value, null, now);
      cache.clear();
    },

    async history({ key, limit = 100 } = {}) {
      const rows = await query<{ id: string; at: Date; actor_label: string; scope: Scope; scope_id: string; key: string; before: unknown; after: unknown }>(
        "SELECT id, at, actor_label, scope, scope_id, key, before, after FROM settings_audit WHERE ($1::text IS NULL OR key = $1) ORDER BY id DESC LIMIT $2",
        [key ?? null, limit],
      );
      return rows.map((r) => ({ id: Number(r.id), at: r.at.toISOString(), actorLabel: r.actor_label, scope: r.scope, scopeId: r.scope_id, key: r.key, before: r.before, after: r.after }));
    },
  };
}

export { SCOPES_BY_SPECIFICITY };
