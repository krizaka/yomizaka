import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { accountService } from "@/app/accounts-edge";
import { BillingSection, DataSection, ProfileSection, SecuritySection, SettingsTabs } from "@/components/console/AccountSettings";
import { PerspectiveChooser } from "@/components/console/PerspectiveChooser";
import { StorageSection } from "@/components/console/StorageSection";
import { pageSession } from "@/lib/access";
import { isSettingsSection, type SettingsSection } from "@/lib/console-nav";
import { appEnvironment } from "@/lib/env";
import { audiencesOf, availableFlows } from "@/lib/flows";
import { asLocale, getDictionary } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; section: string }> }): Promise<Metadata> {
  const { locale, section } = await params;
  const t = getDictionary(asLocale(locale)).console.settings;
  return { title: isSettingsSection(section) ? t.tabs[section] : t.label };
}

/** One section of the settings, one route: /app/settings/profil | securite | facturation | donnees. */
export default async function SettingsSectionPage({ params, searchParams }: { params: Promise<{ locale: string; section: string }>; searchParams: Promise<{ email?: string }> }) {
  const { locale: raw, section } = await params;
  if (!isSettingsSection(section)) notFound();
  const locale = asLocale(raw);
  const session = await pageSession();
  if (!session) notFound();
  const profile = await accountService().profile(session.account.id);
  const email = (await searchParams).email;
  const audiences = audiencesOf(await availableFlows(appEnvironment()));
  const views: Record<SettingsSection, () => ReactNode> = {
    profil: () => (
      <ProfileSection email={profile.email} name={profile.name} avatarSeed={profile.avatarSeed} locale={profile.locale}>
        <PerspectiveChooser current={session.account.perspective} audiences={audiences} />
      </ProfileSection>
    ),
    securite: () => <SecuritySection email={profile.email} pendingEmail={profile.pendingEmail} notice={email === "changed" || email === "invalid" ? email : null} />,
    facturation: () => <BillingSection />,
    stockage: () => <StorageSection />,
    donnees: () => <DataSection />,
  };
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-bold text-fg">{getDictionary(locale).console.profile.settingsTitle}</h1>
      <SettingsTabs>{views[section]()}</SettingsTabs>
    </div>
  );
}
