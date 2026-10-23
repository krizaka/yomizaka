import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChecksView } from "@/components/console/ChecksView";
import { pageSession } from "@/lib/access";
import { listChecks } from "@/lib/checks";
import { query } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";
import { featureOn } from "@/lib/settings/guards";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.shell.titles.checks };
}

/** Vérifications: every check of the account, newest first — and the batches under `?tab=lots` when the workspace has them. */
export default async function ChecksPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const session = await pageSession();
  if (!session) redirect(`/${locale}/sign-in`);
  const [checks, batches] = await Promise.all([listChecks(query, session.account.id), featureOn("batches", session.account.id)]);
  return <ChecksView checks={checks} batches={batches} />;
}
