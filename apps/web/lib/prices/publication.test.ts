import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";
import { SiteFooter } from "@/components/SiteFooter";

import { isListed } from "../listed";
import { menuItems } from "../nav";
import { llmsText } from "../seo";
import { SITE_URL } from "../site";
import { PRICING_PUBLISHED } from "./publication";

/** The price grid waits for Oussama's OK (yomizaka#300): while it is held, no surface offers the page, and the page itself is a 404. */
const ROOT = join(import.meta.dirname, "../..");

describe("the pricing page is held until the grid is approved (#388, #300)", () => {
  it("is not published without his OK", () => expect(PRICING_PUBLISHED).toBe(false));

  it("every surface follows the constant: the bar, the footer, the sitemap and llms.txt", () => {
    const offered = PRICING_PUBLISHED;
    expect(isListed("pricing")).toBe(offered);
    expect(menuItems().some((m) => m.page === "pricing")).toBe(offered);
    for (const locale of ["en", "fr"] as const) {
      expect(renderToStaticMarkup(SiteFooter({ locale })).includes(`href="/${locale}/pricing"`)).toBe(offered);
      expect(sitemap().some((e) => e.url === `${SITE_URL}/${locale}/pricing`)).toBe(offered);
    }
    expect(llmsText().includes("/pricing")).toBe(offered);
  });

  it("the route answers 404 while held, and the page file exists for the day it is published", () => {
    const page = readFileSync(join(ROOT, "app/[locale]/pricing/page.tsx"), "utf8");
    expect(existsSync(join(ROOT, "app/[locale]/pricing/page.tsx"))).toBe(true);
    expect(page).toContain("if (!PRICING_PUBLISHED) notFound();");
  });
});
