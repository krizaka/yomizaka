import { AVATAR_KIND, type CollectionAvatar } from "@yomizaka/core";

import { inspectUpload } from "../documents";
import { refuse } from "../http";
import { ImageError, type PhotoKind,squareAvatar } from "../images";
import { YOMIZAKA_RULES } from "../preflight/rules";
import type { DocumentStore } from "../storage/port";
import { ownedCollection, type Query } from "./store";

/**
 * A collection's avatar (krizaka/yomizaka#206): one from the set the administrator allows (a seed the UI draws), or an uploaded
 * image — checked by the pre-flight (type by its bytes, size, pixels), made square with no metadata, and kept behind the storage
 * port under its own prefix. A new image is a new version: its address changes, so no cache keeps the old picture.
 */
export interface AvatarRules {
  allowedSeeds: readonly string[];
  maxBytes: number;
  size: number;
}

/** Where an image avatar lives in its store (the store adds its own prefix). */
export const avatarKey = (owner: string, collectionId: string, version: number) => `${owner}/${collectionId}/${version}.jpg`;

const IMAGE_KINDS = ["png", "jpeg", "heic"] as const;

async function current(q: Query, owner: string, id: string): Promise<CollectionAvatar | null> {
  await ownedCollection(q, owner, id);
  const [row] = await q<{ avatar: CollectionAvatar | null }>("SELECT avatar FROM collections WHERE id = $1", [id]);
  return row?.avatar ?? null;
}

const forget = (store: DocumentStore | undefined, owner: string, id: string, avatar: CollectionAvatar | null) => (store && avatar?.kind === AVATAR_KIND.image ? store.delete(avatarKey(owner, id, avatar.version)).catch(() => undefined) : Promise.resolve());

/** An avatar from the set, or none (`null`). A seed outside the allowed set is refused; a stored image it replaces is deleted. */
export async function setSetAvatar(q: Query, owner: string, id: string, seed: string | null, allowed: readonly string[], store?: DocumentStore): Promise<void> {
  const before = await current(q, owner, id);
  if (seed !== null && !allowed.includes(seed)) throw refuse(400, "AVATAR_NOT_ALLOWED", "That avatar is not in the set");
  await q("UPDATE collections SET avatar = $2 WHERE id = $1", [id, seed === null ? null : JSON.stringify({ kind: AVATAR_KIND.set, seed })]);
  await forget(store, owner, id, before);
}

export async function uploadAvatar(q: Query, owner: string, id: string, file: { name: string; type: string; bytes: Uint8Array }, deps: AvatarRules & { store: DocumentStore }): Promise<CollectionAvatar> {
  const before = await current(q, owner, id);
  if (file.bytes.length > deps.maxBytes) throw refuse(413, "AVATAR_TOO_LARGE", `An avatar is at most ${Math.floor(deps.maxBytes / 1024)} KB`);
  const { fileKind } = await inspectUpload({ name: file.name, type: file.type, size: file.bytes.length }, file.bytes, { ...YOMIZAKA_RULES, maxBytes: deps.maxBytes, allowedKinds: IMAGE_KINDS });
  let jpeg: Uint8Array;
  try {
    jpeg = await squareAvatar({ bytes: file.bytes, kind: fileKind as PhotoKind }, deps.size);
  } catch (error) {
    throw error instanceof ImageError ? refuse(422, error.code, "This image cannot be read") : error;
  }
  const version = (before?.kind === AVATAR_KIND.image ? before.version : 0) + 1;
  try {
    await deps.store.put(avatarKey(owner, id, version), jpeg, { contentType: "image/jpeg" });
  } catch {
    throw refuse(502, "AVATAR_STORAGE_UNAVAILABLE", "The storage that keeps avatars did not answer");
  }
  const avatar: CollectionAvatar = { kind: AVATAR_KIND.image, version };
  await q("UPDATE collections SET avatar = $2 WHERE id = $1", [id, JSON.stringify(avatar)]);
  await forget(deps.store, owner, id, before);
  return avatar;
}

/** The image of an image avatar (null for a set avatar or none). */
export async function readAvatar(q: Query, owner: string, id: string, store: DocumentStore): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const avatar = await current(q, owner, id);
  if (avatar?.kind !== AVATAR_KIND.image) return null;
  return store.get(avatarKey(owner, id, avatar.version));
}

/** Back to no avatar; a stored image is deleted. */
export async function removeAvatar(q: Query, owner: string, id: string, store?: DocumentStore): Promise<void> {
  const before = await current(q, owner, id);
  await q("UPDATE collections SET avatar = NULL WHERE id = $1", [id]);
  await forget(store, owner, id, before);
}
