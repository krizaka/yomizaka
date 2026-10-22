import { z } from "zod";

import { readJson } from "@/lib/http";
import { act, type Params } from "@/lib/organisation/api";
import { deleteChoice } from "@/lib/organisation/rules";
import { deleteCollection, moveCollection, renameCollection } from "@/lib/organisation/store";

export const dynamic = "force-dynamic";

/** Rename (`name`) and/or move to another library (`libraryId`). */
export const PATCH = (req: Request, { params }: Params) => act(req, async ({ owner, q }) => {
  const id = (await params).id;
  const input = await readJson(req, z.object({ name: z.string().optional(), libraryId: z.string().optional() }));
  let collection;
  if (input.name !== undefined) collection = await renameCollection(q, owner, id, input.name);
  if (input.libraryId !== undefined) collection = await moveCollection(q, owner, id, input.libraryId);
  return { collection };
});

/** Body `{ files: "move" | "delete", to? }`: what becomes of its files. */
export const DELETE = (req: Request, { params }: Params) => act(req, async ({ owner, q, note }) => {
  const id = (await params).id;
  const choice = deleteChoice(await req.json().catch(() => null));
  await deleteCollection(q, owner, id, choice);
  await note("collection.deleted", { id, files: choice.files });
});
