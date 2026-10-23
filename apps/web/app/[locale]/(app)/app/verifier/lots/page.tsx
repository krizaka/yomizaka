import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BatchImport } from "@/components/console/BatchImport";
import { pageSession } from "@/lib/access";
import { asLocale, getDictionary } from "@/lib/i18n";
import { featureOn } from "@/lib/settings/guards";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.batch.title };
}

/** Check many documents at once from a CSV (yomizaka#232); off when the workspace switched batches off. */
export default async function BatchesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const session = await pageSession();
  if (!session || !(await featureOn("batches", session.account.id))) redirect(`/${locale}/app/verifier`);
  return <BatchImport />;
}
