import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "../proxy";
import { localeForAddress, localeFromHeader, NOT_FOUND_LOCALE_HEADER } from "./not-found-locale";

describe("the language of a page that does not exist", () => {
  it("follows the address, then the visitor's choice", () => {
    expect(localeForAddress("/fr/nope", "en")).toBe("fr");
    expect(localeForAddress("/en/nope/deeper", "fr")).toBe("en");
    expect(localeForAddress("/nope", "fr")).toBe("fr");
    expect(localeForAddress("/", "en")).toBe("en");
  });

  it("reads the header back, English when it is missing or unknown", () => {
    expect(localeFromHeader("fr")).toBe("fr");
    expect(localeFromHeader("de")).toBe("en");
    expect(localeFromHeader(null)).toBe("en");
  });

  it("the proxy hands /fr/nope to the 404 page with the French header", () => {
    const response = proxy(new NextRequest("https://dev.example.test/fr/nope", { headers: { host: "www.yomizaka.com" } }));
    expect(response.headers.get(`x-middleware-request-${NOT_FOUND_LOCALE_HEADER}`)).toBe("fr");
  });
});
