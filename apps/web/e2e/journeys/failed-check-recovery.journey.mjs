// Journey « failed-check-recovery » (journeys.json): a check that did not finish says why in plain words (no engine name), and Eric
// retries it and reads a report. Words come from the messages, never typed here.
//
// EXPECTED TO FAIL until the report fix lands: krizaka-internal#1900 (guard first, krizaka-internal#1936). The seed has no failed check
// yet (the slice adds one per real cause to the cast, `demo-seed --cast --check`), so today it fails at « the check that did not finish ».
// `test.fail()`, never `skip`: the slice removes the marker when the journey passes.
import { readFileSync } from "node:fs";

import { videoContextOptions } from "@krizaka/page-audit/journey";
import { expect, test } from "@playwright/test";

import { BASE, sessionsFor } from "./session.mjs";

const JOURNEY = JSON.parse(readFileSync(new URL("./journeys.json", import.meta.url), "utf8")).find(
  (j) => j.id === "failed-check-recovery",
);
const FR = JSON.parse(readFileSync(new URL("../../messages/fr.json", import.meta.url), "utf8"));
const FAILED = FR.console.dossiers.check.failed;
// Words of the engine room that a person never reads (the engine, a run id, a stack).
const ENGINE_WORDS = /orazaka|engine|moteur|stack ?trace|exception|runId|run id|ENGINE_/i;

test("a failed check says why in plain words and recovers", async ({ browser }, info) => {
  test.fail(true, "krizaka-internal#1900: a failed check does not say why or recover yet (and the seed has no failed check)");
  const state = await sessionsFor(browser, info.workerIndex).stateFor("eric");
  const context = await browser.newContext({ storageState: state, ...videoContextOptions(JOURNEY, { dir: info.outputDir }) });
  const page = await context.newPage();

  await page.goto(new URL("/fr/app/verifications", BASE).toString());
  const failed = page.getByRole("link", { name: new RegExp(FAILED) }).first();
  await expect(failed, "the check that did not finish is in his list").toBeVisible();
  await failed.click();

  const status = page.getByRole("status").first();
  await expect(status, "one status says what happened").toBeVisible();
  const words = (await status.innerText()).trim();
  expect(words.length, "in plain words").toBeGreaterThan(20);
  expect(words, "without an engine name").not.toMatch(ENGINE_WORDS);

  await page.getByRole("button", { name: FR.console.checks.retry ?? "Réessayer" }).click();
  await expect(page.locator('[data-testid="finding-citation"]').first(), "the retried check ends in a report").toBeVisible({ timeout: 60_000 });
  await context.close();
});
