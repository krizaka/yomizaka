import { requireAdmin } from "@/lib/access";
import { coupons, guarded } from "@/lib/coupons/instance";
import { query } from "@/lib/db";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** A free code of the configured length (Crockford letters and digits, no I, L, O or U), for the create form's « Generate ». */
export const GET = (req: Request) =>
  handle(async () => {
    await requireAdmin(req);
    return Response.json({ code: await guarded(() => coupons.admin.generateCode(query)) }, { headers: { "Cache-Control": "private, no-store" } });
  });
