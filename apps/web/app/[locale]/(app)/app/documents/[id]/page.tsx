import { redirect } from "next/navigation";

import { asLocale } from "@/lib/i18n";

/** A document opens on its information; each tab is its own route (/documents/[id]/infos|verifications|fichier|texte). */
export default async function DocumentIndex({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  redirect(`/${asLocale(locale)}/app/documents/${id}/infos`);
}
