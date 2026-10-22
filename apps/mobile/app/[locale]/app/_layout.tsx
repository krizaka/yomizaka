import { TabBar } from "@krizaka/ui/native";
import { KnowledgeIcon, SettingsIcon, ShieldIcon } from "@krizaka/icons/native";
import { Redirect, Tabs, useRouter } from "expo-router";

import { AUTH, useAuth } from "@/auth";
import { routes } from "@/domain/links";
import { useI18n } from "@/i18n";
import { useLocale } from "@/use-locale";

type TabName = "verifier" | "bibliotheque" | "settings";

/** The signed-in space: three tabs, each a route (the URL is the state); signed out, the way is back to sign-in. */
export default function AppLayout() {
  const { t } = useI18n();
  const { status } = useAuth();
  const { locale } = useLocale();
  const router = useRouter();
  if (status === AUTH.signedOut) return <Redirect href="/sign-in" />;
  const items = [
    { value: "verifier", label: t("tabs.verify"), icon: (_on: boolean, color: string) => <ShieldIcon color={color} /> },
    { value: "bibliotheque", label: t("tabs.library"), icon: (_on: boolean, color: string) => <KnowledgeIcon color={color} /> },
    { value: "settings", label: t("tabs.settings"), icon: (_on: boolean, color: string) => <SettingsIcon color={color} /> },
  ] as const;
  const hrefs: Record<TabName, string> = { verifier: routes.verify(locale), bibliotheque: routes.library(locale), settings: routes.settings(locale) };
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state }) => {
        const active = state.routes[state.index]?.name.split("/")[0] as TabName;
        return <TabBar aria-label={t("tabs.label")} items={items} value={active} onValueChange={(name) => router.navigate(hrefs[name] as never)} />;
      }}
    >
      <Tabs.Screen name="verifier" />
      <Tabs.Screen name="bibliotheque" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="documents" />
    </Tabs>
  );
}
