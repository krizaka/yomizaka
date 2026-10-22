import { z } from "zod";

import { readJson } from "@/lib/http";
import { act } from "@/lib/organisation/api";
import { createLibrary } from "@/lib/organisation/store";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => act(req, async ({ owner, q }) => ({ library: await createLibrary(q, owner, (await readJson(req, z.object({ name: z.string() }))).name) }), 201);
