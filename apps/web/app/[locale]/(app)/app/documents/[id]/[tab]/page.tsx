import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { storesOf } from "@/app/active-store";
import { DocumentView } from "@/components/console/DocumentView";
import { pageSession } from "@/lib/access";
import { isDocumentTab, movedDocumentHref, searchOf } from "@/lib/console-nav";
import { documentStorage, getDocument } from "@/lib/documents";
import { appEnvironment } from "@/lib/env";
import { availableFlows, offerFor } from "@/lib/flows";
import { HttpError } from "@/lib/http";
import { asLocale, getDictionary } from "@/lib/i18n";
import { withFeatures } from "@/lib/settings/boundary";
import { insightFeatures } from "@/lib/settings/guards";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.shell.document };
}

/** One document, one tab per route — another person's document is a 404, never a 403; an old tab address answers 308 to its tab; an unknown tab is a 404. */
export default async function DocumentTabPage({ params, searchParams }: { params: Promise<{ locale: string; id: string; tab: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale, id, tab } = await params;
  // An old tab address answers 308 to its tab with its query kept (`?refused=`, `?analysis=`), by the map's own keys only.
  const moved = movedDocumentHref(asLocale(locale), id, tab, searchOf(await searchParams));
  if (moved) permanentRedirect(moved);
  if (!isDocumentTab(tab)) notFound();
  const session = await pageSession();
  if (!session) notFound();
  const document = await getDocument(session.account.id, id).then(async (d) => ({ ...withFeatures(d, await insightFeatures(session.account.id)), ...(await documentStorage(session.account.id, id, (await storesOf(session.account.id)).describe)) })).catch((error: unknown) => {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  });
  if (!document) notFound();
  return <DocumentView initial={document} tab={tab} perspective={session.account.perspective} offer={offerFor(await availableFlows(appEnvironment()), session.account.perspective)} />;
}
