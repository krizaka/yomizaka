import { ErrorPage } from "@krizaka/ui/error-page";
import { Mascot } from "@krizaka/ui/mascots";
import { headers } from "next/headers";

import { ButtonLink } from "@/components/ButtonLink";
import { asLocale, getDictionary } from "@/lib/i18n";

/**
 * A page that does not exist (or is not this person's): the owl, one sentence, the ways back — in the language of the address
 * (`x-locale`, set by the proxy: a 404 has no route and no params), the UX review's Y10. Every language segment is routed here,
 * so this is the site's one 404.
 */
export default async function NotFound() {
  const locale = asLocale((await headers()).get("x-locale") ?? "");
  const t = getDictionary(locale).console.notFound;
  return (
    <ErrorPage
      code="404"
      mascot={<Mascot bird="owl" mood="empty" size={120} />}
      title={t.title}
      text={t.text}
      actions={
        <>
          <ButtonLink href={`/${locale}/app`} variant="primary" size="lg" shape="cut">
            {t.library}
          </ButtonLink>
          <ButtonLink href={`/${locale}`} variant="secondary" size="lg">
            {t.home}
          </ButtonLink>
        </>
      }
      data-testid="not-found"
    />
  );
}
