import { MARKERS } from "@krizaka/organize/contract";
import { z } from "zod";

import { readJson } from "@/lib/http";
import { workspaceAct } from "@/lib/workspace/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ kind: string; id: string }> };

export const PATCH = (req: Request, { params }: Params) =>
  workspaceAct(req, params, async ({ kind, account, actor, workspace }) => ({
    tag: await workspace.tags.update(
      account.id,
      actor,
      kind,
      (await params).id,
      await readJson(req, z.object({ name: z.string().optional(), marker: z.enum(MARKERS).optional() })),
    ),
  }));

export const DELETE = (req: Request, { params }: Params) =>
  workspaceAct(req, params, async ({ kind, account, actor, workspace }) => {
    await workspace.tags.remove(account.id, actor, kind, (await params).id);
  });
