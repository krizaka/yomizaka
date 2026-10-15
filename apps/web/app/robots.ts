import type { MetadataRoute } from "next";

import { indexable } from "@/lib/indexing";
import { CRAWLERS } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/** The public pages are open to every crawler; the signed-in space and the API are not for them. */
export default function robots(): MetadataRoute.Robots {
  // Not indexed (dev, preview): closed, no sitemap. The proxy answers the same at request time (APP_SEARCH_INDEXING).
  if (!indexable()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  const disallow = ["/api/", "/en/app", "/fr/app", "/en/sign-in", "/fr/sign-in"];
  return {
    rules: [{ userAgent: "*", allow: "/", disallow }, ...CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow }))],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
