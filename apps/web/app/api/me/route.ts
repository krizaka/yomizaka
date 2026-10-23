import { accountAct } from "@/lib/account/act";

export const dynamic = "force-dynamic";

/**
 * Who is signed in (yomizaka#243): the identity the public bar and the shell show — name, e-mail, the avatar's seed. No session,
 * 401 `UNAUTHENTICATED`. Read-only and never cached; the public pages stay static and ask this from the browser.
 */
export const GET = (req: Request) =>
  accountAct(req, "me", async (s) => ({ account: { email: s.account.email, name: s.account.name ?? null, avatarSeed: s.account.avatarSeed ?? null } }));
