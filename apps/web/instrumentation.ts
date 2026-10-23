/**
 * At server start: refuse to run without the production secrets, then apply the database migrations (one advisory lock,
 * so a second instance waits instead of racing).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertProductionEnv, readEnv } = await import("./lib/env");
  assertProductionEnv();
  if (!readEnv().DATABASE_URL) {
    console.warn("[yomizaka] DATABASE_URL is not set: the public pages work, the library does not.");
    return;
  }
  const { migrate } = await import("./lib/db");
  const applied = await migrate();
  if (applied.length) console.log(`[yomizaka] migrations applied: ${applied.join(", ")}`);
  const { seedDatabase } = await import("./lib/flows");
  const seeded = await seedDatabase();
  if (seeded.length) console.log(`[yomizaka] flows seeded: ${seeded.join(", ")}`);
  const e = readEnv();
  const { appSettings } = await import("./lib/settings/instance");
  const { seedLegacySettings } = await import("./lib/settings/seed");
  const legacy = await seedLegacySettings(appSettings(), { signupOpen: e.AUTH_SIGNUP_ENABLED, purgeAfterHours: e.APP_PURGE_AFTER_HOURS, proAuditsPerMonth: e.APP_FAIR_USE_AUDITS_PER_MONTH }, new Date());
  if (legacy.length) console.log(`[yomizaka] settings seeded from the environment: ${legacy.join(", ")}`);
  // A batch advances without anyone looking at it (yomizaka#240): the interval is a setting, re-read at every look.
  const { sessionSecret } = await import("./lib/env");
  const { registerBatchWebhooks, deliverWebhooks } = await import("./lib/webhooks/emit");
  registerBatchWebhooks(sessionSecret());
  const { startScheduler } = await import("./lib/batch/scheduler");
  const { tickBatches } = await import("./lib/batch/tick");
  const { appEnvironment } = await import("./lib/env");
  startScheduler({
    seconds: async () => (await appSettings().get("limits.batchTickSeconds")) as number,
    run: async () => {
      const report = await tickBatches(new Date(), appEnvironment(), (message, error) => console.error(`[yomizaka] ${message}`, error));
      if (report.advanced || report.failed) console.log(`[yomizaka] batch tick: ${report.advanced} advanced, ${report.failed} failed`);
      // The webhooks queued by closed batches ride the same tick (yomizaka#241).
      const sent = await deliverWebhooks(sessionSecret(), new Date(), { timeoutMs: 8000 });
      if (sent && (sent.delivered || sent.retried || sent.failed)) console.log(`[yomizaka] webhooks: ${sent.delivered} delivered, ${sent.retried} to retry, ${sent.failed} given up`);
    },
    onError: (error) => console.error("[yomizaka] batch tick", error),
  });
}
