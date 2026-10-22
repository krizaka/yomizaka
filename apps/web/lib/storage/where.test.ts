import { describe, expect, it } from "vitest";

import { storageNotice, storedAs } from "./where";

const D = { endpoint: null, region: null, residency: "unknown", encrypted: false, owner: "krizaka", devOnly: false } as const;

describe("where a document lives, as the info panel says it", () => {
  it("not kept", () => {
    expect(storageNotice({ ...D, kind: "none" })).toEqual({ key: "none", vars: {} });
  });
  it("kept by Krizaka in Canada, encrypted — the database of the Toronto region and Spaces tor1 alike", () => {
    expect(storageNotice({ ...D, kind: "database", region: "tor1", residency: "canada", encrypted: true })).toEqual({ key: "krizakaCanadaEncrypted", vars: {} });
    expect(storageNotice({ ...D, kind: "s3", endpoint: "tor1.digitaloceanspaces.com", region: "tor1", residency: "canada", encrypted: true })).toEqual({ key: "krizakaCanadaEncrypted", vars: {} });
    expect(storageNotice({ ...D, kind: "s3", residency: "canada", encrypted: false })).toEqual({ key: "krizakaCanada", vars: {} });
  });
  it("kept by Krizaka outside Canada says the region", () => {
    expect(storageNotice({ ...D, kind: "s3", region: "eu-west-3", residency: "elsewhere" })).toEqual({ key: "krizakaElsewhere", vars: { region: "eu-west-3" } });
  });
  it("kept on the workspace's own storage says the host and the region", () => {
    expect(storageNotice({ ...D, kind: "s3", owner: "workspace", endpoint: "s3.example.com", region: "ca-central-1", residency: "canada" })).toEqual({ key: "workspace", vars: { endpoint: "s3.example.com", region: "ca-central-1" } });
  });
  it("the development store says it is for fictional data", () => {
    expect(storageNotice({ ...D, kind: "bunny", residency: "elsewhere", devOnly: true })).toEqual({ key: "devOnly", vars: {} });
  });
  it("on the device", () => {
    expect(storageNotice({ ...D, kind: "device", owner: "device", residency: "device" })).toEqual({ key: "device", vars: {} });
  });
});

describe("a stored document's descriptor", () => {
  const active = { ...D, kind: "s3", endpoint: "tor1.digitaloceanspaces.com", region: "tor1", residency: "canada", encrypted: true } as const;
  it("follows its own kind: in the database, not kept, or on the active store when it is the same", () => {
    expect(storedAs("database", active)).toMatchObject({ kind: "database", residency: "canada", encrypted: true });
    expect(storedAs("none", active)).toMatchObject({ kind: "none" });
    expect(storedAs("s3", active)).toEqual(active);
  });
  it("a document on a store that is no longer configured says only its kind, with an unknown residency", () => {
    expect(storedAs("bunny", active)).toMatchObject({ kind: "bunny", residency: "unknown", devOnly: true });
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("the info panel", () => {
  it("is on the document's information tab and offers « Supprimer maintenant »", () => {
    const view = readFileSync(join(__dirname, "../../components/console/DocumentView.tsx"), "utf8");
    expect(view).toContain("<StorageNotice storage={doc.storage}");
    expect(readFileSync(join(__dirname, "../../components/console/StorageNotice.tsx"), "utf8")).toContain("document.where.deleteNow");
  });
});
