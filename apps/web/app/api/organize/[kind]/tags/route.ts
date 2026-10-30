import { MARKERS } from "@krizaka/organize/contract";
import { z } from "zod";

import { readJson } from "@/lib/http";
import { workspaceAct } from "@/lib/workspace/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ kind: string }> };

export const GET = (req: Request, { params }: Params) =>
  workspaceAct(req, params, async ({ kind, account, workspace }) => ({
    tags: await workspace.tags.list(account.id, kind),
  }));

/** Creates a tag with a name and a marker of the closed palette. */
export const POST = (req: Request, { params }: Params) =>
  workspaceAct(
    req,
    params,
    async ({ kind, account, actor, workspace }) => ({
      tag: await workspace.tags.create(
        account.id,
        actor,
        kind,
        await readJson(req, z.object({ name: z.string(), marker: z.enum(MARKERS) })),
      ),
    }),
    { status: 201 },
  );
