#!/usr/bin/env node
// The layout audit proven on its own fixtures, in a real browser (yomizaka#435): each broken fixture must be reported, the fine one must not.
// Run before the app is audited, so a guard that stopped seeing is itself a red build.   node scripts/check-page-audit.mjs
import { chromium } from "playwright-core";

import { auditPage, problemsOf } from "./lib/page-audit.mjs";
import { auditContext } from "./lib/settle.mjs";
import { CARD_OVER_NEXT, COLUMN_CUT, FINE, SECTIONS_OVERLAP } from "./lib/page-audit.fixtures.mjs";

const EXPECT = [
  ["a card taller than its panel", CARD_OVER_NEXT, /overflows its panel/],
  ["a card over the next section", CARD_OVER_NEXT, /covers a neighbouring section/],
  ["two sections on top of each other", SECTIONS_OVERLAP, /covers a neighbouring section/],
  ["a column cut by a clipping wrapper", COLUMN_CUT, /is cut off/],
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
  await page.setContent(FINE);
  const fine = problemsOf("fixture", await page.evaluate(auditPage));
  if (fine.length) failures.push(`the audit reports a fine layout: ${fine.join(" | ")}`);
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`page-audit self-test failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("page-audit self-test: 4 broken layouts seen, the fine one clean");
