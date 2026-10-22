import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DocumentView } from "@/components/console/DocumentView";
import { pageSession } from "@/lib/access";
import { isDocumentTab } from "@/lib/console-nav";
import { getDocument } from "@/lib/documents";
import { appEnvironment } from "@/lib/env";
import { availableFlows, offerFor } from "@/lib/flows";
import { HttpError } from "@/lib/http";
import { asLocale, getDictionary } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.shell.document };
}

/** One document, one tab per route — another person's document is a 404, never a 403; an unknown tab is a 404. */
export default async function DocumentTabPage({ params }: { params: Promise<{ locale: string; id: string; tab: string }> }) {
  const { locale, id, tab } = await params;
  if (!isDocumentTab(tab)) notFound();
  const session = await pageSession();
  if (!session) notFound();
  const document = await getDocument(session.account.id, id).catch((error: unknown) => {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  });
  if (!document) notFound();
  // A text file has no file view: its « fichier » is the text.
  if (tab === "fichier" && document.mimeType !== "application/pdf") redirect(`/${asLocale(locale)}/app/documents/${id}/texte`);
  return <DocumentView initial={document} tab={tab} perspective={session.account.perspective} offer={offerFor(await availableFlows(appEnvironment()), session.account.perspective)} />;
}
