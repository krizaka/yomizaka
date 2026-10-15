import { z } from "zod";

import { requireAdmin } from "@/lib/access";
import { setUserRole } from "@/lib/admin";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const body = z.object({ role: z.enum(["USER", "ADMIN"]) });

/** Grants or withdraws the administrator role (an administrator, signed in, from an allowed address). */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAdmin(req);
    const { role } = await readJson(req, body);
    return Response.json({ user: await setUserRole(session.account, (await params).id, role, req.headers) });
  });
}
