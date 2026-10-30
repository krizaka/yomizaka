import { describe, expect, it } from "vitest";

import { revenuQuebecQstAdapter } from "./revenu-quebec-qst";

/*
 * Contract of SW-340 as documented (guide 2019-05) and observed (MessagesInformatifs). Fake answers only: no live call, no real number.
 */
const now = () => new Date("2026-10-30T10:00:00Z");
const NUMBER = "0000000000TQ0001";
type Scripted = { status?: number; body?: unknown; text?: string } | "down";

function fake(answers: Scripted[]) {
  const urls: string[] = [];
  const fetch = (async (url: string) => {
    urls.push(url);
    const next = answers.shift();
    if (!next || next === "down") {
      throw new TypeError("connection refused");
    }
    return new Response(next.text ?? JSON.stringify(next.body), { status: next.status ?? 200 });
  }) as unknown as typeof globalThis.fetch;
  return { urls, fetch };
}

const ok = (status: string, extra: Record<string, unknown> = {}) => ({
  body: {
    RetourWebApi: {
      Resultat: {
        StatutSousDossierUsager: status,
        DescriptionStatut: "x",
        DateStatut: "2020-03-01",
        NomEntreprise: "Atelier Exemple",
        RaisonSociale: "9999-9999 Québec inc.",
        ...extra,
      },
      OperationReussie: true,
      MessagesFonctionnels: [],
      MessagesInformatifs: [{ CodeMessage: "I1", DescriptionMessage: "info" }],
    },
  },
});

describe("revenuQuebecQstAdapter", () => {
  it("reads a registered number from the documented URL", async () => {
    const f = fake([ok("R")]);
    const answer = await revenuQuebecQstAdapter({ fetch: f.fetch, now }).lookupQst("0000 000 000 tq 0001");
    expect(f.urls).toEqual([`https://svcnab2b.revenuquebec.ca/2019/02/ValidationTVQ/${NUMBER}`]);
    expect(answer).toEqual({
      kind: "found",
      status: "registered",
      statusDate: "2020-03-01",
      legalName: "9999-9999 Québec inc.",
      tradeName: "Atelier Exemple",
    });
  });

  it("reads a revoked number (A) as struck", async () => {
    const answer = await revenuQuebecQstAdapter({ fetch: fake([ok("A")]).fetch, now }).lookupQst(NUMBER);
    expect(answer).toMatchObject({ kind: "found", status: "struck" });
  });

  it("reads the unwrapped envelope too", async () => {
    const wrapped = ok("R").body.RetourWebApi;
    const answer = await revenuQuebecQstAdapter({ fetch: fake([{ body: wrapped }]).fetch, now }).lookupQst(NUMBER);
    expect(answer).toMatchObject({ kind: "found", status: "registered" });
  });

  it("answers unknown on 404 GX.AucuneDonneeTrouvee", async () => {
    const body = {
      RetourWebApi: {
        Resultat: null,
        OperationReussie: false,
        MessagesFonctionnels: [{ CodeMessage: "GX.AucuneDonneeTrouvee", DescriptionMessage: "x" }],
      },
    };
    expect(await revenuQuebecQstAdapter({ fetch: fake([{ status: 404, body }]).fetch, now }).lookupQst(NUMBER)).toEqual(
      { kind: "unknown" },
    );
  });

  it("checks the format before any call", async () => {
    const f = fake([ok("R")]);
    const answer = await revenuQuebecQstAdapter({ fetch: f.fetch, now }).lookupQst("12345");
    expect(answer).toEqual({ kind: "not-looked-up", reason: "bad-format" });
    expect(f.urls).toHaveLength(0);
  });

  it("retries once on a 5xx, then says not looked up", async () => {
    const recovered = fake([{ status: 503, text: "" }, ok("R")]);
    expect(await revenuQuebecQstAdapter({ fetch: recovered.fetch, now }).lookupQst(NUMBER)).toMatchObject({
      kind: "found",
    });
    expect(recovered.urls).toHaveLength(2);
    const down = fake([{ status: 500, text: "" }, { status: 503, text: "" }, ok("R")]);
    expect(await revenuQuebecQstAdapter({ fetch: down.fetch, now }).lookupQst(NUMBER)).toEqual({
      kind: "not-looked-up",
      reason: "unavailable",
    });
    expect(down.urls).toHaveLength(2);
  });

  it("says not looked up on a network failure, a bad 400 or an unreadable body", async () => {
    expect(await revenuQuebecQstAdapter({ fetch: fake(["down", "down"]).fetch, now }).lookupQst(NUMBER)).toMatchObject({
      kind: "not-looked-up",
    });
    expect(
      await revenuQuebecQstAdapter({
        fetch: fake([
          {
            status: 400,
            body: { RetourWebApi: { MessagesFonctionnels: [{ CodeMessage: "GX.IdentifiantEntreeInvalide" }] } },
          },
        ]).fetch,
        now,
      }).lookupQst(NUMBER),
    ).toMatchObject({ kind: "not-looked-up" });
    expect(
      await revenuQuebecQstAdapter({ fetch: fake([{ text: "<html>" }]).fetch, now }).lookupQst(NUMBER),
    ).toMatchObject({ kind: "not-looked-up" });
  });

  it("caches a definitive answer for the window, and only that", async () => {
    let t = new Date("2026-10-30T10:00:00Z").getTime();
    const f = fake([ok("R"), ok("R"), { status: 503, text: "" }]);
    const registry = revenuQuebecQstAdapter({ fetch: f.fetch, now: () => new Date(t), cacheHours: 1 });
    await registry.lookupQst(NUMBER);
    await registry.lookupQst(NUMBER);
    expect(f.urls).toHaveLength(1);
    t += 2 * 3_600_000;
    await registry.lookupQst(NUMBER);
    expect(f.urls).toHaveLength(2);
  });
});
