import type { DocumentStatus } from "@yomizaka/core";

/* Pure and client-safe (no database, no node modules): the Vérifications view reads it too. */

/** The checks still running: the page refreshes them from Orazaka before listing; the view asks again while one runs. */
export const runningChecks = <T extends { result: DocumentStatus }>(checks: readonly T[]): T[] => checks.filter((c) => c.result === "analysing");
