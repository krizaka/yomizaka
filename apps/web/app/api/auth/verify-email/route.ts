import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { fieldText, handle } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { verifyEmail } from "@/lib/signup";

/** The link's button: a form POST (a mail scanner opening the link cannot spend the token). Answers a redirect to the sign-in page. */
export function POST(req: Request) {
  return handle(async () => {
    limit("verify-email", req, null, [30, 3600]);
    const form = await req.formData().catch(() => null);
    const token = fieldText(form, "token");
    const locale = form?.get("locale") === "en" ? "en" : "fr";
    const result = await verifyEmail({ query }, token, new Date());
    return Response.redirect(`${env().APP_PUBLIC_URL}/${locale}/sign-in?${result === "VERIFIED" ? "verified=1" : "verify=invalid"}`, 303);
  });
}
