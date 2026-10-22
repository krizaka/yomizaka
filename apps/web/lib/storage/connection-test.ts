import type { DocumentStore } from "./port";

export interface TestStep {
  name: "write" | "read" | "delete";
  ok: boolean;
  ms: number;
  error?: string;
}

/**
 * The connection test of a storage: writes a small probe object, reads it back and compares, then deletes it — the three
 * things a kept document needs. Never leaves the probe behind, never reports a secret. The clock is injected.
 */
export async function testConnection(store: DocumentStore, probeId: string, now: () => number): Promise<{ ok: boolean; steps: TestStep[] }> {
  const key = `connection-test/${probeId}.txt`;
  const payload = new TextEncoder().encode(`yomizaka connection test ${probeId}`);
  const steps: TestStep[] = [];
  const run = async (name: TestStep["name"], fn: () => Promise<void>) => {
    const start = now();
    try {
      await fn();
      steps.push({ name, ok: true, ms: now() - start });
    } catch (error) {
      steps.push({ name, ok: false, ms: now() - start, error: error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 160) : "failed" });
    }
  };
  await run("write", () => store.put(key, payload, { contentType: "text/plain" }));
  if (steps[0]!.ok) {
    await run("read", async () => {
      const got = await store.get(key);
      if (!got || Buffer.compare(Buffer.from(got.bytes), Buffer.from(payload)) !== 0) throw new Error("What was read is not what was written");
    });
    await run("delete", async () => {
      await store.delete(key);
      if (await store.get(key)) throw new Error("The probe is still there after the delete");
    });
  }
  return { ok: steps.length === 3 && steps.every((s) => s.ok), steps };
}
