import { handle, refuse } from "@/lib/http";
import { asLocale } from "@/lib/i18n";
import { limit } from "@/lib/rate-limit";
import { showcaseReport } from "@/lib/showcase";

export const dynamic = "force-dynamic";

/** The signed audit report of the showcase, as the file anyone can check on /verify. `?lang=en|fr`. */
export function GET(req: Request) {
  return handle(async () => {
    limit("showcase-report", req, null, [60, 3600]);
    const made = await showcaseReport(asLocale(new URL(req.url).searchParams.get("lang") ?? undefined));
    if (!made) throw refuse(404, "NOT_FOUND", "No showcase");
    return new Response(made.issued.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${made.filename}"`,
        "X-Report-SHA256": made.issued.fileSha256,
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
