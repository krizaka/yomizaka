import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AllDocuments } from "@/components/console/AllDocuments";
import { pageSession } from "@/lib/access";
import { query } from "@/lib/db";
import { documentsByIds } from "@/lib/documents";
import { asLocale, getDictionary } from "@/lib/i18n";
import { recentIds } from "@/lib/organisation/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.documents };
}

// @fixed: the most the page loads at once; the table pages and filters them on the client, and ⌘K reaches the rest.
const MOST_DOCUMENTS = 500;

/** « Documents » (B2, P14): every document of the account, newest first, whatever its collection — the library's « Tous les documents » view. */
export default async function DocumentsPage() {
  const session = await pageSession();
  if (!session) notFound();
  const owner = session.account.id;
  return <AllDocuments documents={await documentsByIds(owner, await recentIds(query, owner, MOST_DOCUMENTS))} />;
}
