import { requireAdmin } from "@/lib/access";
import { parseParams, partnerAction, periodQuery } from "@/lib/coupons/admin-api";
import { coupons, guarded } from "@/lib/coupons/instance";
import { query, transaction } from "@/lib/db";
import { handle, readJson, refuse } from "@/lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** The partner view, per coupon and currency, for a period: uses, discount given, revenue (paid minus refunded), credits granted. Never a customer. Every read is audited. `?export=1` is the Loi 25 export (the record and its aggregates). */
export const GET = (req: Request, { params }: Ctx) =>
  handle(async () => {
    const session = await requireAdmin(req);
    const { id } = await params;
    if (new URL(req.url).searchParams.get("export") === "1") {
      const exported = await guarded(() => coupons.admin.partners.export(query, id));
      return Response.json(exported, { headers: { "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename="partner-${id}.json"` } });
    }
    const partner = await guarded(() => coupons.admin.partners.get(query, id));
    if (!partner) throw refuse(404, "COUPON_PARTNER_NOT_FOUND", "No such partner");
    const period = parseParams(periodQuery, req.url);
    const rows = await guarded(() => transaction((tx) => coupons.admin.partners.report(tx, { id: session.account.id, label: session.account.email }, id, period)));
    return Response.json({ partner, rows }, { headers: { "Cache-Control": "private, no-store" } });
  });

/** Archives, restores or erases a partner (erasing blanks the name and the e-mail and keeps the aggregates: the redemptions are accounting records). */
export const POST = (req: Request, { params }: Ctx) =>
  handle(async () => {
    const session = await requireAdmin(req);
    const { id } = await params;
    const { action } = await readJson(req, partnerAction);
    const actor = { id: session.account.id, label: session.account.email };
    const partners = coupons.admin.partners;
    const run = { archive: partners.archive, restore: partners.restore, erase: partners.erase }[action];
    return Response.json({ partner: await guarded(() => transaction((tx) => run(tx, actor, id))) });
  });
