import type { Analysis } from "@yomizaka/core";

/** Where a check is, as the person sees it: the file is going up, the engine is reading, then the answer. */
export const STAGE = { sending: "sending", checking: "checking", done: "done", failed: "failed" } as const;
export type Stage = (typeof STAGE)[keyof typeof STAGE];

export const STAGES_IN_ORDER = [STAGE.sending, STAGE.checking, STAGE.done] as const;

export function stageOf(state: { uploading: boolean; analysis: Pick<Analysis, "status"> | null }): Stage {
  if (state.uploading) return STAGE.sending;
  if (!state.analysis) return STAGE.sending;
  if (state.analysis.status === "running") return STAGE.checking;
  return state.analysis.status === "succeeded" ? STAGE.done : STAGE.failed;
}

/** One-based step of the three, for the progress header; a failure stays on the step where it stopped. */
export function stepOf(stage: Stage): number {
  return stage === STAGE.failed ? STAGES_IN_ORDER.length : STAGES_IN_ORDER.indexOf(stage) + 1;
}
