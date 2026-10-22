import { activeStore } from "@/app/active-store";
import { accountAct } from "@/lib/account/act";
import { exportData } from "@/lib/account/data";
import { audit } from "@/lib/audit";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** « Export my data » (Loi 25, access): everything the person has with Yomizaka, as one JSON file to download. */
export const GET = (req: Request) => accountAct(req, "export", async (s) => {
  const data = await exportData(query, s.account.id, activeStore(), new Date());
  await audit({ action: "profile.data_exported", actorId: s.account.id, actorLabel: s.account.email, targetId: s.account.id, headers: req.headers });
  return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="yomizaka-mes-donnees.json"`, "Cache-Control": "private, no-store" } });
});
