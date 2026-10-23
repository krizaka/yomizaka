import { z } from "zod";

import { requireAdmin } from "@/lib/access";
import { audit } from "@/lib/audit";
import { handle, readJson } from "@/lib/http";
import { readGlossary, saveGlossary } from "@/lib/translation/store";

export const dynamic = "force-dynamic";

/** The legal glossary the translation Studio is given (yomizaka#246): French term → its fixed English term, versioned. */
export function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    return Response.json(await readGlossary());
  });
}

const terms = z.object({ terms: z.array(z.object({ source: z.string().trim().min(1).max(200), target: z.string().trim().min(1).max(200) })).max(500) });

/** Replaces the glossary; the version goes up, so a report is translated again with the new terms the next time it is asked for. */
export function PUT(req: Request) {
  return handle(async () => {
    const session = await requireAdmin(req);
    const { terms: next } = await readJson(req, terms);
    const version = await saveGlossary(next);
    await audit({ action: "translation.glossary.saved", actorId: session.account.id, actorLabel: session.account.email, detail: { terms: next.length, version }, headers: req.headers });
    return Response.json({ version, terms: next });
  });
}
