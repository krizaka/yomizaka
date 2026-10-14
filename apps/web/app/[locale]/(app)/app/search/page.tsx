import type { Metadata } from "next";

import { SearchView } from "@/components/console/SearchView";
import { asLocale, getDictionary } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.search };
}

/** Search: the query is in the address (`?q=`), so a search is a link. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return <SearchView initialQuery={(await searchParams).q ?? ""} />;
}
