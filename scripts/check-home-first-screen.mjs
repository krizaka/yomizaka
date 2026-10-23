#!/usr/bin/env node
// The home's first screen (the UX review's Y9 — F6, F8): the page starts 24 px under the fixed bar (no void above the hero), and
// at 390 × 844 the product's visual is inside the first screen — both languages, both themes, in a real browser.
//
//   node scripts/check-home-first-screen.mjs --base http://localhost:3000
//
// Exits 1 listing every page × viewport × theme with a problem.
import { chromium } from "playwright-core";

// @fixed: the gap between the bar and the page (`--kz-hero-top` = the bar's bottom + this), the family's « One frame for every page »
export const GAP_PX = 24;
export const TOLERANCE_PX = 6;
export const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];
export const PAGES = ["/fr", "/en"];
export const THEMES = ["dark", "light"];

/** Runs in the page: the bar's bottom, where the page's content starts (its padding box), and the visual's top. */
export const MEASURE = `(() => {
  const rect = (el) => (el ? el.getBoundingClientRect() : null);
  const bar = rect(document.querySelector("nav"));
  const main = document.querySelector("main");
  const mainTop = main ? main.getBoundingClientRect().top + parseFloat(getComputedStyle(main).paddingTop) : null;
  const showcase = rect(document.querySelector('[data-testid="home-visual"]'));
  return { barBottom: bar ? bar.bottom : null, contentTop: mainTop, showcaseTop: showcase ? showcase.top : null };
})()`;

/** The problems of one measure, in words. */
export function problemsOf(m) {
  const where = `${m.path} @${m.width} ${m.theme}`;
  if (m.barBottom === null || m.contentTop === null) return [`${where}: no bar or no main`];
  const out = [];
  const gap = m.contentTop - m.barBottom;
  if (Math.abs(gap - GAP_PX) > TOLERANCE_PX) out.push(`${where}: the page starts ${Math.round(gap)} px under the bar, not ${GAP_PX}`);
  if (m.width < 600 && (m.showcaseTop === null || m.showcaseTop >= m.height)) out.push(`${where}: the product's visual is not on the first screen (top ${m.showcaseTop === null ? "none" : Math.round(m.showcaseTop)} of ${m.height})`);
  return out;
}

export async function check({ base }) {
  const browser = await chromium.launch();
  const problems = [];
  try {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        const ctx = await browser.newContext({ viewport, colorScheme: theme });
        await ctx.addInitScript((t) => {
          try {
            localStorage.setItem("kz-theme", t);
          } catch {
            /* nothing kept */
          }
        }, theme);
        const page = await ctx.newPage();
        for (const path of PAGES) {
          await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 90000 });
          await page.evaluate(() => document.fonts.ready);
          const m = await page.evaluate(MEASURE);
          problems.push(...problemsOf({ ...m, path, theme, ...viewport }));
        }
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
  return problems;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const i = process.argv.indexOf("--base");
  const base = i >= 0 ? process.argv[i + 1] : "http://localhost:3000";
  const problems = await check({ base });
  for (const p of problems) console.error(`check-home-first-screen: ${p}`);
  if (problems.length) process.exit(1);
  console.log(`home first screen: the page 24 px under the bar, the product on a phone's first screen — ${PAGES.length} pages x ${VIEWPORTS.length} viewports x ${THEMES.length} themes`);
}
