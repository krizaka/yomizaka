import { moveDeps, providers } from "@/app/storage-providers";
import { requireAdmin } from "@/lib/access";
import { handle, refuse } from "@/lib/http";
import { guarded, managedProviders } from "@/lib/storage/admin-api";
import { setMovePaused } from "@/lib/storage/provider-move";
import { actorOf } from "@/lib/storage/providers";

export const dynamic = "force-dynamic";

/** Resumes the open move of documents (audited); a resume also tries the failed objects again. */
export const POST = (req: Request) =>
  handle(async () => {
    const session = await requireAdmin(req);
    managedProviders(providers);
    const deps = moveDeps();
    if (!deps) throw refuse(503, "STORAGE_VAULT_MISSING", "Storing credentials is not available on this deployment");
    return Response.json({ move: await guarded(() => setMovePaused(deps, actorOf(session.account), false)) });
  });
