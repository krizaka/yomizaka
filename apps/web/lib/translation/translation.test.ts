import type { ComplianceReport } from "@yomizaka/core";
import { describe, expect, it } from "vitest";

import { applyToAuthenticity, applyToCompliance } from "./apply";
import { fieldsOf, sourceVersionOf } from "./fields";
import type { TranslationOutcome, TranslationPort, TranslationRequest } from "./port";
import { protect, restore } from "./protect";
import { type StoredTranslation, translate, type TranslationDeps, type TranslationStore } from "./service";

const REPORT: ComplianceReport = {
  rulesetId: "qc-residential-lease",
  rulesetVersion: "2024-02-21",
  jurisdiction: "QC",
  asOf: "2026-10-17",
  reviewStatus: "TO_REVIEW_BY_LAWYER",
  reviewNote: "Règles du Québec à faire relire par un avocat.",
  findings: [
    {
      ruleId: "QC-LEASE-004",
      title: "Dépôt de garantie interdit",
      severity: "BLOCKING",
      verdict: "FAIL",
      citation: "C.c.Q., art. 1904, al. 1",
      explanation: "Le bail exige un dépôt de garantie de 1 450 $ le 1er juillet 2026. L'article 1904 C.c.Q. ne permet que le premier terme de loyer.",
      evidenceSpan: { quote: "dépôt de sécurité de 1 450 $" },
    },
    { ruleId: "QC-LEASE-003", title: "Montant du loyer", severity: "BLOCKING", verdict: "PASS", citation: "C.c.Q., art. 1855", explanation: "Le loyer est chiffré au bail." },
  ],
};

describe("what is never translated", () => {
  const text = "Le bail exige un dépôt de 1 450 $ (C.c.Q., art. 1904, al. 1) avant le 2026-07-01 et le 1er juillet 2026, soit 12 % de plus, comme « dépôt de sécurité » le dit. Règle QC-LEASE-004.";

  it("masks references, amounts, percentages, dates, quoted passages and rule ids; the rest is left to translate", () => {
    const { masked, spans } = protect(text);
    for (const kept of ["C.c.Q., art. 1904, al. 1", "1 450 $", "2026-07-01", "1er juillet 2026", "12 %", "« dépôt de sécurité »", "QC-LEASE-004"]) {
      expect(spans.some((s) => s.includes(kept)), kept).toBe(true);
      expect(masked, kept).not.toContain(kept);
    }
    expect(masked).toContain("Le bail exige un dépôt de");
    expect(restore(masked, spans)).toBe(text);
  });

  it("refuses a translation that lost, doubled or invented a protected span — the original stays", () => {
    const { masked, spans } = protect(text);
    expect(restore(masked.replace("⟦0⟧", ""), spans)).toBeNull();
    expect(restore(`${masked} ⟦0⟧`, spans)).toBeNull();
    expect(restore(`${masked} ⟦99⟧`, spans)).toBeNull();
    expect(restore("⟦", [])).toBeNull();
    expect(restore("a plain text", [])).toBe("a plain text");
  });

  it("sends the generated texts only: never the citation, the rule id as text, the verdict or the dates", () => {
    const fields = fieldsOf(REPORT);
    expect(fields.map((f) => f.key)).toEqual(["reviewNote", "title:QC-LEASE-004", "explanation:QC-LEASE-004", "quote:QC-LEASE-004", "title:QC-LEASE-003", "explanation:QC-LEASE-003"]);
    const sent = JSON.stringify(fields);
    expect(sent).not.toContain("art. 1855");
    expect(sent).not.toContain("BLOCKING");
    expect(sent).not.toContain("2024-02-21");
    expect(fields.every((f) => f.kind === "finding" && f.maxLength > f.text.length)).toBe(true);
  });

  it("the source text's version changes with one word", () => {
    const a = sourceVersionOf(fieldsOf(REPORT));
    const changed = { ...REPORT, findings: [{ ...REPORT.findings[0]!, explanation: `${REPORT.findings[0]!.explanation}!` }, REPORT.findings[1]!] };
    expect(sourceVersionOf(fieldsOf(changed))).not.toBe(a);
    expect(sourceVersionOf(fieldsOf(REPORT))).toBe(a);
  });
});

