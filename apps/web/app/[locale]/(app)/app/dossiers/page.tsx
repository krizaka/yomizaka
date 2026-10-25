import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FilesView } from "@/components/console/FilesView";
import { pageSession } from "@/lib/access";
import { documentTypes, listApplicantFiles } from "@/lib/applicant-file";
import { askableTypes } from "@/lib/applicant-file-face";
import { searchOf } from "@/lib/console-nav";
import { appEnvironment } from "@/lib/env";
import { applicantFilesOffered, availableFlows } from "@/lib/flows";
import { readFileStates } from "@/lib/home-figures";
import { asLocale, getDictionary } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.dossiers.title };
}

/** « Dossiers »: the applicant files of the account (filtered by the link's state with `?state=`) — only for the people offered the flow (the section map); otherwise a 404. */
export default async function FilesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const locale = asLocale((await params).locale);
  const session = await pageSession();
  if (!session) notFound();
  if (!applicantFilesOffered(await availableFlows(appEnvironment()), session.account.perspective ?? null)) notFound();
  const [files, types] = await Promise.all([listApplicantFiles(session.account.id, new Date()), documentTypes()]);
  return <FilesView files={files} states={readFileStates(searchOf(await searchParams))} types={askableTypes(getDictionary(locale).applicantFile.types, types)} origin={SITE_URL} />;
}
