import { requireAdmin } from "@/lib/access";
import { handle, readJson } from "@/lib/http";
import { incidentStepInput } from "@/lib/incident-input";
import { stepIncident } from "@/lib/incidents";

export const dynamic = "force-dynamic";

/** One step of an incident: assess the risk of serious injury, record a measure, record a notice (Commission or people concerned), mark a drill, close. Audited. */
export const POST = (req: Request, ctx: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const session = await requireAdmin(req);
    const { id } = await ctx.params;
    const step = await readJson(req, incidentStepInput);
    return Response.json({ incident: await stepIncident(session.account, id, step, req.headers) });
  });
