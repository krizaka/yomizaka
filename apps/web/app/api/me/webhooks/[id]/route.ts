import { z } from "zod";

import { systemClock } from "@/app/system-clock";
import { audit } from "@/lib/audit";
import { sessionSecret } from "@/lib/env";
import { readJson } from "@/lib/http";
import { settingsFor } from "@/lib/settings/guards";
import { webhooksFor } from "@/lib/webhooks";
import { webhookAct } from "@/lib/webhooks/act";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

const hooksOf = async (ownerId: string) =>
  webhooksFor(sessionSecret(), (await settingsFor(ownerId))["limits.webhookMaxAttempts"].value as number);

/** Changes the events of an endpoint, or switches it off and on. */
export const PATCH = (req: Request, { params }: Params) =>
  webhookAct(req, "webhooks", systemClock.now(), async (s) => {
    const patch = await readJson(
      req,
      z.object({ events: z.array(z.string()).max(20).optional(), active: z.boolean().optional() }),
    );
    const endpoint = await (await hooksOf(s.account.id)).updateEndpoint(s.account.id, (await params).id, patch);
    await audit({
      action: "webhook.endpoint.updated",
      actorId: s.account.id,
      actorLabel: s.account.email,
      targetId: endpoint.id,
      detail: { fields: Object.keys(patch) },
      headers: req.headers,
    });
    return { endpoint };
  });

export const DELETE = (req: Request, { params }: Params) =>
  webhookAct(req, "webhooks", systemClock.now(), async (s) => {
    const id = (await params).id;
    await (await hooksOf(s.account.id)).removeEndpoint(s.account.id, id);
    await audit({
      action: "webhook.endpoint.removed",
      actorId: s.account.id,
      actorLabel: s.account.email,
      targetId: id,
      headers: req.headers,
    });
    return { ok: true };
  });
