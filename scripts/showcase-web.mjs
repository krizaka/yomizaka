#!/usr/bin/env node
// The web showcase journeys of the download page (krizaka/.github#315): short recordings made by the e2e job itself, so the
// videos follow the product. Two journeys, on the seeded demo persona Éric (CI) or the dev QA member (never the administrator):
//   web-binder  sign in (on camera in CI: the persona's address is a demo one), the library, the binder (collections), a collection.
//   web-report  a document of the library, then its signed report.
// « Run a check » needs the Orazaka engine, which the CI backend does not have: that step is the landing's `check` clip
// (scripts/landing-journey.mjs, on dev). Nothing personal is on screen: the e-mail shown in the app is hidden, the password
// is a field of dots, the dev banner stays visible.
//
//   E2E_EMAIL=… E2E_PASSWORD=… node scripts/showcase-web.mjs <out-dir> [--base http://localhost:3000] [--locale en|fr] [--sign-in camera|off]
//
// Writes <out-dir>/web-binder.webm and <out-dir>/web-report.webm (no audio is recorded), ready for the app-videos action.
import { mkdirSync, renameSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { flagReader, hideEmail } from "./lib/recording-kit.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const args = process.argv.slice(2);
const flag = flagReader(args);
const outDir = path.resolve(args[0] ?? "showcase-web");
const base = flag("base", "http://localhost:3000");
const locale = flag("locale", "en");
const signInMode = flag("sign-in", "camera");
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
if (!email || !password) throw new Error("E2E_EMAIL and E2E_PASSWORD are required (the seeded persona, never a real account)");
mkdirSync(outDir, { recursive: true });

const VIEWPORT = { width: 1280, height: 800 };
const browser = await chromium.launch();

async function signIn(page, { slow }) {
  await page.goto(`${base}/${locale}/sign-in`, { waitUntil: "networkidle" });
  if (slow) await page.waitForTimeout(800);
  const delay = slow ? 70 : 0;
  await page.locator("input[type=email]").first().pressSequentially(email, { delay });
  await page.locator("input[type=password]").first().pressSequentially(password, { delay });
  if (slow) await page.waitForTimeout(500);
  await page.locator("form button[type=submit]").first().click();
  await page.waitForURL(/\/app(\/|\?|$)/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
}

/** Signed-in state, made off camera, for the journeys that start inside the app. */
async function session() {
  const ctx = await browser.newContext({ viewport: VIEWPORT, colorScheme: "dark", locale });
  const page = await ctx.newPage();
  await signIn(page, { slow: false });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

/** One journey = one context = one video; the file is renamed <id>.webm in the out directory. */
async function record(id, act, storageState) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, colorScheme: "dark", locale, storageState, recordVideo: { dir: outDir, size: VIEWPORT } });
  await ctx.addInitScript(hideEmail);
  const page = await ctx.newPage();
  await act(page);
  await page.waitForTimeout(1500);
  const video = page.video();
  await ctx.close();
  renameSync(await video.path(), path.join(outDir, `${id}.webm`));
  process.stdout.write(`recorded ${id}\n`);
}

const firstDocument = (page) => page.locator('a[href*="/app/documents/"]').first();

const off = signInMode === "off" ? await session() : undefined;

await record(
  "web-binder",
  async (page) => {
    if (signInMode === "camera") await signIn(page, { slow: true });
    else await page.goto(`${base}/${locale}/app`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1800);
    await page.mouse.wheel(0, 360);
    await page.waitForTimeout(1600);
    // The binder's tabs (the collections): the one with the demo leases, then its own page.
    const tab = page.getByText(/Rosemont/).first();
    if (await tab.count()) {
      await tab.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      await tab.click();
      await page.waitForTimeout(1600);
    }
    const open = page.locator('a[href*="/app/library/"]').first();
    if (await open.count()) {
      await open.click();
      await page.locator('a[href*="/app/documents/"]').first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(2600);
    }
  },
  off,
);

const state = off ?? (await session());
await record(
  "web-report",
  async (page) => {
    await page.goto(`${base}/${locale}/app`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await firstDocument(page).click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1800);
    const href = /\/app\/documents\/[^/?#]+/.exec(new URL(page.url()).pathname)?.[0];
    if (!href) throw new Error("no document in the library: the demo data is missing");
    await page.goto(`${base}/${locale}${href}/rapport`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2200);
    await page.mouse.wheel(0, 320);
    await page.waitForTimeout(2000);
  },
  state,
);

await browser.close();
