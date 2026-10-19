import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { ADMIN_GROUPS, ADMIN_PAGES } from "./admin-nav";

describe("the administration's navigation (admin.ux-review)", () => {
  it("has at most five groups, each of at most four pages, every page once", () => {
    expect(ADMIN_GROUPS.length).toBeLessThanOrEqual(5);
    for (const g of ADMIN_GROUPS) expect(g.pages.length).toBeLessThanOrEqual(4);
    expect(new Set(ADMIN_PAGES.map((p) => p.key)).size).toBe(ADMIN_PAGES.length);
  });
  it("points only at pages that exist", () => {
    for (const p of ADMIN_PAGES) {
      const dir = join(__dirname, "../app/[locale]/(admin)/console/(signed)", p.path);
      expect(existsSync(join(dir, "page.tsx")), p.path || "/").toBe(true);
    }
  });
  it("is worded in both languages", () => {
    for (const messages of [en, fr]) {
      const shell = messages.console.adminConsole.shell as Record<string, unknown>;
      for (const p of ADMIN_PAGES) expect(typeof shell[p.key]).toBe("string");
      for (const g of ADMIN_GROUPS) expect(typeof (shell.groups as Record<string, unknown>)[g.key]).toBe("string");
    }
  });
});
