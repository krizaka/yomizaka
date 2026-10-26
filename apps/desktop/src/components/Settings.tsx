import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { List } from "@krizaka/ui/list";
import { useState } from "react";

import { useI18n } from "../i18n";
import { APP_VERSION } from "../lib/config";
import { inbox } from "../lib/inbox-store";

/** Where the documents live, the watched folders, the version. The language and the account are in the header's menu. */
export function Settings() {
  const { t } = useI18n();
  const [watched, setWatched] = useState(() => inbox.watched());
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <Card.Root className="flex flex-col gap-2 p-4">
        <h2 className="text-sm font-semibold">{t("settings.storage")}</h2>
        <p className="text-fg-secondary">{t("settings.storageBody")}</p>
      </Card.Root>
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("settings.watched")}</h2>
        <List
          aria-label={t("settings.watched")}
          density="compact"
          items={watched}
          getId={(folder) => folder}
          empty={<p className="text-sm text-fg-secondary">{t("settings.watchedNone")}</p>}
          row={(folder) => ({
            title: folder.split("/").findLast(Boolean) ?? folder,
            description: folder,
            actions: (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  inbox.set(folder, false);
                  setWatched(inbox.watched());
                }}
              >
                {t("settings.unwatch")}
              </Button>
            ),
          })}
        />
      </div>
      <p className="text-xs text-fg-muted">{t("settings.version", { version: APP_VERSION })}</p>
    </div>
  );
}
