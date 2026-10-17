import { requireSession } from "@/lib/access";
import { appEnvironment } from "@/lib/env";
import { availableFlows, flowsFor, grantedConsents, offerFor } from "@/lib/flows";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The flows available to the signed-in person in this environment, what they offer on a document, and the consents given. */
export function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    const flows = await availableFlows(appEnvironment(), { fallback: false });
    const mine = flowsFor(flows, session.account.perspective);
    return Response.json(
      { flows: mine.map((f) => ({ key: f.key, version: f.version, ...f.definition })), offer: offerFor(flows, session.account.perspective), consents: await grantedConsents(session.account.id) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  });
}
