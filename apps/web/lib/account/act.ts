import { AccountError } from "@krizaka/auth";

import { requireSession } from "../access";
import { handle, refuse } from "../http";
import { limit } from "../limits";
import type { Session } from "../session";

/** One account action: signed in, rate-limited (reads far less tightly than writes), run, answered as JSON (never cached). An `AccountError` becomes the stable `{ code }` answer the page translates. */
export function accountAct(req: Request, scope: string, run: (session: Session) => Promise<Response | Record<string, unknown> | undefined>) {
  return handle(async () => {
    const session = await requireSession(req);
    // A read (the page's own configuration, loaded on every page) is far looser than a change of something.
    const reading = req.method === "GET";
    await limit(reading ? "accountRead" : "accountWrite", req, session.account.id, scope);
    try {
      const out = await run(session);
      if (out instanceof Response) return out;
      return Response.json(out ?? { ok: true }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      if (error instanceof AccountError) throw refuse(error.status, error.code, error.message);
      throw error;
    }
  });
}
