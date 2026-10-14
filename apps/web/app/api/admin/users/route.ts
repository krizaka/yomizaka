import { requireAdmin } from "@/lib/access";
import { listUsers } from "@/lib/accounts";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The accounts: an administrator, signed in, from an address of AUTH_ALLOWED_IPS — or 403. */
export function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    return Response.json({ users: await listUsers() });
  });
}
