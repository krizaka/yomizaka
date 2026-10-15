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
}
