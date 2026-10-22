import { requireAdmin } from "@/lib/access";
import { handle } from "@/lib/http";
import { appSettings } from "@/lib/settings/instance";

export const dynamic = "force-dynamic";

/** Who changed what and when, with the value before and after (newest first; `?key=` narrows it to one setting). */
export const GET = (req: Request) =>
  handle(async () => {
    await requireAdmin(req);
    const key = new URL(req.url).searchParams.get("key") ?? undefined;
    return Response.json({ history: await appSettings().history({ key, limit: 100 }) }, { headers: { "Cache-Control": "private, no-store" } });
  });
