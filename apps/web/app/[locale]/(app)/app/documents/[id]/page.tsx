import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocumentView } from "@/components/console/DocumentView";
import { pageSession } from "@/lib/access";
import { getDocument } from "@/lib/documents";
import { HttpError } from "@/lib/http";
import { asLocale, getDictionary } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.shell.document };
}

/** One document: its file and text, Orazaka's checks — another person's document is a 404, never a 403. */
export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await pageSession();
  if (!session) notFound();
  const document = await getDocument(session.account.id, (await params).id).catch((error: unknown) => {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  });
  if (!document) notFound();
  return <DocumentView initial={document} perspective={session.account.perspective} />;
}
