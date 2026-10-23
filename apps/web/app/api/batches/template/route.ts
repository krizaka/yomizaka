import { BATCH_TEMPLATE } from "@yomizaka/core";

export const dynamic = "force-static";

/** The CSV template of a batch (yomizaka#232): the header and two example rows. A BOM, so Excel reads the accents. */
export function GET() {
  return new Response(`\uFEFF${BATCH_TEMPLATE}\r\n`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="yomizaka-lot-modele.csv"' } });
}
