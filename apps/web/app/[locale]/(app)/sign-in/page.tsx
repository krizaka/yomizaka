import { YomizakaLogo } from "@krizaka/ui";
import { AuthLayout } from "@krizaka/ui/auth-layout";
import { Mascot } from "@krizaka/ui/mascots";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/console/SignInForm";
import { pageSession } from "@/lib/access";
import { asLocale, getDictionary } from "@/lib/i18n";
import { contactHref, safeNext } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getDictionary(asLocale((await params).locale));
  return { title: t.console.meta.signIn, robots: { index: false, follow: false } };
}

/** Sign-in on @krizaka/ui's auth template, Yomizaka's mark and its owl. Sign-up is closed — the page says so. */
export default async function SignInPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const locale = asLocale((await params).locale);
  const next = safeNext((await searchParams).next, locale);
  if (await pageSession().catch(() => null)) redirect(next);
  const t = getDictionary(locale).console.signIn;
  return (
    <AuthLayout
      brand={
        <Link href={`/${locale}`} className="inline-flex items-center gap-2">
          <YomizakaLogo size={28} /> Yomizaka
        </Link>
      }
      promise={t.promise}
      aside={<Mascot bird="owl" mood="welcome" size={72} />}
      asideFooter={t.asideFooter}
      title={t.title}
      description={t.description}
      footer={
        <>
          <strong className="block font-semibold text-fg">{t.closedTitle}</strong>
          <span className="block">{t.closed}</span>{" "}
          <a className="font-semibold text-fg-accent" href={contactHref("yomizaka-sign-in")}>
            {t.contact}
          </a>
        </>
      }
      legal={
        <>
          {t.legalPrefix}
          <Link className="underline" href={`/${locale}/privacy`}>
            {t.privacy}
          </Link>
          .
        </>
      }
    >
      <SignInForm next={next} />
    </AuthLayout>
  );
}
