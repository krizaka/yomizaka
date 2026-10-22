import { requireSession } from "../access";
import { handle, refuse } from "../http";
import { limit } from "../rate-limit";
import type { Session } from "../session";
import { AccountError } from "./port";

/** One account action: signed in, rate-limited, run, answered as JSON (never cached). An `AccountError` becomes the stable `{ code }` answer the page translates. */
export function accountAct(req: Request, scope: string, run: (session: Session) => Promise<Response | Record<string, unknown> | undefined>) {
  return handle(async () => {
    const session = await requireSession(req);
    limit(scope, req, session.account.id, [30, 3600], [15, 3600]);
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
