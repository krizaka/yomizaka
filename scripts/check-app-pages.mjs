#!/usr/bin/env node
// The signed-in pages, rendered in a real browser as the seeded persona (never a real account): every app page has exactly
// one h1, no horizontal overflow at 360, 390 and 1440 px in both themes, no unnamed button, the header's one action on
// screen and named, no console error (the UX review of October 2026, Y1).
//
//   E2E_EMAIL=… E2E_PASSWORD=… node scripts/check-app-pages.mjs --base http://localhost:3000 [--locale fr] [--shots <dir>]
//
// The fixed pages are below; a collection and a document (its checks and its information) are found from the library.
// Exits 1 listing every page × width × theme with a problem. With --shots it also writes a screenshot of each.
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright-core";

import { auditPage, problemsOf } from "./lib/page-audit.mjs";

export const WIDTHS = [360, 390, 1440];
export const THEMES = ["dark", "light"];
export const PAGES = ["/app", "/app/documents", "/app/verifier", "/app/verifications", "/app/verifications?tab=lots", "/app/verifications?q=bail&result=attention,checked&kind=lease&period=year", "/app/recherche", "/app/settings/profil", "/app/settings/securite", "/app/settings/facturation", "/app/settings/stockage", "/app/settings/donnees"];

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

/** Signs in through the form, as a person would; the session cookie then carries the context. */
export async function signIn(page, base, locale, email, password) {
  await page.goto(`${base}/${locale}/sign-in`, { waitUntil: "load" });
  await page.locator("input[type=email]").first().fill(email);
  await page.locator("input[type=password]").first().fill(password);
  await page.locator("form button[type=submit]").first().click();
  await page.waitForURL(/\/app(\/|\?|$)/, { timeout: 60_000 });
}

/** The pages to visit: the fixed list, then one collection and one document found on the library (their tabs). */
export async function discover(page, base, locale) {
  await page.goto(`${base}/${locale}/app`, { waitUntil: "load" });
  const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
  const found = [];
  const collection = hrefs.find((h) => /\/app\/bibliotheque\/[^/]+\/[^/]+$/.test(h ?? ""));
  if (collection) found.push(collection.replace(/^\/(en|fr)/, ""));
  const document = hrefs.find((h) => /\/app\/documents\/[^/]+(\/|$)/.test(h ?? ""));
  if (document) {
    const id = document.match(/\/app\/documents\/([^/?#]+)/)[1];
    found.push(`/app/documents/${id}/rapport`, `/app/documents/${id}/document`);
  }
  return [...PAGES, ...found];
}

export async function check({ base, locale = "fr", email, password, shots }) {
  if (!email || !password) throw new Error("E2E_EMAIL and E2E_PASSWORD are required (the seeded persona)");
  const browser = await chromium.launch();
  const problems = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const probe = await context.newPage();
    await signIn(probe, base, locale, email, password);
    const pages = await discover(probe, base, locale);
    await probe.close();
    const cookies = await context.cookies();
    await context.close();
    for (const theme of THEMES) {
      const ctx = await browser.newContext({ colorScheme: theme });
      await ctx.addCookies(cookies);
      await ctx.addInitScript((t) => {
        try {
          localStorage.setItem("kz-theme", t);
        } catch {}
      }, theme);
      const page = await ctx.newPage();
      let errors = [];
      page.on("console", (m) => {
        if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 140));
      });
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));
      for (const path of pages) {
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
          await page.goto(`${base}/${locale}${path}`, { waitUntil: "load" });
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(300);
          const result = await page.evaluate(auditPage);
          const where = `${path} @${width} ${theme}`;
          problems.push(...problemsOf(where, result, { errors, h1: true, headerAction: true }));
          errors = [];
          if (shots) {
            mkdirSync(shots, { recursive: true });
            await page.screenshot({ path: join(shots, `${path.replace(/[^a-z0-9]+/gi, "_")}-${width}-${theme}.png`), fullPage: false });
          }
        }
      }
      await ctx.close();
    }
    return { problems, pages };
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { problems, pages } = await check({ base: arg("base", "http://localhost:3000"), locale: arg("locale", "fr"), email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD, shots: arg("shots") });
  if (problems.length) {
    console.error(`${problems.length} problem(s) on the signed-in pages:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`signed-in pages: one h1 each, no overflow, the header's action on screen — ${pages.length} pages x ${WIDTHS.length} widths x ${THEMES.length} themes`);
}
