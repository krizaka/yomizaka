import { Button } from "@krizaka/ui/button";
import { useState } from "react";

import { CheckView } from "./components/CheckView";
import { Library } from "./components/Library";
import { Settings } from "./components/Settings";
import { SignIn } from "./components/SignIn";
import { I18nProvider, type Locale, currentLocale, useI18n } from "./i18n";
import { AUTH, useAuth } from "./lib/use-auth";
import { useRoute } from "./lib/use-route";

export function App() {
  const [locale, setLocale] = useState<Locale>(currentLocale());
  return (
    <I18nProvider locale={locale} setLocale={setLocale}>
      <Gate onLocale={setLocale} />
    </I18nProvider>
  );
}

/** Signed out, the sign-in; signed in, the library, a check being followed, the settings: each one the window's hash. */
function Gate({ onLocale }: { onLocale: (locale: Locale) => void }) {
  const { t } = useI18n();
  const status = useAuth();
  const [route, go] = useRoute();
  if (status === AUTH.loading) return null;
  if (status === AUTH.signedOut) return <SignIn />;
  return (
    <div className="flex h-full flex-col">
      <nav aria-label={t("nav.label")} className="flex items-center gap-2 border-b border-border-subtle px-4 py-2">
        <span className="mr-2 font-semibold">{t("app.name")}</span>
        <Button size="sm" variant={route.screen === "settings" ? "ghost" : "secondary"} onClick={() => go({ screen: "library", folder: null })}>
          {t("nav.library")}
        </Button>
        <Button size="sm" variant={route.screen === "settings" ? "secondary" : "ghost"} onClick={() => go({ screen: "settings" })}>
          {t("nav.settings")}
        </Button>
      </nav>
      <div className="min-h-0 flex-1 overflow-auto">
        {route.screen === "library" ? <Library folder={route.folder} go={go} /> : null}
        {route.screen === "check" ? <CheckView documentId={route.documentId} analysisId={route.analysisId} go={go} /> : null}
        {route.screen === "settings" ? <Settings onLocale={onLocale} /> : null}
      </div>
    </div>
  );
}
