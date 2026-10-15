import { requireAdmin } from "@/lib/access";
import { setUserStatus } from "@/lib/admin";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Suspends an account (an administrator, signed in, from an allowed address). */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAdmin(req);
    return Response.json({ user: await setUserStatus(session.account, (await params).id, "SUSPENDED", req.headers) });
  });
}
