import { providers, storageRuntime } from "@/app/storage-providers";
import { requireAdmin } from "@/lib/access";
import { env } from "@/lib/env";
import { handle, readJson } from "@/lib/http";
import { addProvider, adminKinds, createProviderInput, guarded, managedProviders, overview } from "@/lib/storage/admin-api";
import { actorOf, ORG_SCOPE } from "@/lib/storage/providers";

export const dynamic = "force-dynamic";

/** The storage providers of this deployment (ADR-005, `storage.manage`: administrators only). Every secret reads `set` or `not set`, never a value. */
export const GET = (req: Request) =>
  handle(async () => {
    await requireAdmin(req);
    const { service, store } = managedProviders(providers);
    return Response.json(await guarded(() => overview(service, () => store.defaults(ORG_SCOPE), adminKinds(storageRuntime(), env().APP_ENVIRONMENT))), { headers: { "Cache-Control": "private, no-store" } });
  });

/** Adds a provider (a draft), tests it at once and audits it; the answer carries no secret. */
export const POST = (req: Request) =>
  handle(async () => {
    const session = await requireAdmin(req);
    const input = await readJson(req, createProviderInput);
    const { service } = managedProviders(providers);
    return Response.json({ provider: await addProvider(service, actorOf(session.account), input) }, { status: 201 });
  });
