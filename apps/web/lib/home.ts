import { subDays } from "date-fns";

import { listApplicantFiles } from "./applicant-file";
import { LINK } from "./applicant-file-rules";
import { type ActivityDay, activityOf, type HomePeriod, PERIOD_DAYS, type ToDo } from "./home-figures";
import type { Query } from "./organisation/store";

/*
 * The home's queries (yomizaka#325, P8): « À traiter » and the activity of a period, each figure counted by a query over
 * the same rows its view lists, never a counter kept aside.
 */

// The checks « to look at »: the rows Vérifications shows under `result=attention,failed` (lib/documents `documentStatus`).
const TO_REVIEW = `SELECT count(*)::int AS n
     FROM analyses a JOIN documents d ON d.id = a.document_id
    WHERE d.owner_id = $1
      AND (a.status IN ('failed', 'cancelled') OR (a.status = 'succeeded' AND coalesce((a.report->>'attention')::boolean, false)))`;

// A day more than the period, so the oldest day is whole in Québec; activityOf keeps the period's days only.
const SLACK_DAYS = 1;

/** « À traiter »: the checks to look at, and — with the applicant-file flow — the files to decide and the open links. */
export async function toDo(q: Query, owner: string, now: Date, { applicantFiles }: { applicantFiles: boolean }): Promise<ToDo> {
  const [[review], files] = await Promise.all([q<{ n: number }>(TO_REVIEW, [owner]), applicantFiles ? listApplicantFiles(owner, now) : Promise.resolve(null)]);
  if (!files) return { toReview: review?.n ?? 0, toDecide: null, openLinks: null, nextExpiry: null };
  const open = files.filter((f) => f.status === LINK.open);
  return {
    toReview: review?.n ?? 0,
    toDecide: files.filter((f) => f.status === LINK.used).length,
    openLinks: open.length,
    nextExpiry: open.map((f) => f.expiresAt).sort()[0] ?? null,
  };
}

/** The checks of each day of the period, from the moments they ended (or started, while they run). */
export async function activity(q: Query, owner: string, period: HomePeriod, now: Date): Promise<ActivityDay[]> {
  const rows = await q<{ at: Date }>(
    `SELECT coalesce(a.finished_at, a.created_at) AS at
       FROM analyses a JOIN documents d ON d.id = a.document_id
      WHERE d.owner_id = $1 AND coalesce(a.finished_at, a.created_at) >= $2`,
    [owner, subDays(now, PERIOD_DAYS[period] + SLACK_DAYS)],
  );
  return activityOf(rows.map((r) => r.at), period, now);
}
