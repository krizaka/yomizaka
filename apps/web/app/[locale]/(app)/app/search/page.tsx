import { redirect } from "next/navigation";

import { asLocale } from "@/lib/i18n";

/** The old address of the search: it lives at /recherche now (the query travels with it). */
export default async function OldSearch({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }) {
  const locale = asLocale((await params).locale);
  const q = (await searchParams).q;
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  redirect(`/${locale}/app/recherche${query}`);
}
