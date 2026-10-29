import { providers } from "@/app/storage-providers";
import { requireAdmin } from "@/lib/access";
import { handle } from "@/lib/http";
import { guarded, managedProviders } from "@/lib/storage/admin-api";
import { actorOf } from "@/lib/storage/providers";

export const dynamic = "force-dynamic";

/** The admin's confirmation that a retiring provider is done: refused while a document still reaches it; its old copies are swept and it is disabled. Audited. */
export const POST = (req: Request, ctx: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const session = await requireAdmin(req);
    const { id } = await ctx.params;
    const { service } = managedProviders(providers);
    return Response.json(await guarded(() => service.retire(actorOf(session.account), id)));
  });
