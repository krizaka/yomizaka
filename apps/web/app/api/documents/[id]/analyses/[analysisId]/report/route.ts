import { requireSession } from "@/lib/access";
import { audit } from "@/lib/audit";
import { handle } from "@/lib/http";
import { asLocale } from "@/lib/i18n";
import { limit } from "@/lib/limits";
import { reportFor, reportPdfFor } from "@/lib/reports";

export const dynamic = "force-dynamic";

/**
 * The signed audit report of a finished compliance check, to the document's owner. `?lang=en|fr` picks its language;
 * `?meta=1` answers the report's fingerprint and key as JSON (what the page shows next to the download) without the file.
 */
export function GET(req: Request, { params }: { params: Promise<{ id: string; analysisId: string }> }) {
  return handle(async () => {
    const session = await requireSession(req);
    await limit("report", req, session.account.id);
    const { id, analysisId } = await params;
    const url = new URL(req.url);
    if (url.searchParams.get("format") === "pdf" && !url.searchParams.get("meta")) {
      const pdf = await reportPdfFor(session.account.id, id, analysisId, asLocale(url.searchParams.get("lang") ?? undefined));
      await audit({ action: "report.issued", actorId: session.account.id, actorLabel: session.account.email, targetId: id, detail: { analysisId, format: "pdf", runId: pdf.issued.attestation.payload.check.runId, fileSha256: pdf.issued.fileSha256, keyId: pdf.issued.attestation.keyId }, headers: req.headers });
      return new Response(new Uint8Array(pdf.issued.bytes), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${pdf.filename}"`, "X-Report-SHA256": pdf.issued.fileSha256, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
      });
    }
    const { issued, filename } = await reportFor(session.account.id, id, analysisId, asLocale(url.searchParams.get("lang") ?? undefined));
    if (url.searchParams.get("meta")) {
      return Response.json({ report: { fileSha256: issued.fileSha256, keyId: issued.attestation.keyId, filename, lang: issued.attestation.payload.lang }, }, { headers: { "Cache-Control": "private, no-store" } });
    }
    await audit({ action: "report.issued", actorId: session.account.id, actorLabel: session.account.email, targetId: id, detail: { analysisId, runId: issued.attestation.payload.check.runId, fileSha256: issued.fileSha256, keyId: issued.attestation.keyId }, headers: req.headers });
    return new Response(issued.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Report-SHA256": issued.fileSha256,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
