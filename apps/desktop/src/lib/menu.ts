import type { MenuSpec } from "@krizaka/app-desktop";
import { acceleratorOf } from "@krizaka/ui/app-shell";

import type { Messages } from "../i18n";

/** The app's shortcuts: the sidebar's items answer them, the menu bar shows them (krizaka-ui ADR-002). */
export const SHORTCUTS = { addFolder: "mod+o", library: "mod+1", batches: "mod+2", reports: "mod+3", settings: "mod+," } as const;

export const MENU_IDS = { addFolder: "library.add-folder", library: "go.library", batches: "go.batches", reports: "go.reports", settings: "go.settings" } as const;

/** The native menu bar in the app's words. */
export function menuSpec(t: Pick<Messages, "menu" | "nav">): MenuSpec {
  const { file, addFolder, go, settings, ...labels } = t.menu;
  const item = (id: keyof typeof MENU_IDS, label: string, separated = false) => ({ id: MENU_IDS[id], label, accelerator: acceleratorOf(SHORTCUTS[id]), separated });
  return {
    labels,
    menus: [
      { title: file, items: [item("addFolder", addFolder)] },
      { title: go, items: [item("library", t.nav.library), item("batches", t.nav.batches), item("reports", t.nav.reports), item("settings", settings, true)] },
    ],
  };
}
