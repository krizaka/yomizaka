import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const spec = readFileSync(join(__dirname, "../../../deploy/digitalocean/dev.app.yaml"), "utf8");

describe("dev.yomizaka.com is indexed (krizaka-com AGENTS §2.4); admin.yomizaka.com is not", () => {
  it("the dev app spec leaves APP_SEARCH_INDEXING on, so robots allows, the sitemap exists and no noindex is sent", () => {
    const line = spec.split("\n").find((l) => !l.trim().startsWith("#") && l.includes("APP_SEARCH_INDEXING"));
    expect(line, "APP_SEARCH_INDEXING is declared").toBeDefined();
    expect(line).toMatch(/value:\s*"on"/);
  });
});
