import { z } from "zod";

import { readJson } from "@/lib/http";
import { workspaceAct } from "@/lib/workspace/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ kind: string; id: string }> };

/** Only the author renames, changes or shares a view. */
export const PATCH = (req: Request, { params }: Params) =>
  workspaceAct(req, params, async ({ account, actor, workspace }) => ({ view: await workspace.views.update(account.id, actor, (await params).id, (await readJson(req, z.object({ name: z.string().optional(), filters: z.unknown().optional(), shared: z.boolean().optional() }))) as never) }));

export const DELETE = (req: Request, { params }: Params) =>
  workspaceAct(req, params, async ({ account, actor, workspace }) => {
    await workspace.views.remove(account.id, actor, (await params).id);
  });
