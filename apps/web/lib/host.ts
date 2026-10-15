/**
 * Two sites, one app: dev.yomizaka.com (the product) and admin.yomizaka.com (the administration console). The proxy
 * decides by the host: on the admin host every page is the console (`/en/users` is served by `/en/console/users`) and
 * nothing else; on the product host the console does not exist (404). Pure, so it is tested without a server.
 */
export const isAdminHost = (host: string | null | undefined) => /^admin\./i.test(host ?? "");

export type HostRoute = { kind: "next" } | { kind: "rewrite"; path: string } | { kind: "redirect"; path: string } | { kind: "notFound" } | { kind: "robotsClosed" };

const LOCALE = /^\/(en|fr)(?=\/|$)/;

export function routeFor(host: string | null | undefined, pathname: string, preferred: "en" | "fr"): HostRoute {
  const locale = LOCALE.exec(pathname)?.[1];
  if (isAdminHost(host)) {
    if (pathname === "/robots.txt") return { kind: "robotsClosed" };
    if (pathname === "/sitemap.xml" || pathname === "/llms.txt") return { kind: "notFound" };
    if (!locale) return { kind: "redirect", path: `/${preferred}${pathname === "/" ? "" : pathname}` };
    const rest = pathname.slice(locale.length + 1);
    if (rest === "/console" || rest.startsWith("/console/")) return { kind: "redirect", path: `/${locale}${rest.slice("/console".length)}` };
    return { kind: "rewrite", path: `/${locale}/console${rest}` };
  }
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml" || pathname === "/llms.txt") return { kind: "next" };
  if (!locale) return { kind: "redirect", path: `/${preferred}${pathname === "/" ? "" : pathname}` };
  const rest = pathname.slice(locale.length + 1);
  if (rest === "/console" || rest.startsWith("/console/")) return { kind: "notFound" };
  return { kind: "next" };
}
