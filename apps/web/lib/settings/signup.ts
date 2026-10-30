import { appSettings } from "./instance";

/**
 * Whether sign-up is open right now: the setting (its default is the legacy environment switch) AND the verification e-mail
 * can be sent — no mail, no accounts nobody can confirm. The server decides; a page only reflects it.
 */
export async function signupOpenNow(mail: {
  MAIL_PROVIDER?: string;
  MAIL_API_KEY?: string;
  MAIL_DOMAIN?: string;
}): Promise<boolean> {
  return (await appSettings().get("signup.open")) && !!mail.MAIL_PROVIDER && !!mail.MAIL_API_KEY && !!mail.MAIL_DOMAIN;
}
