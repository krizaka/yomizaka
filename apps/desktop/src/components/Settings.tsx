import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";

import { LOCALES, type Locale, rememberLocale, useI18n } from "../i18n";
import { APP_VERSION, yomizaka } from "../lib/config";

/** The language, where the documents live, the account. */
export function Settings({ onLocale }: { onLocale: (locale: Locale) => void }) {
  const { t, locale } = useI18n();
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 p-6">
      <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("settings.language")}</h2>
        <div className="flex gap-2">
          {LOCALES.map((value) => (
            <Button
              key={value}
              variant={value === locale ? "primary" : "secondary"}
              onClick={() => {
                rememberLocale(value);
                onLocale(value);
              }}
            >
              {value === "fr" ? "Français" : "English"}
            </Button>
          ))}
        </div>
      </div>
      <Card.Root className="flex flex-col gap-2 p-4">
        <h2 className="text-sm font-semibold">{t("settings.storage")}</h2>
        <p className="text-fg-secondary">{t("settings.storageBody")}</p>
      </Card.Root>
      <div>
        <Button variant="secondary" onClick={() => void yomizaka.signOut()}>
          {t("nav.signOut")}
        </Button>
      </div>
      <p className="text-xs text-fg-muted">{t("settings.version", { version: APP_VERSION })}</p>
    </main>
  );
}
