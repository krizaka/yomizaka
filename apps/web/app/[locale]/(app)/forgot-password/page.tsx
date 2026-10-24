import { Alert } from "@krizaka/ui/alert";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { mailConfigured } from "@/app/accounts-edge";
import { AuthShell } from "@/components/console/AuthShell";
import { ForgotPasswordForm } from "@/components/console/ForgotPasswordForm";
import { pageSession } from "@/lib/access";
import { asLocale, getDictionary } from "@/lib/i18n";
import { resetLinkMinutes } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getDictionary(asLocale((await params).locale));
  return { title: t.console.forgotPassword.title, robots: { index: false, follow: false } };
}

/** « Forgot your password? » on the sign-in family's frame. The page only reflects the server: without e-mail it says a link cannot be sent. */
export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  if (await pageSession().catch(() => null)) redirect(`/${locale}/app`);
  const t = getDictionary(locale).console.forgotPassword;
  const on = mailConfigured();
  return (
    <AuthShell
      locale={locale}
      promise={t.promise}
      title={t.title}
      description={t.description}
      footer={
        <Link className="font-semibold text-fg-accent" href={`/${locale}/sign-in`}>
          {t.back}
        </Link>
      }
    >
      {on ? <ForgotPasswordForm minutes={await resetLinkMinutes()} /> : <Alert tone="warning">{t.mailOff}</Alert>}
    </AuthShell>
  );
}
