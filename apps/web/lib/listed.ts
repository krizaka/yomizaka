import { downloadsOffered } from "./downloads";
import { PRICING_PUBLISHED } from "./prices/publication";
import type { PageId } from "./site";

/**
 * Whether a page is shown anywhere — the bar, the footer, the sitemap, llms.txt. `/download` is parked while no app can be
 * downloaded (yomizaka#389); `/pricing` is held until the price grid is approved (yomizaka#388, #300). One answer for every surface.
 */
export function isListed(page: PageId): boolean {
  if (page === "download") return downloadsOffered();
  if (page === "pricing") return PRICING_PUBLISHED;
  return true;
}
