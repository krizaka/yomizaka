import crypto from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { migrate, query } from "../db";
import { memoryStore } from "./memory";
import { loadSettings, ownS3Store, saveSettings, storeForOwner } from "./settings";

/** The workspace's storage settings against a real PostgreSQL (skipped without YOMIZAKA_DB_IT=1 and DATABASE_URL). */
const enabled = process.env.YOMIZAKA_DB_IT === "1" && !!process.env.DATABASE_URL;
const NOW = new Date("2026-10-22T12:00:00Z");
const S3 = { endpoint: "https://s3.example.com", region: "ca-central-1", bucket: "docs", accessKeyId: "AKIAEXAMPLE", secretAccessKey: "s3-secret-value" };

describe.runIf(enabled)("storage settings (ADR-0007)", () => {
  beforeAll(async () => {
    await migrate();
  });
  const key = crypto.randomBytes(32);
  const account = async () => (await query<{ id: string }>("INSERT INTO accounts (email, password_hash, email_verified_at) VALUES ($1, 'x', now()) RETURNING id", [`s-${Math.random().toString(36).slice(2)}@yomizaka.test`]))[0]!.id;

  it("defaults to Krizaka's store, keeping off by default", async () => {
    expect(await loadSettings(query, await account())).toEqual({ mode: "krizaka", keepDefault: false, s3: null, testedAt: null });
  });

  it("saves an own S3 with its secret sealed: never in clear in the database, never returned", async () => {
    const owner = await account();
    const saved = await saveSettings(query, owner, { mode: "s3", keepDefault: true, s3: S3 }, key, NOW);
    expect(saved).toMatchObject({ mode: "s3", keepDefault: true, s3: { endpoint: "https://s3.example.com", region: "ca-central-1", bucket: "docs", accessKeyId: "AKIAEXAMPLE", hasSecret: true }, testedAt: NOW.toISOString() });
    expect(JSON.stringify(saved)).not.toContain("s3-secret-value");
    const [raw] = await query<{ s3_secret_sealed: string }>("SELECT s3_secret_sealed FROM storage_settings WHERE owner_id = $1", [owner]);
    expect(raw!.s3_secret_sealed).toMatch(/^v1\./);
    expect(raw!.s3_secret_sealed).not.toContain("s3-secret-value");
  });

  it("keeps the stored secret when a save gives none, and replaces it when it gives one", async () => {
    const owner = await account();
    await saveSettings(query, owner, { mode: "s3", keepDefault: false, s3: S3 }, key, NOW);
    const [before] = await query<{ s: string }>("SELECT s3_secret_sealed AS s FROM storage_settings WHERE owner_id = $1", [owner]);
    await saveSettings(query, owner, { mode: "s3", keepDefault: false, s3: { ...S3, bucket: "other", secretAccessKey: undefined } }, key, NOW);
    expect((await query<{ s: string }>("SELECT s3_secret_sealed AS s FROM storage_settings WHERE owner_id = $1", [owner]))[0]!.s).toBe(before!.s);
    await saveSettings(query, owner, { mode: "s3", keepDefault: false, s3: { ...S3, secretAccessKey: "new" } }, key, NOW);
    expect((await query<{ s: string }>("SELECT s3_secret_sealed AS s FROM storage_settings WHERE owner_id = $1", [owner]))[0]!.s).not.toBe(before!.s);
  });

  it("refuses to store credentials without the deployment's key, and an incomplete S3", async () => {
    const owner = await account();
    await expect(saveSettings(query, owner, { mode: "s3", keepDefault: false, s3: S3 }, null, NOW)).rejects.toMatchObject({ status: 503, body: { code: "SETTINGS_KEY_MISSING" } });
    await expect(saveSettings(query, owner, { mode: "s3", keepDefault: false, s3: { ...S3, bucket: "" } }, key, NOW)).rejects.toMatchObject({ status: 400 });
    await expect(saveSettings(query, owner, { mode: "s3", keepDefault: false, s3: { ...S3, secretAccessKey: undefined } }, key, NOW)).rejects.toMatchObject({ status: 400 });
  });

  it("nothing can be kept by default when keeping is switched off", async () => {
    await expect(saveSettings(query, await account(), { mode: "none", keepDefault: true }, key, NOW)).rejects.toMatchObject({ status: 400 });
  });

  it("the owner's S3 becomes a store that says it is the workspace's, with its host and region", async () => {
    const owner = await account();
    expect(await ownS3Store(query, owner, key, () => NOW)).toBeNull();
    await saveSettings(query, owner, { mode: "s3", keepDefault: false, s3: S3 }, key, NOW);
    const store = await ownS3Store(query, owner, key, () => NOW);
    expect(store!.describe()).toMatchObject({ kind: "s3", owner: "workspace", endpoint: "s3.example.com", region: "ca-central-1", residency: "canada", devOnly: false });
    expect(await ownS3Store(query, owner, null, () => NOW)).toBeNull();
  });

  it("which store an owner's documents use: nothing, Krizaka's, or their own", async () => {
    const owner = await account();
    const krizaka = memoryStore({ kind: "s3" });
    expect((await storeForOwner(query, owner, key, krizaka, () => NOW)).store).toBe(krizaka);
    await saveSettings(query, owner, { mode: "none", keepDefault: false }, key, NOW);
    expect((await storeForOwner(query, owner, key, krizaka, () => NOW)).store.describe().kind).toBe("none");
    await saveSettings(query, owner, { mode: "s3", keepDefault: false, s3: S3 }, key, NOW);
    expect((await storeForOwner(query, owner, key, krizaka, () => NOW)).store.describe().owner).toBe("workspace");
    await expect(storeForOwner(query, owner, null, krizaka, () => NOW)).rejects.toMatchObject({ status: 503, body: { code: "STORAGE_UNAVAILABLE" } });
  });
});
