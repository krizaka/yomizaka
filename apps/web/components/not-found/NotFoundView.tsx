import { ErrorPage } from "@krizaka/ui/error-page";
import { Mascot } from "@krizaka/ui/mascots";

import { ButtonLink } from "@/components/ButtonLink";
import { getDictionary, type Locale } from "@/lib/i18n";

/** A page that does not exist: the code drawn, the owl « lost », one sentence and the way back, in the address's language. */
export function NotFoundView({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).notFound;
  return (
    <ErrorPage
      code="404"
      mascot={<Mascot bird="owl" mood="error" size={120} />}
      title={t.title}
      text={t.text}
      actions={
        <ButtonLink href={`/${locale}`} variant="primary" size="md" shape="cut">
          {t.home}
        </ButtonLink>
      }
    />
  );
}
