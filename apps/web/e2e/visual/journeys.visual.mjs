// The main journeys of Yomizaka, compared to their baselines (krizaka/.github#375), as the seeded persona Éric (the cast,
// krizaka/.github#356: scripts/demo-seed, CI-only credentials, never a real account).
import { readFileSync } from "node:fs";

import { defineJourneyTests } from "@krizaka/page-audit/visual";
import { expect, test } from "@playwright/test";

const BASE = process.env.VISUAL_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "eric@demo.yomizaka.test";
const SECRET = process.env.E2E_PASSWORD ?? "ci-only-demo-password-0123";
// Rows are stamped with the day of the run: dates are masked, and the browser clock is the moment the seed finished.
const NOW = (() => {
  try {
    return readFileSync(new URL("../../../../.visual-now", import.meta.url), "utf8").trim();
  } catch {
    return undefined;
  }
})();
const LIVE = ["time", "[data-live]"];

/** Signs in through the form, as a person would; the session cookie is kept for the signed-in captures. */
async function signIn(page) {
  await page.goto(new URL("/fr/sign-in", BASE).toString());
  await page.locator("input[type=email]").first().fill(EMAIL);
  await page.locator("input[type=password]").first().fill(SECRET);
  await page.locator("form button[type=submit]").first().click();
  await page.waitForURL(/\/app(\/|\?|$)/, { timeout: 60_000 });
}

/** The report of the first seeded document (its id is random). */
async function firstReport(page, { origin }) {
  await page.goto(new URL("/fr/app/documents", origin).toString());
  const href = await page.locator('a[href*="/app/documents/"]').first().getAttribute("href");
  const id = href?.match(/\/app\/documents\/([^/?#]+)/)?.[1];
  if (!id) throw new Error("no seeded document on the library: is the cast seeded?");
  return `/fr/app/documents/${id}/rapport`;
}

/** The report of the seeded lease whose title holds `words` (Section G on the lease without notice, art. 1904 on the one with illegal clauses; yomizaka#104). */
const reportTitled = (words) => async (page, { origin }) => {
  await page.goto(new URL("/fr/app/documents", origin).toString());
  const href = await page.locator('a[href*="/app/documents/"]', { hasText: words }).first().getAttribute("href");
  const id = href?.match(/\/app\/documents\/([^/?#]+)/)?.[1];
  if (!id) throw new Error(`no seeded document titled « ${words} »: is the cast seeded?`);
  return `/fr/app/documents/${id}/rapport`;
};

/** The seeded applicant file, with two figures typed in the rent-share section (information only, in memory). */
async function firstFile(page, { origin }) {
  await page.goto(new URL("/fr/app/dossiers", origin).toString());
  const href = await page.locator('a[href*="/app/dossiers/"]').first().getAttribute("href");
  const id = href?.match(/\/app\/dossiers\/([^/?#]+)/)?.[1];
  if (!id) throw new Error("no seeded applicant file: is the cast seeded?");
  return `/fr/app/dossiers/${id}`;
}
async function typeRentShare(page) {
  await page.locator("#rent-share-rent").fill("1450");
  await page.locator("#rent-share-income").fill("4200");
  await page.locator('[data-testid="rent-share-result"] p').first().waitFor();
}

defineJourneyTests({
  test,
  expect,
  base: BASE,
  signIn,
  ...(NOW ? { now: NOW } : {}),
  journeys: [
    { name: "landing", path: "/fr", mask: LIVE },
    { name: "pricing", path: "/fr/pricing", mask: LIVE },
    { name: "sign-in", path: "/fr/sign-in" },
    { name: "app-home", path: "/fr/app", session: true, mask: LIVE },
    // The library, where the bookmarks live (#339): the guard they lacked.
    { name: "documents", path: "/fr/app/documents", session: true, mask: LIVE },
    { name: "document-report", path: firstReport, session: true, mask: LIVE },
    // The tenant-shield findings in the report (yomizaka#104): Section G with the deadline and the facts for the TAL; the payment clauses (art. 1904).
    { name: "report-section-g", path: reportTitled("avis du TAL absent"), session: true, mask: LIVE },
    { name: "report-payment-clauses", path: reportTitled("clause illégale"), session: true, mask: LIVE },
    { name: "file-rent-share", path: firstFile, session: true, ready: typeRentShare, mask: LIVE },
    // The first paint of a signed-in page: the HTML the server sent, and the hydrated page while the account query is pending (krizaka-ui#827).
    { name: "app-home", path: "/fr/app", session: true, firstPaint: true, viewports: ["phone"], mask: LIVE },
    { name: "app-home-pending", path: "/fr/app", session: true, firstPaint: { hold: ["**/api/me"] }, viewports: ["phone"], mask: LIVE },
  ],
});
