import { z } from "zod";

import { readJson } from "@/lib/http";
import { act, type Params } from "@/lib/organisation/api";
import { placeDocument } from "@/lib/organisation/store";

export const dynamic = "force-dynamic";

/** Moves a document into a collection, or one of its folders (`null`, `null` = « sans collection »). */
export const PUT = (req: Request, { params }: Params) => act(req, async ({ owner, q }) => {
  const input = await readJson(req, z.object({ collectionId: z.string().nullable(), folderId: z.string().nullable().optional() }));
  await placeDocument(q, owner, (await params).id, { collectionId: input.collectionId, folderId: input.folderId ?? null });
});
