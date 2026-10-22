import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LibraryView } from "@/components/console/LibraryView";
import { SAMPLES } from "@/content/recorded-runs/samples.mjs";
import { pageSession } from "@/lib/access";
import { listDocuments } from "@/lib/documents";
import { appEnvironment } from "@/lib/env";
import { availableFlows, flowsFor } from "@/lib/flows";
import { asLocale, getDictionary } from "@/lib/i18n";
import { onboardingTarget } from "@/lib/library-screen";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.library };
}

/** The library: the first list is read on the server, the rest is @krizaka/query. */
export default async function LibraryPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const session = await pageSession();
  const onboarding = session ? onboardingTarget(session.account.perspective ?? null) : null;
  if (onboarding) redirect(`/${locale}${onboarding}`);
  const perspective = session?.account.perspective ?? null;
  const screeningOffered = !!session && (await availableFlows(appEnvironment())).some((f) => f.key === "tenant-screening" && flowsFor([f], perspective).length > 0);
  return <LibraryView initial={session ? await listDocuments(session.account.id) : []} perspective={perspective} screening={screeningOffered} examples={SAMPLES} />;
}
