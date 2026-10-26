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
  const goes = (res: Response) => (res.headers.get("location") ? new URL(res.headers.get("location")!).pathname : null);

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
