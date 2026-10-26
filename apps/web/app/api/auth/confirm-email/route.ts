import { accountService } from "@/app/accounts-edge";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { fieldText, handle } from "@/lib/http";
import { asLocale } from "@/lib/i18n";
import { limit } from "@/lib/limits";

export const dynamic = "force-dynamic";

/** The mailed link's button (a form POST, so a mail scanner cannot spend the link): applies the change and goes to the security settings. */
export function POST(req: Request) {
  return handle(async () => {
    await limit("confirmEmail", req, null);
    const form = await req.formData().catch(() => null);
    const locale = asLocale(fieldText(form, "locale"));
    const result = await accountService().confirmEmailChange(fieldText(form, "token"), new Date());
    if (result === "CHANGED") await audit({ action: "profile.email_changed", actorId: null, actorLabel: "e-mail change link", headers: req.headers });
    return Response.redirect(`${env().APP_PUBLIC_URL}/${locale}/app/settings/securite?email=${result === "CHANGED" ? "changed" : "invalid"}`, 303);
  });
}
