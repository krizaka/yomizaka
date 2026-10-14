import { type OrazakaRun, orazakaRun, type Studio } from "@yomizaka/core";
import { z } from "zod";

import { readEnv } from "./env";
import { refuse } from "./http";

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
}

const installation = z.object({ studioKey: z.string() });

/** What a refusal of Orazaka's means for Yomizaka — a stable code the UI translates. */
export function orazakaRefusal(status: number): { status: number; code: string } {
  if (status === 401 || status === 403) return { status: 502, code: "ORAZAKA_KEY" };
  if (status === 402) return { status: 502, code: "ORAZAKA_CREDITS" };
  if (status === 409) return { status: 502, code: "ORAZAKA_LOCKED" };
  if (status === 400 || status === 422) return { status: 422, code: "ORAZAKA_INPUT" };
  if (status === 404) return { status: 502, code: "ORAZAKA_NOT_FOUND" };
  return { status: 502, code: "ORAZAKA_UNAVAILABLE" };
}

export function createOrazakaClient(options: { baseUrl: string; apiKey: string | undefined; fetch?: Fetch; timeoutMs?: number }): OrazakaClient {
  const doFetch = options.fetch ?? fetch;
  const base = options.baseUrl.replace(/\/$/, "");
  const installed = new Set<string>();

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
      throw refuse(status, code, `Orazaka answered ${res.status} on ${init.method ?? "GET"} ${path.split("?")[0]}`);
    }
    const parsed = schema.safeParse(await res.json().catch(() => undefined));
    if (!parsed.success) throw refuse(502, "ORAZAKA_SHAPE", `Orazaka's answer to ${path} has an unexpected shape`);
    return parsed.data;
  }

  async function ensureInstalled(studio: Studio) {
    if (installed.has(studio)) return;
    const mine = await call("/api/v1/studios/installations", z.array(installation));
    if (!mine.some((i) => i.studioKey === studio)) {
      await call(`/api/v1/studios/${studio}/installations?locale=en`, installation, { method: "POST", body: { config: {} } });
    }
    installed.add(studio);
  }

  return {
    async startRun(studio, inputs) {
      await ensureInstalled(studio);
      return call(`/api/v1/studios/${studio}/runs`, orazakaRun, { method: "POST", body: { inputs } });
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
