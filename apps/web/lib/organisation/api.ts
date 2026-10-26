import { requireSession } from "../access";
import { audit } from "../audit";
import { query } from "../db";
import { handle } from "../http";
import { limit } from "../limits";
import type { Query } from "./store";

export type Params = { params: Promise<{ id: string }> };

/** One organisation action: signed in, rate-limited, run against the store, answered as JSON (never cached). */
export function act(req: Request, run: (ctx: { owner: string; q: Query; note: (action: string, detail?: Record<string, unknown>) => Promise<void> }) => Promise<unknown>, status = 200) {
  return handle(async () => {
    const session = await requireSession(req);
    await limit("organise", req, session.account.id);
    const note = (action: string, detail: Record<string, unknown> = {}) => audit({ action, actorId: session.account.id, actorLabel: session.account.email, detail, headers: req.headers });
    const body = await run({ owner: session.account.id, q: query, note });
    return Response.json(body ?? { ok: true }, { status, headers: { "Cache-Control": "private, no-store" } });
  });
}
