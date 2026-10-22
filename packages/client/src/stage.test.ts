import { describe, expect, it } from "vitest";

import { STAGE, stageOf, stepOf } from "./stage";

describe("the stage of a check", () => {
  it.each([
    [{ uploading: true, analysis: null }, STAGE.sending],
    [{ uploading: false, analysis: null }, STAGE.sending],
    [{ uploading: false, analysis: { status: "running" } }, STAGE.checking],
    [{ uploading: false, analysis: { status: "succeeded" } }, STAGE.done],
    [{ uploading: false, analysis: { status: "failed" } }, STAGE.failed],
    [{ uploading: false, analysis: { status: "cancelled" } }, STAGE.failed],
  ] as const)("reads %j as %s", (state, stage) => {
    expect(stageOf(state)).toBe(stage);
  });

  it("numbers the steps from one, a failure on the last", () => {
    expect([STAGE.sending, STAGE.checking, STAGE.done, STAGE.failed].map(stepOf)).toEqual([1, 2, 3, 3]);
  });
});
