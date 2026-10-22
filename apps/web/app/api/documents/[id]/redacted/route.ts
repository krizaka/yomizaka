import { requireSession } from "@/lib/access";
import { audit } from "@/lib/audit";
import { getDocument } from "@/lib/documents";
import { handle } from "@/lib/http";
import { asLocale } from "@/lib/i18n";
import { personalInfo } from "@/lib/pii";
import { limit } from "@/lib/rate-limit";
import { assertFeature } from "@/lib/settings/guards";

export const dynamic = "force-dynamic";

/**
 * The document's text with its personal information blanked (Loi 25): to the document's owner only, as a text file. Nothing is
 * stored; the values are not logged — the audit line carries the counts.
 */
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession(req);
    limit("redacted", req, session.account.id, [60, 3600]);
    await assertFeature("personalInfo", session.account.id);
    const { id } = await params;
    const doc = await getDocument(session.account.id, id);
    const lang = asLocale(new URL(req.url).searchParams.get("lang") ?? undefined);
    const body = personalInfo.redact(doc.text, lang);
    await audit({ action: "document.redacted_exported", actorId: session.account.id, actorLabel: session.account.email, targetId: id, detail: { counts: doc.insight?.pii.counts ?? {} }, headers: req.headers });
    const name = `${doc.filename.replace(/\.[^.]+$/, "")}-caviarde.txt`;
    return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  });
}
