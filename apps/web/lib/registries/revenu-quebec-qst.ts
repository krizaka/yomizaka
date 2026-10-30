import { addMilliseconds, isBefore } from "date-fns";
import { z } from "zod";

import { ANSWER, type BusinessRegistry, NOT_LOOKED_UP, type RegistryAnswer } from "./model";
import { normaliseQstNumber } from "./qst-number";

/*
 * Revenu Québec's B2B API SW-340 (guide 2019-05): a public HTTPS GET, JSON, no enrolment and no key, to validate a QST number. The terms
 * allow it (« connecter vos outils à cet API »). Used sparingly: one call per number printed, a short cache, no bulk, one retry.
 */
export const QST_ENDPOINT = "https://svcnab2b.revenuquebec.ca/2019/02/ValidationTVQ/";

// @fixed: the API answers in well under a second; a slow register must not hold a report
const TIMEOUT_MS = 5000;
// @fixed: a status changes rarely and a number is looked up once per document: hours, not days
const CACHE_MS = 6 * 3_600_000;

const message = z.object({ CodeMessage: z.string().optional(), DescriptionMessage: z.string().optional() });
const envelope = z.object({
  Resultat: z
    .object({
      StatutSousDossierUsager: z.string().optional(),
      DescriptionStatut: z.string().optional(),
      DateStatut: z.string().nullish(),
      NomEntreprise: z.string().nullish(),
      RaisonSociale: z.string().nullish(),
    })
    .nullish(),
  OperationReussie: z.boolean().optional(),
  MessagesFonctionnels: z.array(message).nullish(),
  /** Absent from the 2019 guide, present in the live answers. */
  MessagesInformatifs: z.array(message).nullish(),
});
const wrapped = z.union([z.object({ RetourWebApi: envelope }).transform((w) => w.RetourWebApi), envelope]);

const NO_DATA = "GX.AucuneDonneeTrouvee";
const lookedUpNot = (reason: (typeof NOT_LOOKED_UP)[keyof typeof NOT_LOOKED_UP]): RegistryAnswer => ({ kind: ANSWER.notLookedUp, reason });

export interface QstAdapterOptions {
  fetch?: typeof globalThis.fetch;
  /** The injected clock. */
  now: () => Date;
  timeoutMs?: number;
  cacheMs?: number;
}

/** The adapter. 200 "R" → registered, "A" → struck; 404 no data → unknown; 5xx, timeout, anything unreadable → not looked up (never a signal). */
export function revenuQuebecQstAdapter(options: QstAdapterOptions): BusinessRegistry {
  const doFetch = options.fetch ?? globalThis.fetch;
  const now = options.now;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const cacheMs = options.cacheMs ?? CACHE_MS;
  const cache = new Map<string, { expiresAt: Date; answer: RegistryAnswer }>();

  async function call(number: string): Promise<Response | null> {
    try {
      return await doFetch(QST_ENDPOINT + number, { method: "GET", headers: { accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      return null;
    }
  }

  async function read(res: Response): Promise<RegistryAnswer> {
    const parsed = wrapped.safeParse(await res.json().catch(() => null));
    if (!parsed.success) {
      return lookedUpNot(NOT_LOOKED_UP.unavailable);
    }
    const body = parsed.data;
    const codes = (body.MessagesFonctionnels ?? []).map((m) => m.CodeMessage);
    if (res.status === 404 || codes.includes(NO_DATA)) return { kind: ANSWER.unknown };
    const r = body.Resultat;
    if (!res.ok || !r) {
      return lookedUpNot(NOT_LOOKED_UP.unavailable);
    }
    if (r.StatutSousDossierUsager !== "R" && r.StatutSousDossierUsager !== "A") {
      return lookedUpNot(NOT_LOOKED_UP.unavailable);
    }
    return { kind: ANSWER.found, status: r.StatutSousDossierUsager === "R" ? "registered" : "struck", statusDate: r.DateStatut ?? null, legalName: r.RaisonSociale ?? null, tradeName: r.NomEntreprise ?? null };
  }

  return {
    source: "Revenu Québec",
    async lookupQst(printed) {
      const number = normaliseQstNumber(printed);
      if (!number) {
        return lookedUpNot(NOT_LOOKED_UP.badFormat);
      }
      const hit = cache.get(number);
      if (hit && isBefore(now(), hit.expiresAt)) {
        return hit.answer;
      }
      let res = await call(number);
      if (!res || res.status >= 500) {
        res = await call(number);
      }
      if (!res || res.status >= 500) {
        return lookedUpNot(NOT_LOOKED_UP.unavailable);
      }
      const answer = await read(res);
      if (answer.kind !== ANSWER.notLookedUp) {
        cache.set(number, { expiresAt: addMilliseconds(now(), cacheMs), answer });
      }
      return answer;
    },
  };
}
