import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { APP_VIDEOS, MAX_AGE_DAYS, staleVideos, videoId } from "./app-videos";
import { getDictionary, LOCALES } from "./i18n";

const ROOT = join(__dirname, "..");
const PATH = /^products\/yomizaka\/download\/(web|android|ios|mac)-[a-z0-9-]+\.[0-9a-f]{10}\.(webm|mp4|jpg)$/;

describe("the download page's videos (krizaka/.github#315)", () => {
  it("are known to the manifest with a file of each kind, hashed, under the product's download folder", () => {
    expect(APP_VIDEOS.length).toBeGreaterThan(0);
    for (const v of APP_VIDEOS) {
      expect(Object.keys(v.files).sort()).toEqual(["mp4", "poster", "webm"]);
      for (const path of Object.values(v.files)) expect(path, videoId(v)).toMatch(PATH);
      expect(v.seconds, videoId(v)).toBeLessThanOrEqual(30);
    }
  });

  it.each(LOCALES)("each video has its words in %s (the words may come first: the automated manifest pull request must pass)", (locale) => {
    const items = getDictionary(locale).download.videos.items as Record<string, { name: string; body: string }>;
    const ids = APP_VIDEOS.map(videoId);
    for (const id of ids) {
      expect(items[id], `${locale}: ${id}`).toBeDefined();
      expect(items[id]?.name).not.toBe("");
      expect(items[id]?.body).not.toBe("");
    }
  });

  it("the page reads the manifest only: no address of a video is typed in it", () => {
    const page = readFileSync(join(ROOT, "app/[locale]/download/page.tsx"), "utf8");
    expect(page).toContain("APP_VIDEOS");
    expect(page).not.toMatch(/b-cdn|products\/yomizaka|\.(mp4|webm|jpg)["'`]/);
  });

  it(`none is older than ${MAX_AGE_DAYS} days: a stale recording means the e2e job stopped publishing`, () => {
    expect(staleVideos(new Date()).map(videoId)).toEqual([]);
  });

  it("staleVideos tells a fresh recording from an old one", () => {
    const now = new Date("2026-11-20T00:00:00Z");
    const v = (capturedAt: string) => ({ platform: "web", flow: "x", seconds: 5, capturedAt, files: { webm: "", mp4: "", poster: "" } });
    expect(staleVideos(now, [v("2026-11-07T00:00:01Z")])).toEqual([]);
    expect(staleVideos(now, [v("2026-11-05T00:00:00Z")])).toHaveLength(1);
  });

  it("the page says nothing of stores or availability beyond the platform cards", () => {
    for (const locale of LOCALES) {
      const { title, lead, play, recorded, seconds } = getDictionary(locale).download.videos;
      expect([title, lead, play, recorded, seconds].join(" ")).not.toMatch(/App Store|Google Play|TestFlight|disponible|available/i);
    }
  });
});
