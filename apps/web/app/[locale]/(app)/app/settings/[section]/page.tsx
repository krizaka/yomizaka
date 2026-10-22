import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { accountService } from "@/app/accounts-edge";
import { BillingSection, DataSection, ProfileSection, SecuritySection, SettingsShell } from "@/components/console/AccountSettings";
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
  const { section } = await params;
  if (!isSettingsSection(section)) notFound();
  const session = await pageSession();
  if (!session) notFound();
  const profile = await accountService().profile(session.account.id);
  const email = (await searchParams).email;
  const audiences = audiencesOf(await availableFlows(appEnvironment()));
  const views: Record<SettingsSection, () => ReactNode> = {
    profil: () => <ProfileSection email={profile.email} emailVerified={profile.emailVerified} name={profile.name} avatarSeed={profile.avatarSeed} locale={profile.locale} perspective={session.account.perspective} audiences={audiences} />,
    securite: () => <SecuritySection email={profile.email} pendingEmail={profile.pendingEmail} notice={email === "changed" || email === "invalid" ? email : null} />,
    facturation: () => <BillingSection />,
    stockage: () => <StorageSection />,
    donnees: () => <DataSection />,
  };
  return <SettingsShell>{views[section]()}</SettingsShell>;
}
