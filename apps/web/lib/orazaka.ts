import { createOrazakaClient as createSharedClient } from "@krizaka/orazaka-client";
import { type OrazakaRun, orazakaRun, type Studio } from "@yomizaka/core";
import { z } from "zod";

import { systemClock } from "../app/system-clock";
import { readEnv } from "./env";
import { HttpError, refuse } from "./http";
import { engineDoor, standingConsent } from "./screening-checks/engine-door";
import type { ChecksDoor } from "./screening-checks/model";

/**
 * Orazaka's edge — the only place Yomizaka's analyses run. Yomizaka calls it with its service key (`oz_…`, a DO
 * SECRET): the edge exchanges the key for a session of the `svc_yomizaka` account, whose operator grants open the
 * document Studios. No model is ever called from here; Yomizaka keeps the run id as the trace of what ran.
 *
 *   GET  /api/v1/studios/installations         the Studios this account installed
 *   POST /api/v1/studios/{studio}/installations install one (once)
 *   POST /api/v1/studios/{studio}/runs         start a run: { inputs } → 202 + the run
 *   GET  /api/v1/studios/runs/{runId}          the run, its status and outputs
 */
type Fetch = typeof fetch;

export interface OrazakaClient {
  startRun(studio: Studio, inputs: Record<string, string>): Promise<OrazakaRun>;
  getRun(runId: string): Promise<OrazakaRun>;
  /** The Studios this product's key has installed — also the cheapest call that proves the key and the connection. */
  studios(): Promise<string[]>;
}

const installation = z.object({ studioKey: z.string(), pinnedVersion: z.string().optional() });

/** What a refusal of Orazaka's means for Yomizaka — a stable code the UI translates. */
export function orazakaRefusal(status: number): { status: number; code: string } {
  if (status === 401 || status === 403) return { status: 502, code: "ORAZAKA_KEY" };
  if (status === 402) return { status: 502, code: "ORAZAKA_CREDITS" };
  if (status === 409) return { status: 502, code: "ORAZAKA_LOCKED" };
  if (status === 400 || status === 422) return { status: 422, code: "ORAZAKA_INPUT" };
  if (status === 404) return { status: 502, code: "ORAZAKA_NOT_FOUND" };
  // « too many concurrent runs »: the engine says when to come back; not a failure of the document (yomizaka#248).
  if (status === 429) return { status: 429, code: "ORAZAKA_BUSY" };
  return { status: 502, code: "ORAZAKA_UNAVAILABLE" };
}

/** Whether an installation pinned on this version reads a declared kind (2.x and later; not told: assumed so). */
export const kindIsRead = (pinnedVersion: string | undefined): boolean => pinnedVersion === undefined || Number.parseInt(pinnedVersion, 10) >= 2;

export function createOrazakaClient(options: { baseUrl: string; apiKey: string | undefined; fetch?: Fetch; timeoutMs?: number }): OrazakaClient {
  const doFetch = options.fetch ?? fetch;
  const base = options.baseUrl.replace(/\/$/, "");
  const installed = new Map<string, string | undefined>();

  async function call<T>(path: string, schema: z.ZodType<T>, init: { method?: string; body?: unknown } = {}): Promise<T> {
    if (!options.apiKey) throw refuse(503, "ORAZAKA_NOT_CONFIGURED", "AI_API_KEY is not set");
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        method: init.method ?? "GET",
        headers: { authorization: `Bearer ${options.apiKey}`, accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) },
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
        cache: "no-store",
      });
    } catch {
      throw refuse(502, "ORAZAKA_UNAVAILABLE", "Orazaka did not answer");
    }
    if (!res.ok) {
      const { status, code } = orazakaRefusal(res.status);
      if (res.status === 429) {
        const wait = Math.min(300, Math.max(1, Number(((await res.json().catch(() => null)) as { retryAfterSeconds?: unknown } | null)?.retryAfterSeconds) || 15));
        throw new HttpError(status, `Orazaka is busy on ${init.method ?? "GET"} ${path.split("?")[0]}`, { code, retryAfter: wait }, { "Retry-After": String(wait) });
      }
      throw refuse(status, code, `Orazaka answered ${res.status} on ${init.method ?? "GET"} ${path.split("?")[0]}`);
    }
    const parsed = schema.safeParse(await res.json().catch(() => undefined));
    if (!parsed.success) throw refuse(502, "ORAZAKA_SHAPE", `Orazaka's answer to ${path} has an unexpected shape`);
    return parsed.data;
  }

  /** The version this account's installation is pinned on (undefined: not told). Installs the Studio once when it is not. */
  async function ensureInstalled(studio: Studio): Promise<string | undefined> {
    if (installed.has(studio)) return installed.get(studio);
    const mine = await call("/api/v1/studios/installations", z.array(installation));
    const found = mine.find((i) => i.studioKey === studio) ?? (await call(`/api/v1/studios/${studio}/installations?locale=en`, installation, { method: "POST", body: { config: {} } }));
    installed.set(studio, found.pinnedVersion);
    return found.pinnedVersion;
  }

  return {
    async startRun(studio, inputs) {
      const pinned = await ensureInstalled(studio);
      // A kind declared to the Studio (visit notice, état des lieux) is read by compliance-check 2.x only; a 1.x installation would ignore it and judge the document as a lease.
      if (inputs.declaredKind && !kindIsRead(pinned)) throw refuse(422, "ORAZAKA_STUDIO_OLD", "This Studio's installation is on 1.x: it cannot read this kind of document yet");
      return call(`/api/v1/studios/${studio}/runs`, orazakaRun, { method: "POST", body: { inputs } });
    },
    async studios() {
      return (await call("/api/v1/studios/installations", z.array(installation))).map((i) => i.studioKey);
    },
    getRun(runId) {
      if (!/^[0-9a-f-]{36}$/i.test(runId)) throw refuse(400, "BAD_RUN", "Not a run id");
      return call(`/api/v1/studios/runs/${runId}`, orazakaRun);
    },
  };
}

const holder = globalThis as unknown as { __yomizakaOrazaka?: OrazakaClient };

export function orazaka(): OrazakaClient {
  if (holder.__yomizakaOrazaka) return holder.__yomizakaOrazaka;
  const env = readEnv();
  holder.__yomizakaOrazaka = createOrazakaClient({ baseUrl: env.AI_API_URL, apiKey: env.AI_API_KEY });
  return holder.__yomizakaOrazaka;
}

/** Tests: use this client (null: back to the configured one). */
export function useOrazakaClient(client: OrazakaClient | null) {
  holder.__yomizakaOrazaka = client ?? undefined;
}

/** The door for external checks (orazaka-ai-engine#105): the shared client with this product's service key, `AI_API_URL` / `AI_API_KEY`. */
export function checksDoor(): ChecksDoor {
  const env = readEnv();
  return engineDoor(createSharedClient({ baseUrl: env.AI_API_URL, apiKey: env.AI_API_KEY, clock: systemClock }), standingConsent);
}
