import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { loadReleases } from "@/lib/changelog";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { APP_VERSION, pagePath,PAGES } from "./site";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

afterEach(() => vi.unstubAllGlobals());

describe("/changelog", () => {
  it("reads the merged pull requests into weeks, the latest first, housekeeping left out", async () => {
    const pulls = [
      { title: "feat(shop): ship a thing (#12)", html_url: "https://github.com/krizaka/yomizaka/pull/12", merged_at: "2026-10-16T10:00:00Z" },
      { title: "chore: bump", html_url: "https://github.com/krizaka/yomizaka/pull/13", merged_at: "2026-10-16T11:00:00Z" },
      { title: "fix: XSS in the report (#9)", html_url: "https://github.com/krizaka/yomizaka/pull/9", merged_at: "2026-10-07T10:00:00Z" },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(pulls))));
    const releases = await loadReleases();
    expect(releases.map((r) => r.version)).toEqual(["2026-10-12", "2026-10-05"]);
    expect(releases[0].changes.map((c) => c.tag)).toEqual(["feature"]);
    expect(releases[1].changes[0].tag).toBe("security");
  });

  it("is empty, not broken, when GitHub cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 403 })));
    expect(await loadReleases()).toEqual([]);
  });

  it("exists in both languages, in the sitemap pages, with its feed", () => {
    expect(PAGES).toContain("changelog");
    expect(pagePath("fr", "changelog")).toBe("/fr/changelog");
    expect(read("app/[locale]/changelog/page.tsx")).toContain("<ChangelogBody");
    expect(read("app/[locale]/changelog/page.tsx")).toContain("await loadReleases()");
    expect(read("app/[locale]/changelog/feed.xml/route.ts")).toContain("changelogRss");
    for (const m of [en, fr]) {
      expect(m.changelog.title).toBeTruthy();
      expect(m.changelog.kinds.security).toBeTruthy();
    }
  });

  it("the footer's version link lands on the page's anchor", () => {
    expect(read("components/SiteFooter.tsx")).toContain('`${pagePath(locale, "changelog")}#${APP_VERSION}`');
    expect(read("components/ChangelogBody.tsx")).toContain("<span id={version}>");
    expect(read("app/[locale]/changelog/page.tsx")).toContain("version={APP_VERSION}");
    expect(APP_VERSION).toBeTruthy();
  });
});
