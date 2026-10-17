import type { Metadata } from "next";

import { LibraryView } from "@/components/console/LibraryView";
import { pageSession } from "@/lib/access";
import { listDocuments } from "@/lib/documents";
import { asLocale, getDictionary } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.library };
}

/** The library: the first list is read on the server, the rest is @krizaka/query. */
export default async function LibraryPage() {
  const session = await pageSession();
  const perspective = session?.account.perspective ?? null;
  return <LibraryView initial={session ? await listDocuments(session.account.id) : []} perspective={perspective} />;
}
