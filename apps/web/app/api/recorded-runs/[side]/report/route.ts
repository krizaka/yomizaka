import { perspective } from "@yomizaka/core";

import { handle, refuse } from "@/lib/http";
import { asLocale } from "@/lib/i18n";
import { limit } from "@/lib/rate-limit";
import { recordedReport } from "@/lib/recorded-runs";

export const dynamic = "force-dynamic";

/** The signed audit report of a recorded sample run (`tenant` | `landlord`), `?lang=en|fr`: a sample document, no personal data. */
export function GET(req: Request, { params }: { params: Promise<{ side: string }> }) {
  return handle(async () => {
    limit("recorded-report", req, null, [60, 3600]);
    const side = perspective.safeParse((await params).side);
    if (!side.success) throw refuse(404, "NOT_FOUND", "No such recorded run");
    const made = recordedReport(side.data, asLocale(new URL(req.url).searchParams.get("lang") ?? undefined));
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
