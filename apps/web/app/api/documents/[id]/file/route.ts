import { requireSession } from "@/lib/access";
import { getFile } from "@/lib/documents";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The file as it was uploaded, to its owner only, shown inline (the viewer frames it), never cached by a proxy. */
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession(req);
    const file = await getFile(session.account.id, (await params).id);
    return new Response(new Uint8Array(file.content), {
      headers: {
        "Content-Type": file.mimeType === "text/plain" ? "text/plain; charset=utf-8" : file.mimeType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
