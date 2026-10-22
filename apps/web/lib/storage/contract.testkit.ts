import { expect, it } from "vitest";

import type { DocumentStore } from "./port";

/** What every DocumentStore adapter must do (ADR-0007): the same behaviour behind the same port. */
export function documentStoreContract(name: string, make: () => DocumentStore | Promise<DocumentStore>) {
  const id = () => `contract/${Math.random().toString(36).slice(2)}/doc.pdf`;
  const bytes = () => new Uint8Array([37, 80, 68, 70, 0, 255, 1, 2, 3]);

  it(`${name}: keeps what it is given, byte for byte, with its content type`, async () => {
    const store = await make();
    const key = id();
    await store.put(key, bytes(), { contentType: "application/pdf" });
    const got = await store.get(key);
    expect(got).not.toBeNull();
    expect([...got!.bytes]).toEqual([...bytes()]);
    expect(got!.contentType).toBe("application/pdf");
    await store.delete(key);
  });

  it(`${name}: answers null for what is not there, and deleting it twice is fine`, async () => {
    const store = await make();
    const key = id();
    expect(await store.get(key)).toBeNull();
    await store.delete(key);
    await store.put(key, bytes(), { contentType: "text/plain" });
    await store.delete(key);
    await store.delete(key);
    expect(await store.get(key)).toBeNull();
  });

  it(`${name}: refuses a key that could leave its prefix`, async () => {
    const store = await make();
    for (const bad of ["../x", "a/../b", "/abs", "a//b", "UPPER/case", "a/b/", ""]) await expect(store.put(bad, bytes(), { contentType: "text/plain" })).rejects.toMatchObject({ status: 400 });
  });

  it(`${name}: says where it lives`, async () => {
    const d = (await make()).describe();
    expect(["none", "database", "bunny", "s3", "device"]).toContain(d.kind);
    expect(typeof d.encrypted).toBe("boolean");
    expect(["canada", "elsewhere", "unknown", "device"]).toContain(d.residency);
  });
}
