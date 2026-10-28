import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";

// The accessibility guard (a bug means a missing guard): axe-core WCAG 2.1 AA in both page audits, held by a ratchet baseline.
const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const SUITES = [
  ["check-overflow.mjs", "a11y-baseline.json"],
  ["check-app-pages.mjs", "a11y-baseline.app.json"],
];

describe("the a11y guard", () => {
  for (const [script, baseline] of SUITES) {
    it(`${script} runs axe through @krizaka/a11y-audit and ratchets against ${baseline}`, () => {
      const source = read(`scripts/${script}`);
      assert.match(source, /from "@krizaka\/a11y-audit"/);
      assert.match(source, /auditA11y\(page\)/);
      assert.match(source, new RegExp(`new URL\\("\\.\\./${baseline.replace(".", "\\.")}"`));
      assert.doesNotMatch(source, /from "axe-core"/, "apps never import axe-core");
    });

    it(`${baseline} holds counts, and no serious or critical rule (those are fixed, not recorded)`, () => {
      const { rules } = JSON.parse(read(baseline));
      for (const [rule, { impact, count }] of Object.entries(rules)) {
        assert.ok(Number.isInteger(count) && count > 0, `${rule}: a positive count`);
        assert.ok(["minor", "moderate"].includes(impact), `${rule} is ${impact}: fix it, do not record it`);
      }
    });
  }
});
