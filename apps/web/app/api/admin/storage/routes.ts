import { moveDeps, providers } from "@/app/storage-providers";
import { requireAdmin } from "@/lib/access";
import { handle, refuse } from "@/lib/http";
import { guarded, managedProviders } from "@/lib/storage/admin-api";
import { setMovePaused } from "@/lib/storage/provider-move";
import { actorOf } from "@/lib/storage/providers";

type Service = NonNullable<ReturnType<typeof providers>>["service"];
type Actor = ReturnType<typeof actorOf>;

/** The admin route that pauses (`true`) or resumes (`false`) the open move of documents, audited: one body for both. */
export const movePauseRoute = (paused: boolean) => (req: Request) =>
  handle(async () => {
    const session = await requireAdmin(req);
    managedProviders(providers);
    const deps = moveDeps();
    if (!deps) {throw refuse(503, "STORAGE_VAULT_MISSING", "Storing credentials is not available on this deployment");}
    return Response.json({ move: await guarded(() => setMovePaused(deps, actorOf(session.account), paused)) });
  });

/** An admin route that acts on one provider of the path, audited: its answer is the action's result, under `key` when given. */
export const providerActionRoute =
  (act: (service: Service, actor: Actor, id: string) => Promise<unknown>, key?: string) =>
  (req: Request, ctx: { params: Promise<{ id: string }> }) =>
    handle(async () => {
      const session = await requireAdmin(req);
      const { id } = await ctx.params;
      const { service } = managedProviders(providers);
      const result = await guarded(() => act(service, actorOf(session.account), id));
      return Response.json(key ? { [key]: result } : result);
    });
