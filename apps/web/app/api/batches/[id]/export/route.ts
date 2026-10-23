import { requireSession } from "@/lib/access";
import { batchView } from "@/lib/batch/run";
import { isUuid } from "@/lib/documents";
import { handle, refuse } from "@/lib/http";

export const dynamic = "force-dynamic";

const csvCell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The batch's results as CSV, one line per row of the CSV it came from: what each became, and its reason when it did not run. */
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession(req);
    const id = (await params).id;
    if (!isUuid(id)) throw refuse(404, "NOT_FOUND", "No such batch");
    const batch = await batchView(session.account.id, id);
    const lines = [["line", "file", "reference", "state", "reason", "document"].join(","), ...batch.items.map((i) => [i.line, i.file, i.reference, i.state, i.error, i.documentId].map(csvCell).join(","))];
    return new Response(`\uFEFF${lines.join("\r\n")}\r\n`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="lot-${id.slice(0, 8)}.csv"` } });
  });
}
