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

  it("follows the admin's settings over the environment, for documents and for avatars alike (`resolveStorage`)", () => {
    const admin = { provider: "s3", maxMegabytes: 25, signedUrlSeconds: 60, endpoint: "https://ca-central-1.example.com", region: "ca-central-1", bucket: "other", zone: "", prefix: "ignored", pullHostname: "", publicBaseUrl: "https://public.example.com" } as const;
    const d = storageFrom(readEnv({ APP_ENVIRONMENT: "prod", ...S3 }), () => new Date(), admin).describe();
    expect(d).toMatchObject({ kind: "s3", endpoint: "ca-central-1.example.com", region: "ca-central-1" });
    const avatars = storageFrom(readEnv({ APP_ENVIRONMENT: "prod", ...S3, MEDIA_DOCUMENTS_PREFIX: "yomizaka-avatars" }), () => new Date(), admin);
    expect(avatars.describe().endpoint).toBe("ca-central-1.example.com");
  });

  it("claims Canada only when the region and the endpoint agree", () => {
    expect(from({ ...S3, MEDIA_S3_ENDPOINT: "https://nyc3.digitaloceanspaces.com" }).describe()).toMatchObject({ residency: "elsewhere" });
    expect(from(S3).describe()).toMatchObject({ residency: "canada" });
  });

  it("keeps nothing when the admin chose a provider but the deployment keeps nothing", () => {
    const admin = { provider: "s3", maxMegabytes: 25, signedUrlSeconds: 60, endpoint: "https://tor1.digitaloceanspaces.com", region: "tor1", bucket: "b", zone: "", prefix: "", pullHostname: "", publicBaseUrl: "" } as const;
    expect(storageFrom(readEnv({ APP_ENVIRONMENT: "prod" }), () => new Date(), admin).describe()).toMatchObject({ kind: "none" });
  });
});
