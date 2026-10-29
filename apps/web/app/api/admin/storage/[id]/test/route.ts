import { providers } from "@/app/storage-providers";
import { requireAdmin } from "@/lib/access";
import { handle } from "@/lib/http";
import { guarded, managedProviders } from "@/lib/storage/admin-api";
import { actorOf } from "@/lib/storage/providers";

export const dynamic = "force-dynamic";

/** Tests the connection again (a probe write, read, compare, delete) and records the residency it found. Only a green test verifies a draft. Audited. */
export const POST = (req: Request, ctx: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const session = await requireAdmin(req);
    const { id } = await ctx.params;
    const { service } = managedProviders(providers);
    return Response.json({ provider: await guarded(() => service.test(actorOf(session.account), id)) });
  });
