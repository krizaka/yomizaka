// Journey « home-check-and-dossiers » (journeys.json; krizaka-internal#1898): Eric signs in and, on one screen, sees « Vérifier un
// document » (the drop zone) and his dossiers, then opens one. Run on a desktop and on a phone: the first screen is the promise.
import { readFileSync } from "node:fs";

import { videoContextOptions } from "@krizaka/page-audit/journey";
import { expect, test } from "@playwright/test";

import { BASE, sessionsFor } from "./session.mjs";

const JOURNEY = JSON.parse(readFileSync(new URL("./journeys.json", import.meta.url), "utf8")).find(
  (j) => j.id === "home-check-and-dossiers",
);
const SCREENS = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "phone", viewport: { width: 390, height: 844 } },
];

for (const screen of SCREENS) {
  test(`Eric sees « Vérifier un document » and his dossiers on one screen, then opens one (${screen.name})`, async ({
    browser,
  }, info) => {
    const state = await sessionsFor(browser, info.workerIndex).stateFor("eric");
    const context = await browser.newContext({
      storageState: state,
      viewport: screen.viewport,
      ...(screen.name === "desktop" ? videoContextOptions(JOURNEY, { dir: info.outputDir }) : {}),
    });
    const page = await context.newPage();
    await page.goto(new URL("/fr/app", BASE).toString());

    await expect(page.getByRole("heading", { level: 1 }), "the home is titled Accueil").toHaveText("Accueil");
    const drop = page.getByTestId("library-dropzone");
    await expect(drop, "the drop zone is on the home").toBeVisible();
    const list = page.getByRole("list", { name: "Vos dossiers" });
    await expect(list.getByRole("link", { name: /Immeuble Rosemont/ }), "his dossiers are listed").toBeVisible();

    const box = await drop.boundingBox();
    expect(box && box.y + box.height <= screen.viewport.height, "the drop zone is on the first screen").toBe(true);
    const row = await list.getByRole("link").first().boundingBox();
    expect(row && row.y < screen.viewport.height, "the list starts on the first screen").toBe(true);
    await expect(page.getByRole("link", { name: "Vérifier un document" }).first()).toBeVisible();

    await list.getByRole("link", { name: /Immeuble Rosemont/ }).click();
    await expect(page, "the dossier opens").toHaveURL(/\/app\/library\/[^/]+\/[^/?#]+/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Immeuble Rosemont");
    await context.close();
  });
}
