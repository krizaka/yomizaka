import { type NextRequest, NextResponse } from "next/server";

import { isAdminHost, routeFor } from "./lib/host";
import { CLOSED_ROBOTS, devRedirect, indexableOn, isDevHost, NOINDEX_HEADER } from "./lib/indexing";
import { SITE_URL } from "./lib/site";

/**
 * Every page exists in English and French (`/en/…`, `/fr/…`); an address without a language goes to the visitor's choice
 * (cookie `NEXT_LOCALE`), else English. admin.yomizaka.com serves only the administration console (lib/host.ts), never
 * indexed; dev.yomizaka.com never serves it. A deployment with APP_SEARCH_INDEXING=off (lib/indexing.ts) answers noindex on
 * every response — pages, redirects and the API — and a closed robots.txt without a sitemap.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  const chosen = request.cookies.get("NEXT_LOCALE")?.value === "fr" ? "fr" : "en";
  const admin = isAdminHost(host);
  const dev = isDevHost(host);
  // Closed to search engines: the consoles and the dev host always; every other host but the public one (APP_PUBLIC_URL's:
  // www.yomizaka.com) when APP_SEARCH_INDEXING=off.
  const closed = admin || dev || !indexableOn(host);
  const seal = <T extends NextResponse>(response: T): T => {
    if (closed) response.headers.set("x-robots-tag", NOINDEX_HEADER);
    return response;
  };
  // The API (and /.well-known) is not routed by language or host: it only carries the noindex header.
  if (request.nextUrl.pathname.startsWith("/api/") || request.nextUrl.pathname.startsWith("/.well-known/")) return seal(NextResponse.next());
  // dev.yomizaka.com (APP_DEV_HOST): robots.txt closes everything; a page goes to www (308); healthz keeps serving.
  if (dev) {
    if (request.nextUrl.pathname === "/robots.txt") return seal(new NextResponse(CLOSED_ROBOTS, { headers: { "content-type": "text/plain" } }));
    const to = devRedirect(request.method, request.nextUrl.pathname, request.nextUrl.search, process.env.APP_PUBLIC_URL ?? SITE_URL);
    return seal(to ? NextResponse.redirect(to, 308) : NextResponse.next());
  }
  const route = routeFor(host, request.nextUrl.pathname, chosen);
  let response: NextResponse;
  if (!admin && closed && request.nextUrl.pathname === "/robots.txt") return seal(new NextResponse(CLOSED_ROBOTS, { headers: { "content-type": "text/plain" } }));
  if (!admin && closed && request.nextUrl.pathname === "/sitemap.xml") return seal(new NextResponse("Not found", { status: 404 }));
  switch (route.kind) {
    case "robotsClosed":
      return seal(new NextResponse(CLOSED_ROBOTS, { headers: { "content-type": "text/plain" } }));
    case "notFound":
      return seal(new NextResponse("Not found", { status: 404 }));
    case "redirect": {
      // The public host, not the platform's internal one: admin.yomizaka.com stays admin.yomizaka.com.
      const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
      return seal(NextResponse.redirect(new URL(route.path, host ? `${proto}://${host}` : request.url)));
    }
    case "rewrite":
      response = NextResponse.rewrite(new URL(route.path, request.url));
      break;
    default:
      response = NextResponse.next();
  }
  const segment = request.nextUrl.pathname.split("/")[1];
  if ((segment === "en" || segment === "fr") && request.cookies.get("NEXT_LOCALE")?.value !== segment) {
    response.cookies.set("NEXT_LOCALE", segment, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return seal(response);
}

export const config = {
  matcher: ["/api/:path*", "/((?!api|_next/static|_next/image|og.png|favicon.ico|icon.svg|.*\\..*).*)", "/robots.txt", "/sitemap.xml", "/llms.txt", "/.well-known/:path*"],
};
