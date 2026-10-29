/**
 * Bookmarks on the documents (yomizaka#339): the person's own tags of kind « document » read as a filter. Pure: the page loads the
 * ids and the tags of each, these rules say which documents remain — a document must wear **every** bookmark asked for (the same
 * rule as a place's `?tags=`), and a bookmark that no longer exists is ignored, never an empty list.
 */
export type BookmarkRef = { id: string };

/** The ids that wear all of `selected`, in their order. No bookmark asked for: all of them. */
export function wearingAll(ids: readonly string[], tagsByDocument: Readonly<Record<string, readonly BookmarkRef[]>>, selected: readonly string[]): string[] {
  if (selected.length === 0) return [...ids];
  return ids.filter((id) => {
    const worn = new Set((tagsByDocument[id] ?? []).map((t) => t.id));
    return selected.every((s) => worn.has(s));
  });
}

/** What the address may ask for: only the bookmarks the person has (an id that was deleted or is not theirs falls away). */
export function knownBookmarks(selected: readonly string[], owned: readonly BookmarkRef[]): string[] {
  const own = new Set(owned.map((t) => t.id));
  return selected.filter((s) => own.has(s));
}

/** The bookmarks a document wears after one is applied (`on`) or lifted; never twice, the others untouched. */
export function withBookmark(worn: readonly string[], id: string, on: boolean): string[] {
  if (!on) return worn.filter((w) => w !== id);
  return worn.includes(id) ? [...worn] : [...worn, id];
}
