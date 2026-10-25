import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FileView } from "@/components/console/FileView";
import { pageSession } from "@/lib/access";
import { applicantFileOf, documentTypes } from "@/lib/applicant-file";
import { askableTypes } from "@/lib/applicant-file-face";
import { appEnvironment } from "@/lib/env";
import { applicantFilesOffered, availableFlows } from "@/lib/flows";
import { HttpError } from "@/lib/http";
import { asLocale, getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.dossiers.title };
}

/** One applicant file — another account's file is a 404, never a 403. */
export default async function FilePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = asLocale(raw);
  const session = await pageSession();
  if (!session) notFound();
  if (!applicantFilesOffered(await availableFlows(appEnvironment()), session.account.perspective ?? null)) notFound();
  const file = await applicantFileOf(session.account.id, id, new Date()).catch((error: unknown) => {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  });
  if (!file) notFound();
  return <FileView file={file} types={askableTypes(getDictionary(locale).applicantFile.types, await documentTypes())} />;
}
