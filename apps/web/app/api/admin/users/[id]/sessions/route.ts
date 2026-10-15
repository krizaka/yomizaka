import { requireAdmin } from "@/lib/access";
import { revokeUserSessions } from "@/lib/admin";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Ends every open session of an account, leaving it active. */
export function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAdmin(req);
    return Response.json(await revokeUserSessions(session.account, (await params).id, req.headers));
  });
}
