#!/usr/bin/env node
// Responsive guard: no horizontal overflow, and no tap target under 44 px in the « Pour qui ? » chips, at every width that
// matters, in both themes and both languages, on the pages a visitor lands on.
//
//   node scripts/check-overflow.mjs --base http://localhost:3111 [--shots <dir>]
//
// Exits 1 listing every page × width × theme that overflows. With --shots it also writes a screenshot of each.
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright-core";

export const WIDTHS = [360, 390, 430, 768, 1024, 1440];
export const THEMES = ["dark", "light"];
export const PAGES = ["/en", "/fr", "/fr/locataire", "/en/freelancer", "/fr/run"];

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

export async function check({ base, shots }) {
  const browser = await chromium.launch();
  const problems = [];
  for (const theme of THEMES) {
    const context = await browser.newContext({ colorScheme: theme });
    await context.addInitScript((t) => {
      try {
        localStorage.setItem("kz-theme", t);
      } catch {}
    }, theme);
    const page = await context.newPage();
    for (const path of PAGES) {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
        const result = await page.evaluate(() => {
          const doc = document.documentElement;
          // An element that pokes out only matters when nothing clips it: decorative layers (aria-hidden) and anything inside a
          // clipping or scrolling ancestor (overflow hidden / clip / auto / scroll) are meant to extend.
          const clipped = (el) => {
            for (let n = el; n && n !== document.body; n = n.parentElement) {
              if (n.getAttribute("aria-hidden") === "true") return true;
              if (n !== el || true) {
                const o = getComputedStyle(n).overflowX;
                if (n !== el && ["hidden", "clip", "auto", "scroll"].includes(o)) return true;
              }
            }
            return false;
          };
          const wide = [...document.querySelectorAll("body *")]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && (r.right > doc.clientWidth + 1 || r.left < -1) && !clipped(el);
            })
            .slice(0, 3)
            .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")}`);
          const chips = [...document.querySelectorAll('[data-testid="audience-picker"] a')].map((a) => Math.round(a.getBoundingClientRect().height));
          return { scroll: doc.scrollWidth, client: doc.clientWidth, wide, chips };
        });
        const where = `${path} @${width} ${theme}`;
        if (result.scroll > result.client) problems.push(`${where}: scrollWidth ${result.scroll} > ${result.client} (${result.wide.join(", ")})`);
        else if (result.wide.length) problems.push(`${where}: elements past the edge (${result.wide.join(", ")})`);
        if (result.chips.some((h) => h < 44)) problems.push(`${where}: a chip is ${Math.min(...result.chips)} px tall (< 44)`);
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
