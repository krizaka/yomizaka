/** The mail settings, passed in by the edge that read them (lib/env.ts). */
export interface MailConfig {
  MAIL_PROVIDER?: string;
  MAIL_API_KEY?: string;
  MAIL_DOMAIN?: string;
  MAIL_API_URL: string;
  MAIL_FROM?: string;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
}
export type Mailer = (mail: Mail) => Promise<void>;

/** Mailgun's HTTP API (the vendor is the value of MAIL_PROVIDER). A failure throws: sign-up must not pretend a mail left. */
export const mailerFor = (e: MailConfig): Mailer => async (mail) => {
  if (e.MAIL_PROVIDER !== "mailgun" || !e.MAIL_API_KEY || !e.MAIL_DOMAIN) throw new Error("Mail is not configured");
  const body = new URLSearchParams({ from: e.MAIL_FROM ?? `Yomizaka <no-reply@${e.MAIL_DOMAIN}>`, to: mail.to, subject: mail.subject, text: mail.text });
  const res = await fetch(`${e.MAIL_API_URL.replace(/\/$/, "")}/v3/${e.MAIL_DOMAIN}/messages`, {
    method: "POST",
    headers: { authorization: `Basic ${Buffer.from(`api:${e.MAIL_API_KEY}`).toString("base64")}` },
    body,
  });
  if (!res.ok) throw new Error(`Mail provider answered ${res.status}`);
};
