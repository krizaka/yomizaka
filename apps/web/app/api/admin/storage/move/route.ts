import { moveDeps, providers } from "@/app/storage-providers";
import { requireAdmin } from "@/lib/access";
import { handle, readJson, refuse } from "@/lib/http";
import { guarded, managedProviders, startMoveInput } from "@/lib/storage/admin-api";
import { startMove } from "@/lib/storage/provider-move";
import { actorOf } from "@/lib/storage/providers";

export const dynamic = "force-dynamic";

/** Starts the verified move of the documents from a retiring provider to the new default (ADR-005 §3). One move at a time; audited. The scheduler's tick does the work. */
export const POST = (req: Request) =>
  handle(async () => {
    const session = await requireAdmin(req);
    const input = await readJson(req, startMoveInput);
    managedProviders(providers);
    const deps = moveDeps();
    if (!deps) throw refuse(503, "STORAGE_VAULT_MISSING", "Storing credentials is not available on this deployment");
    return Response.json({ move: await guarded(() => startMove(deps, actorOf(session.account), input)) }, { status: 201 });
  });
