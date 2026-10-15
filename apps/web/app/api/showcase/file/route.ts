import { handle, refuse } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { showcaseFile } from "@/lib/showcase";

export const dynamic = "force-dynamic";

/** The showcase's sample document, as uploaded — only the sample of the promoted check, never another file. */
export function GET(req: Request) {
  return handle(async () => {
    limit("showcase-file", req, null, [60, 3600]);
    const file = await showcaseFile();
    if (!file) throw refuse(404, "NOT_FOUND", "No showcase");
    return new Response(new Uint8Array(file.content), {
      headers: {
        "Content-Type": file.mimeType === "text/plain" ? "text/plain; charset=utf-8" : file.mimeType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
