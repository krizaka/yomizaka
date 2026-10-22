import { beforeAll, describe, expect, it } from "vitest";

import { migrate, query } from "../db";
import * as org from "./store";

/** The organisation against a real PostgreSQL (skipped without YOMIZAKA_DB_IT=1 and DATABASE_URL, like billing.integration.test.ts). */
const enabled = process.env.YOMIZAKA_DB_IT === "1" && !!process.env.DATABASE_URL;

describe.runIf(enabled)("organisation (ADR-0007)", () => {
  beforeAll(async () => {
    await migrate();
  });
  const account = async () => (await query<{ id: string }>("INSERT INTO accounts (email, password_hash, email_verified_at) VALUES ($1, 'x', now()) RETURNING id", [`o-${Math.random().toString(36).slice(2)}@yomizaka.test`]))[0]!.id;
  const doc = async (owner: string) => (await query<{ id: string }>("INSERT INTO documents (owner_id, title, filename, mime_type, size_bytes, sha256, content) VALUES ($1, 't', 'f.txt', 'text/plain', 1, $2, 'x') RETURNING id", [owner, Math.random().toString(36)]))[0]!.id;
  const where = async (id: string) => (await query<{ collection_id: string | null; folder_id: string | null }>("SELECT collection_id, folder_id FROM documents WHERE id = $1", [id]))[0]!;

  it("gives every owner one default library, once", async () => {
    const owner = await account();
    const a = await org.ensureLibrary(query, owner, "Ma bibliothèque");
    const b = await org.ensureLibrary(query, owner, "Ma bibliothèque");
    expect(a.id).toBe(b.id);
  });

  it("places a document in a collection or a folder of the same collection, never a foreign one", async () => {
    const owner = await account();
    const lib = await org.ensureLibrary(query, owner, "L");
    const c1 = await org.createCollection(query, owner, lib.id, "Baux");
    const c2 = await org.createCollection(query, owner, lib.id, "Factures");
    const f = await org.createFolder(query, owner, c1.id, "2026");
    const d = await doc(owner);
    await org.placeDocument(query, owner, d, { collectionId: c1.id, folderId: f.id });
    expect(await where(d)).toEqual({ collection_id: c1.id, folder_id: f.id });
    await expect(org.placeDocument(query, owner, d, { collectionId: c2.id, folderId: f.id })).rejects.toMatchObject({ status: 400 });
    await org.placeDocument(query, owner, d, { collectionId: null, folderId: null });
    expect(await where(d)).toEqual({ collection_id: null, folder_id: null });
    const stranger = await account();
    await expect(org.placeDocument(query, stranger, d, { collectionId: c1.id, folderId: null })).rejects.toMatchObject({ status: 404 });
  });

  it("refuses a duplicate name in the same place", async () => {
    const owner = await account();
    const lib = await org.ensureLibrary(query, owner, "L");
    await org.createCollection(query, owner, lib.id, "Baux");
    await expect(org.createCollection(query, owner, lib.id, "Baux")).rejects.toMatchObject({ status: 409, body: { code: "NAME_TAKEN" } });
  });

  it("deleting a folder asks: move the files up to the collection, or delete them", async () => {
    const owner = await account();
    const lib = await org.ensureLibrary(query, owner, "L");
    const c = await org.createCollection(query, owner, lib.id, "C");
    const f1 = await org.createFolder(query, owner, c.id, "a");
    const f2 = await org.createFolder(query, owner, c.id, "b");
    const d1 = await doc(owner);
    const d2 = await doc(owner);
    await org.placeDocument(query, owner, d1, { collectionId: c.id, folderId: f1.id });
    await org.placeDocument(query, owner, d2, { collectionId: c.id, folderId: f2.id });
    await org.deleteFolder(query, owner, f1.id, { files: "move", to: null });
    expect(await where(d1)).toEqual({ collection_id: c.id, folder_id: null });
    await org.deleteFolder(query, owner, f2.id, { files: "delete" });
    expect(await query("SELECT 1 FROM documents WHERE id = $1", [d2])).toHaveLength(0);
  });

  it("deleting a collection moves its files to another collection or to « sans collection », or deletes them", async () => {
    const owner = await account();
    const lib = await org.ensureLibrary(query, owner, "L");
    const c1 = await org.createCollection(query, owner, lib.id, "one");
    const c2 = await org.createCollection(query, owner, lib.id, "two");
    const c3 = await org.createCollection(query, owner, lib.id, "three");
    const f = await org.createFolder(query, owner, c1.id, "f");
    const d1 = await doc(owner);
    const d2 = await doc(owner);
    await org.placeDocument(query, owner, d1, { collectionId: c1.id, folderId: f.id });
    await org.placeDocument(query, owner, d2, { collectionId: c3.id, folderId: null });
    await org.deleteCollection(query, owner, c1.id, { files: "move", to: c2.id });
    expect(await where(d1)).toEqual({ collection_id: c2.id, folder_id: null });
    await org.deleteCollection(query, owner, c3.id, { files: "move", to: null });
    expect(await where(d2)).toEqual({ collection_id: null, folder_id: null });
    await org.deleteCollection(query, owner, c2.id, { files: "delete" });
    expect(await query("SELECT 1 FROM documents WHERE id = $1", [d1])).toHaveLength(0);
  });

  it("moving a folder takes its files along", async () => {
    const owner = await account();
    const lib = await org.ensureLibrary(query, owner, "L");
    const c1 = await org.createCollection(query, owner, lib.id, "one");
    const c2 = await org.createCollection(query, owner, lib.id, "two");
    const f = await org.createFolder(query, owner, c1.id, "f");
    const d = await doc(owner);
    await org.placeDocument(query, owner, d, { collectionId: c1.id, folderId: f.id });
    await org.moveFolder(query, owner, f.id, c2.id);
    expect(await where(d)).toEqual({ collection_id: c2.id, folder_id: f.id });
  });

  it("tags: per owner, unique by name, many to many, and the filter needs all of them", async () => {
    const owner = await account();
    const lib = await org.ensureLibrary(query, owner, "L");
    const c = await org.createCollection(query, owner, lib.id, "C");
    const urgent = await org.createTag(query, owner, "Urgent", "red");
    const done = await org.createTag(query, owner, "Fait", "green");
    await expect(org.createTag(query, owner, "urgent", "blue")).rejects.toMatchObject({ status: 409 });
    const d1 = await doc(owner);
    const d2 = await doc(owner);
    await org.placeDocument(query, owner, d1, { collectionId: c.id, folderId: null });
    await org.placeDocument(query, owner, d2, { collectionId: c.id, folderId: null });
    await org.setTags(query, owner, { kind: "document", id: d1 }, [urgent.id, done.id]);
    await org.setTags(query, owner, { kind: "document", id: d2 }, [urgent.id]);
    await org.setTags(query, owner, { kind: "collection", id: c.id }, [done.id]);
    expect((await org.browse(query, owner, { collectionId: c.id, tagIds: [urgent.id] })).documentIds.sort()).toEqual([d1, d2].sort());
    expect((await org.browse(query, owner, { collectionId: c.id, tagIds: [urgent.id, done.id] })).documentIds).toEqual([d1]);
    expect((await org.tagsOf(query, owner, "document", [d1, d2])).get(d1)?.map((t) => t.name).sort()).toEqual(["Fait", "Urgent"]);
    const other = await account();
    await expect(org.setTags(query, other, { kind: "document", id: d1 }, [urgent.id])).rejects.toMatchObject({ status: 404 });
    await org.deleteTag(query, owner, urgent.id);
    expect((await org.browse(query, owner, { collectionId: c.id, tagIds: [] })).documentIds.sort()).toEqual([d1, d2].sort());
  });

  it("browse: a collection root shows the files not in a folder, a folder shows its own; recents and unfiled are separate", async () => {
    const owner = await account();
    const lib = await org.ensureLibrary(query, owner, "L");
    const c = await org.createCollection(query, owner, lib.id, "C");
    const f = await org.createFolder(query, owner, c.id, "f");
    const root = await doc(owner);
    const inFolder = await doc(owner);
    const loose = await doc(owner);
    await org.placeDocument(query, owner, root, { collectionId: c.id, folderId: null });
    await org.placeDocument(query, owner, inFolder, { collectionId: c.id, folderId: f.id });
    expect((await org.browse(query, owner, { collectionId: c.id, tagIds: [] })).documentIds).toEqual([root]);
    expect((await org.browse(query, owner, { collectionId: c.id, folderId: f.id, tagIds: [] })).documentIds).toEqual([inFolder]);
    expect(await org.unfiledIds(query, owner)).toEqual([loose]);
    expect((await org.recentIds(query, owner, 10)).sort()).toEqual([root, inFolder, loose].sort());
  });
});
