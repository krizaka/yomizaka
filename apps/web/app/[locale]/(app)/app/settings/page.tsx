import { redirect } from "next/navigation";

import { asLocale } from "@/lib/i18n";

/** The settings open on the profile; each section is its own route. */
export default async function SettingsIndex({ params }: { params: Promise<{ locale: string }> }) {
  redirect(`/${asLocale((await params).locale)}/app/settings/profil`);
}
