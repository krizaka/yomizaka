import { isLinkToken } from "@krizaka/auth";
import { Alert } from "@krizaka/ui/alert";
import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/console/AuthShell";
import { ResetPasswordForm } from "@/components/console/ResetPasswordForm";
import { asLocale, getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** The link carries a secret: no referrer leaves this page, and no robot indexes it. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getDictionary(asLocale((await params).locale));
  return { title: t.console.resetPassword.title, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/** The mailed link lands here. Opening the page spends nothing (a mail scanner may open it): the password is set by the form's POST. */
export default async function ResetPasswordPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }>) {
  const locale = asLocale((await params).locale);
  const token = (await searchParams).token;
  const t = getDictionary(locale).console.resetPassword;
  const valid = isLinkToken("ye", token);
  return (
    <AuthShell
      locale={locale}
      promise={t.promise}
      title={valid ? t.title : t.invalidTitle}
      description={valid ? t.description : t.invalid}
      footer={
        <Link className="font-semibold text-fg-accent" href={`/${locale}/sign-in`}>
          {t.back}
        </Link>
      }
    >
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert tone="warning">
          <Link className="font-semibold underline" href={`/${locale}/forgot-password`}>
            {t.again}
          </Link>
        </Alert>
      )}
    </AuthShell>
  );
}
