import { requireAdmin } from "@/lib/access";
import { newPartner } from "@/lib/coupons/admin-api";
import { coupons, guarded } from "@/lib/coupons/instance";
import { query, transaction } from "@/lib/db";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The people who sell for us (admin only, Loi 25: a name and an optional e-mail, for one purpose, attributing sales). */
export const GET = (req: Request) =>
  handle(async () => {
    await requireAdmin(req);
    return Response.json({ partners: await guarded(() => coupons.admin.partners.list(query, { includeArchived: true })) }, { headers: { "Cache-Control": "private, no-store" } });
  });

export const POST = (req: Request) =>
  handle(async () => {
    const session = await requireAdmin(req);
    const input = await readJson(req, newPartner);
    const partner = await guarded(() => transaction((tx) => coupons.admin.partners.create(tx, { id: session.account.id, label: session.account.email }, { displayName: input.displayName, contactEmail: input.contactEmail ?? null })));
    return Response.json({ partner }, { status: 201 });
  });
