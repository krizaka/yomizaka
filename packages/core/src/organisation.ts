import { DOCUMENT_KINDS, DOCUMENT_STATUSES } from "./vocabulary";

type DocumentKind = (typeof DOCUMENT_KINDS)[number];
type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** The pure rules of the organisation (ADR-0007): names, tag colours, the `tags` filter, the paths, the delete choice. */
// @fixed: the length of the name columns and of the field in the UI
export const NAME_MAX = 80;
export const TAG_COLORS = ["blue", "green", "amber", "red", "violet", "gray"] as const;
export type TagColor = (typeof TAG_COLORS)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** `?tags=a,b` (or the repeated form) → the ids, in order, without duplicates and without anything that is not an id. */
export function parseTagsParam(value: string | string[] | undefined): string[] {
  const parts = (Array.isArray(value) ? value : [value ?? ""]).flatMap((v) => v.split(","));
  return [...new Set(parts.map((p) => p.trim()).filter(isId))];
}

export const toggleTag = (current: readonly string[], id: string): string[] =>
  current.includes(id) ? current.filter((t) => t !== id) : [...current, id];

/** The same view with another set of tags: the URL is the state. */
export const tagsHref = (path: string, tags: readonly string[]): string =>
  tags.length ? `${path}?tags=${tags.join(",")}` : path;

/** The filters of a library view: all of them live in the URL (`?tags=…&kind=…&status=…`), so back, forward, refresh and a shared link keep them. */
export interface ViewState {
  tags: string[];
  kind: DocumentKind | null;
  status: DocumentStatus | null;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseView(search: {
  tags?: string | string[];
  kind?: string | string[];
  status?: string | string[];
}): ViewState {
  const kind = one(search.kind);
  const status = one(search.status);
  return {
    tags: parseTagsParam(search.tags),
    kind: (DOCUMENT_KINDS as readonly string[]).includes(kind ?? "") ? (kind as DocumentKind) : null,
    status: (DOCUMENT_STATUSES as readonly string[]).includes(status ?? "") ? (status as DocumentStatus) : null,
  };
}

export function viewHref(path: string, view: ViewState): string {
  const query = [
    view.tags.length ? `tags=${view.tags.join(",")}` : "",
    view.kind ? `kind=${view.kind}` : "",
    view.status ? `status=${view.status}` : "",
  ]
    .filter(Boolean)
    .join("&");
  return query ? `${path}?${query}` : path;
}

/** Keeps the documents that match the kind and the status asked for (the tags are filtered in SQL). */
export function applyFilters<T extends { kind: string; status: string }>(docs: readonly T[], view: ViewState): T[] {
  return docs.filter((d) => (!view.kind || d.kind === view.kind) && (!view.status || d.status === view.status));
}
