import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "./proxy";

const request = (url: string) => new NextRequest(url, { headers: { host: new URL(url).host } });

describe("the proxy carries the language of the address to the page (the UX review's Y10)", () => {
  it("sets `x-locale` from the address's segment, so a 404 answers in that language", () => {
    expect(proxy(request("https://www.yomizaka.com/fr/nope")).headers.get("x-middleware-request-x-locale")).toBe("fr");
    expect(proxy(request("https://www.yomizaka.com/en/nope")).headers.get("x-middleware-request-x-locale")).toBe("en");
    expect(proxy(request("https://www.yomizaka.com/fr/app/documents/d1/rapport")).headers.get("x-middleware-request-x-locale")).toBe("fr");
  });
  it("falls back on the chosen language (the cookie, else English) when the address has none", () => {
    const res = proxy(new NextRequest("https://www.yomizaka.com/en/x", { headers: { host: "www.yomizaka.com", cookie: "NEXT_LOCALE=fr" } }));
    expect(res.headers.get("x-middleware-request-x-locale")).toBe("en");
  });
});
