import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";

const request = (url: string) => new NextRequest(url, { headers: { host: new URL(url).host } });

describe("the proxy carries the language of the address to the page (the UX review's Y10)", () => {
  it("sets `x-locale` from the address's segment, so a 404 answers in that language", () => {
    expect(proxy(request("https://www.yomizaka.com/fr/nope")).headers.get("x-middleware-request-x-locale")).toBe("fr");
    expect(proxy(request("https://www.yomizaka.com/en/nope")).headers.get("x-middleware-request-x-locale")).toBe("en");
    expect(proxy(request("https://www.yomizaka.com/fr/app/documents/d1/rapport")).headers.get("x-middleware-request-x-locale")).toBe("fr");
  });
  it("walks every localised address, even one with a dot in a segment, so its 404 has the language", () => {
    expect(config.matcher).toContain("/(en|fr)/:path*");
    expect(proxy(request("https://www.yomizaka.com/fr/screening/missing.pdf")).headers.get("x-middleware-request-x-locale")).toBe("fr");
  });
  it("an address that names a language keeps it, whatever the cookie says", () => {
    const res = proxy(new NextRequest("https://www.yomizaka.com/en/x", { headers: { host: "www.yomizaka.com", cookie: "NEXT_LOCALE=fr" } }));
    expect(res.headers.get("x-middleware-request-x-locale")).toBe("en");
  });
});

// yomizaka#366 (Loi 96, Charter of the French language art. 52, 55): an address without a language opens in French.
describe("an address without a language opens in French; English stays a choice (yomizaka#366)", () => {
  const ask = (path: string, cookie?: string, host = "www.yomizaka.com") =>
    proxy(new NextRequest(`https://${host}${path}`, { headers: { host, ...(cookie ? { cookie } : {}) } }));
  const goes = (res: Response) => (res.headers.get("location") ? new URL(res.headers.get("location")!, "https://www.yomizaka.com").pathname : null);

  it("no cookie: / goes to /fr, and every other address to its /fr twin", () => {
    expect(goes(ask("/"))).toBe("/fr");
    expect(goes(ask("/privacy"))).toBe("/fr/privacy");
    expect(goes(ask("/terms"))).toBe("/fr/terms");
    expect(goes(ask("/sign-up"))).toBe("/fr/sign-up");
  });
  it("NEXT_LOCALE=en: the same addresses go to /en", () => {
    expect(goes(ask("/", "NEXT_LOCALE=en"))).toBe("/en");
    expect(goes(ask("/sign-up", "NEXT_LOCALE=en"))).toBe("/en/sign-up");
  });
  it("NEXT_LOCALE=fr, or a value that is no language: French", () => {
    expect(goes(ask("/", "NEXT_LOCALE=fr"))).toBe("/fr");
    expect(goes(ask("/", "NEXT_LOCALE=de"))).toBe("/fr");
    expect(goes(ask("/", "NEXT_LOCALE="))).toBe("/fr");
  });
  it("opening /en/… stays English and keeps the choice in NEXT_LOCALE", () => {
    const res = ask("/en/privacy");
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("set-cookie")).toContain("NEXT_LOCALE=en");
  });
  it("the administration console follows the same rule", () => {
    expect(goes(ask("/", undefined, "admin.yomizaka.com"))).toBe("/fr");
    expect(goes(ask("/", "NEXT_LOCALE=en", "admin.yomizaka.com"))).toBe("/en");
  });
});

// krizaka-ui#827: a signed-in visitor never sees the public landing page; the bar's hint flag follows the session cookie.
describe("a signed-in visitor lands on their home, never on the landing page (krizaka-ui#827)", () => {
  const ask = (path: string, cookie?: string, host = "www.yomizaka.com") => proxy(new NextRequest(`https://${host}${path}`, { headers: { host, ...(cookie ? { cookie } : {}) } }));
  const goes = (res: Response) => (res.headers.get("location") ? new URL(res.headers.get("location")!, "https://www.yomizaka.com").pathname : null);

  it("/ , /fr and /en with the session cookie answer 307 to the home in the language, private and varying with the cookie", () => {
    for (const [path, home, cookie] of [
      ["/", "/fr/app", "yomizaka_session=ys1.x"],
      ["/", "/en/app", "yomizaka_session=ys1.x; NEXT_LOCALE=en"],
      ["/fr", "/fr/app", "yomizaka_session=ys1.x"],
      ["/en", "/en/app", "yomizaka_session=ys1.x"],
    ] as const) {
      const res = ask(path, cookie);
      expect(res.status).toBe(307);
      expect(goes(res)).toBe(home);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(res.headers.get("vary")).toBe("Cookie");
    }
  });
  it("a signed-out visitor still gets the landing page, and a public page stays reachable signed in", () => {
    expect(goes(ask("/fr"))).toBeNull();
    expect(goes(ask("/fr/pricing", "yomizaka_session=ys1.x"))).toBeNull();
  });
  it("keeps the readable hint flag in step with the cookie on a public page, never carrying the token", () => {
    const set = ask("/fr/pricing", "yomizaka_session=ys1.tok").headers.get("set-cookie") ?? "";
    expect(set).toContain("kz-session=1");
    expect(set).not.toContain("ys1.tok");
    expect(ask("/fr/pricing", "kz-session=1").headers.get("set-cookie") ?? "").toContain("Max-Age=0");
  });
  it("the administration console is not a landing page", () => {
    expect(goes(ask("/fr", "yomizaka_session=ys1.x", "admin.yomizaka.com"))).not.toBe("/fr/app");
  });
});
