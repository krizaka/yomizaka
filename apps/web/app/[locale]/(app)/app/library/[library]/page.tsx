import { redirect } from "next/navigation";

import { asLocale } from "@/lib/i18n";

/** A library opens on the library page, which lists its collections. */
export default async function LibraryRedirect({ params }: { params: Promise<{ locale: string }> }) {
  redirect(`/${asLocale((await params).locale)}/app`);
}
