import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

// One page change, one system: Krizaka UI's PageTransition wraps the page content once, in the root layout. Its cross-fade
// and the instant change under prefers-reduced-motion live in @krizaka/ui's motion.css (tested there).
describe("page transitions", () => {
  const layout = read("app/[locale]/layout.tsx");

  it("the root layout wraps the page content in PageTransition from @krizaka/ui/motion, once", () => {
    expect(layout).toMatch(/import \{[^}]*\bPageTransition\b[^}]*\} from "@krizaka\/ui\/motion"/);
    expect(layout.match(/<PageTransition>/g)).toHaveLength(1);
    expect(layout).toMatch(/<PageTransition>\s*\{children\}\s*<\/PageTransition>/);
  });

  it("the stylesheet that carries the transition (and its reduced-motion rule) is loaded: the @krizaka/tailwind preset imports motion.css", () => {
    expect(read("app/globals.css")).toMatch(/@import "@krizaka\/tailwind/);
    expect(readFileSync(join(ROOT, "node_modules/@krizaka/tailwind/index.css"), "utf8")).toContain("@krizaka/ui/motion.css");
    expect(readFileSync(join(ROOT, "node_modules/@krizaka/ui/dist/motion.css"), "utf8")).toMatch(/prefers-reduced-motion[^}]*[\s\S]*::view-transition-old\(\*\)/);
  });
});
