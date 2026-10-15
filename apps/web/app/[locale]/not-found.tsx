import { ErrorPage } from "@krizaka/ui/error-page";
import { Mascot } from "@krizaka/ui/mascots";
import Link from "next/link";

/** A page that does not exist (or that this person may not see): the same answer, in both languages. */
export default function NotFound() {
  return (
    <ErrorPage
      code="404"
      mascot={<Mascot bird="owl" mood="empty" size={96} />}
      title="Not found · Introuvable"
      text="This page does not exist, or is not yours. · Cette page n'existe pas, ou n'est pas à vous."
      actions={
        <Link href="/" className="font-semibold text-fg-accent underline">
          Yomizaka
        </Link>
      }
    />
  );
}
