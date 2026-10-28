import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ADR-0012 guard: a document's bytes live in the store, never in `documents.content` (BYTEA). This reads the SQL of the code that
 * writes to `documents` and refuses a write of anything but `''::bytea` into that column. KNOWN is empty: the demo seed puts its bytes in the working store and the e2e fixture writes none; a file added there needs a reason.
 */
const KNOWN = new Set<string>([]);
/**
 * The one adapter that may write document bytes to PostgreSQL, into its own table `document_blobs` (the `database` working store for
 * a deployed environment without a bucket), and its twin: the demo seed cannot import TypeScript, so it writes the same table with the
 * same statement. Anything else that writes `document_blobs` is a second adapter and fails here.
 */
const ADAPTERS = new Set(["apps/web/lib/storage/database.ts", "scripts/demo-seed/seed.mjs"]);
const EMPTY = "''::bytea";

/** Splits a SQL list on its top-level commas (parentheses and quotes respected). */
export function splitTopLevel(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = false;
  let from = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === "'") quote = !quote;
    else if (!quote && c === "(") depth++;
    else if (!quote && c === ")") depth--;
    else if (!quote && depth === 0 && c === ",") {
      parts.push(list.slice(from, i).trim());
      from = i + 1;
    }
  }
  parts.push(list.slice(from).trim());
  return parts;
}

/** The text between the parenthesis opened at `open` and its match. */
function balanced(source: string, open: number): string {
  let depth = 0;
  let quote = false;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === "'") quote = !quote;
    else if (!quote && c === "(") depth++;
    else if (!quote && c === ")" && --depth === 0) return source.slice(open + 1, i);
  }
  return "";
}

/** The writes of bytes to `documents.content` in a piece of source: each is a violation. */
export function byteWrites(source: string): string[] {
  const found: string[] = [];
  for (const m of source.matchAll(/INSERT INTO documents\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const columns = splitTopLevel(balanced(source, open));
    const at = columns.findIndex((c) => c === "content");
    if (at < 0) continue;
    const after = open + balanced(source, open).length + 2;
    const values = /^\s*VALUES\s*\(/.exec(source.slice(after));
    const value = values ? splitTopLevel(balanced(source, after + values[0].length - 1))[at] : undefined;
    if (value !== EMPTY) found.push(`INSERT INTO documents … content = ${value ?? "?"}`);
  }
  for (const m of source.matchAll(/UPDATE documents SET([\s\S]*?)\sWHERE/g)) {
    for (const assignment of splitTopLevel(m[1]!)) {
      const [name, ...rest] = assignment.split("=");
      if (name?.trim() === "content" && rest.join("=").trim() !== EMPTY) found.push(`UPDATE documents SET ${assignment}`);
    }
  }
  return found;
}

/** The writes to the adapter's table in a piece of source. */
export const blobWrites = (source: string): string[] => [...source.matchAll(/(?:INSERT INTO|UPDATE)\s+document_blobs\b/g)].map((m) => m[0]);

describe("blobWrites (the adapter's table)", () => {
  it("sees an insert or an update of document_blobs, and nothing else", () => {
    expect(blobWrites("INSERT INTO document_blobs (object_key, bytes) VALUES ($1, $2)")).toHaveLength(1);
    expect(blobWrites("UPDATE document_blobs SET bytes = $2 WHERE object_key = $1")).toHaveLength(1);
    expect(blobWrites("SELECT bytes FROM document_blobs WHERE object_key = $1")).toEqual([]);
    expect(blobWrites("DELETE FROM document_blobs WHERE object_key = $1")).toEqual([]);
  });
});

describe("byteWrites (the rule)", () => {
  it("refuses bytes written to the column, by insert or update", () => {
    expect(byteWrites("INSERT INTO documents (owner_id, content, text) VALUES ($1, $2, $3)")).toHaveLength(1);
    expect(byteWrites("INSERT INTO documents (owner_id, content) VALUES ($1, 'bail')")).toHaveLength(1);
    expect(byteWrites("UPDATE documents SET content = $3, text = $4 WHERE id = $1")).toHaveLength(1);
  });

  it("accepts an empty column, a row without the column, and updates of other columns", () => {
    expect(byteWrites("INSERT INTO documents (owner_id, content, object_key) VALUES ($1, ''::bytea, $2)")).toEqual([]);
    expect(byteWrites("INSERT INTO documents (owner_id, title) VALUES ($1, $2)")).toEqual([]);
    expect(byteWrites("UPDATE documents SET content = ''::bytea, text = '' WHERE id = $1")).toEqual([]);
    expect(byteWrites("UPDATE documents SET text = $2, extraction = 'done' WHERE id = $1")).toEqual([]);
  });
});

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === ".next") return [];
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx|mjs)$/.test(name) && !/\.test\.|\.integration\./.test(name) ? [path] : [];
  });
}

describe("no new write of document bytes to PostgreSQL (ADR-0012)", () => {
  const root = join(__dirname, "..", "..", "..");
  const files = ["apps/web/lib", "apps/web/app", "scripts"].flatMap((d) => sources(join(root, d)));

  it("every write to documents.content is empty, except the known fixtures", () => {
    const offenders = files.map((f) => [relative(root, f), byteWrites(readFileSync(f, "utf8"))] as const).filter(([, w]) => w.length > 0);
    expect(offenders.filter(([f]) => !KNOWN.has(f))).toEqual([]);
  });

  it("the known list holds only files that still write bytes (it only goes down)", () => {
    const offending = new Set(files.map((f) => [relative(root, f), byteWrites(readFileSync(f, "utf8"))] as const).filter(([, w]) => w.length > 0).map(([f]) => f));
    expect([...KNOWN].filter((f) => !offending.has(f))).toEqual([]);
  });

  it("only the adapter (and its seed twin) writes document_blobs, and both still do", () => {
    const writers = new Set(files.filter((f) => blobWrites(readFileSync(f, "utf8")).length > 0).map((f) => relative(root, f)));
    expect([...writers].filter((f) => !ADAPTERS.has(f))).toEqual([]);
    expect([...ADAPTERS].filter((f) => !writers.has(f))).toEqual([]);
  });
});
