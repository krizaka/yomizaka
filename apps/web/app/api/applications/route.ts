import { requireSession } from "@/lib/access";
import { listApplicantFiles, requestApplicantFile } from "@/lib/applicant-file";
import { applicantRequestBody } from "@/lib/applicant-file-face";
import { appEnvironment } from "@/lib/env";
import { resolveFlow } from "@/lib/flows";
import { handle, readJson } from "@/lib/http";
import { limit } from "@/lib/limits";

export const dynamic = "force-dynamic";

const FLOW = "tenant-screening";

/** The manager's applicant files, with the state of each link. Needs the flow enabled, as the screenings do. */
export function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    await resolveFlow(session.account, FLOW, appEnvironment());
    return Response.json(
      { applications: await listApplicantFiles(session.account.id, new Date()) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  });
}

/** Asks an applicant for their documents. Returns the link ONCE (only its hash is kept): the manager hands it over; no document goes by e-mail. */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    await limit("applicantFileRequest", req, session.account.id);
    await resolveFlow(session.account, FLOW, appEnvironment());
    // The form's body (lib/applicant-file-face); a SIN-like type is refused by the service with its own code (422 TYPE_NOT_NECESSARY).
    const input = await readJson(req, applicantRequestBody);
    const made = await requestApplicantFile(
      { id: session.account.id, email: session.account.email },
      input,
      new Date(),
      req.headers,
    );
    return Response.json(made, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}
