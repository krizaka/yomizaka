import { Page } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import Link from "next/link";

import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, getDictionary } from "@/lib/i18n";
import { pagePath } from "@/lib/site";

/** The two pages a mailed link lands on (confirm a new address, verify a sign-up): the action is a button (a POST), so a mail scanner cannot spend the link. */
export type EmailTokenKind = "confirmEmail" | "verifyEmail";

export async function EmailTokenPage({
  params,
  searchParams,
  kind,
  isToken,
  action,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
  kind: EmailTokenKind;
  isToken: (token: string | undefined) => boolean;
  action: string;
}) {
  const locale = asLocale((await params).locale);
  const token = (await searchParams).token;
  const t = getDictionary(locale);
  const v = t.console[kind];
  const valid = isToken(token);
  return (
    <>
      <SiteHeader locale={locale} current="home" />
      <main id="content" className="pt-20">
        <PageHero back={{ href: pagePath(locale, "home"), label: t.meta.siteName }} linkAs={Link} title={v.title} backdrop="plain" lead={valid ? v.lead : v.invalid} />
        <Page>
          {valid ? (
            <form method="post" action={action}>
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

export const emailTokenMetadata = async (params: Promise<{ locale: string }>, kind: EmailTokenKind) => ({
  title: getDictionary(asLocale((await params).locale)).console[kind].title,
  robots: { index: false, follow: false },
});
