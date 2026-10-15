import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CLOSED_ROBOTS, indexable, NOINDEX_HEADER } from "./indexing";

afterEach(() => vi.unstubAllEnvs());

const ask = async (url: string, host: string) => {
  const { proxy } = await import("../proxy");
  return proxy(new NextRequest(url, { headers: { host } }));
};

describe("APP_SEARCH_INDEXING — one flag closes a deployment to search engines", () => {
  it("is on by default and off only when set to off", () => {
    expect(indexable({})).toBe(true);
    expect(indexable({ APP_SEARCH_INDEXING: "on" })).toBe(true);
    expect(indexable({ APP_SEARCH_INDEXING: "OFF" })).toBe(false);
  });

  it("off: robots.txt disallows everything and names no sitemap; sitemap.xml is 404; every response says noindex", async () => {
    vi.stubEnv("APP_SEARCH_INDEXING", "off");
    const robots = await ask("https://dev.yomizaka.com/robots.txt", "dev.yomizaka.com");
    expect(await robots.text()).toBe(CLOSED_ROBOTS);
    expect(CLOSED_ROBOTS).not.toMatch(/sitemap/i);
    expect(robots.headers.get("x-robots-tag")).toBe(NOINDEX_HEADER);
    expect((await ask("https://dev.yomizaka.com/sitemap.xml", "dev.yomizaka.com")).status).toBe(404);
    for (const path of ["/", "/en", "/fr/verify", "/api/healthz", "/api/verify"]) {
      const res = await ask(`https://dev.yomizaka.com${path}`, "dev.yomizaka.com");
      expect(res.headers.get("x-robots-tag"), path).toBe(NOINDEX_HEADER);
    }
  });

  it("on: nothing is closed on the product host", async () => {
    vi.stubEnv("APP_SEARCH_INDEXING", "on");
    const res = await ask("https://dev.yomizaka.com/en", "dev.yomizaka.com");
    expect(res.headers.get("x-robots-tag")).toBeNull();
  });

  it("the console host is closed whatever the flag, redirects included", async () => {
    vi.stubEnv("APP_SEARCH_INDEXING", "on");
    const redirect = await ask("https://admin.yomizaka.com/", "admin.yomizaka.com");
    expect(redirect.status).toBeGreaterThanOrEqual(300);
    expect(redirect.headers.get("x-robots-tag")).toBe(NOINDEX_HEADER);
    expect(await (await ask("https://admin.yomizaka.com/robots.txt", "admin.yomizaka.com")).text()).toBe(CLOSED_ROBOTS);
  });
});