describe("applying a translation", () => {
  const texts = { "title:QC-LEASE-004": "Security deposit prohibited", "explanation:QC-LEASE-004": "The lease requires a deposit.", "quote:QC-LEASE-004": "security deposit of $1,450", reviewNote: "Québec rules to be reviewed by a lawyer." };

  it("replaces the title and the explanation, never the quote, the citation, the rule id, the verdict or the dates; the quote's translation travels beside it", () => {
    const out = applyToCompliance(REPORT, texts);
    const [first, second] = out.findings;
    expect(first).toMatchObject({ title: "Security deposit prohibited", explanation: "The lease requires a deposit.", quoteAid: "security deposit of $1,450" });
    expect(first!.evidenceSpan!.quote).toBe("dépôt de sécurité de 1 450 $");
    expect(first!.citation).toBe("C.c.Q., art. 1904, al. 1");
    expect([first!.ruleId, first!.verdict, first!.severity]).toEqual(["QC-LEASE-004", "FAIL", "BLOCKING"]);
    expect(out.asOf).toBe("2026-10-17");
    expect(out.reviewNote).toBe("Québec rules to be reviewed by a lawyer.");
    // a finding with no translation keeps what Orazaka wrote, and has no aid
    expect(second).toMatchObject({ title: "Montant du loyer", explanation: "Le loyer est chiffré au bail." });
    expect("quoteAid" in second!).toBe(false);
  });

  it("an authenticity report keeps its levels and its places' kinds; its observations are translated", () => {
    const report = { signals: [{ signalId: "S1", level: "inhabituel", observation: "Deux polices.", mayIndicate: "Une retouche.", where: "page 1" }], pages: 1 };
    const out = applyToAuthenticity(report, { "observation:S1": "Two fonts.", "mayIndicate:S1": "An edit." });
    expect(out.signals[0]).toMatchObject({ level: "inhabituel", observation: "Two fonts.", mayIndicate: "An edit.", where: "page 1" });
  });
});

/** A port that records what it was given and answers by its script. */
function fakePort(script: (request: TranslationRequest) => Record<string, string>) {
  const calls = { start: [] as TranslationRequest[], read: 0 };
  let phase: "running" | "done" | "failed" = "running";
  const port: TranslationPort = {
    async start(request) {
      calls.start.push(request);
      return { runId: `run-${calls.start.length}` };
    },
    async read(runId): Promise<TranslationOutcome> {
      calls.read++;
      if (phase === "running") return { state: "running", runId };
      if (phase === "failed") return { state: "failed", runId, reason: "boom" };
      return { state: "done", runId, studioVersion: "1.0.0", texts: script(calls.start.at(-1)!) };
    },
  };
  return { port, calls, finish: (to: "done" | "failed") => void (phase = to) };
}

function memoryStore(): TranslationStore & { rows: StoredTranslation[] } {
  const rows: StoredTranslation[] = [];
  return {
    rows,
    async find(_a, _l, sourceVersion, glossaryVersion) {
      return [...rows].reverse().find((r) => r.sourceVersion === sourceVersion && r.glossaryVersion === glossaryVersion) ?? null;
    },
    async save(_a, _l, stored) {
      rows.push(stored);
    },
    async update(_a, _l, runId, patch) {
      const row = rows.find((r) => r.runId === runId)!;
      Object.assign(row, patch);
    },
  };
}

const analysis = { id: "an1", report: REPORT };
const depsOf = (port: TranslationPort, store: TranslationStore, extra: Partial<TranslationDeps> = {}) => {
  const ledger = { spent: 0, refunded: 0, version: 1 };
  const deps: TranslationDeps = {
    port,
    store,
    glossary: async () => ({ version: ledger.version, terms: [{ source: "bail", target: "lease" }] }),
    credits: 0,
    spend: async (n) => void (ledger.spent += n),
    refund: async (n) => void (ledger.refunded += n),
    ...extra,
  };
  return { deps, ledger };
};
/** What a good Studio does: translates the words around the tokens and keeps the tokens. */
const translateWords = (request: TranslationRequest) => Object.fromEntries(request.fields.map((f) => [f.key, `EN ${f.text}`]));

