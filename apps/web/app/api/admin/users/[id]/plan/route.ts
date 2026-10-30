import { z } from "zod";

import { requireAdmin } from "@/lib/access";
import { setUserPlan } from "@/lib/admin";
import { appEnvironment } from "@/lib/env";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const body = z.object({ plan: z.enum(["FREE", "PRO"]) });

/** Puts a QA account on Pro without a card, or back on Free (an administrator, signed in, from an allowed address; refused in production). */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAdmin(req);
    const { plan } = await readJson(req, body);
    return Response.json({
      user: await setUserPlan(session.account, (await params).id, plan, appEnvironment(), req.headers),
    });
  });
}
