import { type Audience } from "@yomizaka/core";

import { CONSOLE_ROUTES } from "./console-nav";

/** The one-time onboarding step (which side of the lease): its own route, shown until a role is chosen, never on the library. */
export const WELCOME_ROUTE = "/app/welcome";

/** Where the library sends a person who has not chosen a role yet. */
export const onboardingTarget = (perspective: Audience | null): string | null =>
  perspective === null ? WELCOME_ROUTE : null;

/** Where the welcome page sends a person who already has a role. */
export const welcomeTarget = (perspective: Audience | null): string | null =>
  perspective === null ? null : CONSOLE_ROUTES.library;

/** What the library first screen shows: one primary action, an optional secondary one (offered to the role), the table only with files. */
export function libraryScreen({ documents, screening }: { documents: number; screening: boolean }) {
  return {
    primary: CONSOLE_ROUTES.check,
    secondary: screening ? "/app/screening" : null,
    table: documents > 0,
    emptyDropzone: documents === 0,
  };
}
