import { z } from "zod";

import { readJson } from "../http";
import { act, type Params } from "./api";
import { deleteChoice } from "./rules";
import { createCollection, createFolder, deleteCollection, deleteFolder, moveCollection, moveFolder, ownedCollection, renameCollection, renameFolder, setDefaultCollection } from "./store";

/** Collections and folders are served the same way: create, rename and move, delete with a choice for the files. One table, one set of handlers. */
const CONTAINER = {
  collection: { parentField: "libraryId", create: createCollection, rename: renameCollection, move: moveCollection, remove: deleteCollection, audit: "collection.deleted" },
  folder: { parentField: "collectionId", create: createFolder, rename: renameFolder, move: moveFolder, remove: deleteFolder, audit: "folder.deleted" },
} as const;

export function containerHandlers(kind: keyof typeof CONTAINER) {
  const c = CONTAINER[kind];
  return {
    POST: (req: Request) =>
      act(
        req,
        async ({ owner, q }) => {
          const input = await readJson(req, z.object({ [c.parentField]: z.string(), name: z.string() }));
          return { [kind]: await c.create(q, owner, input[c.parentField] as string, input.name as string) };
        },
        201,
      ),
    /** Rename (`name`), move (`parentField`; a folder's files follow) and, for a collection, make it the default (`default: true`). */
    PATCH: (req: Request, { params }: Params) =>
      act(req, async ({ owner, q }) => {
        const id = (await params).id;
        const input = await readJson(req, z.object({ name: z.string().optional(), [c.parentField]: z.string().optional(), default: z.literal(true).optional() }));
        let result;
        if (input.name !== undefined) result = await c.rename(q, owner, id, input.name as string);
        if (input[c.parentField] !== undefined) result = await c.move(q, owner, id, input[c.parentField] as string);
        if (input.default && kind === "collection") {
          await setDefaultCollection(q, owner, id);
          result = await ownedCollection(q, owner, id);
        }
        return { [kind]: result };
      }),
    /** Body `{ files: "move" | "delete", to? }`: what becomes of its files. */
    DELETE: (req: Request, { params }: Params) =>
      act(req, async ({ owner, q, note }) => {
        const id = (await params).id;
        const choice = deleteChoice(await req.json().catch(() => null));
        await c.remove(q, owner, id, choice);
        await note(c.audit, { id, files: choice.files });
      }),
  };
}
