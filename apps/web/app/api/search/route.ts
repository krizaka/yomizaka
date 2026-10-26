import { requireSession } from "@/lib/access";
import { handle } from "@/lib/http";
import { limit } from "@/lib/limits";
import { search } from "@/lib/search";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    await limit("search", req, session.account.id);
    const q = new URL(req.url).searchParams.get("q") ?? "";
    return Response.json({ hits: await search(session.account.id, q) });
  });
}
