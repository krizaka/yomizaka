import { z } from "zod";

import { readJson } from "@/lib/http";
import { act } from "@/lib/organisation/api";
import { TAG_COLORS } from "@/lib/organisation/rules";
import { createTag, listTags } from "@/lib/organisation/store";

export const dynamic = "force-dynamic";

export const GET = (req: Request) => act(req, async ({ owner, q }) => ({ tags: await listTags(q, owner) }));
export const POST = (req: Request) =>
  act(
    req,
    async ({ owner, q }) => {
      const input = await readJson(req, z.object({ name: z.string(), color: z.enum(TAG_COLORS) }));
      return { tag: await createTag(q, owner, input.name, input.color) };
    },
    201,
  );
