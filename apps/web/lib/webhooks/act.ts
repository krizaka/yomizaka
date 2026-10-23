import { WEBHOOK_CODE, type WebhookCode, WebhookError } from "@krizaka/webhooks";

import { accountAct } from "../account/act";
import { HttpError, refuse } from "../http";
import type { Session } from "../session";
import { assertFeature } from "../settings/guards";
import { maxEndpoints } from "./index";

/** The HTTP answer of each refusal of the module: stable codes the page translates and the docs list. */
const ANSWER: Record<WebhookCode, number> = {
  [WEBHOOK_CODE.url]: 400,
  [WEBHOOK_CODE.events]: 400,
  [WEBHOOK_CODE.limit]: 409,
  [WEBHOOK_CODE.notFound]: 404,
  [WEBHOOK_CODE.signature]: 401,
};

export function webhookRefusal(error: unknown): HttpError | null {
  const e = error as { name?: unknown; code?: unknown; detail?: unknown; message?: unknown } | null;
  const known = Object.values(WEBHOOK_CODE) as string[];
  if (error instanceof WebhookError || (e && e.name === "WebhookError" && typeof e.code === "string" && known.includes(e.code))) {
    const code = (error as WebhookError).code;
    return refuse(ANSWER[code], code, `Webhook refused: ${code}`, typeof (error as WebhookError).detail === "string" ? { detail: (error as WebhookError).detail } : {});
  }
  return null;
}

/** An endpoint action: signed in, the switch on, the plan holds at least one endpoint, rate-limited; a module refusal becomes its stable answer. */
export function webhookAct(req: Request, scope: string, now: Date, run: (session: Session, max: number) => Promise<Response | Record<string, unknown> | undefined>) {
  return accountAct(req, scope, async (session) => {
    await assertFeature("webhooks", session.account.id);
    const max = await maxEndpoints(session.account.id, now);
    if (max < 1) throw refuse(403, "WEBHOOK_PLAN", "Your plan does not include webhooks");
    try {
      return await run(session, max);
    } catch (error) {
      throw webhookRefusal(error) ?? error;
    }
  });
}
