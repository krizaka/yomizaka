import { redirect } from "next/navigation";

import { asLocale } from "@/lib/i18n";

/** The configuration opens on the general switches; every page of it is a route. */
export default async function ConfigIndex({ params }: { params: Promise<{ locale: string }> }) {
  redirect(`/${asLocale((await params).locale)}/config/general`);
}
