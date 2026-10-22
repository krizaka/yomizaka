import { avatarStore } from "@/app/active-store";
import { accountAct } from "@/lib/account/act";
import { clientConfigOf } from "@/lib/settings/boundary";
import { settingsFor } from "@/lib/settings/guards";

export const dynamic = "force-dynamic";

/** What the browser needs of the configuration for this person: their limits, the features they get, the payment display. */
export const GET = (req: Request) => accountAct(req, "app-config", async (s) => {
  const config = clientConfigOf(await settingsFor(s.account.id));
  // An uploaded avatar needs a store behind it (Bunny in development, a Canadian bucket later): the server knows, the browser only reflects.
  return { config: { ...config, avatars: { ...config.avatars, canUpload: avatarStore() !== null } } };
});
