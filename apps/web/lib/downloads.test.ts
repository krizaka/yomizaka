import { describe, expect, it } from "vitest";

import { DOWNLOAD_STATE, DOWNLOADS, downloadState } from "./downloads";
import { getDictionary, LOCALES } from "./i18n";

describe("the downloads", () => {
  it("are « soon » until a store or release link exists, and say so honestly", () => {
    for (const download of DOWNLOADS) {
      expect(downloadState(download)).toBe(download.href ? DOWNLOAD_STATE.available : DOWNLOAD_STATE.soon);
    }
    expect(downloadState({ id: "ios", href: null })).toBe(DOWNLOAD_STATE.soon);
    expect(downloadState({ id: "ios", href: "https://testflight.apple.com/join/x" })).toBe(DOWNLOAD_STATE.available);
  });

  it("only ever link over https", () => {
    for (const { href } of DOWNLOADS) if (href) expect(href).toMatch(/^https:\/\//);
  });

  it.each(LOCALES)("each platform has its words in %s", (locale) => {
    const t = getDictionary(locale).download;
    for (const { id } of DOWNLOADS) {
      expect(t.platforms[id].name).not.toBe("");
      expect(t.platforms[id].body).not.toBe("");
    }
  });
});
