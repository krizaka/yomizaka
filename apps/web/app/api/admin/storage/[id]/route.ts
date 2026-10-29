import { providers } from "@/app/storage-providers";
import { requireAdmin } from "@/lib/access";
import { handle } from "@/lib/http";
import { guarded, managedProviders } from "@/lib/storage/admin-api";
import { actorOf } from "@/lib/storage/providers";

export const dynamic = "force-dynamic";

/** Disables a provider: refused (409) while it is a default or documents still reach it. Audited. */
export const DELETE = (req: Request, ctx: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const session = await requireAdmin(req);
    const { id } = await ctx.params;
    const { service } = managedProviders(providers);
    return Response.json({ provider: await guarded(() => service.disable(actorOf(session.account), id)) });
  });
