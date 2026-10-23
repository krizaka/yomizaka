import { BatchIcon, DebriefIcon, HomeIcon, LogoutIcon, SettingsIcon } from "@krizaka/icons";
import { useQuery } from "@krizaka/query";
import { YomizakaLogo } from "@krizaka/ui";
import { AccountMenu } from "@krizaka/ui/account-menu";
import { AppShell } from "@krizaka/ui/app-shell";
import { ThemeToggle } from "@krizaka/ui/theme";
import { useCallback, useEffect, useState } from "react";

import { BatchesView, BatchView } from "./components/Batches";
import { CheckView } from "./components/CheckView";
import { Library } from "./components/Library";
import { DocumentView, ReportsView } from "./components/Reports";
import { Settings } from "./components/Settings";
import { SignIn } from "./components/SignIn";
import { I18nProvider, type Locale, LOCALES, currentLocale, rememberLocale, useI18n } from "./i18n";
import { APP_VERSION, queries, yomizaka } from "./lib/config";
import { bridge, folders, followLinks, setNativeMenu } from "./lib/desktop";
import { MENU_IDS, menuSpec, SHORTCUTS } from "./lib/menu";
import { hashOf, type Route, routeOfLink, sectionOf } from "./lib/route";
import { AUTH, useAuth } from "./lib/use-auth";
import { useRoute } from "./lib/use-route";

export function App() {
  const [locale, setLocale] = useState<Locale>(currentLocale());
  const choose = useCallback((next: Locale) => {
    rememberLocale(next);
    setLocale(next);
  }, []);
  return (
    <I18nProvider locale={locale} setLocale={choose}>
      <Gate onLocale={choose} />
    </I18nProvider>
  );
}

const LANGUAGE_NAMES: Record<Locale, string> = { fr: "Français", en: "English" };

/**
 * Signed out, the sign-in; signed in, the window (krizaka-ui ADR-002: `AppShell desktop`, its header and sidebar are the
 * title bar). The signed-in account is always in the header (Oussama's decision, 2026-10-23). The screen is the hash; the
 * native menu and `yomizaka://` links move it too.
 */
function Gate({ onLocale }: { onLocale: (locale: Locale) => void }) {
  const { t, messages, locale } = useI18n();
  const status = useAuth();
  const [route, go] = useRoute();

  const addFolder = useCallback(
    () =>
      void folders.grant().then((granted) => {
        if (granted) go({ screen: "library", folder: granted });
      }),
    [go],
  );
  useEffect(() => {
    if (status !== AUTH.signedIn) return;
    const handlers = {
      [MENU_IDS.addFolder]: addFolder,
      [MENU_IDS.library]: () => go({ screen: "library", folder: null }),
      [MENU_IDS.batches]: () => go({ screen: "batches" }),
      [MENU_IDS.reports]: () => go({ screen: "reports" }),
      [MENU_IDS.settings]: () => go({ screen: "settings" }),
    };
    const stops = [setNativeMenu(bridge, menuSpec(messages), handlers), followLinks(bridge, (link) => go(routeOfLink(link)))];
    return () => void Promise.all(stops).then((all) => all.forEach((stop) => stop()));
  }, [status, messages, addFolder, go]);

  if (status === AUTH.loading) return null;
  if (status === AUTH.signedOut) return <SignIn />;
  const section = sectionOf(route);
  const item = (to: Route, current: boolean) => ({ href: hashOf(to), current });
  return (
    <AppShell.Root desktop skipLabel={t("shell.skip")} collapseShortcut={false}>
      <AppShell.Sidebar
        label={t("nav.label")}
        brand={
          <>
            <YomizakaLogo size={22} animated={false} /> {t("app.name")}
          </>
        }
        collapseLabels={[t("shell.collapse"), t("shell.expand")]}
        closeLabel={t("shell.close")}
        footer={<AppShell.Item icon={<SettingsIcon size={16} />} label={t("nav.settings")} {...item({ screen: "settings" }, section === "settings")} />}
      >
        <AppShell.Item icon={<HomeIcon size={16} />} label={t("nav.library")} shortcut={SHORTCUTS.library} {...item({ screen: "library", folder: null }, section === "library")} />
        <AppShell.Item icon={<BatchIcon size={16} />} label={t("nav.batches")} shortcut={SHORTCUTS.batches} {...item({ screen: "batches" }, section === "batches")} />
        <AppShell.Item icon={<DebriefIcon size={16} />} label={t("nav.reports")} shortcut={SHORTCUTS.reports} {...item({ screen: "reports" }, section === "reports")} />
      </AppShell.Sidebar>
      <AppShell.Body>
        <AppShell.Header title={t(`nav.${section}`)} menuLabel={t("shell.menu")} actions={<Account locale={locale} onLocale={onLocale} go={go} />} />
        <AppShell.Main className="min-h-0">
          {route.screen === "library" ? <Library folder={route.folder} go={go} onAddFolder={addFolder} /> : null}
          {route.screen === "check" ? <CheckView documentId={route.documentId} analysisId={route.analysisId} go={go} /> : null}
          {route.screen === "document" ? <DocumentView documentId={route.documentId} go={go} /> : null}
          {route.screen === "batches" ? <BatchesView go={go} /> : null}
          {route.screen === "batch" ? <BatchView batchId={route.batchId} go={go} /> : null}
          {route.screen === "reports" ? <ReportsView go={go} /> : null}
          {route.screen === "settings" ? <Settings /> : null}
        </AppShell.Main>
      </AppShell.Body>
    </AppShell.Root>
  );
}

/** The header's account menu: who is signed in, the settings, the theme, the language, sign out — at every width. */
function Account({ locale, onLocale, go }: { locale: Locale; onLocale: (locale: Locale) => void; go: (route: Route) => void }) {
  const { t } = useI18n();
  const me = useQuery(queries.me());
  const email = me.data?.email ?? "";
  const name = me.data?.name ?? email;
  return (
    <AccountMenu
      label={t("shell.account")}
      name={name}
      email={email}
      showName
      avatar={{ defaultAvatar: { brand: "yomizaka", seed: me.data?.avatarSeed ?? email }, fallback: (name || "Y").charAt(0).toUpperCase() }}
      links={[{ id: "settings", label: t("nav.settings"), href: hashOf({ screen: "settings" }), icon: <SettingsIcon size={16} /> }]}
      language={{ label: t("shell.language"), value: locale, options: LOCALES.map((value) => ({ value, label: LANGUAGE_NAMES[value] })), onChange: (to) => onLocale(to as Locale) }}
      signOut={{ label: t("nav.signOut"), onSelect: () => void yomizaka.signOut().then(() => go({ screen: "library", folder: null })), icon: <LogoutIcon size={16} /> }}
    >
      <div className="px-3 py-1">
        <ThemeToggle label={t("shell.theme")} variant="ghost" />
      </div>
      <p className="px-3 py-1 text-xs text-fg-muted">{t("settings.version", { version: APP_VERSION })}</p>
    </AccountMenu>
  );
}
