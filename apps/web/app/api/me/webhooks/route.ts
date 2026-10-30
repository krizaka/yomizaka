import { z } from "zod";

import { systemClock } from "@/app/system-clock";
import { audit } from "@/lib/audit";
import { sessionSecret } from "@/lib/env";
import { readJson } from "@/lib/http";
import { settingsFor } from "@/lib/settings/guards";
import { webhooksFor } from "@/lib/webhooks";
import { webhookAct } from "@/lib/webhooks/act";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/events";

export const dynamic = "force-dynamic";

const hooksOf = async (ownerId: string) =>
  webhooksFor(sessionSecret(), (await settingsFor(ownerId))["limits.webhookMaxAttempts"].value as number);

/** The person's endpoints (never a secret), the events they can subscribe to, and what their plan allows. */
export const GET = (req: Request) =>
  webhookAct(req, "webhooks", systemClock.now(), async (s, max) => ({
    endpoints: await (await hooksOf(s.account.id)).listEndpoints(s.account.id),
    events: WEBHOOK_EVENTS,
    maxEndpoints: max,
  }));

/** Registers an endpoint (https, a public address): its signing secret is in this answer and nowhere else, ever. */
export const POST = (req: Request) =>
  webhookAct(req, "webhooks", systemClock.now(), async (s, max) => {
    const input = await readJson(req, z.object({ url: z.string().max(2000), events: z.array(z.string()).max(20) }));
    const made = await (
      await hooksOf(s.account.id)
    ).registerEndpoint(s.account.id, input, { maxEndpoints: max }, systemClock.now());
    await audit({
      action: "webhook.endpoint.created",
      actorId: s.account.id,
      actorLabel: s.account.email,
      targetId: made.endpoint.id,
      detail: { events: made.endpoint.events, host: new URL(made.endpoint.url).host },
      headers: req.headers,
    });
    return new Response(JSON.stringify(made), {
      status: 201,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store, private" },
    });
  });
