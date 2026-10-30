import { access, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const exists = (path: string): Promise<boolean> => access(path).then(() => true, () => false);

/** The package inside `dir`'s pnpm store, or null. */
async function inPnpmStore(dir: string, name: string): Promise<string | null> {
  const store = join(dir, "node_modules", ".pnpm");
  const entries = await readdir(store).catch(() => null);
  if (!entries) {return null;}
  const entry = entries.find((d) => d.startsWith(`${name}@`));
  const candidate = entry ? join(store, entry, "node_modules", name) : null;
  return candidate && (await exists(join(candidate, "package.json"))) ? candidate : null;
}

/**
 * The folder of an installed package, found by walking up from `from`: `node_modules/<name>` first, then the pnpm store
 * (`node_modules/.pnpm/<name>@…/node_modules/<name>`).
 *
 * Why not `require.resolve(name)`: the production build (Turbopack) rewrites it into the module id of the bundle (a number), and
 * the worker of lib/extraction/isolated.ts, which runs from a string, then received `require(669405)` — every PDF failed with
 * UNREADABLE_FILE on dev while every unit test was green (2026-10-29). In the standalone image the package is only in the store.
 */
export async function findPackageDir(name: string, from: string = process.cwd()): Promise<string> {
  for (let dir = from; ; dir = dirname(dir)) {
    const linked = join(dir, "node_modules", name);
    if (await exists(join(linked, "package.json"))) {return linked;}
    const stored = await inPnpmStore(dir, name);
    if (stored) {return stored;}
    if (dirname(dir) === dir) {throw new Error(`The package ${name} is not installed above ${from}`);}
  }
}
