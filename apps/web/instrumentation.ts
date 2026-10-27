/**
 * At server start (Node only): the work is in `instrumentation-node.ts`, imported only when the runtime is Node, so the Edge
 * build never traces it (the Node-only modules it reaches, a storage folder among them, have no place there).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    await registerNode();
  }
}
