import { requireAdmin } from "@/lib/access";
import { handle } from "@/lib/http";
import { setShowcase } from "@/lib/showcase";

export const dynamic = "force-dynamic";

/** Promotes a finished compliance check of a sample document to the public showcase (an administrator, from an allowed address). */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAdmin(req);
    return Response.json(await setShowcase(session.account, (await params).id, true, req.headers));
  });
}

/** Withdraws it. */
export function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAdmin(req);
    return Response.json(await setShowcase(session.account, (await params).id, false, req.headers));
  });
}