describe("translating a report through the port (mocked until the Studio ships)", () => {
  it("starts once, answers `running` until the run is back, restores the protected spans, and never starts again", async () => {
    const fake = fakePort(translateWords);
    const store = memoryStore();
    const { deps } = depsOf(fake.port, store);
    const first = await translate(analysis, "en", deps);
    expect(first.status).toBe("running");
    expect(fake.calls.start).toHaveLength(1);
    const request = fake.calls.start[0]!;
    // what left: the texts masked, the glossary, the languages — never a citation, never the quoted passage's words in an explanation
    expect(request).toMatchObject({ source: "fr", target: "en", glossary: [{ source: "bail", target: "lease" }] });
    const sent = JSON.stringify(request.fields);
    expect(sent).not.toContain("art. 1904");
    expect(sent).not.toContain("1 450 $");
    expect(sent).not.toContain("1er juillet 2026");
    expect(sent).toContain("⟦0⟧");

    expect((await translate(analysis, "en", deps)).status).toBe("running");
    expect(fake.calls.start).toHaveLength(1);

    fake.finish("done");
    const done = await translate(analysis, "en", deps);
    expect(done.status).toBe("done");
    expect(done.texts!["explanation:QC-LEASE-004"]).toBe("EN Le bail exige un dépôt de garantie de 1 450 $ le 1er juillet 2026. L'article 1904 C.c.Q. ne permet que le premier terme de loyer.");
    expect(done.trace).toMatchObject({ original: "fr", language: "en", runId: "run-1", studioVersion: "1.0.0", glossaryVersion: 1 });
    expect(done.trace!.sourceVersion).toBe(sourceVersionOf(fieldsOf(REPORT)));

    // cached: asking again calls neither start nor read
    const reads = fake.calls.read;
    expect((await translate(analysis, "en", deps)).status).toBe("done");
    expect(fake.calls.start).toHaveLength(1);
    expect(fake.calls.read).toBe(reads);
  });

  it("drops a text whose protected spans did not come back, and keeps the others", async () => {
    const fake = fakePort((request) => Object.fromEntries(request.fields.map((f) => [f.key, f.key === "explanation:QC-LEASE-004" ? "The lease asks for a deposit." : `EN ${f.text}`])));
    const { deps } = depsOf(fake.port, memoryStore());
    await translate(analysis, "en", deps);
    fake.finish("done");
    const done = await translate(analysis, "en", deps);
    expect(done.status).toBe("done");
    expect(done.texts).not.toHaveProperty("explanation:QC-LEASE-004");
    expect(done.texts).toHaveProperty("title:QC-LEASE-004");
    expect(done.accepted!.texts).toBeLessThan(done.accepted!.of);
  });

  it("the original language needs no run; a report with nothing to translate needs none either", async () => {
    const fake = fakePort(translateWords);
    const { deps } = depsOf(fake.port, memoryStore());
    expect((await translate(analysis, "fr", deps)).status).toBe("original");
    expect((await translate({ id: "x", report: { ...REPORT, reviewNote: undefined, findings: [] } }, "en", deps)).status).toBe("done");
    expect(fake.calls.start).toHaveLength(0);
  });

  it("a failed run gives the credits back and is tried again on the next ask", async () => {
    const fake = fakePort(translateWords);
    const { deps, ledger } = depsOf(fake.port, memoryStore(), { credits: 2 });
    await translate(analysis, "en", deps);
    expect(ledger.spent).toBe(2);
    fake.finish("failed");
    const failed = await translate(analysis, "en", deps);
    expect(failed).toMatchObject({ status: "failed", error: "boom" });
    expect(ledger.refunded).toBe(2);
    fake.finish("done");
    await translate(analysis, "en", deps);
    expect(fake.calls.start).toHaveLength(2);
  });

  it("a new glossary version, or a changed source text, is a new translation", async () => {
    const fake = fakePort(translateWords);
    const store = memoryStore();
    const { deps, ledger } = depsOf(fake.port, store);
    await translate(analysis, "en", deps);
    ledger.version = 2;
    await translate(analysis, "en", deps);
    expect(fake.calls.start).toHaveLength(2);
    await translate({ id: "an1", report: { ...REPORT, reviewNote: "Autre note." } }, "en", deps);
    expect(fake.calls.start).toHaveLength(3);
  });

  it("an error starting the run gives the credits back", async () => {
    const { deps, ledger } = depsOf({ start: async () => Promise.reject(new Error("down")), read: async () => ({ state: "running", runId: "x" }) }, memoryStore(), { credits: 1 });
    await expect(translate(analysis, "en", deps)).rejects.toThrow("down");
    expect([ledger.spent, ledger.refunded]).toEqual([1, 1]);
  });
});
