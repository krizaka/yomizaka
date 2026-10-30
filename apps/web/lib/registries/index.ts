import type { Clock } from "@krizaka/api-keys";

import { type BusinessRegistry, closedRegistry, NOT_LOOKED_UP } from "./model";
import { revenuQuebecQstAdapter } from "./revenu-quebec-qst";

export * from "./model";
export { normaliseQstNumber } from "./qst-number";
export { revenuQuebecQstAdapter } from "./revenu-quebec-qst";
export { checkIssuer, registrantOfNeq, registrySignals } from "./signals";

/**
 * The registers Yomizaka reads. Revenu Québec's QST validation is open (public API, terms read). The CRA's GST/HST registry is never used
 * (its terms forbid commercial reproduction); the Registraire (REQ) has no adapter and answers « not authorised » until its written authorisation (yomizaka#627).
 */
export const registries = (
  clock: Clock,
): { qst: BusinessRegistry; gstHst: BusinessRegistry; req: BusinessRegistry } => ({
  qst: revenuQuebecQstAdapter({ now: clock.now }),
  gstHst: closedRegistry("CRA", NOT_LOOKED_UP.notCovered),
  req: closedRegistry("Registraire des entreprises", NOT_LOOKED_UP.notAuthorised),
});
