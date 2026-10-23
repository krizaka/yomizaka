import { DiscoveryProvider } from "@krizaka/discovery/react";
import { KrizakaQueryProvider, useQueryClient } from "@krizaka/query";
import { bindNativeLifecycle } from "@krizaka/query/native";
import { brands } from "@krizaka/tokens/native";
import { ThemeProvider } from "@krizaka/ui/native";
import { Stack } from "expo-router";
import * as React from "react";
import { AppState } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthProvider } from "@/auth";
import { discovery, session } from "@/config";
import { I18nProvider } from "@/i18n";
import { useLocale } from "@/use-locale";

/** A refresh of the signed manifest each time the app comes back to the foreground. */
const onForeground = (callback: () => void) => {
  const subscription = AppState.addEventListener("change", (state) => state === "active" && callback());
  return () => subscription.remove();
};

/**
 * One account's data never shows to the next: when a session starts or ends (a sign-out, a sign-in, a 401), the queries in
 * flight are cancelled and the cache is emptied before another account's screens render. Query's focus follows the app
 * state, so the screens refresh when the app comes back to the foreground.
 */
function SessionBoundary({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  React.useEffect(
    () =>
      session.onChange(() => {
        void queryClient.cancelQueries();
        queryClient.clear();
      }),
    [queryClient],
  );
  React.useEffect(() => bindNativeLifecycle({ appState: AppState }), []);
  return <>{children}</>;
}

/** The app's root: Yomizaka's indigo on the Krizaka native theme (dark and light), the backend found by discovery, the session. */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Themed>
        <DiscoveryProvider discovery={discovery} subscribeForeground={onForeground}>
          <KrizakaQueryProvider throwOnError={false}>
            <SessionBoundary>
              <Localised />
            </SessionBoundary>
          </KrizakaQueryProvider>
        </DiscoveryProvider>
      </Themed>
    </SafeAreaProvider>
  );
}

/** The theme keeps its bars and buttons clear of the notch and the home indicator: it needs the safe-area insets. */
function Themed({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ThemeProvider overrides={brands.yomizaka} insets={insets}>
      {children}
    </ThemeProvider>
  );
}

function Localised() {
  const { locale, setLocale } = useLocale();
  return (
    <I18nProvider locale={locale} setLocale={setLocale}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </I18nProvider>
  );
}
