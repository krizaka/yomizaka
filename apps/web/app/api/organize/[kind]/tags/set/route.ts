import { z } from "zod";

import { readJson } from "@/lib/http";
import { workspaceAct } from "@/lib/workspace/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ kind: string }> };

/** One file's or document's tags become exactly these. */
export const PUT = (req: Request, { params }: Params) =>
  workspaceAct(req, params, async ({ kind, account, actor, workspace }) => {
    const input = await readJson(req, z.object({ id: z.string(), tagIds: z.array(z.string()).max(200) }));
    return { changed: await workspace.tags.set(account.id, actor, kind, input.id, input.tagIds) };
  });
