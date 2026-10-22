import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { productionProblems, readEnv } from "../env";
import { storageFrom } from "./config";

const BUNNY = { MEDIA_DOCUMENTS_PROVIDER: "bunny", MEDIA_STORAGE_API_KEY: "zone-key", MEDIA_STORAGE_ZONE: "krizaka-assets", MEDIA_STORAGE_ENDPOINT: "storage.bunnycdn.com", MEDIA_DOCUMENTS_PREFIX: "yomizaka" } as const;
const S3 = { MEDIA_DOCUMENTS_PROVIDER: "s3", MEDIA_S3_ENDPOINT: "https://tor1.digitaloceanspaces.com", MEDIA_S3_REGION: "tor1", MEDIA_S3_BUCKET: "yomizaka-documents", MEDIA_S3_ACCESS_KEY_ID: "id", MEDIA_S3_SECRET_ACCESS_KEY: "key", MEDIA_DOCUMENTS_PREFIX: "yomizaka" } as const;
const from = (e: Record<string, string>, appEnv: "dev" | "prod" = "dev") => storageFrom(readEnv({ APP_ENVIRONMENT: appEnv, ...e }), () => new Date());

describe("the documents store is chosen here, from configuration", () => {
  it("keeps nothing by default", () => {
    expect(from({}).describe()).toMatchObject({ kind: "none" });
  });

  it("is Bunny in development, labelled dev and fictional data only", () => {
    expect(from(BUNNY).describe()).toMatchObject({ kind: "bunny", devOnly: true, residency: "elsewhere" });
  });

  it("hands out signed links when the zone's pull zone and its token key are configured (private zone, token authentication)", async () => {
    const store = from({ ...BUNNY, MEDIA_DOCUMENTS_PULL_HOSTNAME: "yomizaka-docs-dev.b-cdn.net", MEDIA_DOCUMENTS_TOKEN_KEY: "token-key" });
    const link = await store.signedUrl("owner/doc/a.pdf", 300);
    expect(link).toMatch(/^https:\/\/yomizaka-docs-dev\.b-cdn\.net\/yomizaka\/owner\/doc\/a\.pdf\?token=[A-Za-z0-9_-]+&expires=\d+$/);
    // without them there is no link: the bytes only ever leave through the authenticated storage API
    expect(await from(BUNNY).signedUrl("owner/doc/a.pdf", 300)).toBeNull();
  });

  it("refuses Bunny in production: it has no Canadian region", () => {
    expect(() => from(BUNNY, "prod")).toThrow(/development/i);
    expect(productionProblems(readEnv({ NODE_ENV: "production", APP_ENVIRONMENT: "prod", ...BUNNY, DATABASE_URL: undefined }))).toContain("MEDIA_DOCUMENTS_PROVIDER=bunny has no Canadian region: development and fictional data only");
  });

  it("is S3 on Spaces tor1 in Canada, and says so; the region table is data", () => {
    expect(from(S3, "prod").describe()).toMatchObject({ kind: "s3", endpoint: "tor1.digitaloceanspaces.com", region: "tor1", residency: "canada", devOnly: false });
    expect(from({ ...S3, MEDIA_S3_ENDPOINT: "https://s3.example.com", MEDIA_S3_REGION: "eu-west-3" }).describe()).toMatchObject({ residency: "elsewhere" });
  });

  it("refuses an incomplete provider, naming what is missing, never a value", () => {
    expect(() => from({ MEDIA_DOCUMENTS_PROVIDER: "s3", MEDIA_S3_BUCKET: "b" })).toThrow(/MEDIA_S3_ENDPOINT/);
    expect(() => from({ MEDIA_DOCUMENTS_PROVIDER: "bunny", MEDIA_STORAGE_ZONE: "z" })).toThrow(/MEDIA_STORAGE_API_KEY/);
  });

  it("encrypts what it keeps when a key is given", () => {
    const key = crypto.randomBytes(32).toString("base64");
    expect(from({ ...S3, MEDIA_DOCUMENTS_ENCRYPTION_KEY: key }).describe().encrypted).toBe(true);
    expect(() => from({ ...S3, MEDIA_DOCUMENTS_ENCRYPTION_KEY: "short" })).toThrow(/32 bytes/);
  });
});
