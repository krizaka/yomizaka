import { redirect } from "next/navigation";

import { asLocale } from "@/lib/i18n";

/** A document opens on its report; each tab is its own route (/documents/[id]/rapport|document|historique). */
export default async function DocumentIndex({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  redirect(`/${asLocale(locale)}/app/documents/${id}/rapport`);
}
