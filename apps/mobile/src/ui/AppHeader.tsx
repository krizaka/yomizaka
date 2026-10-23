import { useQuery } from "@krizaka/query";
import { Avatar, Header } from "@krizaka/ui/native";
import { useRouter } from "expo-router";
import * as React from "react";
import { Pressable } from "react-native";

import { queries } from "@/config";
import { routes } from "@/domain/links";
import { useI18n } from "@/i18n";
import { useLocale } from "@/use-locale";

/**
 * A tab's header: its title, and the signed-in account on the right at every size (Oussama's decision, 2026-10-23) — the
 * avatar opens the account and the settings.
 */
export function AppHeader({ title }: { title: string }) {
  const { t } = useI18n();
  const { locale } = useLocale();
  const router = useRouter();
  const me = useQuery(queries.me());
  const name = me.data?.name ?? me.data?.email ?? "";
  return (
    <Header
      title={title}
      size="inline"
      actions={
        <Pressable role="button" aria-label={name ? t("account.openNamed", { name }) : t("account.open")} hitSlop={8} onPress={() => router.navigate(routes.settings(locale) as never)}>
          <Avatar size="sm" defaultAvatar={{ brand: "yomizaka", seed: me.data?.avatarSeed ?? me.data?.email ?? "yomizaka" }} fallback={name.charAt(0).toUpperCase() || "Y"} />
        </Pressable>
      }
    />
  );
}
