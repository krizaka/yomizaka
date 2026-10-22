import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PerspectiveChooser } from "@/components/console/PerspectiveChooser";
import { pageSession } from "@/lib/access";
import { appEnvironment } from "@/lib/env";
import { audiencesOf, availableFlows } from "@/lib/flows";
import { asLocale, getDictionary } from "@/lib/i18n";
import { welcomeTarget } from "@/lib/library-screen";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.shell.titles.welcome };
}

/** The one-time onboarding step: which side of the lease. Saved on selection, then the library; changeable later in settings. */
export default async function WelcomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const session = await pageSession();
  const done = welcomeTarget(session?.account.perspective ?? null);
  if (done) redirect(`/${locale}${done}`);
  return (
    <div className="mx-auto max-w-xl">
      <PerspectiveChooser current={null} audiences={audiencesOf(await availableFlows(appEnvironment()))} onboarding next={`/${locale}/app`} />
    </div>
  );
}
