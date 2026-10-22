import { z } from "zod";

import { readJson } from "@/lib/http";
import { act } from "@/lib/organisation/api";
import { createCollection } from "@/lib/organisation/store";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => act(req, async ({ owner, q }) => {
  const input = await readJson(req, z.object({ libraryId: z.string(), name: z.string() }));
  return { collection: await createCollection(q, owner, input.libraryId, input.name) };
}, 201);
