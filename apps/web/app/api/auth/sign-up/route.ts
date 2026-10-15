import { signupEnabled } from "@/lib/env";
import { handle, refuse } from "@/lib/http";

/**
 * Sign-up. Closed on every deployment so far (`AUTH_SIGNUP_ENABLED` is not `true`): only the accounts an operator
 * creates can sign in. The refusal is the server's, whatever a page shows. When it opens, this is where it will live.
 */
export function POST() {
  return handle(async () => {
    if (!signupEnabled()) throw refuse(403, "SIGNUP_CLOSED", "Sign-up is closed");
    throw refuse(501, "NOT_IMPLEMENTED", "Sign-up is not built yet");
  });
}
