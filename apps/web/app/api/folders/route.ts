import { z } from "zod";

import { readJson } from "@/lib/http";
import { act } from "@/lib/organisation/api";
import { createFolder } from "@/lib/organisation/store";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => act(req, async ({ owner, q }) => {
  const input = await readJson(req, z.object({ collectionId: z.string(), name: z.string() }));
  return { folder: await createFolder(q, owner, input.collectionId, input.name) };
}, 201);
