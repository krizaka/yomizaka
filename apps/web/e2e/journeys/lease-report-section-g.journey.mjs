// Journey « lease-report-section-g » (journeys.json): a tenant opens the report of a lease with no TAL notice and sees
// Section G with its citation. The result the customer reads is asserted, not « the page loaded ».
import { readFileSync } from "node:fs";

import { videoContextOptions } from "@krizaka/page-audit/journey";
import { expect, test } from "@playwright/test";

import { BASE, sessionsFor } from "./session.mjs";

const JOURNEY = JSON.parse(readFileSync(new URL("./journeys.json", import.meta.url), "utf8")).find(
  (j) => j.id === "lease-report-section-g",
);

test("a tenant opens the report of a lease with no TAL notice and sees Section G", async ({ browser }, info) => {
  const state = await sessionsFor(browser, info.workerIndex).stateFor("eric");
  const context = await browser.newContext({
    storageState: state,
    ...videoContextOptions(JOURNEY, { dir: info.outputDir }),
  });
  const page = await context.newPage();

  await page.goto(new URL("/fr/app/documents", BASE).toString());
  const link = page.locator('a[href*="/app/documents/"]', { hasText: "avis du TAL absent" }).first();
  await expect(link, "the seeded lease without a TAL notice is in the library").toBeVisible();
  const href = await link.getAttribute("href");
  const id = href?.match(/\/app\/documents\/([^/?#]+)/)?.[1];
  expect(id, "the library links the lease by its id").toBeTruthy();

  await page.goto(new URL(`/fr/app/documents/${id}/rapport`, BASE).toString());
  const finding = page.locator("#finding-TS-G-001");
  await expect(finding, "the Section G finding is in the report").toBeVisible();
  await expect(finding.locator('[data-testid="finding-citation"]'), "the finding cites its source").toBeVisible();
  await context.close();
});
