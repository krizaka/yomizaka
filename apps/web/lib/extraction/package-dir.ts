import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * The folder of an installed package, found by walking up from `from`: `node_modules/<name>` first, then the pnpm store
 * (`node_modules/.pnpm/<name>@…/node_modules/<name>`).
 *
 * Why not `require.resolve(name)`: the production build (Turbopack) rewrites it into the module id of the bundle (a number), and
 * the worker of lib/extraction/isolated.ts, which runs from a string, then received `require(669405)` — every PDF failed with
 * UNREADABLE_FILE on dev while every unit test was green (2026-10-29). In the standalone image the package is only in the store.
 */
export function findPackageDir(name: string, from: string = process.cwd()): string {
  for (let dir = from; ; dir = dirname(dir)) {
    const linked = join(dir, "node_modules", name);
    if (existsSync(join(linked, "package.json"))) return linked;
    const store = join(dir, "node_modules", ".pnpm");
    if (existsSync(store)) {
      const entry = readdirSync(store).find((d) => d.startsWith(`${name}@`));
      const candidate = entry ? join(store, entry, "node_modules", name) : null;
      if (candidate && existsSync(join(candidate, "package.json"))) return candidate;
    }
    if (dirname(dir) === dir) throw new Error(`The package ${name} is not installed above ${from}`);
  }
}
