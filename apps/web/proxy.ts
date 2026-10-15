import { type NextRequest, NextResponse } from "next/server";

import { isAdminHost, routeFor } from "./lib/host";

/**
 * Every page exists in English and French (`/en/…`, `/fr/…`); an address without a language goes to the visitor's choice
 * (cookie `NEXT_LOCALE`), else English. admin.yomizaka.com serves only the administration console (lib/host.ts), never
 * indexed; dev.yomizaka.com never serves it. The API never passes here.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  const chosen = request.cookies.get("NEXT_LOCALE")?.value === "fr" ? "fr" : "en";
  const route = routeFor(host, request.nextUrl.pathname, chosen);
  const admin = isAdminHost(host);
  let response: NextResponse;
  switch (route.kind) {
    case "robotsClosed":
      return new NextResponse("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain", "x-robots-tag": "noindex, nofollow" } });
    case "notFound":
      return new NextResponse("Not found", { status: 404, headers: admin ? { "x-robots-tag": "noindex, nofollow" } : {} });
    case "redirect": {
      // The public host, not the platform's internal one: admin.yomizaka.com stays admin.yomizaka.com.
      const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
      return NextResponse.redirect(new URL(route.path, host ? `${proto}://${host}` : request.url));
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
  if (admin) response.headers.set("x-robots-tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|og.png|favicon.ico|icon.svg|.*\\..*).*)", "/robots.txt", "/sitemap.xml", "/llms.txt"],
};
