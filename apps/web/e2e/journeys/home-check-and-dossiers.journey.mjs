// Journey « home-check-and-dossiers » (journeys.json): after signing in, the home offers « Check a document » as the one primary
// action on the first screen, and the dossiers list holds the seeded dossier, which opens. Words come from the messages, never typed here.
//
// EXPECTED TO FAIL until the home lands: krizaka-internal#1898 (guard first, krizaka-internal#1935). `test.fail()`, never `skip`:
// when the home ships this test passes, the run goes red, and the slice removes the marker below.
import { readFileSync } from "node:fs";

import { videoContextOptions } from "@krizaka/page-audit/journey";
import { expect, test } from "@playwright/test";

import { BASE, sessionsFor } from "./session.mjs";

const JOURNEY = JSON.parse(readFileSync(new URL("./journeys.json", import.meta.url), "utf8")).find(
  (j) => j.id === "home-check-and-dossiers",
);
const FR = JSON.parse(readFileSync(new URL("../../messages/fr.json", import.meta.url), "utf8"));
const CHECK = FR.console.shell.checkAction;
const DOSSIER = "Immeuble Laurier (démo)";

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`the home offers « Check a document » and the dossiers (${viewport.width} px)`, async ({ browser }, info) => {
    test.fail(true, "krizaka-internal#1898: the home does not offer « Check a document » yet");
    const state = await sessionsFor(browser, info.workerIndex).stateFor("eric");
    const context = await browser.newContext({
      storageState: state,
      viewport,
      ...videoContextOptions(JOURNEY, { dir: info.outputDir }),
    });
    const page = await context.newPage();

    await page.goto(new URL("/fr/app", BASE).toString());
    const check = page.getByRole("main").getByRole("link", { name: CHECK });
    await expect(check, "« Check a document » is the primary action of the home").toBeVisible();
    await expect(check, "and it stands on the first screen").toBeInViewport();

    await page.goto(new URL("/fr/app/dossiers", BASE).toString());
    const dossier = page.getByRole("link", { name: DOSSIER }).first();
    await expect(dossier, "the seeded dossier is in his list").toBeVisible();
    await dossier.click();
    await expect(page.getByRole("heading", { name: DOSSIER }).first(), "the dossier opens").toBeVisible();
    await context.close();
  });
}
