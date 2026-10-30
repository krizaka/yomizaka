import { z } from "zod";

import { readJson } from "@/lib/http";
import { workspaceAct } from "@/lib/workspace/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ kind: string }> };

/** The views of a list, in their order: the system's (the administration's), the account's shared ones, then the person's. */
export const GET = (req: Request, { params }: Params) =>
  workspaceAct(req, params, async ({ kind, account, actor, workspace }) => ({
    views: await workspace.views.list(account.id, actor, kind),
  }));

/** Saves a view: its filters are checked by the rules of the address (the same thing, refused instead of dropped). */
export const POST = (req: Request, { params }: Params) =>
  workspaceAct(
    req,
    params,
    async ({ kind, account, actor, workspace }) => ({
      view: await workspace.views.create(
        account.id,
        actor,
        kind,
        (await readJson(
          req,
          z.object({ name: z.string(), filters: z.unknown(), shared: z.boolean().optional() }),
        )) as never,
      ),
    }),
    { status: 201 },
  );
