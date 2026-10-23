import { systemClock } from "@/app/system-clock";
import { sessionSecret } from "@/lib/env";
import { settingsFor } from "@/lib/settings/guards";
import { webhooksFor } from "@/lib/webhooks";
import { webhookAct } from "@/lib/webhooks/act";

export const dynamic = "force-dynamic";

/** What was sent to an endpoint and how it went: the recent deliveries, newest first (id, event, status, tries, last answer). */
export const GET = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  webhookAct(req, "webhooks", systemClock.now(), async (s) => ({
    deliveries: await webhooksFor(sessionSecret(), (await settingsFor(s.account.id))["limits.webhookMaxAttempts"].value as number).deliveries(s.account.id, (await params).id, 50),
  }));
