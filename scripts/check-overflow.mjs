#!/usr/bin/env node
// Responsive guard: no horizontal overflow, and no tap target under 44 px in the « Pour qui ? » chips, at every width that
// matters, in both themes and both languages, on the pages a visitor lands on.
//
//   node scripts/check-overflow.mjs --base http://localhost:3111 [--shots <dir>]
//
// Also fails on a console error or an uncaught exception (a hydration mismatch is one: React error #418).
// Exits 1 listing every page × width × theme that overflows. With --shots it also writes a screenshot of each.
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright-core";

import { auditPage, problemsOf } from "./lib/page-audit.mjs";
import { auditContext, loadSettled, resizeSettled } from "./lib/settle.mjs";

export const WIDTHS = [360, 390, 430, 768, 1024, 1440];
export const THEMES = ["dark", "light"];
export const PAGES = ["/en", "/fr", "/en/privacy", "/fr/privacy", "/en/docs", "/fr/docs", "/en/sign-in", "/fr/sign-in", "/en/forgot-password", "/fr/forgot-password", `/en/reset-password?token=ye1.${"A".repeat(43)}`, "/fr/reset-password", "/fr/verify", "/fr/nope", "/en/nope"];

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

export async function check({ base, shots }) {
  const browser = await chromium.launch();
  const problems = [];
  for (const theme of THEMES) {
    const context = await auditContext(browser, { colorScheme: theme });
    await context.addInitScript((t) => {
      try {
        localStorage.setItem("kz-theme", t);
      } catch {}
    }, theme);
    const page = await context.newPage();
    let errors = [];
    page.on("console", (m) => {
      // A blocked third-party resource is not a page error; a script error and a hydration mismatch are.
      if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 140));
    });
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));
    for (const path of PAGES) {
      for (const width of WIDTHS) {
        await resizeSettled(page, { width, height: 900 });
        // « load » and the faces, not « networkidle »: Next's router prefetches (one RSC stream per link of the bar) can hold
        // Chromium's six connections to the host open on a re-visit, and the page never goes idle (30 s, CI red) while
        // nothing on screen changes. What is measured below — layout — is final once the page and its fonts are loaded.
        await loadSettled(page, `${base}${path}`);
        await page.waitForTimeout(300);
        const result = await page.evaluate(auditPage);
        const where = `${path} @${width} ${theme}`;
        problems.push(...problemsOf(where, result, { errors }));
        errors = [];
        if (shots) {
          mkdirSync(shots, { recursive: true });
          await page.screenshot({ path: join(shots, `${path.replace(/\//g, "_") || "_"}-${width}-${theme}.png`), fullPage: false });
        }
      }
    }
    await context.close();
  }
  await browser.close();
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = await check({ base: arg("base", "http://localhost:3000"), shots: arg("shots") });
  if (problems.length) {
    console.error(`${problems.length} responsive problem(s):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`no horizontal overflow, tap targets >= 44 px: ${PAGES.length} pages x ${WIDTHS.length} widths x ${THEMES.length} themes`);
}
