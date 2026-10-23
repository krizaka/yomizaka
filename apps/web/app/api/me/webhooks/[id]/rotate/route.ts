import { systemClock } from "@/app/system-clock";
import { audit } from "@/lib/audit";
import { sessionSecret } from "@/lib/env";
import { settingsFor } from "@/lib/settings/guards";
import { webhooksFor } from "@/lib/webhooks";
import { webhookAct } from "@/lib/webhooks/act";

export const dynamic = "force-dynamic";

/** A new signing secret (the old one stops signing at once), in the answer once. */
export const POST = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  webhookAct(req, "webhooks", systemClock.now(), async (s) => {
    const id = (await params).id;
    const { secret } = await webhooksFor(sessionSecret(), (await settingsFor(s.account.id))["limits.webhookMaxAttempts"].value as number).rotateSecret(s.account.id, id);
    await audit({ action: "webhook.endpoint.rotated", actorId: s.account.id, actorLabel: s.account.email, targetId: id, headers: req.headers });
    return new Response(JSON.stringify({ secret }), { status: 201, headers: { "Content-Type": "application/json", "Cache-Control": "no-store, private" } });
  });
