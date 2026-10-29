import { AVAILABILITY, describePrices, type Price } from "@krizaka/settings";
import { z } from "zod";

import { requireAdmin } from "@/lib/access";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { handle, readJson } from "@/lib/http";
import { paymentsFrom } from "@/lib/payments/config";
import { processorSync } from "@/lib/payments/processor-sync";
import { appPrices } from "@/lib/prices/catalogue";
import { SOLD, SOLD_KINDS } from "@/lib/pricing";
import { settingsRefusal } from "@/lib/settings/refusal";

export const dynamic = "force-dynamic";

async function run(fn: () => Promise<Response>) {
  return handle(async () => {
    try {
      return await fn();
    } catch (error) {
      throw settingsRefusal(error) ?? error;
    }
  });
}

/** What the processor charges for each sold entry, to show beside the catalogue's (null when payments are off or the price is missing). */
async function processorAmounts(): Promise<{ mode: "test" | "live" | null; amounts: Record<string, number | null> }> {
  const e = env();
  const port = paymentsFrom(e);
  if (!port) return { mode: null, amounts: {} };
  const amounts = Object.fromEntries(
    await Promise.all(SOLD_KINDS.map(async (kind) => [SOLD[kind].key, await port.price(kind).then((p) => p.amount, () => null)] as const)),
  );
  return { mode: e.PAYMENTS_STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live" : "test", amounts };
}

/** The price catalogue as the admin screen draws it: every entry in force, what is scheduled, its history, and what the processor charges. */
export const GET = (req: Request) =>
  run(async () => {
    await requireAdmin(req);
    const catalogue = appPrices();
    const now = new Date();
    const description = await describePrices(catalogue, now);
    const history = Object.fromEntries(await Promise.all(description.entries.map(async (e) => [e.key, await catalogue.history(e.key)] as const)));
    return Response.json({ ...description, history, processor: await processorAmounts() }, { headers: { "Cache-Control": "private, no-store" } });
  });

const change = z.object({
  key: z.string().max(81),
  amountCents: z.number().int().min(0).nullable().optional(),
  availability: z.enum(Object.values(AVAILABILITY) as [string, ...string[]]).optional(),
  limits: z.record(z.string().max(40), z.number().int().min(0)).optional(),
  /** From when (ISO); absent = now. Never in the past (the catalogue refuses it: 400 BAD_DATE). */
  effectiveFrom: z.iso.datetime({ offset: true }).optional(),
});

/** Schedules a change of one entry from a date: a new version (the catalogue writes its audit line), and a line in the administration's trail. */
export const POST = (req: Request) =>
  run(async () => {
    const session = await requireAdmin(req);
    const { key, effectiveFrom, ...fields } = await readJson(req, change);
    const now = new Date();
    const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as Partial<Price>;
    const entry = await appPrices().schedule({ id: session.account.id, label: session.account.email }, key, patch, effectiveFrom ? new Date(effectiveFrom) : now, now);
    await audit({ action: "prices.scheduled", actorId: session.account.id, actorLabel: session.account.email, targetId: null, detail: { key, versionId: entry.versionId, effectiveFrom: entry.effectiveFrom.toISOString(), ...patch }, headers: req.headers });
    // A change that applies now reaches the processor at once (test mode; a live key is the owner's); a scheduled one is synced when its day comes (the screen's « Sync » or the next change).
    const sync = entry.effectiveFrom <= now ? await processorSync(env(), (await describePrices(appPrices(), now)).entries).catch(() => "failed" as const) : "later";
    return Response.json({ entry, sync });
  });
