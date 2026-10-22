import { z } from "zod";

import { readJson } from "@/lib/http";
import { act } from "@/lib/organisation/api";
import { setTags } from "@/lib/organisation/store";

export const dynamic = "force-dynamic";

/** Replaces the tags of a collection, a folder or a document. */
export const PUT = (req: Request) => act(req, async ({ owner, q }) => {
  const input = await readJson(req, z.object({ kind: z.enum(["collection", "folder", "document"]), id: z.string(), tagIds: z.array(z.string()).max(50) }));
  await setTags(q, owner, { kind: input.kind, id: input.id }, input.tagIds);
});
