import { z } from "zod";

import { readJson } from "@/lib/http";
import { act, type Params } from "@/lib/organisation/api";
import { TAG_COLORS } from "@/lib/organisation/rules";
import { deleteTag, updateTag } from "@/lib/organisation/store";

export const dynamic = "force-dynamic";

export const PATCH = (req: Request, { params }: Params) => act(req, async ({ owner, q }) => ({ tag: await updateTag(q, owner, (await params).id, await readJson(req, z.object({ name: z.string().optional(), color: z.enum(TAG_COLORS).optional() }))) }));
export const DELETE = (req: Request, { params }: Params) => act(req, async ({ owner, q }) => void (await deleteTag(q, owner, (await params).id)));
