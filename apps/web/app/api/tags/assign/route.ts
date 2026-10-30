import { z } from "zod";

import { readJson } from "@/lib/http";
import { act } from "@/lib/organisation/api";
import { setTags } from "@/lib/organisation/store";

export const dynamic = "force-dynamic";

/** Replaces the tags of a collection or a folder. A document's tags are the workspace's: `PUT /api/organize/document/tags/set`. */
export const PUT = (req: Request) =>
  act(req, async ({ owner, q }) => {
    const input = await readJson(
      req,
      z.object({ kind: z.enum(["collection", "folder"]), id: z.string(), tagIds: z.array(z.string()).max(50) }),
    );
    await setTags(q, owner, { kind: input.kind, id: input.id }, input.tagIds);
  });
