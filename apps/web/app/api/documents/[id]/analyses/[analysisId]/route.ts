import { requireSession } from "@/lib/access";
import { getAnalysis } from "@/lib/analyses";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** One analysis, brought up to date with its Orazaka run while it runs (the page polls this). */
export function GET(req: Request, { params }: { params: Promise<{ id: string; analysisId: string }> }) {
  return handle(async () => {
    const session = await requireSession(req);
    const { id, analysisId } = await params;
    return Response.json({ analysis: await getAnalysis(session.account.id, id, analysisId) });
  });
}
