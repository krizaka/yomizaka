import { z } from "zod";

import { readJson } from "@/lib/http";
import { workspaceAct } from "@/lib/workspace/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ kind: string }> };

const body = z.object({
  ids: z.array(z.string()).min(1).max(1000),
  add: z.array(z.string()).max(200).optional(),
  remove: z.array(z.string()).max(200).optional(),
});

/** Tags and untags many files or documents at once: one transaction, one audit line per entity that changed. At most 200 ids; an id of another account is 404 and nothing changes. */
export const POST = (req: Request, { params }: Params) =>
  workspaceAct(req, params, async ({ kind, account, actor, workspace }) => ({
    changed: await workspace.tags.apply(account.id, actor, kind, await readJson(req, body)),
  }));
