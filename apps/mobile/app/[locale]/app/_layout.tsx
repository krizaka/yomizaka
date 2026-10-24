import { TabBar } from "@krizaka/ui/native";
import { CheckIcon, KnowledgeIcon, SearchIcon, UsersIcon } from "@krizaka/icons/native";
import type { SectionId } from "@yomizaka/core";
import { Redirect, Tabs, useRouter } from "expo-router";

import { AUTH, useAuth } from "@/auth";
import { phoneTabs } from "@/domain/tabs";
import { useI18n } from "@/i18n";
import { useLocale } from "@/use-locale";

const ICONS: Record<SectionId, typeof KnowledgeIcon> = { library: KnowledgeIcon, files: UsersIcon, checks: CheckIcon, search: SearchIcon };

/**
 * The signed-in space: the tabs are the one section map (`phoneTabs`, yomizaka#319), each a route (the URL is the state).
 * « Vérifier un document » is the header's « + » and the settings are under the avatar: both stay routes, never tabs.
 * Signed out, the way is back to sign-in.
 */
export default function AppLayout() {
  const { t } = useI18n();
  const { status } = useAuth();
  const { locale } = useLocale();
  const router = useRouter();
  if (status === AUTH.signedOut) return <Redirect href="/sign-in" />;
  const tabs = phoneTabs(locale);
  const items = tabs.map((tab) => {
    const Icon = ICONS[tab.id];
    return { value: tab.screen, label: t(`sections.${tab.id}`), icon: (_on: boolean, color: string) => <Icon color={color} /> };
  });
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state }) => {
        const active = state.routes[state.index]?.name.split("/")[0] ?? "";
        return <TabBar aria-label={t("tabs.label")} items={items} value={active} onValueChange={(screen) => router.navigate(tabs.find((tab) => tab.screen === screen)?.href as never)} />;
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen key={tab.screen} name={tab.screen} />
      ))}
      <Tabs.Screen name="verifier" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="documents" />
    </Tabs>
  );
}
