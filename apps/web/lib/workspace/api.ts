import { type Actor, type Workspace } from "@krizaka/organize";

import { storesOf } from "@/app/active-store";
import { systemClock } from "@/app/system-clock";

import { requireSession } from "../access";
import { handle, refuse } from "../http";
import { limit } from "../limits";
import { guard } from "../organisation/organize";
import type { Session } from "../session";
import { isKind, type Kind } from "./decl";
import { actorOf, workspaceFor } from "./service";

/**
 * One workspace action over HTTP, for every route of `/api/organize/[kind]/…`: signed in, rate-limited, the kind known (any other
 * is 404), the layer's refusals answered with their stable codes (the console translates them), the answer never cached. A route
 * file is only the shape of its body and one call to the service: the gate (roles, limits, scope) is the layer's, so no route skips it.
 */
export interface WorkspaceContext {
  kind: Kind;
  account: Session["account"];
  actor: Actor;
  workspace: Workspace;
}

export function workspaceAct(req: Request, params: Promise<{ kind: string }>, run: (ctx: WorkspaceContext) => Promise<unknown>, options: { status?: number; purges?: boolean } = {}): Promise<Response> {
  return handle(async () => {
    const session = await requireSession(req);
    await limit("organise", req, session.account.id);
    const { kind } = await params;
    if (!isKind(kind)) throw refuse(404, "NOT_FOUND", "No such kind");
    // The kept files' store is needed only by a call that can decide (a decision purges the files it closes).
    const store = options.purges ? (await storesOf(session.account.id)).write : undefined;
    const workspace = workspaceFor({ clock: systemClock, store, headers: req.headers });
    const body = await guard(() => run({ kind, account: session.account, actor: actorOf(session.account), workspace }));
    return Response.json(body ?? { ok: true }, { status: options.status ?? 200, headers: { "Cache-Control": "private, no-store" } });
  });
}
