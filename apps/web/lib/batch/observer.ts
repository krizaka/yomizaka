import { logError } from "../log";
import type { BatchView } from "./run";

/**
 * Who is told when a batch closes (yomizaka#241). The runner does not know about webhooks: the server registers an observer at
 * start (instrumentation), a test registers its own. Shared through `globalThis` — pages and routes are bundled apart. A failing
 * observer is logged and never breaks the batch.
 */
export interface BatchObserver {
  finished(ownerId: string, batch: BatchView, now: Date): Promise<void>;
}

const holder = globalThis as unknown as { __yomizakaBatchObserver?: BatchObserver };

export const setBatchObserver = (observer: BatchObserver | null) => {
  holder.__yomizakaBatchObserver = observer ?? undefined;
};

export async function notifyFinished(ownerId: string, batch: BatchView, now: Date): Promise<void> {
  try {
    await holder.__yomizakaBatchObserver?.finished(ownerId, batch, now);
  } catch (error) {
    logError(`[yomizaka] batch ${batch.id}: the finished observer failed`, error);
  }
}
