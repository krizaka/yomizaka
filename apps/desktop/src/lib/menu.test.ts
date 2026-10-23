import { describe, expect, it } from "vitest";

import en from "../i18n/own.en.json";
import fr from "../i18n/own.fr.json";
import { MENU_IDS, menuSpec } from "./menu";

describe("the native menu bar", () => {
  it("is built in the app's words with the sidebar's shortcuts", () => {
    const spec = menuSpec(fr);
    expect(spec.labels.quit).toBe("Quitter Yomizaka");
    expect(spec.menus.map((m) => m.title)).toEqual(["Fichier", "Aller"]);
    expect(spec.menus.flatMap((m) => m.items.map((i) => [i.id, i.accelerator]))).toEqual([
      [MENU_IDS.addFolder, "CmdOrCtrl+O"],
      [MENU_IDS.library, "CmdOrCtrl+1"],
      [MENU_IDS.batches, "CmdOrCtrl+2"],
      [MENU_IDS.reports, "CmdOrCtrl+3"],
      [MENU_IDS.settings, "CmdOrCtrl+,"],
    ]);
    expect(Object.keys(spec.labels).sort()).toEqual(Object.keys(menuSpec(en).labels).sort());
  });

  it("uses ids and labels the native side accepts (lowercase ids, labels of 1 to 60 characters)", () => {
    for (const messages of [fr, en]) {
      const spec = menuSpec(messages);
      for (const item of spec.menus.flatMap((m) => m.items)) {
        expect(item.id).toMatch(/^[a-z][a-z0-9.-]*$/);
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.label.length).toBeLessThanOrEqual(60);
      }
      for (const label of Object.values(spec.labels)) expect(label.length).toBeLessThanOrEqual(60);
    }
  });
});
