import { requireAdmin } from "@/lib/access";
import { handle, refuse } from "@/lib/http";
import { exportFormat } from "@/lib/incident-input";
import { exportIncidentRegister } from "@/lib/incidents";

export const dynamic = "force-dynamic";

/** The register for the Commission, on request: `?format=csv|json` (json by default). Reading it is audited. */
export const GET = (req: Request) =>
  handle(async () => {
    const session = await requireAdmin(req);
    const format = exportFormat.safeParse(new URL(req.url).searchParams.get("format") ?? "json");
    if (!format.success) throw refuse(400, "BAD_REQUEST", "format is csv or json");
    const file = await exportIncidentRegister(session.account, format.data, req.headers);
    return new Response(file.body, { headers: { "Content-Type": file.type, "Content-Disposition": `attachment; filename="${file.filename}"`, "Cache-Control": "private, no-store" } });
  });
