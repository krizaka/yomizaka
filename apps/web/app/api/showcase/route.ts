import { handle } from "@/lib/http";
import { limit } from "@/lib/limits";
import { getShowcase } from "@/lib/showcase";

export const dynamic = "force-dynamic";

/** The public showcase — the one check an administrator promoted on a sample document — or 404. Nothing else is ever listed. */
export function GET(req: Request) {
  return handle(async () => {
    await limit("showcase", req, null);
    const showcase = await getShowcase();
    if (!showcase)
      return Response.json(
        { error: "No showcase", code: "NOT_FOUND" },
        { status: 404, headers: { "Cache-Control": "public, max-age=60" } },
      );
    return Response.json({ showcase }, { headers: { "Cache-Control": "public, max-age=300" } });
  });
}
