import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `admin.audit-log`: every operator action is in the audit log. A structural guard — each administration API route that
 * changes something (POST, PUT, PATCH, DELETE) calls a function of `lib/` whose body writes an `audit(...)` entry, and
 * the export of an account (a read of personal data, Law 25) is audited too. A new route that forgets it fails here.
 */
const root = join(__dirname, "..");
const routes = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? routes(path) : name === "route.ts" ? [path] : [];
  });

const bodyOf = (source: string, name: string): string | null => {
  const start = source.search(new RegExp(`export (async )?function ${name}\\b`));
  if (start < 0) return null;
  const next = source.slice(start + 1).search(/\nexport /);
  return next < 0 ? source.slice(start) : source.slice(start, start + 1 + next);
};

describe("the administration's audit trail", () => {
  const files = routes(join(root, "app/api/admin"));
  it("finds the administration routes", () => {
    expect(files.length).toBeGreaterThan(8);
  });
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const changes = /export (async )?function (POST|PUT|PATCH|DELETE)\b/.test(source);
    const isExport = file.includes("/export/");
    if (!changes && !isExport) continue;
    it(`${file.slice(root.length + 1)} writes an audit entry`, () => {
      const imports = [...source.matchAll(/import \{([^}]+)\} from "@\/lib\/([a-z-]+)"/g)].filter(([, , mod]) => !["access", "http", "documents"].includes(mod!));
      const audited = imports.some(([, names, mod]) => {
        const lib = readFileSync(join(root, "lib", `${mod}.ts`), "utf8");
        return names!
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean)
          .some((n) => /\baudit\(/.test(bodyOf(lib, n) ?? ""));
      });
      expect(audited).toBe(true);
    });
  }
});
