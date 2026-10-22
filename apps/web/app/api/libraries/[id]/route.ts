import { z } from "zod";

import { readJson } from "@/lib/http";
import { act, type Params } from "@/lib/organisation/api";
import { deleteLibrary, renameLibrary } from "@/lib/organisation/store";

export const dynamic = "force-dynamic";

export const PATCH = (req: Request, { params }: Params) => act(req, async ({ owner, q }) => ({ library: await renameLibrary(q, owner, (await params).id, (await readJson(req, z.object({ name: z.string() }))).name) }));
export const DELETE = (req: Request, { params }: Params) => act(req, async ({ owner, q, note }) => {
  const id = (await params).id;
  await deleteLibrary(q, owner, id);
  await note("library.deleted", { id });
});
