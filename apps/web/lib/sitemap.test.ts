import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import sitemap from "../app/sitemap";
import { proxy } from "../proxy";
import { SITE_URL } from "./site";

/** The sitemap lists every indexable page in both languages, each the other's hreflang alternate — and is served when indexing is on. */
describe("sitemap.xml", () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);

  it("lists the home, the run, privacy and both sides, in en and fr", () => {
    for (const path of ["", "/run", "/privacy", "/tenant", "/landlord"]) expect(urls).toContain(`${SITE_URL}/en${path}`);
    for (const path of ["", "/run", "/privacy", "/locataire", "/proprietaire"]) expect(urls).toContain(`${SITE_URL}/fr${path}`);
  });

  it("gives every entry en, fr and x-default alternates", () => {
    for (const e of entries) expect(Object.keys(e.alternates?.languages ?? {}).sort()).toEqual(["en", "fr", "x-default"]);
  });

  it("does not list the members-only /verify", () => {
    expect(urls.filter((u) => u.includes("/verify"))).toEqual([]);
  });
});

describe("the proxy serves /sitemap.xml and /robots.txt only when the deployment is indexed", () => {
  const ask = (path: string) => proxy(new NextRequest(`https://dev.yomizaka.com${path}`, { headers: { host: "dev.yomizaka.com" } }));
  const before = process.env.APP_SEARCH_INDEXING;
  const restore = () => (before === undefined ? delete process.env.APP_SEARCH_INDEXING : (process.env.APP_SEARCH_INDEXING = before));

  it("on: passes the request through to the generated sitemap (no 404, no noindex)", async () => {
    process.env.APP_SEARCH_INDEXING = "on";
    try {
      const res = ask("/sitemap.xml");
      expect(res.status).toBe(200);
      expect(res.headers.get("x-robots-tag")).toBeNull();
    } finally {
      restore();
    }
  });

  it("off: answers 404 and a closed robots.txt", async () => {
    process.env.APP_SEARCH_INDEXING = "off";
    try {
      expect(ask("/sitemap.xml").status).toBe(404);
      expect(await ask("/robots.txt").text()).toContain("Disallow: /");
    } finally {
      restore();
    }
  });
});
