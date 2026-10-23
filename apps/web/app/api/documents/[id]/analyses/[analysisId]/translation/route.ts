import { requireSession } from "@/lib/access";
import { getAnalysis } from "@/lib/analyses";
import { handle, refuse } from "@/lib/http";
import { asLocale } from "@/lib/i18n";
import { limit } from "@/lib/rate-limit";
import { translationFor } from "@/lib/translation/wire";

export const dynamic = "force-dynamic";

/**
 * The finished report's generated texts in `?lang=en|fr` (yomizaka#246): `original` for the language Orazaka wrote it in, `running`
 * while the Studio works (the page asks again), `done` with the texts and the trace (run id, glossary version, source version),
 * `failed` with the reason. Started once, then cached. The quoted passages, references, amounts and dates are never in it.
 */
export function GET(req: Request, { params }: { params: Promise<{ id: string; analysisId: string }> }) {
  return handle(async () => {
    const session = await requireSession(req);
    limit("report-translation", req, session.account.id, [240, 3600], [120, 3600]);
    const { id, analysisId } = await params;
    const analysis = await getAnalysis(session.account.id, id, analysisId);
    if (!analysis.report) throw refuse(409, "REPORT_NOT_READY", "This check has no report yet");
    const translation = await translationFor(session.account.id, analysis, asLocale(new URL(req.url).searchParams.get("lang") ?? undefined));
    return Response.json({ translation }, { headers: { "Cache-Control": "private, no-store" } });
  });
}
