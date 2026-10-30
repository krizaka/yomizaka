import { z } from "zod";

import { readJson } from "@/lib/http";
import { workspaceAct } from "@/lib/workspace/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ kind: string }> };

// The layer takes at most 200 ids and answers TOO_MANY; this bound is only against an absurd body.
const body = z.object({
  ids: z.array(z.string()).min(1).max(1000),
  to: z.string().max(40),
  expect: z.string().max(40).optional(),
});

/**
 * Moves files to a state of the kind's set — the manager's decision. `{ ids, to, expect? }` answers `{ moved, skipped }`: what moved,
 * and what the layer left as it was with why. One file with a stale `expect` is 409 STALE; a file of another account is 404 and
 * nothing moves. No reason is accepted: there is never a free-text reason about a person.
 */
export const POST = (req: Request, { params }: Params) =>
  workspaceAct(
    req,
    params,
    async ({ kind, account, actor, workspace }) => {
      const input = await readJson(req, body);
      const result = await workspace.status.move(account.id, actor, kind, input);
      return {
        moved: result.moved.map((m) => ({ id: m.entityId, from: m.from, to: m.to, final: m.final })),
        skipped: result.skipped,
      };
    },
    { purges: true },
  );
