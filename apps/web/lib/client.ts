/** What the browser side needs to talk to the BFF: the stable error code of a refusal (the console translates it). */
export function errorKey(error: unknown): string {
  const e = error as { code?: unknown; status?: unknown; body?: { code?: unknown } } | null;
  for (const code of [e?.code, e?.body?.code]) if (typeof code === "string" && /^[A-Z_]+$/.test(code)) return code;
  if (e?.status === 0 || error instanceof TypeError) return "NETWORK";
  return "UNKNOWN";
}
