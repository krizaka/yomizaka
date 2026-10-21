// Cahier (krizaka-ui ADR-004, #417): this app's own sources carry none of the template tells the family retired — no
// uppercase tracked label, no frosted backdrop, no pill on a control or a label (a dot or an avatar stays round), no card
// corner of 10 px or more in its stylesheets. The identity itself comes from @krizaka/ui ≥ 3.38 and @krizaka/fonts ≥ 0.3.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (["node_modules", ".next", "fixtures"].includes(name)) return [];
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx|css)$/.test(name) && !/\.(test|stories)\./.test(name) ? [path] : [];
  });
}
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const sources = ["app", "components"].flatMap((d) => { try { return files(join(ROOT, d)); } catch { return []; } }).map((f) => [f.slice(ROOT.length + 1), code(readFileSync(f, "utf8"))] as const);

describe("Cahier: no template tell in this app's own sources", () => {
  it("no uppercase tracked label", () => {
    for (const [f, s] of sources) {
      expect(s, f).not.toMatch(/["'`\s]uppercase["'`\s]|text-transform:\s*uppercase|textTransform: "uppercase"/);
      expect(s, f).not.toMatch(/tracking-(wider|widest)|letter-spacing:\s*0?\.(0[4-9]|[1-9])/);
    }
  });
  it("no frosted backdrop", () => {
    for (const [f, s] of sources) expect(s, f).not.toMatch(/backdrop-blur|backdrop-filter|backdropFilter/);
  });
  it("no pill on a control or a label, no round card in the stylesheets", () => {
    for (const [f, s] of sources) {
      for (const cls of s.match(/"[^"\n]*rounded-full[^"\n]*"/g) ?? []) expect(cls, f).toMatch(/\b(?:h-([\d.]+) w-\1|size-[\w.[\]-]+|w-([\d.]+) h-\2|h-1\.5 w-1\.5)\b/);
      if (f.endsWith(".css")) for (const m of s.matchAll(/border-radius:\s*(\d+)px/g)) expect(Number(m[1]) < 10 || Number(m[1]) >= 999, `${f}: ${m[1]}px`).toBe(true);
    }
  });
});
