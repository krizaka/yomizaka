import { setBatchObserver } from "../batch/observer";
import { withAdvisoryLock } from "../db";
import { featureOn, settingsFor } from "../settings/guards";
import { appSettings } from "../settings/instance";
import { eventsOfFinishedBatch } from "./events";
import { webhooksFor } from "./index";
import { safeSend } from "./send";

/** What the server wires at start (instrumentation): a closed batch queues its events for the owner's endpoints; a tick sends what is due. */
export function registerBatchWebhooks(serverSecret: string): void {
  setBatchObserver({
    async finished(ownerId, batch, now) {
      if (!(await featureOn("webhooks", ownerId))) return;
      const hooks = webhooksFor(
        serverSecret,
        (await settingsFor(ownerId))["limits.webhookMaxAttempts"].value as number,
      );
      for (const event of eventsOfFinishedBatch(batch)) await hooks.emit(ownerId, event, now);
    },
  });
}

// @fixed: the advisory-lock key of the delivery loop (the batch tick uses 73192, migrate 73191) — a technical identifier
const DELIVERY_LOCK = 73193;

/** Sends what is due, one instance at a time. */
export async function deliverWebhooks(
  serverSecret: string,
  now: Date,
  options: { timeoutMs: number; send?: ReturnType<typeof safeSend> },
) {
  return withAdvisoryLock(DELIVERY_LOCK, async () => {
    const hooks = webhooksFor(serverSecret, (await appSettings().get("limits.webhookMaxAttempts")) as number);
    return hooks.deliverDue(now, options.send ?? safeSend({ timeoutMs: options.timeoutMs }), { limit: 50 });
  });
}
