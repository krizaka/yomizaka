import { z } from "zod";

import { requireAdmin } from "@/lib/access";
import { deleteAccount } from "@/lib/admin";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const body = z.object({ confirmEmail: z.string().min(3).max(320) });

/** Law 25 erasure of an account and everything it owns; the administrator types the e-mail to confirm. */
export function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAdmin(req);
    const { confirmEmail } = await readJson(req, body);
    return Response.json(await deleteAccount(session.account, (await params).id, confirmEmail, req.headers));
  });
}
