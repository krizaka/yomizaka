import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LibraryView } from "@/components/console/LibraryView";
import { SAMPLES } from "@/content/recorded-runs/samples.mjs";
import { pageSession } from "@/lib/access";
import { listChecks } from "@/lib/checks";
import { creditsOf } from "@/lib/credits";
import { query } from "@/lib/db";
import { appEnvironment } from "@/lib/env";
import { applicantFilesOffered, availableFlows, offerFor } from "@/lib/flows";
import { activityStrip, toDo } from "@/lib/home";
import { BINDER_KEY, stripOf } from "@/lib/home-b2";
import { HOME_PERIOD_KEY, homePeriodOf } from "@/lib/home-figures";
import { asLocale, getDictionary } from "@/lib/i18n";
import { onboardingTarget } from "@/lib/library-screen";
import * as org from "@/lib/organisation/store";
import { purgeExpired } from "@/lib/retention";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.library };
}

/** The library's first screen (ADR-0007, § 5.1): « À traiter », the latest checks, the activity of the period, the collections; read on the server. */
export default async function LibraryPage({ params, searchParams }: Readonly<{ params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const locale = asLocale((await params).locale);
  const search = await searchParams;
  const session = await pageSession();
  const onboarding = session ? onboardingTarget(session.account.perspective ?? null) : null;
  if (onboarding) redirect(`/${locale}${onboarding}`);
  const perspective = session?.account.perspective ?? null;
  const flows = await availableFlows(appEnvironment());
  const screeningOffered = !!session && applicantFilesOffered(flows, perspective);
  const owner = session?.account.id;
  if (!owner) return null;
  // The sweep: documents that were not kept and never checked are purged once their window has passed.
  await purgeExpired(query, new Date());
  await org.ensureLibrary(query, owner, getDictionary(locale).console.organisation.library);
  const period = homePeriodOf(typeof search[HOME_PERIOD_KEY] === "string" ? search[HOME_PERIOD_KEY] : null);
  const now = new Date();
  const [libraries, tags, latest, todo, series, credits] = await Promise.all([
    org.overview(query, owner),
    org.listTags(query, owner),
    listChecks(query, owner, 5),
    toDo(query, owner, now, { applicantFiles: screeningOffered }),
    activityStrip(query, owner, period, now, { applicantFiles: screeningOffered }),
    creditsOf(owner, now),
  ]);
  const documents = libraries.reduce((n, l) => n + l.collections.reduce((m, c) => m + c.files, 0), 0);
  return <LibraryView libraries={libraries} documents={documents} latest={latest} tags={tags} perspective={perspective} screening={screeningOffered} examples={SAMPLES} jurisdictions={offerFor(flows, perspective).jurisdictions} todo={todo} activity={series.checks} strip={stripOf(series)} credits={credits} period={period} chosen={typeof search[BINDER_KEY] === "string" ? search[BINDER_KEY] : null} now={now.toISOString()} />;
}
