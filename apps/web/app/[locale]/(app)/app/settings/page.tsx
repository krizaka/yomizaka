import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PerspectiveChooser } from "@/components/console/PerspectiveChooser";
import { pageSession } from "@/lib/access";
import { asLocale, getDictionary } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.profile.settingsTitle };
}

/** Settings: the side of the lease (changeable at any time). */
export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const session = await pageSession();
  if (!session) notFound();
  const t = getDictionary(locale).console.profile;
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="font-display text-xl font-bold text-fg">{t.settingsTitle}</h1>
        <p className="text-sm text-fg-secondary">{t.settingsLead}</p>
      </div>
      <PerspectiveChooser current={session.account.perspective} />
    </div>
  );
}
