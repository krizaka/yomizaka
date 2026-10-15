import { type NextRequest, NextResponse } from "next/server";

/**
 * Every page exists in English and French (`/en/…`, `/fr/…`). An address without a language goes to the visitor's: the
 * one they chose (cookie `NEXT_LOCALE`), else English — the default of every Krizaka site. The API never passes here.
 */
const LOCALES = ["en", "fr"] as const;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segment = pathname.split("/")[1];
  if ((LOCALES as readonly string[]).includes(segment ?? "")) {
    if (request.cookies.get("NEXT_LOCALE")?.value === segment) return;
    const response = NextResponse.next();
    response.cookies.set("NEXT_LOCALE", segment!, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return response;
  }
  const chosen = request.cookies.get("NEXT_LOCALE")?.value;
  const locale = chosen === "fr" ? "fr" : "en";
  return NextResponse.redirect(new URL(`/${locale}${pathname === "/" ? "" : pathname}`, request.url));
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|robots.txt|sitemap.xml|llms.txt|og.png|favicon.ico|icon.svg|.*\\..*).*)"],
};
