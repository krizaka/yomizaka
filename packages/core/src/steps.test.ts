import { describe, expect, it } from "vitest";

import { CHECK_STEP, CHECK_STEP_IDS, checkSteps, STEP_STATE } from "./steps";

const state = (steps: ReturnType<typeof checkSteps>) => Object.fromEntries(steps.map((s) => [s.id, s.state]));

/** A check's progress, the same on the web and in the Mac, iOS and Android apps: Lecture, Contrôle préalable, Vérification, Rapport. */
describe("the steps of a check", () => {
  it("always has the four steps, in order, with stable ids the apps translate", () => {
    expect(CHECK_STEP_IDS).toEqual(["read", "preflight", "rules", "report"]);
    expect(checkSteps({ hasText: true, analysis: null }).map((s) => s.id)).toEqual([
      CHECK_STEP.read,
      CHECK_STEP.preflight,
      CHECK_STEP.rules,
      CHECK_STEP.report,
    ]);
  });

  it("before any check: the document is read and accepted, the rules and the report are upcoming", () => {
    expect(state(checkSteps({ hasText: true, analysis: null }))).toEqual({
      read: STEP_STATE.done,
      preflight: STEP_STATE.done,
      rules: STEP_STATE.upcoming,
      report: STEP_STATE.upcoming,
    });
  });

  it("while the run works: the rules are the current step, the report waits", () => {
    expect(state(checkSteps({ hasText: true, analysis: { studio: "compliance-check", status: "running" } }))).toEqual({
      read: "done",
      preflight: "done",
      rules: "current",
      report: "upcoming",
    });
  });

  it("when the run succeeded: every step is done", () => {
    expect(
      Object.values(
        state(checkSteps({ hasText: true, analysis: { studio: "compliance-check", status: "succeeded" } })),
      ),
    ).toEqual(["done", "done", "done", "done"]);
  });

  it("when the run failed: the rules step failed and the report was never made", () => {
    expect(state(checkSteps({ hasText: true, analysis: { studio: "compliance-check", status: "failed" } }))).toEqual({
      read: "done",
      preflight: "done",
      rules: "failed",
      report: "upcoming",
    });
    expect(
      state(checkSteps({ hasText: true, analysis: { studio: "compliance-check", status: "cancelled" } })).rules,
    ).toBe("failed");
  });

  it("a compliance check needs the text: a document without one fails at the reading, before anything else", () => {
    expect(state(checkSteps({ hasText: false, analysis: null, studio: "compliance-check" }))).toEqual({
      read: "failed",
      preflight: "upcoming",
      rules: "upcoming",
      report: "upcoming",
    });
  });

  it("the authenticity check reads the file, not the text: a document without text is fine", () => {
    expect(
      state(checkSteps({ hasText: false, analysis: { studio: "document-authenticity", status: "running" } })).read,
    ).toBe("done");
  });

  it("names the Studio on the rules step so a page can say « Vérification des règles » or « Examen du fichier »", () => {
    expect(
      checkSteps({ hasText: true, analysis: { studio: "document-authenticity", status: "running" } }).find(
        (s) => s.id === "rules",
      )?.studio,
    ).toBe("document-authenticity");
    expect(checkSteps({ hasText: true, analysis: null }).find((s) => s.id === "rules")?.studio).toBe(
      "compliance-check",
    );
  });
});
