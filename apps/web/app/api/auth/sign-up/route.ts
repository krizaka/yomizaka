import { query } from "@/lib/db";
import { env, signupOpen } from "@/lib/env";
import { handle, readJson, refuse } from "@/lib/http";
import { mailerFor } from "@/lib/mailer";
import { limit } from "@/lib/rate-limit";
import { signUp, signUpBody } from "@/lib/signup";

/**
 * Sign-up, for Yomizaka only. Closed unless `AUTH_SIGNUP_ENABLED=true` AND the verification e-mail can be sent (the refusal
 * is the server's, whatever a page shows). The answer is the same whether or not the address already has an account.
 * Abuse limits: 5 sign-ups per hour per address of the client, 3 per hour per e-mail address.
 */
export function POST(req: Request) {
  return handle(async () => {
    if (!signupOpen()) throw refuse(403, "SIGNUP_CLOSED", "Sign-up is closed");
    const input = await readJson(req, signUpBody);
    limit("sign-up", req, input.email, [5, 3600], [3, 3600]);
    const e = env();
    await signUp({ query, mail: mailerFor(e), baseUrl: e.APP_PUBLIC_URL }, input, new Date());
    return Response.json({ ok: true }, { status: 202 });
  });
}
