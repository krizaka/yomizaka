import { requireAdmin } from "@/lib/access";
import { handle } from "@/lib/http";
import { setSample } from "@/lib/showcase";

export const dynamic = "force-dynamic";

/** Declares a document a sample — non-personal, showable (an administrator, from an allowed address). */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAdmin(req);
    return Response.json(await setSample(session.account, (await params).id, true, req.headers));
  });
}

/** Takes the flag away; the document's checks leave the showcase with it. */
export function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAdmin(req);
    return Response.json(await setSample(session.account, (await params).id, false, req.headers));
  });
}
