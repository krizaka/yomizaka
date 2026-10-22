import { z } from "zod";

import { readJson } from "@/lib/http";
import { act, type Params } from "@/lib/organisation/api";
import { deleteChoice } from "@/lib/organisation/rules";
import { deleteFolder, moveFolder, renameFolder } from "@/lib/organisation/store";

export const dynamic = "force-dynamic";

/** Rename (`name`) and/or move to another collection (`collectionId`; its files follow). */
export const PATCH = (req: Request, { params }: Params) => act(req, async ({ owner, q }) => {
  const id = (await params).id;
  const input = await readJson(req, z.object({ name: z.string().optional(), collectionId: z.string().optional() }));
  let folder;
  if (input.name !== undefined) folder = await renameFolder(q, owner, id, input.name);
  if (input.collectionId !== undefined) folder = await moveFolder(q, owner, id, input.collectionId);
  return { folder };
});

/** Body `{ files: "move" | "delete", to? }`: what becomes of its files (moved up to the collection when `to` is null). */
export const DELETE = (req: Request, { params }: Params) => act(req, async ({ owner, q, note }) => {
  const id = (await params).id;
  const choice = deleteChoice(await req.json().catch(() => null));
  await deleteFolder(q, owner, id, choice);
  await note("folder.deleted", { id, files: choice.files });
});
