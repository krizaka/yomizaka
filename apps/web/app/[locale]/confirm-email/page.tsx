import { Page } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { isEmailChangeToken } from "@/lib/account/postgres";
import { asLocale, getDictionary } from "@/lib/i18n";
import { pagePath } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.confirmEmail.title, robots: { index: false, follow: false } };
}

/** The mailed link lands here; the address is confirmed by a button (a POST), so a mail scanner cannot spend the link. */
export default async function ConfirmEmail({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }) {
  const locale = asLocale((await params).locale);
  const token = (await searchParams).token;
  const t = getDictionary(locale);
  const v = t.console.confirmEmail;
  return (
    <>
      <SiteHeader locale={locale} current="home" />
      <main id="content" className="pt-20">
        <PageHero back={{ href: pagePath(locale, "home"), label: t.meta.siteName }} linkAs={Link} title={v.title} backdrop="plain" lead={isEmailChangeToken(token) ? v.lead : v.invalid} />
        <Page>
          {isEmailChangeToken(token) ? (
            <form method="post" action="/api/auth/confirm-email">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="locale" value={locale} />
              <button type="submit" className="rounded-md bg-accent px-5 py-3 font-semibold text-on-accent">
                {v.button}
              </button>
            </form>
          ) : null}
        </Page>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
