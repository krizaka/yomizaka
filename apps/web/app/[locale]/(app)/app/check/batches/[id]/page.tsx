import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BatchProgress } from "@/components/console/BatchProgress";
import { pageSession } from "@/lib/access";
import { advanceBatch } from "@/lib/batch/run";
import { isUuid } from "@/lib/documents";
import { appEnvironment } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { asLocale, getDictionary } from "@/lib/i18n";
import { settingsFor } from "@/lib/settings/guards";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.batch.title };
}

/** A batch, read (and advanced) on the server, then followed live by its page. */
export default async function BatchPage({ params }: Readonly<{ params: Promise<{ locale: string; id: string }> }>) {
  const { locale: raw, id } = await params;
  const locale = asLocale(raw);
  const session = await pageSession();
  if (!session) redirect(`/${locale}/sign-in`);
  if (!isUuid(id)) notFound();
  const batch = await advanceBatch(session.account, id, {
    settings: await settingsFor(session.account.id),
    now: new Date(),
    environment: appEnvironment(),
  }).catch((error: unknown) => {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  });
  return <BatchProgress initial={batch} />;
}
