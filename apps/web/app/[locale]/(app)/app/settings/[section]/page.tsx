import { PageHeader } from "@krizaka/ui/page-header";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { accountService } from "@/app/accounts-edge";
import { BillingSection, DataSection, SecuritySection } from "@/components/console/AccountSettings";
import { AppearanceSection } from "@/components/console/AppearanceSection";
import { ProfileSection } from "@/components/console/ProfileSection";
import { SettingsShell } from "@/components/console/SettingsShell";
import { StorageSection } from "@/components/console/StorageSection";
import { pageSession } from "@/lib/access";
import { isSettingsSection, type SettingsSection } from "@/lib/console-nav";
import { query } from "@/lib/db";
import { appEnvironment } from "@/lib/env";
import { audiencesOf, availableFlows } from "@/lib/flows";
import { asLocale, getDictionary } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; section: string }> }): Promise<Metadata> {
  const { locale, section } = await params;
  const t = getDictionary(asLocale(locale)).console.settings;
  return { title: isSettingsSection(section) ? t.tabs[section] : t.label };
}

/** One section of the settings, one route: /app/settings/profil | securite | facturation | stockage | donnees — on `SettingsLayout`, the identity card on top (the UX review's Y2). */
export default async function SettingsSectionPage({ params, searchParams }: Readonly<{ params: Promise<{ locale: string; section: string }>; searchParams: Promise<{ email?: string }> }>) {
  const { locale: raw, section } = await params;
  if (!isSettingsSection(section)) notFound();
  const locale = asLocale(raw);
  const session = await pageSession();
  if (!session) notFound();
  const profile = await accountService().profile(session.account.id);
  const [facts] = await query<{ created_at: Date; email_verified_at: Date | null }>("SELECT created_at, email_verified_at FROM accounts WHERE id = $1", [session.account.id]);
  if (!facts) notFound();
  const email = (await searchParams).email;
  const audiences = audiencesOf(await availableFlows(appEnvironment()));
  const views: Record<SettingsSection, ReactNode> = {
    profil: <ProfileSection initial={{ name: profile.name ?? "", avatarSeed: profile.avatarSeed ?? "", locale: profile.locale, perspective: session.account.perspective }} audiences={audiences} />,
    apparence: <AppearanceSection />,
    securite: <SecuritySection email={profile.email} pendingEmail={profile.pendingEmail} notice={email === "changed" || email === "invalid" ? email : null} />,
    facturation: <BillingSection />,
    stockage: <StorageSection />,
    donnees: <DataSection />,
  };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={getDictionary(locale).console.profile.settingsTitle} />
      <SettingsShell section={section} account={{ email: profile.email, name: profile.name, avatarSeed: profile.avatarSeed, verified: facts.email_verified_at !== null, memberSince: facts.created_at.toISOString() }}>
        {views[section]}
      </SettingsShell>
    </div>
  );
}
