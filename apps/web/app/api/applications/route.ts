import { z } from "zod";

import { requireSession } from "@/lib/access";
import { listApplicantFiles, requestApplicantFile } from "@/lib/applicant-file";
import { appEnvironment } from "@/lib/env";
import { resolveFlow } from "@/lib/flows";
import { handle, readJson } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const FLOW = "tenant-screening";

/** The manager's applicant files, with the state of each link. Needs the flow enabled, as the screenings do. */
export function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    await resolveFlow(session.account, FLOW, appEnvironment());
    return Response.json({ applications: await listApplicantFiles(session.account.id, new Date()) }, { headers: { "Cache-Control": "private, no-store" } });
  });
}

/** Asks an applicant for their documents. Returns the link ONCE (only its hash is kept): the manager hands it over; no document goes by e-mail. */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    limit("applicant-file-request", req, session.account.id, [30, 3600], [20, 3600]);
    await resolveFlow(session.account, FLOW, appEnvironment());
    const input = await readJson(
      req,
      z.object({
        candidateName: z.string().trim().min(1).max(120),
        candidateEmail: z.string().trim().toLowerCase().email().max(254),
        types: z.array(z.string().min(2).max(40)).min(1).max(10),
      }),
    );
    const made = await requestApplicantFile({ id: session.account.id, email: session.account.email }, input, new Date(), req.headers);
    return Response.json(made, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}
