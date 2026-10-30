"use client";

import { appearance } from "@krizaka/tokens";
import { AppearanceSettings } from "@krizaka/ui/account-settings";
import { SettingsSection } from "@krizaka/ui/settings-layout";
import { useAppearance } from "@krizaka/ui/theme";

import { useSay } from "@/lib/i18n-client";

/** The themes this product offers (ADR-006 § 4): the required three — System, Light, Dark. The surface sets and the accents are not shipped here (the product keeps its own indigo). */
const OFFERED = appearance.themes.filter((t) => t.required === true);
const previewOf = (id: "light" | "dark") => appearance.themes.find((t) => t.id === id)?.preview ?? null;

/**
 * The appearance of the app on Krizaka UI's `AppearanceSettings` and `useAppearance()`: the theme (System · Light · Dark, dark by default) and the
 * density, applied at once and kept in this browser. The language is the profile's, one section above. The sound stays off.
 */
export function AppearanceSection() {
  const { say } = useSay();
  const state = useAppearance();
  const light = previewOf("light");
  const dark = previewOf("dark");
  return (
    <SettingsSection
      variant="flat"
      title={say("settings.tabs.apparence")}
      description={say("settings.appearance.lead")}
      data-testid="settings-apparence"
    >
      <AppearanceSettings
        themes={OFFERED.map((t) => ({
          id: t.id,
          label: say(`settings.appearance.themes.${t.id}`),
          description: say(`settings.appearance.themes.${t.id}Hint`),
          preview: t.preview,
          ...(t.id === "system" && light && dark ? { halves: [light, dark] as const } : {}),
        }))}
        theme={state.themeId}
        onThemeChange={state.setThemeId}
        densities={appearance.densities.map((value) => ({
          value,
          label: say(`settings.appearance.densities.${value}`),
        }))}
        density={state.density}
        onDensityChange={state.setDensity}
        labels={{
          theme: say("settings.appearance.theme"),
          themeHint: say("settings.appearance.themeHint"),
          density: say("settings.appearance.density"),
          densityHint: say("settings.appearance.densityHint"),
        }}
      />
    </SettingsSection>
  );
}
