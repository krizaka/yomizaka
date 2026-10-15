/**
 * One flag decides whether this deployment is open to search engines: `APP_SEARCH_INDEXING=off` (every dev and preview
 * deployment) closes it — robots.txt `Disallow: /` with no sitemap, `X-Robots-Tag: noindex, nofollow, noarchive` on every
 * response, `<meta name="robots">` noindex, and the « development environment » line in the footer. Production flips it by
 * configuration alone. Read at request time (the proxy) — never baked at build.
 */
export const NOINDEX_HEADER = "noindex, nofollow, noarchive";

export const indexable = (env: Record<string, string | undefined> = process.env): boolean => env.APP_SEARCH_INDEXING?.trim().toLowerCase() !== "off";

/** robots.txt of a deployment that is not indexed: closed, and no sitemap to advertise. */
export const CLOSED_ROBOTS = "User-agent: *\nDisallow: /\n";
