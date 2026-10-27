import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The server/client boundary (yomizaka#457): React error #441 on « Dossiers » came from a server page calling a function
 * that `@krizaka/ui/filter-bar` exports from a `"use client"` module ("Attempted to call readFilterParams() from the server").
 * Unit tests never see it (vitest ignores the directive) and a build does not either. This walks what the server renders —
 * the pages, layouts and routes, and every module they import until a `"use client"` file — and refuses a **value** import
 * from a client module of `@krizaka/*`: render it, or move the function to a plain module.
 */
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLIENT = /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*["']use client["']/;
const IMPORT = /^(import|export)\s+(type\s+)?([^;]*?)\s+from\s+["']([^"']+)["']/gm;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === ".next") return [];
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const resolveLocal = (from: string, spec: string): string | null => {
  const base = spec.startsWith("@/") ? join(ROOT, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
};

/** Is the package module a client module? Reads the built entry's first line. */
const packageIsClient = (spec: string): boolean => {
  const [scope, name, ...rest] = spec.split("/");
  const entry = join(ROOT, "node_modules", scope, name, "dist", `${rest.join("/") || "index"}.js`);
  return existsSync(entry) && /^["']use client["']/.test(readFileSync(entry, "utf8").trimStart());
};

/** The value imports a file makes (a type-only import, or only `type` specifiers, is erased and harmless). */
const valueImports = (source: string): { spec: string; names: string }[] =>
  [...source.matchAll(IMPORT)]
    .filter((m) => !m[2] && m[1] === "import")
    .map((m) => ({ spec: m[4], names: m[3] }))
    .filter(({ names }) => names.replace(/\{|\}/g, "").split(",").some((n) => n.trim() && !n.trim().startsWith("type ")));

/** Every file the server renders: the entries, then what they import, stopping at a `"use client"` file. */
export const serverGraph = () => {
  const entries = walk(join(ROOT, "app")).filter((f) => /(?:^|\/)(?:page|layout|route|error|loading|not-found|default)\.tsx?$/.test(f) && !/\.test\./.test(f));
  const seen = new Set<string>();
  const offences: string[] = [];
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    if (CLIENT.test(source)) return;
    for (const { spec, names } of valueImports(source)) {
      if (spec.startsWith("@krizaka/")) {
        if (packageIsClient(spec) && /\b(?:use[A-Z]|read[A-Z]|write[A-Z]|[a-z]\w*(?=\s*[,}]))/.test(names)) offences.push(`${relative(ROOT, file)} imports ${names.trim()} from ${spec} ("use client")`);
        continue;
      }
      const local = resolveLocal(file, spec);
      if (local) visit(local);
    }
  };
  for (const entry of entries) visit(entry);
  return { seen, offences };
};

describe("the server never calls a client module's function (React #441)", () => {
  it("no server-rendered module imports a function from a \"use client\" @krizaka module", () => {
    const { seen, offences } = serverGraph();
    expect(seen.size).toBeGreaterThan(50);
    expect(offences).toEqual([]);
  });
});
