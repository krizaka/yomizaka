import { z } from "zod";

import { refuse } from "../http";

/** The pure rules of the organisation (ADR-0007): names, tag colours, the `tags` filter, the paths, the delete choice. */
// @fixed: the length of the name columns and of the field in the UI
export const NAME_MAX = 80;
export const TAG_COLORS = ["blue", "green", "amber", "red", "violet", "gray"] as const;
export type TagColor = (typeof TAG_COLORS)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export function cleanName(raw: string): string {
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name) throw refuse(400, "BAD_REQUEST", "A name is required");
  if (name.length > NAME_MAX) throw refuse(400, "BAD_REQUEST", `A name is at most ${NAME_MAX} characters`);
  return name;
}

/** `?tags=a,b` (or the repeated form) → the ids, in order, without duplicates and without anything that is not an id. */
export function parseTagsParam(value: string | string[] | undefined): string[] {
  const parts = (Array.isArray(value) ? value : [value ?? ""]).flatMap((v) => v.split(","));
  return [...new Set(parts.map((p) => p.trim()).filter(isId))];
}

export const toggleTag = (current: readonly string[], id: string): string[] => (current.includes(id) ? current.filter((t) => t !== id) : [...current, id]);

/** The same view with another set of tags: the URL is the state. */
export const tagsHref = (path: string, tags: readonly string[]): string => (tags.length ? `${path}?tags=${tags.join(",")}` : path);

export function libraryPath(locale: string, library: string, collection?: string, folder?: string): string {
  return ["", locale, "app", "bibliotheque", library, collection, collection ? folder : undefined].filter((p) => p !== undefined).join("/");
}

const choice = z.object({ files: z.enum(["move", "delete"]), to: z.string().nullish() });
export type DeleteChoice = { files: "delete" } | { files: "move"; to: string | null };

/** A deletion always states what becomes of the files: moved (to a collection, or up / to « Sans collection » when `to` is null) or deleted. */
export function deleteChoice(input: unknown): DeleteChoice {
  const parsed = choice.safeParse(input);
  if (!parsed.success) throw refuse(400, "BAD_REQUEST", "Say what happens to the files: move or delete");
  if (parsed.data.files === "delete") return { files: "delete" };
  const to = parsed.data.to ?? null;
  if (to !== null && !isId(to)) throw refuse(400, "BAD_REQUEST", "Not a destination");
  return { files: "move", to };
}
