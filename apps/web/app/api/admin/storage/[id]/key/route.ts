import { providers } from "@/app/storage-providers";
import { requireAdmin } from "@/lib/access";
import { handle, readJson } from "@/lib/http";
import { changeKeyInput, guarded, managedProviders } from "@/lib/storage/admin-api";
import { actorOf } from "@/lib/storage/providers";

export const dynamic = "force-dynamic";

/** Replaces a credential. The new one is tested first: a failing key is refused and nothing is saved. Audited, the value never. */
export const PUT = (req: Request, ctx: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const session = await requireAdmin(req);
    const { id } = await ctx.params;
    const input = await readJson(req, changeKeyInput);
    const { service } = managedProviders(providers);
    return Response.json({ provider: await guarded(() => service.changeKey(actorOf(session.account), id, input.credentials)) });
  });
