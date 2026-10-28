#!/usr/bin/env node
// The layout audit proven on its own fixtures, in a real browser (yomizaka#435): each broken fixture must be reported, the fine one must not.
// Run before the app is audited, so a guard that stopped seeing is itself a red build.   node scripts/check-page-audit.mjs
import { chromium } from "playwright-core";

import { auditPage, problemsOf } from "./lib/page-audit.mjs";
import { auditContext } from "./lib/settle.mjs";
import { CARD_OVER_NEXT, COLUMN_CUT, FINE, FOLDED_SECTION, HIDDEN_CONTENT, SECTIONS_OVERLAP, TALL_CELL, TOKEN_SQUEEZED } from "./lib/page-audit.fixtures.mjs";

const EXPECT = [
  ["a card taller than its panel", CARD_OVER_NEXT, /overflows its panel/],
  ["a card over the next section", CARD_OVER_NEXT, /covers a neighbouring section/],
  ["two sections on top of each other", SECTIONS_OVERLAP, /covers a neighbouring section/],
  ["a column cut by a clipping wrapper", COLUMN_CUT, /is cut off/],
  ["a token wrapping one character per line", TOKEN_SQUEEZED, /wraps one character per line/],
];

const browser = await chromium.launch();
const failures = [];
try {
  const page = await (await auditContext(browser, { viewport: { width: 1280, height: 800 } })).newPage();
  for (const [name, html, pattern] of EXPECT) {
    await page.setContent(html);
    const problems = problemsOf("fixture", await page.evaluate(auditPage));
    if (!problems.some((p) => pattern.test(p))) failures.push(`the audit does not see ${name}: ${problems.join(" | ") || "no problem reported"}`);
  }
  for (const [name, html] of [["a fine layout", FINE], ["content that is not drawn (a visually hidden table, a folded details)", HIDDEN_CONTENT], ["a section folded in a details", FOLDED_SECTION], ["a cell stretched by its neighbour", TALL_CELL]]) {
    await page.setContent(html);
    const fine = problemsOf("fixture", await page.evaluate(auditPage));
    if (fine.length) failures.push(`the audit reports ${name}: ${fine.join(" | ")}`);
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`page-audit self-test failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("page-audit self-test: 5 broken layouts seen, the fine ones clean");
